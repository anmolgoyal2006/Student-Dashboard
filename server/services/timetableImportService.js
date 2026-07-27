const { generateContentWithInlineData, HEAVY_MODEL } = require('./aiService');
const { renderPDFPagesToImages } = require('./pdfParser');
const { extractJSON } = require('../utils/extractJSON');

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PROMPT = `You extract class timetables from an image of a timetable grid into JSON.

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

How to read the grid — this is an IMAGE, use visual position, not text order:
- The column headers across the top define time ranges. The row labels down
  the side define days. A cell's time range comes from the column(s) it
  visually sits under, and its day comes from the row it visually sits in —
  never infer either from reading order.
- A cell spanning several consecutive columns is ONE slot: use the FIRST
  spanned column's start time and the LAST spanned column's end time.
- The same subject appearing on multiple days produces multiple entries in
  that subject's schedule array — one object per day, not duplicate subjects.
- A lab meeting twice a week is still one subject with two schedule entries.
- Group/section labels ("G1", "B2", "CSE3,CSE4") are not part of the subject
  name and not a room. Drop them unless they are clearly the venue.
- Skip non-teaching cells entirely: LUNCH, BREAK, RECESS, free/blank periods,
  and the header row/column itself.
- Room codes and course codes can look alike; the room is the one printed
  inside the timetable cell, the code is the one in a legend/subject list
  elsewhere on the page, if present.

Never invent a value. If something is genuinely not visible, use "" for
strings and null for credits. Return every subject you find, even if some of
its fields are incomplete. Never drop a row because it is partial.`;

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
    let day = typeof slot?.day === 'string' ? slot.day.trim() : '';
    const dayLower = day.toLowerCase();
    const dayMap = {
      sun: 'Sun', sunday: 'Sun',
      mon: 'Mon', monday: 'Mon',
      tue: 'Tue', tuesday: 'Tue',
      wed: 'Wed', wednesday: 'Wed',
      thu: 'Thu', thursday: 'Thu',
      fri: 'Fri', friday: 'Fri',
      sat: 'Sat', saturday: 'Sat'
    };
    if (dayMap[dayLower]) {
      day = dayMap[dayLower];
    }
    if (!DAYS.includes(day)) {
      issues.push({ field: `schedule.${i}.day`, reason: `"${day || 'blank'}" is not a valid day.` });
    }
    let startTime = slot?.startTime || '';
    if (/^\d:[0-5]\d$/.test(startTime)) {
      startTime = '0' + startTime;
    }
    let endTime = slot?.endTime || '';
    if (/^\d:[0-5]\d$/.test(endTime)) {
      endTime = '0' + endTime;
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
      issues.push({ field: `schedule.${i}.startTime`, reason: 'Time must be in 24-hour HH:MM form.' });
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) {
      issues.push({ field: `schedule.${i}.endTime`, reason: 'Time must be in 24-hour HH:MM form.' });
    }

    return {
      day,
      startTime,
      endTime,
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

async function parseTimetablePDF(buffer) {
  let images;
  try {
    images = await renderPDFPagesToImages(buffer);
  } catch (err) {
    const e = new Error('That PDF could not be read. It may be corrupted or password-protected.');
    e.code = 'UNREADABLE_PDF';
    throw e;
  }

  if (!images || images.length === 0) {
    const e = new Error('That PDF has no pages to read.');
    e.code = 'UNREADABLE_PDF';
    throw e;
  }

  const parts = images.map(img => ({
    inlineData: { mimeType: img.mimeType, data: img.data },
  }));
  parts.push({ text: PROMPT });

  const rawText = await generateContentWithInlineData(parts, {
    model: HEAVY_MODEL,
    temperature: 0,
    maxOutputTokens: 8000,
    responseMimeType: 'application/json',
  });

  const parsed = extractJSON((rawText || '').trim());
  const subjects = Array.isArray(parsed?.subjects) ? parsed.subjects : null;

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
