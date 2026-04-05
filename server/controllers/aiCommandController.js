const Groq      = require('groq-sdk');
const Subject    = require('../models/Subject');
const Attendance = require('../models/Attendance');
const Marks      = require('../models/Marks');
const Task       = require('../models/Task');
const Semester   = require('../models/Semester.model');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM_PROMPT
// [CHANGED] Added schedule to subject entity + duplicate-prevention example
//           Updated Friday example to use real ISO date
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `
You are a JSON-only command parser for a Student Dashboard app.

YOUR ONLY OUTPUT IS RAW JSON — no explanation, no markdown, no code fences, no extra text.
If you add anything outside the JSON object, the system will break.

ENTITIES AND THEIR FIELDS:
- subject    : { name (string), code (string), credits (number 1-6), instructor (string), schedule: [{ day ("Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat"), startTime ("HH:MM"), endTime ("HH:MM"), room (string) }] }
- attendance : { subjectName (string), status ("present"|"absent"), date (ISO YYYY-MM-DD) }
- marks      : { subjectName (string), examType ("midterm"|"final"|"quiz"|"assignment"|"practical"), marksObtained (number), maxMarks (number), examDate (ISO YYYY-MM-DD) }
- task       : { title (string), description (string), dueDate (ISO YYYY-MM-DD), priority ("low"|"medium"|"high"), category (string) }
- semester   : { semesterNumber (number), semesterName (string), sgpa (number), subjects: [{ name, credits, grade }] }

OUTPUT FORMAT (always exactly this shape):
{
  "action"  : "add" | "update" | "delete" | "get",
  "entity"  : "subject" | "attendance" | "marks" | "task" | "semester",
  "data"    : { ...only the fields that were mentioned or can be safely inferred },
  "message" : "short human-friendly confirmation (max 12 words)"
}

FIELD RULES:
- Omit any field that was NOT mentioned — never fabricate values
- credits: if not mentioned, omit entirely (do not default to any number)
- date / dueDate / examDate: if not mentioned use today's date in ISO format
- For schedule days: "monday"→"Mon", "tuesday"→"Tue", "wednesday"→"Wed", "thursday"→"Thu", "friday"→"Fri", "saturday"→"Sat"
- If time not mentioned but day is mentioned, default startTime to "09:00" and endTime to "10:00"
- status synonyms: "attended"/"went"/"present" → "present" | "missed"/"skipped"/"absent"/"bunked" → "absent"
- grade synonyms: "A plus"→"A+", "B plus"→"B+", "O"→"O", "ex"→"Ex", etc.
- examType synonyms: "mid"/"mids"/"midterm" → "midterm" | "finals"/"end term" → "final" | "test"/"quiz" → "quiz"
- priority synonyms: "urgent"/"asap"/"important" → "high" | "normal" → "medium" | "later"/"someday" → "low"
- For attendance and marks, always use "subjectName" (string) — NOT subjectId

UNKNOWN INTENT:
If you genuinely cannot determine action or entity, return:
{
  "action"  : "unknown",
  "entity"  : "unknown",
  "data"    : {},
  "message" : "I couldn't understand that. Can you rephrase?"
}

EXAMPLES (study these patterns):
User: "Add Maths subject"
→ { "action":"add","entity":"subject","data":{"name":"Maths","code":"MATHS"},"message":"Maths subject added." }

User: "Add Maths subject on Friday"
→ { "action":"add","entity":"subject","data":{"name":"Maths","code":"MATHS","schedule":[{"day":"Fri","startTime":"09:00","endTime":"10:00"}]},"message":"Maths added on Friday 9-10 AM." }

User: "Add Physics on Monday at 11am"
→ { "action":"add","entity":"subject","data":{"name":"Physics","code":"PHYSIC","schedule":[{"day":"Mon","startTime":"11:00","endTime":"12:00"}]},"message":"Physics added on Monday 11 AM." }

User: "I attended Data Structures today"
→ { "action":"add","entity":"attendance","data":{"subjectName":"Data Structures","status":"present","date":"2026-04-05"},"message":"Attendance marked present for Data Structures." }

User: "I scored 45 out of 50 in Physics midterm"
→ { "action":"add","entity":"marks","data":{"subjectName":"Physics","examType":"midterm","marksObtained":45,"maxMarks":50},"message":"Midterm marks added for Physics." }

User: "Add a high priority task to submit assignment by Friday"
→ { "action":"add","entity":"task","data":{"title":"Submit assignment","priority":"high","dueDate":"2026-04-10"},"message":"Task added: Submit assignment." }

User: "Delete the Maths subject"
→ { "action":"delete","entity":"subject","data":{"name":"Maths"},"message":"Maths subject deleted." }
`;

// ─────────────────────────────────────────────────────────────────────────────
// extractJSON — safely pulls the first {...} block from any string
// ─────────────────────────────────────────────────────────────────────────────
function extractJSON(raw) {
  if (!raw) return null;

  try { return JSON.parse(raw); } catch { /* fall through */ }

  const fenceStripped = raw.replace(/```(?:json)?\s*([\s\S]*?)```/i, '$1').trim();
  try { return JSON.parse(fenceStripped); } catch { /* fall through */ }

  const start = raw.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === '{') depth++;
    else if (raw[i] === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(raw.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// validateParsed — checks required top-level shape before any DB access
// ─────────────────────────────────────────────────────────────────────────────
function validateParsed(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  const validActions  = ['add', 'update', 'delete', 'get', 'unknown'];
  const validEntities = ['subject', 'attendance', 'marks', 'task', 'semester', 'unknown'];
  return (
    validActions.includes(parsed.action) &&
    validEntities.includes(parsed.entity) &&
    typeof parsed.data === 'object' &&
    parsed.data !== null
  );
}

const FALLBACK = {
  success: false,
  entity : 'unknown',
  action : 'unknown',
  message: "I couldn't understand that. Please try rephrasing.",
  data   : null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
exports.handleCommand = async (req, res) => {

  const userInput = (req.body.message || req.body.text || '').trim();
  if (!userInput) {
    return res.status(400).json({ ...FALLBACK, message: 'No input provided.' });
  }

  try {
    // ── Step 1: Call Groq ──────────────────────────────────────────────────
    const completion = await groq.chat.completions.create({
      model      : 'llama-3.3-70b-versatile',
      messages   : [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userInput },
      ],
      temperature: 0.1,
      max_tokens : 512,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';

    // ── Step 2: Robust JSON extraction ────────────────────────────────────
    const parsed = extractJSON(raw);

    if (!parsed || !validateParsed(parsed)) {
      console.warn('[AI Command] Unparseable response:', raw);
      return res.json({ ...FALLBACK, raw });
    }

    if (parsed.action === 'unknown' || parsed.entity === 'unknown') {
      return res.json({ success: false, message: parsed.message || FALLBACK.message });
    }

    // ── Step 3: Execute MongoDB action ────────────────────────────────────
    const userId = req.user._id;
    let result   = null;

    // ── SUBJECT ──────────────────────────────────────────────────────────
    if (parsed.entity === 'subject') {
      if (parsed.action === 'add') {

        // Auto-generate code if missing
        if (!parsed.data.code && parsed.data.name) {
          parsed.data.code = parsed.data.name
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 6);
        }

        // [CHANGED] Prevent duplicate subject names for same user
        const existing = await Subject.findOne({
          userId,
          name: new RegExp(`^${parsed.data.name}$`, 'i'),
        });
        if (existing) {
          return res.json({
            success: false,
            message: `Subject "${parsed.data.name}" already exists.`,
          });
        }

        result = await Subject.create({ ...parsed.data, userId });

      } else if (parsed.action === 'delete') {
        if (!parsed.data.name) {
          return res.json({ success: false, message: 'Please specify which subject to delete.' });
        }
        const s = await Subject.findOne({ userId, name: new RegExp(parsed.data.name, 'i') });
        if (s) await Subject.findByIdAndDelete(s._id);
        else   return res.json({ success: false, message: `Subject "${parsed.data.name}" not found.` });

      } else if (parsed.action === 'get') {
        result = await Subject.find({ userId });
      }
    }

    // ── ATTENDANCE ────────────────────────────────────────────────────────
    else if (parsed.entity === 'attendance') {
      if (parsed.action === 'add') {
        if (parsed.data.subjectName && !parsed.data.subjectId) {
          const s = await Subject.findOne({ userId, name: new RegExp(parsed.data.subjectName, 'i') });
          if (!s) return res.json({ success: false, message: `Subject "${parsed.data.subjectName}" not found. Add it first.` });
          parsed.data.subjectId = s._id;
          delete parsed.data.subjectName;
        }
        if (!['present', 'absent', 'cancelled'].includes(parsed.data.status)) {
          parsed.data.status = 'present';
        }
        const { subjectId, date, status } = parsed.data;
        result = await Attendance.findOneAndUpdate(
          { userId, subjectId, date: new Date(date) },
          { status },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

      } else if (parsed.action === 'get') {
        result = await Attendance.find({ userId }).populate('subjectId', 'name');
      }
    }

    // ── MARKS ─────────────────────────────────────────────────────────────
    else if (parsed.entity === 'marks') {
      if (parsed.action === 'add') {
        if (parsed.data.subjectName && !parsed.data.subjectId) {
          const s = await Subject.findOne({ userId, name: new RegExp(parsed.data.subjectName, 'i') });
          if (!s) return res.json({ success: false, message: `Subject "${parsed.data.subjectName}" not found. Add it first.` });
          parsed.data.subjectId = s._id;
          delete parsed.data.subjectName;
        }
        result = await Marks.create({ ...parsed.data, userId });

      } else if (parsed.action === 'get') {
        result = await Marks.find({ userId }).populate('subjectId', 'name');
      }
    }

    // ── TASK ──────────────────────────────────────────────────────────────
    else if (parsed.entity === 'task') {
      if (parsed.action === 'add') {
        if (!parsed.data.priority) parsed.data.priority = 'medium';
        if (parsed.data.dueDate) {
          const d = new Date(parsed.data.dueDate);
          parsed.data.dueDate = isNaN(d.getTime()) ? undefined : d;
        }
        result = await Task.create({ ...parsed.data, user: userId });

      } else if (parsed.action === 'delete') {
        if (!parsed.data.title) {
          return res.json({ success: false, message: 'Please specify which task to delete.' });
        }
        const t = await Task.findOne({ user: userId, title: new RegExp(parsed.data.title, 'i') });
        if (t) await Task.findByIdAndDelete(t._id);
        else   return res.json({ success: false, message: `Task "${parsed.data.title}" not found.` });

      } else if (parsed.action === 'update') {
        if (!parsed.data.title) {
          return res.json({ success: false, message: 'Please specify which task to update.' });
        }
        const t = await Task.findOne({ user: userId, title: new RegExp(parsed.data.title, 'i') });
        if (t) result = await Task.findByIdAndUpdate(t._id, parsed.data, { new: true });
        else   return res.json({ success: false, message: `Task "${parsed.data.title}" not found.` });

      } else if (parsed.action === 'get') {
        result = await Task.find({ user: userId });
      }
    }

    // ── SEMESTER ──────────────────────────────────────────────────────────
    else if (parsed.entity === 'semester') {
      if (parsed.action === 'add') {
        result = await Semester.create({ ...parsed.data, student: userId });
      } else if (parsed.action === 'get') {
        result = await Semester.find({ student: userId }).sort({ semesterNumber: 1 });
      }
    }

    // ── Success response ──────────────────────────────────────────────────
    return res.json({
      success: true,
      message: parsed.message,
      action : parsed.action,
      entity : parsed.entity,
      data   : result,
    });

  } catch (err) {
    console.error('[AI Command Error]', err.message);
    return res.status(500).json({ ...FALLBACK, message: 'Server error. Please try again.' });
  }
};