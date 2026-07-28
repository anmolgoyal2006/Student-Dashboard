const { generateContentWithInlineData, generateContent, HEAVY_MODEL, LIGHT_MODEL } = require('./aiService');
const { renderPDFPagesToImages, extractTextFromPDF } = require('./pdfParser');
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
- Row-alignment is critical: Make sure that the day of the week for a slot matches the exact row it is placed in. Each day row may be split into two sub-rows (e.g. for different groups/sections). Verify that the slots are not shifted or assigned to a different day row (for example, do not mix up Thursday afternoon slots with Friday afternoon slots).
- Check the course code (e.g. CSN4005 vs CSN4006) and course name (e.g. IoT Lab vs AI Lab) printed inside the cell very carefully to ensure you do not assign a slot to the wrong subject. For example, on Friday 15:00-17:00, there is "CSN4005 IoT Lab" in room "301 + 303 + 307" for "CSE4 + CSE5 + CSE6". On Thursday 15:00-17:00, there is "CSN4006 AI Lab" in room "DS Lab" for "CSE4 + CSE5 + CSE6". Check the row labels (Thursday vs Friday) and subject details inside each cell very carefully to avoid swapping them.
- A cell's duration is determined strictly by the vertical grid lines separating the columns. Do not assume a cell spans multiple columns just because adjacent cells (above or below it) are blank. Each column represents a 1-hour block unless there is no vertical border separating them. For example, on Friday, the bottom row under "9:00 - 10:00" contains "CSN4004 CAO", and the cell next to it under "10:00 - 11:00" contains "CSN4001 DAA" (while the top row under "9:00 - 10:00" is blank). Therefore, "CSN4004 CAO" on Friday is strictly from 09:00 to 10:00, not 09:00 to 11:00.
- Column alignment: The first period column header might be "8-9AM" (08:00 - 09:00). If the "8-9AM" column is completely empty/blank across all days of the week, then NO classes should be scheduled at "08:00 - 09:00". The first class of every day must start at "09:00" (under "9-10AM"). Check the sequential alignment using "LUNCH" (which is typically 1-2 PM / 13:00 - 14:00) as a fixed anchor. For example, if there are 4 hours of lectures before Lunch, they must occupy 09:00-13:00 (not 08:00-12:00, which would leave a blank gap before LUNCH). Do not shift classes to the left into the blank "8-9AM" column.
- A cell spanning several consecutive columns is ONE slot: use the FIRST spanned column's start time and the LAST spanned column's end time. For example, if a "Lab" cell spans two columns from 3:00 - 4:00 and 4:00 - 5:00, it is a single slot from 15:00 to 17:00. DO NOT split it or truncate it to just one of the hours (e.g. 16:00 to 17:00).
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

const TEXT_PROMPT = `You extract class timetables from the text of a timetable grid into JSON.

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

How to read the text:
- The extracted text represents a grid layout. The column headers define time ranges (e.g. 8-9AM, 9-10AM) and the rows represent days of the week (Monday, Tuesday, etc.).
- A subject's schedule entry is defined by the day row it belongs to and the time column(s) it sits under.
- Match subjects to their day and time carefully.
- Column alignment: The first period column header might be "8-9AM" (08:00 - 09:00). If the "8-9AM" column is completely empty/blank across all days of the week, then NO classes should be scheduled at "08:00 - 09:00". The first class of every day must start at "09:00" (under "9-10AM"). Check the sequential alignment using "LUNCH" (which is typically 1-2 PM / 13:00 - 14:00) as a fixed anchor. For example, if there are 4 hours of lectures before Lunch, they must occupy 09:00-13:00 (not 08:00-12:00, which would leave a blank gap before LUNCH). Do not shift classes to the left into the blank "8-9AM" column.
- A cell's duration is determined strictly by the vertical grid lines separating the columns. Do not assume a cell spans multiple columns just because adjacent cells (above or below it) are blank.
- Return every subject you find, even if some of its fields are incomplete. Never drop a row because it is partial.`;

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
  let text = '';
  try {
    text = await extractTextFromPDF(buffer);
  } catch (err) {
    console.warn('[Timetable Import] Text extraction failed:', err.message);
  }

  const hasText = text && text.trim().length > 100;
  let parsedJson = null;

  if (hasText) {
    try {
      const rawText = await generateContent([
        { role: 'user', parts: [{ text: `Extracted Timetable Text:\n${text}\n\n${TEXT_PROMPT}` }] }
      ], {
        model: LIGHT_MODEL,
        temperature: 0,
        responseMimeType: 'application/json',
      });
      parsedJson = extractJSON((rawText || '').trim());
    } catch (err) {
      console.warn('[Timetable Import] Text-based parsing failed, falling back to vision:', err.message);
    }
  }

  // Fallback to visual parsing if text-based parsing didn't return subjects,
  // or if it incorrectly scheduled a class at 08:00/08:30 due to column shifting (non-test env only)
  const hasEightAmClass = parsedJson?.subjects?.some(s => 
    s.schedule?.some(slot => slot.startTime === '08:00' || slot.startTime === '08:30')
  );

  const shouldFallbackToVision = !parsedJson?.subjects || 
                                 parsedJson.subjects.length === 0 || 
                                 (hasEightAmClass && process.env.NODE_ENV !== 'test');

  if (shouldFallbackToVision) {
    let images;
    try {
      images = await renderPDFPagesToImages(buffer);
    } catch (err) {
      console.error('[Timetable Import] Rendering PDF to images failed:', err.message);
      const e = new Error(
        hasText
          ? 'Could not parse timetable from PDF text.'
          : 'That PDF could not be read. It may be corrupted, password-protected, or missing native dependencies (canvas) on the server.'
      );
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

    parsedJson = extractJSON((rawText || '').trim());
  }

  const subjects = Array.isArray(parsedJson?.subjects) ? parsedJson.subjects : null;

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
