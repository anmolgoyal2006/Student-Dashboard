const { chatCompletionsCreate, HEAVY_MODEL } = require('./aiService');
const { extractTextFromPDF } = require('./pdfParser');
const { extractJSON } = require('../utils/extractJSON');

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// pdf-parse returns '' for scanned/image-only PDFs — there is no text layer to
// send to the model, and doing so would burn a HEAVY_MODEL call on whitespace.
const MIN_TEXT_LENGTH = 40;

const PROMPT = `You extract class timetables from raw PDF text into JSON.

Return ONLY a JSON object of this exact shape:
{"subjects":[{"name":"","code":"","instructor":"","credits":null,"schedule":[{"day":"","startTime":"","endTime":"","room":""}]}]}

Field rules — these names are fixed, do not rename or add fields:
- name: the subject/course title. Required.
- code: the course code exactly as printed (e.g. "CS201"). "" if absent.
- instructor: teacher name. "" if absent.
- credits: a number 1-6, or null if not printed. Never guess.
- day: one of Sun, Mon, Tue, Wed, Thu, Fri, Sat. Map abbreviations
  (MON/M/Monday -> Mon, TUES/TUE -> Tue, THURS/THU/TH -> Thu, etc).
- startTime / endTime: 24-hour "HH:MM". Convert 12-hour times ("2:00 PM" ->
  "14:00"). A timetable running 9-5 with a bare "1:00" start means "13:00".
- room: room/venue as printed. "" if absent.

Real-world layouts you must handle:
- A cell spanning several consecutive periods is ONE slot: use the first
  period's start and the last period's end.
- The same subject appearing on multiple days produces multiple entries in
  that subject's schedule array — one object per day, not duplicate subjects.
- A lab meeting twice a week is still one subject with two schedule entries.
- Group/section labels ("G1", "B2", "CSE3,CSE4") are not part of the subject
  name and not a room. Drop them unless they are clearly the venue.
- Skip non-teaching rows entirely: LUNCH, BREAK, RECESS, free/blank periods,
  and header rows repeating the day names.
- Room codes and course codes can look alike; the room is the one printed
  inside the timetable cell, the code is the one in a legend/subject list.

Never invent a value. If something is genuinely not in the text, use "" for
strings and null for credits. Return every subject you find, even if some of
its fields are incomplete. Never drop a row because it is partial.`;

/**
 * Validates one model-produced entry against what the Subject schema and the
 * route validators actually accept. Returns the cleaned entry plus a list of
 * per-field problems — nothing is dropped or corrected silently, the user
 * confirms everything in the preview before it reaches the DB.
 */
function flagEntry(raw) {
  const issues = [];
  const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
  if (!name) issues.push({ field: 'name', reason: 'Missing subject name.' });

  let credits = raw?.credits;
  if (credits === '' || credits === undefined) credits = null;
  if (credits !== null) {
    credits = Number(credits);
    if (!Number.isFinite(credits) || credits < 1 || credits > 6) {
      issues.push({ field: 'credits', reason: 'Credits must be a number from 1 to 6.' });
      credits = null;
    }
  }

  const schedule = (Array.isArray(raw?.schedule) ? raw.schedule : []).map((slot, i) => {
    const day = typeof slot?.day === 'string' ? slot.day.trim() : '';
    if (!DAYS.includes(day)) {
      issues.push({ field: `schedule.${i}.day`, reason: `"${day || 'blank'}" is not a valid day.` });
    }
    for (const key of ['startTime', 'endTime']) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(slot?.[key] || '')) {
        issues.push({ field: `schedule.${i}.${key}`, reason: 'Time must be in 24-hour HH:MM form.' });
      }
    }
    return {
      day,
      startTime: slot?.startTime || '',
      endTime: slot?.endTime || '',
      room: typeof slot?.room === 'string' ? slot.room.trim() : '',
    };
  });

  if (schedule.length === 0) {
    issues.push({ field: 'schedule', reason: 'No class times found for this subject.' });
  }

  return {
    entry: {
      name,
      code: typeof raw?.code === 'string' ? raw.code.trim() : '',
      instructor: typeof raw?.instructor === 'string' ? raw.instructor.trim() : '',
      credits,
      schedule,
    },
    issues,
  };
}

/**
 * Folds rows that are the same course into one, before any flagging. A
 * timetable often lists a course once per teacher or once per session block;
 * createSubject dedupes by name on write, so leaving them split would silently
 * drop every slot after the first. Schedules concatenate, first non-empty
 * scalar wins. Runs on raw model output, so every field is treated as untrusted.
 */
function mergeDuplicates(subjects) {
  const byKey = new Map();
  for (const raw of subjects) {
    const entry = {
      ...raw,
      schedule: Array.isArray(raw?.schedule) ? raw.schedule : [],
    };
    const key = String(raw?.code || raw?.name || '').trim().toLowerCase();
    const seen = key && byKey.get(key);
    if (!seen) {
      byKey.set(key || Symbol('unnamed'), entry);
      continue;
    }
    seen.schedule = [...seen.schedule, ...entry.schedule];
    seen.name = seen.name || entry.name;
    seen.instructor = seen.instructor || entry.instructor;
    seen.credits = seen.credits ?? entry.credits;
  }
  return [...byKey.values()];
}

/**
 * Reads a timetable PDF and returns candidate subjects for user review.
 * Throws an error carrying `.code` so the controller can map it to a status.
 */
async function parseTimetablePDF(buffer) {
  let text;
  try {
    text = await extractTextFromPDF(buffer);
  } catch (err) {
    const e = new Error('That PDF could not be read. It may be corrupted or password-protected.');
    e.code = 'UNREADABLE_PDF';
    throw e;
  }

  if (!text || text.trim().length < MIN_TEXT_LENGTH) {
    const e = new Error('No readable text found in that PDF.');
    e.code = 'NO_TEXT';
    e.hint = 'Scanned or photographed timetables have no text layer. Export the PDF from your portal, or add the subjects manually.';
    throw e;
  }

  const completion = await chatCompletionsCreate({
    model: HEAVY_MODEL,
    messages: [
      { role: 'system', content: PROMPT },
      { role: 'user', content: text },
    ],
    temperature: 0,
    // A full week of subjects with every slot runs well past the 1000-token
    // default; truncated output parses as null and looks like "no timetable".
    max_tokens: 8000,
    response_format: { type: 'json_object' },
  });

  const parsed = extractJSON(completion.choices[0]?.message?.content?.trim() ?? '');
  const subjects = Array.isArray(parsed?.subjects) ? parsed.subjects : null;

  // An empty array means the model read the text fine and found no classes in
  // it — a marks sheet or syllabus. That is the same dead end for the user as
  // unparseable output, so it gets the same 422 rather than an empty success.
  if (!subjects || subjects.length === 0) {
    const e = new Error('Could not find any classes in that PDF.');
    e.code = 'NO_TIMETABLE';
    e.hint = 'Make sure the file is a class timetable — result sheets and syllabi have no schedule to import.';
    throw e;
  }

  const results = mergeDuplicates(subjects).map(flagEntry);
  return {
    entries: results.map((r, i) => ({ ...r.entry, index: i, issues: r.issues })),
    flagged: results.reduce((n, r) => n + (r.issues.length > 0 ? 1 : 0), 0),
  };
}

module.exports = { parseTimetablePDF, flagEntry, mergeDuplicates };
