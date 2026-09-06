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
- startTime / endTime: 24-hour "HH:MM". Preserve exact minutes as printed in the header/cell time (e.g., "08:30" to "09:30", "09:30" to "10:30", "13:30" to "14:30", "14:30" to "15:30"). Never round minutes to whole hours (do not turn 9:30 into 9:00).
- room: venue, e.g. "L21", "402+L407", "Room No 406", "Room No 215".

How to parse each cell item:
- You are given a JSON array of cell objects. Each object has "day", "time" (e.g. "08:30-09:30", "09:30-10:30", "14:30-16:30"), and "content".
- Note that sometimes the day and time headers might be swapped in the PDF (e.g., the "day" field contains a time range and the "time" field contains a weekday). Identify which field holds the weekday and which holds the time, and map them correctly to "day", "startTime", and "endTime" regardless of the property name.
- Translate the weekday to the standard Sun-Sat value (e.g., "MON" -> "Mon", "TUES" -> "Tue", "onday" -> "Mon", "esday" -> "Tue", "nesday" -> "Wed", "ursday" -> "Thu", "riday" -> "Fri").
- Translate the time range to 24-hour format "HH:MM", preserving exact minutes as printed:
  - "08:30-09:30" -> startTime: "08:30", endTime: "09:30"
  - "09:30-10:30" -> startTime: "09:30", endTime: "10:30"
  - "10:30-11:30" -> startTime: "10:30", endTime: "11:30"
  - "11:30-12:30" -> startTime: "11:30", endTime: "12:30"
  - "12:30-13:30" -> startTime: "12:30", endTime: "13:30"
  - "13:30-14:30" -> startTime: "13:30", endTime: "14:30"
  - "14:30-15:30" -> startTime: "14:30", endTime: "15:30"
  - "14:30-16:30" -> startTime: "14:30", endTime: "16:30"
- Dynamic Breaks: Lunch/recess breaks are dynamic per timetable (e.g. 13:30-14:30, 12:00-13:00, 13:00-14:00, marked as -X-, LUNCH, BREAK, RECESS). Skip non-teaching break cells entirely. Do NOT assume lunch is always 13:00-14:00.
- Extract course name, code, instructor, and room from content.
- If a cell's "content" contains multiple class blocks (e.g. for different groups/sections like Gp 1, Gp 2, Gp 3), split them into separate schedule entries for each group/subject slot sharing the same day, time, and respective room.
- Fold duplicate subjects together into single subject objects with multiple schedule slots.`;

function extractStructuredTableFromPDF(buffer) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../scripts/extractTable.py');
    const trySpawn = (cmd) => new Promise((res, rej) => {
      const py = spawn(cmd, [scriptPath]);
      let stdout = '';
      let stderr = '';
      py.stdout.on('data', data => stdout += data);
      py.stderr.on('data', data => stderr += data);
      py.on('error', rej);
      py.stdin.on('error', () => { /* ignore stdin EPIPE/EOF errors if child exits early */ });
      py.on('close', code => {
        if (code !== 0) {
          rej(new Error(stderr || `Python script exited with code ${code}`));
        } else {
          try {
            res(JSON.parse(stdout));
          } catch (err) {
            rej(err);
          }
        }
      });
      if (py.stdin.writable) {
        py.stdin.write(buffer);
        py.stdin.end();
      }
    });

    const primaryCmd = process.platform === 'win32' ? 'python' : 'python3';
    const fallbackCmd = process.platform === 'win32' ? 'python3' : 'python';

    trySpawn(primaryCmd)
      .then(resolve)
      .catch(() => trySpawn(fallbackCmd).then(resolve).catch(reject));
  });
}


const PROMPT = `You extract class timetables from an image of a timetable grid into JSON.

Return ONLY a JSON object of this exact shape:
{"subjects":[{"name":"","code":"","instructor":"","credits":null,"schedule":[{"day":"","startTime":"","endTime":"","room":""}]}]}

Field rules — these names are fixed, do not rename or add fields:
- name: the subject/course title. Required. Clean up section/group markers like (Pr) Gp 1, Gp 2 from the subject name.
- code: the course code exactly as printed (e.g. "CS201"). "" if absent.
- instructor: teacher name (e.g. "Dr. Ankit Gupta", "Dr. Sunil k Singh"). "" if absent.
- credits: a number 1-6, or null if not printed. Never guess.
- day: one of Sun, Mon, Tue, Wed, Thu, Fri, Sat. Map abbreviations, full names, or cropped margins
  (Monday/onday -> Mon, Tuesday/esday -> Tue, Wednesday/nesday -> Wed, Thursday/ursday -> Thu, Friday/riday -> Fri, Saturday/urday -> Sat, Sunday/unday -> Sun).
- startTime / endTime: 24-hour "HH:MM". Preserve exact minutes as printed in column headers (e.g. "08:30" to "09:30", "09:30" to "10:30", "10:30" to "11:30", "13:30" to "14:30", "14:30" to "15:30", "14:30" to "16:30"). NEVER round 09:30 to 09:00 or 14:30 to 14:00.
- room: room/venue as printed (e.g. "Room No 406", "Room No 206", "Room No 215", "Room No 419"). "" if absent.

How to read the grid — this is an IMAGE, use visual position, not text order:
- The column headers across the top define exact time ranges (e.g. 08:30-09:30, 09:30-10:30, 10:30-11:30, 11:30-12:30, 12:30-13:30, 13:30-14:30, 14:30-15:30, 15:30-16:30). The row labels down the side define days. A cell's time range comes strictly from the column(s) it visually sits under, and its day comes from the row it visually sits in.
- Dynamic Lunch / Break Times: Lunch breaks vary per institution and timetable. Read the exact time range of the break column (e.g. 13:30-14:30, 12:30-13:30, 12:00-13:00, 13:00-14:00, marked as -X-, LUNCH, BREAK, RECESS) and skip non-teaching cells entirely. Do NOT assume lunch is always 13:00-14:00.
- A cell's duration is determined strictly by the vertical grid lines separating the columns. A cell spanning several consecutive time columns is ONE slot: use the FIRST spanned column's start time and the LAST spanned column's end time. For example, if a 2-hour Lab cell spans 14:30-15:30 and 15:30-16:30, it is a single slot from 14:30 to 16:30.
- Parallel Lab / Group Rows: A day row may be divided into sub-rows for different practical groups (Gp 1, Gp 2, Gp 3). Extract each parallel group slot with its respective subject, instructor, and room.
- Skip non-teaching cells (-X-, LUNCH, BREAK, RECESS) and header rows/columns entirely.
- Return every subject found. Fold duplicate subjects into single entries with multiple schedule entries.`;

const TEXT_PROMPT = `You extract class timetables from the text of a timetable grid into JSON.

Return ONLY a JSON object of this exact shape:
{"subjects":[{"name":"","code":"","instructor":"","credits":null,"schedule":[{"day":"","startTime":"","endTime":"","room":""}]}]}

Field rules — these names are fixed, do not rename or add fields:
- name: the subject/course title. Required.
- code: the course code exactly as printed (e.g. "CS201"). "" if absent.
- instructor: teacher name. "" if absent.
- credits: a number 1-6, or null if not printed. Never guess.
- day: one of Sun, Mon, Tue, Wed, Thu, Fri, Sat. Map cropped day margins (onday->Mon, esday->Tue, nesday->Wed, ursday->Thu, riday->Fri).
- startTime / endTime: 24-hour "HH:MM". Preserve exact printed minutes (e.g., "08:30", "09:30", "10:30", "13:30", "14:30"). Never round 9:30 to 9:00.
- room: room/venue as printed. "" if absent.

How to read the text:
- The extracted text represents a grid layout. The column headers define dynamic time ranges (e.g. 08:30-09:30, 09:30-10:30, 10:30-11:30, 13:30-14:30, 14:30-15:30) and the rows represent days of the week.
- Match subjects to their exact day row and time column.
- Dynamic Breaks: Lunch/recess breaks are dynamic per timetable (e.g. 13:30-14:30, 12:00-13:00, 13:00-14:00, -X-). Skip break slots entirely. Do NOT assume lunch is always 13:00-14:00.
- Return every subject found.`;

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
      sun: 'Sun', sunday: 'Sun', unday: 'Sun',
      mon: 'Mon', monday: 'Mon', onday: 'Mon',
      tue: 'Tue', tuesday: 'Tue', esday: 'Tue',
      wed: 'Wed', wednesday: 'Wed', nesday: 'Wed',
      thu: 'Thu', thursday: 'Thu', ursday: 'Thu',
      fri: 'Fri', friday: 'Fri', riday: 'Fri',
      sat: 'Sat', saturday: 'Sat', urday: 'Sat',
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
 * Slots that share the exact same time window but are in different rooms are
 * treated as parallel/combined sections (common in Indian university timetables
 * where two groups share a lecture block) and are NOT flagged as conflicts.
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
            // Skip parallel/combined-section slots: exact same window in
            // different rooms. These are common in Indian timetables where two
            // subjects share a combined lecture block (e.g. CSN5003 SE in L407
            // and CSN5002 SC in L406 both at Thu 11:00-12:00).
            const exactSameWindow = (aStart === bStart && aEnd === bEnd);
            const differentRooms = (slotA.room || '') !== (slotB.room || '') &&
                                   (slotA.room || '').trim() !== '' &&
                                   (slotB.room || '').trim() !== '';
            if (exactSameWindow && differentRooms) continue;

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
  let plumberLayoutText = '';

  // 1. In non-test environments, try structured table parsing using pdfplumber first
  if (process.env.NODE_ENV !== 'test') {
    try {
      const tableData = await extractStructuredTableFromPDF(buffer);
      if (Array.isArray(tableData?.pages)) {
        plumberLayoutText = tableData.pages.map(p => p.text).filter(Boolean).join('\n\n');
      }
      const gridTable = tableData?.pages?.[0]?.tables?.[0];
      if (gridTable && gridTable.length > 1) {
        const headers = gridTable[0];
        const cellsWithTimes = [];

        // Normalise a cell's text for dedup comparison:
        // collapse whitespace + newlines so minor line-break differences
        // (e.g. "DBMS\nLab" vs "DBMS Lab") don't prevent adjacent-cell merging.
        const normalizeCell = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

        for (let r = 1; r < gridTable.length; r++) {
          const row = gridTable[r];
          const dayName = row[0];

          // Merge adjacent cells with identical (normalised) content — e.g. a
          // 2-hour lab that pdfplumber extracts as two 1-hour cells with the
          // same subject text (possibly with different internal line-breaks).
          const mergedCells = [];
          for (let c = 1; c < row.length; c++) {
            const content = (row[c] || '').trim();
            if (!content || /^(LUNCH|BREAK|RECESS|-X-|- X -|---|--|-)$/i.test(content)) continue;

            const last = mergedCells[mergedCells.length - 1];
            // Collapse into previous cell if same day + same normalised content
            // and the column is strictly adjacent.
            if (last && normalizeCell(last.content) === normalizeCell(content) && last.endCol === c - 1) {
              last.endCol = c;
            } else {
              mergedCells.push({ startCol: c, endCol: c, content });
            }
          }

          for (const cell of mergedCells) {
            // Build a composite time range from the first-column and last-column headers.
            const startHeader = (headers[cell.startCol] || '').replace(/\n/g, ' ').trim();
            const endHeader   = (headers[cell.endCol]   || '').replace(/\n/g, ' ').trim();

            // Extract the start time from startHeader and end time from endHeader.
            // Header format examples: "9:00-10:00", "3:00-4:00", "5:00- 7:00"
            const startMatch = startHeader.match(/^(\d{1,2}:\d{2})/);
            const endMatch   = endHeader.match(/-\s*(\d{1,2}:\d{2})\s*$/);

            let timeStr;
            if (startMatch && endMatch && cell.startCol !== cell.endCol) {
              // Multi-column merged cell → span from first start to last end
              timeStr = `${startMatch[1]}-${endMatch[1]}`;
            } else {
              timeStr = startHeader;
            }

            cellsWithTimes.push({
              day: dayName,
              time: timeStr,
              content: cell.content,
            });
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
  let text = plumberLayoutText || '';
  const hasParsedSubjects = parsedJson?.subjects && parsedJson.subjects.length > 0;
  if (!hasParsedSubjects) {
    if (!text) {
      try {
        text = await extractTextFromPDF(buffer);
      } catch (err) {
        console.warn('[Timetable Import] Text extraction failed:', err.message);
      }
    }

    hasText = text && text.trim().length > 15;
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
      model: LIGHT_MODEL,
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
