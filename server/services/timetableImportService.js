const { spawn } = require('child_process');
const path = require('path');
const { generateContentWithInlineData, generateContent, HEAVY_MODEL, LIGHT_MODEL } = require('./aiService');
const { renderPDFPagesToImages, extractTextFromPDF } = require('./pdfParser');
const { extractJSON } = require('../utils/extractJSON');

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const GRID_PROMPT = `You extract class timetables from a structured list of timetable grid cells with explicit times.

Return ONLY a JSON object of this exact shape:
{"subjects":[{"name":"","code":"","instructor":"","credits":null,"schedule":[{"day":"","startTime":"","endTime":"","room":""}]}]}

Field rules:
- name: course name, e.g. "Software Engineering", "SE", "TOC". Clean up section markers like (G1) or (CSE3, CSE4). Never include them.
- code: course code, e.g. "CSN5003", "CSN5001+AIN5001".
- instructor: e.g. "Dr. Ashpreet".
- credits: number or null.
- day: Sun, Mon, Tue, Wed, Thu, Fri, Sat.
- startTime / endTime: 24-hour "HH:MM".
- room: venue, e.g. "L21", "402+L407".

How to parse each cell item:
- You are given a JSON array of cell objects. Each object has "day", "time" (e.g. "9:00-10:00", "5:00- 7:00"), and "content".
- Note that sometimes the day and time headers might be swapped in the PDF (e.g., the "day" field contains a time range and the "time" field contains a weekday). Identify which field holds the weekday and which holds the time, and map them correctly to "day", "startTime", and "endTime" regardless of the property name.
- Translate the weekday to the standard Sun-Sat value (e.g., "MON" -> "Mon", "TUES" -> "Tue").
- Translate the time to 24-hour format:
  - "9:00-10:00" -> 09:00 - 10:00.
  - "11:00-12:00" -> 11:00 - 12:00.
  - "12:00-1:00" -> 12:00 - 13:00.
  - "2:00-3:00" -> 14:00 - 15:00.
  - "3:00-4:00" -> 15:00 - 16:00.
  - "4:00-5:00" -> 16:00 - 17:00.
  - "5:00- 7:00" -> 17:00 - 19:00.
- Extract the course name, course code, instructor, and room from the "content" text.
- If a cell's "content" contains multiple class blocks (separated by newlines/spaces), split them into separate schedule slots for those subjects. For example, if "content" has SC on line 1 and SE on line 2, split them into two slots (one for SC, one for SE) sharing the same day and time.
- Ensure all courses are correctly grouped by name/code, and fold duplicate subjects together.`;

function extractStructuredTableFromPDF(buffer) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../scripts/extractTable.py');
    const py = spawn('python', [scriptPath]);
    
    let stdout = '';
    let stderr = '';
    
    py.stdout.on('data', data => stdout += data);
    py.stderr.on('data', data => stderr += data);
    
    py.on('close', code => {
      if (code !== 0) {
        reject(new Error(stderr || `Python script exited with code ${code}`));
      } else {
        try {
          resolve(JSON.parse(stdout));
        } catch (err) {
          reject(err);
        }
      }
    });
    
    py.on('error', err => reject(err));
    
    py.stdin.write(buffer);
    py.stdin.end();
  });
}


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

/**
 * Detect scheduling conflicts across all subjects in the parsed set.
 *
 * A conflict is any pair of distinct subjects (A, B) that share the same day
 * and have overlapping time windows (start < other.end && end > other.start).
 *
 * Returns an array of conflict descriptors added as `issues` entries on the
 * affected subject entries (mutates `results` in place), and also returns a
 * flat list for logging.
 *
 * @param {Array<{entry: object, issues: Array}>} results - output of flagEntry
 * @returns {number} number of conflicts detected
 */
function detectAndFlagConflicts(results) {
  const toMin = (t) => {
    if (!t || !/^\d\d:\d\d$/.test(t)) return -1;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  let conflictCount = 0;

  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      const a = results[i].entry;
      const b = results[j].entry;

      for (const slotA of (a.schedule || [])) {
        for (const slotB of (b.schedule || [])) {
          if (slotA.day !== slotB.day) continue;

          const aStart = toMin(slotA.startTime);
          const aEnd   = toMin(slotA.endTime);
          const bStart = toMin(slotB.startTime);
          const bEnd   = toMin(slotB.endTime);

          if (aStart < 0 || aEnd < 0 || bStart < 0 || bEnd < 0) continue;

          // Overlap: A starts before B ends AND A ends after B starts
          if (aStart < bEnd && aEnd > bStart) {
            const msg = `Conflicts with "${b.name}" on ${slotA.day} (${slotA.startTime}–${slotA.endTime} overlaps ${slotB.startTime}–${slotB.endTime})`;
            results[i].issues.push({ field: 'schedule', reason: msg, conflict: true });

            const msgB = `Conflicts with "${a.name}" on ${slotB.day} (${slotB.startTime}–${slotB.endTime} overlaps ${slotA.startTime}–${slotA.endTime})`;
            results[j].issues.push({ field: 'schedule', reason: msgB, conflict: true });

            conflictCount++;
          }
        }
      }
    }
  }

  return conflictCount;
}

async function parseTimetablePDF(buffer) {
  let parsedJson = null;
  let hasText = false;

  // 1. In non-test environments, try structured table parsing using pdfplumber first
  if (process.env.NODE_ENV !== 'test') {
    try {
      const tableData = await extractStructuredTableFromPDF(buffer);
      const gridTable = tableData?.pages?.[0]?.tables?.[0];
      if (gridTable && gridTable.length > 1) {
        const headers = gridTable[0];
        const cellsWithTimes = [];
        
        for (let r = 1; r < gridTable.length; r++) {
          const row = gridTable[r];
          const dayName = row[0];
          for (let c = 1; c < row.length; c++) {
            const cellContent = row[c];
            if (cellContent && cellContent.trim() && !/LUNCH|BREAK|RECESS/i.test(cellContent)) {
              const timeHeader = headers[c] || '';
              cellsWithTimes.push({
                day: dayName,
                time: timeHeader.replace(/\n/g, ' '),
                content: cellContent
              });
            }
          }
        }

        const rawText = await generateContent([
          { role: 'user', parts: [{ text: `${GRID_PROMPT}\n\nStructured Grid Cells:\n${JSON.stringify(cellsWithTimes)}` }] }
        ], {
          model: LIGHT_MODEL,
          temperature: 0,
          responseMimeType: 'application/json',
        });
        parsedJson = extractJSON((rawText || '').trim());
        console.log('[Timetable Import] Structured grid parsed successfully.');
      }
    } catch (err) {
      console.warn('[Timetable Import] Structured grid parsing failed, falling back to raw text/vision:', err.message);
    }
  }

  // 2. Fallback to raw plain-text parsing if structured grid parsing didn't return subjects
  let text = '';
  const hasParsedSubjects = parsedJson?.subjects && parsedJson.subjects.length > 0;
  if (!hasParsedSubjects) {
    try {
      text = await extractTextFromPDF(buffer);
    } catch (err) {
      console.warn('[Timetable Import] Text extraction failed:', err.message);
    }

    hasText = text && text.trim().length > 100;
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
        console.warn('[Timetable Import] Text-based parsing failed:', err.message);
      }
    }
  }

  // 3. Fallback to visual parsing if still no subjects, or if we got an 8:00 class (likely alignment shift)
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
  const conflicts = detectAndFlagConflicts(results);
  if (conflicts > 0) {
    console.warn(`[Timetable Import] Detected ${conflicts} schedule conflict(s) across imported subjects.`);
  }
  return {
    entries: results.map((r, i) => ({ ...r.entry, index: i, issues: r.issues })),
    flagged: results.reduce((n, r) => n + (r.issues.length > 0 ? 1 : 0), 0),
    conflicts,
  };
}

module.exports = { parseTimetablePDF, flagEntry, mergeDuplicates, detectAndFlagConflicts };
