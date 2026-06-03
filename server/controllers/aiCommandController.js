const Groq      = require('groq-sdk');
const Subject    = require('../models/Subject');
const Attendance = require('../models/Attendance');
const Marks      = require('../models/Marks');
const Task       = require('../models/Task');
const Semester   = require('../models/Semester.model');
const { sendNotification } = require('../utils/sendNotification');
const User = require('../models/User');

const groq = new Groq({ apiKey: process.env.GROQ_CHAT_KEY || process.env.GROQ_API_KEY });
console.log('[AI] GROQ_API_KEY loaded:', process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.substring(0, 15) + '...' : 'UNDEFINED');

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM_PROMPT — Groq handles ALL routing: commands, queries, conversation
// No hardcoded patterns. Date/day injected so "today", "Friday" etc. work.
// ─────────────────────────────────────────────────────────────────────────────
function buildPrompt() {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = new Date();
  return `
You are a JSON-only intelligent assistant for a Student Dashboard app.
Today's date : ${today.toISOString().slice(0, 10)}
Today's day  : ${days[today.getDay()]}

YOUR ONLY OUTPUT IS RAW JSON — no explanation, no markdown, no code fences, no extra text.

YOU HANDLE THREE REQUEST TYPES:

TYPE 1 — ACTIONS (user wants to create/modify/delete data)
  → use action: "add" | "update" | "delete"

TYPE 2 — DATA QUERIES (user wants to see/fetch data)
  → use action: "get"

TYPE 3 — CONVERSATIONAL / ANALYTICAL (user asks a question you can answer directly)
  Examples: "What will my CGPA be if I score 7.5?", "How many classes do I need to reach 75%?",
            "Which subject has lowest marks?", "Am I safe in attendance?"
  → use action: "answer", entity: "none"
  → compute or reason about the answer in the "message" field
  → "data" can carry any computed values you want to surface

ENTITIES AND FIELDS:
- subject    : { name (string), code (string), credits (number 1–6), instructor (string),
                 schedule: [{ day ("Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat"), startTime ("HH:MM"), endTime ("HH:MM"), room (string) }] }
- attendance : { subjectName (string), status ("present"|"absent"|"cancelled"), date (ISO YYYY-MM-DD) }
- marks      : { subjectName (string), examType ("midterm"|"final"|"quiz"|"assignment"|"practical"),
                 marksObtained (number), maxMarks (number), examDate (ISO YYYY-MM-DD) }
- task       : { title (string), description (string), dueDate (ISO YYYY-MM-DD),
                 priority ("low"|"medium"|"high"), category (string) }
- semester   : { semesterNumber (number), semesterName (string), sgpa (number),
                 subjects: [{ name, credits, grade }] }

OUTPUT FORMAT (always exactly this shape):
{
  "action"  : "add" | "update" | "delete" | "get" | "answer",
  "entity"  : "subject" | "attendance" | "marks" | "task" | "semester" | "none",
  "data"    : { ...fields or computed values },
  "message" : "short human-friendly response (max 20 words)"
}

BULK OPERATIONS:
If user mentions multiple subjects/tasks in one command, use "items" array inside data:
{ "action":"add","entity":"subject","data":{"items":[{"name":"Maths","schedule":[{"day":"Mon","startTime":"09:00","endTime":"10:00"}]},{"name":"Physics","schedule":[{"day":"Tue","startTime":"11:00","endTime":"12:00"}]}]},"message":"Added Maths and Physics." }

FIELD RULES:
- Omit fields that were NOT mentioned — never fabricate
- credits: omit if not mentioned
- date/dueDate/examDate: use today's ISO date if not mentioned
- For "today's classes" → action: "get", entity: "subject", data: { query: "today" }
- Day synonyms: monday→"Mon", tuesday→"Tue", wednesday→"Wed", thursday→"Thu", friday→"Fri", saturday→"Sat"
- If day mentioned but no time → startTime: "09:00", endTime: "10:00"
- status: attended/went/present→"present" | missed/bunked/skipped/absent→"absent"
- examType: mid/mids→"midterm" | finals/end-term→"final" | test→"quiz"
- priority: urgent/asap/important→"high" | normal→"medium" | later/someday→"low"
- grade: "A plus"→"A+", "B plus"→"B+", "O"/"outstanding"→"O", etc.
- Always use "subjectName" (string) for attendance and marks — never subjectId
- If time is mentioned but no day, default day to today's abbreviation: ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][today.getDay()]}
-Study/focus/prepare questions→{action:"answer",entity:"none",data:{query:"study_suggestion"},"message":"Let me check your data."}

UNKNOWN INTENT:
{ "action":"unknown","entity":"none","data":{},"message":"I couldn't understand that. Can you rephrase?" }

EXAMPLES:
User: "Add Maths on Monday and Physics on Tuesday"
→ {"action":"add","entity":"subject","data":{"items":[{"name":"Maths","code":"MATHS","schedule":[{"day":"Mon","startTime":"09:00","endTime":"10:00"}]},{"name":"Physics","code":"PHYSIC","schedule":[{"day":"Tue","startTime":"09:00","endTime":"10:00"}]}]},"message":"Added Maths and Physics."}

User: "What classes do I have today"
→ {"action":"get","entity":"subject","data":{"query":"today"},"message":"Fetching today's classes."}

User: "I attended Data Structures today"
→ {"action":"add","entity":"attendance","data":{"subjectName":"Data Structures","status":"present","date":"${today.toISOString().slice(0,10)}"},"message":"Attendance marked present for Data Structures."}

User: "I scored 45 out of 50 in Physics midterm"
→ {"action":"add","entity":"marks","data":{"subjectName":"Physics","examType":"midterm","marksObtained":45,"maxMarks":50},"message":"Midterm marks added for Physics."}

User: "What will my CGPA be if I score 7.5 next semester"
→ {"action":"answer","entity":"semester","data":{"hypotheticalSGPA":7.5,"query":"cgpa_predict"},"message":"Calculating your predicted CGPA."}

User: "What will my cgpa if I score 6 GPA next semester"
→ {"action":"answer","entity":"semester","data":{"hypotheticalSGPA":6,"query":"cgpa_predict"},"message":"Calculating your predicted CGPA."}

User: "What Sgpa should i score next sem to get overally cgpa of 9"
→ {"action":"answer","entity":"semester","data":{"targetCGPA":9,"query":"sgpa_needed"},"message":"Calculating required SGPA."}

User: "What SGPA do I need next sem to reach 8.5 CGPA"
→ {"action":"answer","entity":"semester","data":{"targetCGPA":8.5,"query":"sgpa_needed"},"message":"Calculating required SGPA."}

User: "If my CGPA is 8.0 till 4th sem, what will my CGPA be if I score 7 in the next 2 semesters?"
→ {"action":"answer","entity":"semester","data":{"currentCGPA":8.0,"completed":4,"hypotheticalSGPA":7.0,"hypotheticalSemestersCount":2,"query":"cgpa_predict"},"message":"Calculating hypothetical CGPA."}

User: "What will my cgpa be if i have 8.2 cgpa till 3 sems and get 9 sgpa in next sem"
→ {"action":"answer","entity":"semester","data":{"currentCGPA":8.2,"completed":3,"hypotheticalSGPA":9.0,"hypotheticalSemestersCount":1,"query":"cgpa_predict"},"message":"Calculating hypothetical CGPA."}

User: "How many classes do I need to reach 75% in Maths"
→ {"action":"answer","entity":"none","data":{"subjectName":"Maths","query":"attendance_needed"},"message":"Let me check your Maths attendance and calculate what you need."}

User: "Add high priority task to submit project by Friday"
→ {"action":"add","entity":"task","data":{"title":"Submit project","priority":"high","dueDate":"${getNextFriday()}"},"message":"Task added: Submit project by Friday."}

User: "What's my attendance for DAA"
→ {"action":"answer","entity":"attendance","data":{"subjectName":"DAA","query":"attendance_status"},"message":"Fetching DAA attendance."}

// Add to EXAMPLES in buildPrompt():
User: "tell my marks in Discrete Mathematics in mid sem"
→ {"action":"answer","entity":"marks","data":{"subjectName":"Discrete Mathematics","examType":"midterm","query":"marks_status"},"message":"Fetching Discrete Mathematics midterm marks."}

User: "what are my marks"
→ {"action":"answer","entity":"marks","data":{"query":"marks_status"},"message":"Fetching all your marks."}

User: "show me my final exam marks for Physics"
→ {"action":"answer","entity":"marks","data":{"subjectName":"Physics","examType":"final","query":"marks_status"},"message":"Fetching Physics final marks."}

User: "How many classes did I miss in Maths"
→ {"action":"answer","entity":"attendance","data":{"subjectName":"Maths","query":"attendance_status"},"message":"Checking Maths attendance."}

User: "how many subjects this semester"
→ {"action":"get","entity":"subject","data":{"query":"list"},"message":"Fetching your subjects."}

User: "what are my subjects"
→ {"action":"get","entity":"subject","data":{"query":"list"},"message":"Fetching your subjects."}

User: "what are my GPAs or semester summary"
→ {"action":"get","entity":"semester","data":{"query":"list"},"message":"Fetching your semester GPAs."}

User: "delete task Submit assignment"
→ {"action":"delete","entity":"task","data":{"title":"Submit assignment"},"message":"Deleting task."}

User: "remove Math subject"
→ {"action":"delete","entity":"subject","data":{"name":"Math"},"message":"Deleting subject."}

User: "delete all the subjects"
→ {"action":"delete","entity":"subject","data":{"name":"all"},"message":"Deleting all subjects."}

User: "remove all tasks"
→ {"action":"delete","entity":"task","data":{"title":"all"},"message":"Deleting all tasks."}

User: "change Maths class instructor to Dr. Smith"
→ {"action":"update","entity":"subject","data":{"name":"Maths","instructor":"Dr. Smith"},"message":"Updating Maths instructor."}

User: "complete task Submit Project"
→ {"action":"update","entity":"task","data":{"title":"Submit Project","status":"completed"},"message":"Task completed."}

User: "set semester 1 SGPA to 8.5"
→ {"action":"update","entity":"semester","data":{"semesterNumber":1,"sgpa":8.5},"message":"Updating Semester 1 SGPA to 8.5."}

User: "set semester 1 SGPA to 8.5 and semester 2 to 9.0"
→ {"action":"update","entity":"semester","data":{"items":[{"semesterNumber":1,"sgpa":8.5},{"semesterNumber":2,"sgpa":9.0}]},"message":"Updating GPAs for Semester 1 and Semester 2."}

User: "delete semester 1"
→ {"action":"delete","entity":"semester","data":{"semesterNumber":1},"message":"Deleting Semester 1."}
`;



// ← single backtick here, closing the template literal
}    // ← closing the buildPrompt function



function getNextFriday() {
  const d = new Date();
  const day = d.getDay();
  const diff = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// extractJSON — 3-layer safe extraction from any Groq response
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
// validateParsed — ensures shape is correct before any DB access
// ─────────────────────────────────────────────────────────────────────────────
function validateParsed(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  const validActions  = ['add', 'update', 'delete', 'get', 'answer', 'unknown'];
  const validEntities = ['subject', 'attendance', 'marks', 'task', 'semester', 'none', 'unknown'];
  return (
    validActions.includes(parsed.action) &&
    validEntities.includes(parsed.entity) &&
    typeof parsed.data === 'object' &&
    parsed.data !== null
  );
}

const FALLBACK = {
  success: false,
  entity : 'none',
  action : 'unknown',
  message: "I couldn't understand that. Please try rephrasing.",
  data   : null,
};

// ─────────────────────────────────────────────────────────────────────────────
// createSubject helper — used for both single and bulk
// ─────────────────────────────────────────────────────────────────────────────
async function createSubject(data, userId) {
  if (!data.code && data.name) {
    data.code = data.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }
  const exists = await Subject.findOne({ userId, name: new RegExp(`^${data.name}$`, 'i') });
  if (exists) return { skipped: true, name: data.name };
  return Subject.create({ ...data, userId });
}

// ─────────────────────────────────────────────────────────────────────────────
// upsertSemester helper — handles single upsert of a manual semester SGPA
// ─────────────────────────────────────────────────────────────────────────────
async function upsertSemester(data, userId) {
  const semesterNumber = Number(data.semesterNumber);
  if (isNaN(semesterNumber)) {
    throw new Error('Semester number must be a valid number.');
  }

  // Find existing semester
  let semester = await Semester.findOne({ student: userId, semesterNumber });

  const sgpaVal = data.sgpa !== undefined ? Number(data.sgpa) : (data.directSGPA !== undefined ? Number(data.directSGPA) : null);

  if (semester) {
    // Update existing
    if (data.semesterName !== undefined) semester.semesterName = data.semesterName;
    if (sgpaVal !== null && !isNaN(sgpaVal)) {
      semester.isManual = true;
      semester.directSGPA = sgpaVal;
      semester.sgpa = sgpaVal;
    }
    if (data.subjects !== undefined) {
      semester.subjects = data.subjects;
      if (sgpaVal === null) {
        semester.isManual = false;
        semester.directSGPA = null;
      }
    }
    if (data.totalCredits !== undefined) semester.totalCredits = Number(data.totalCredits);
    await semester.save();
    return semester;
  } else {
    // Create new
    const isManual = sgpaVal !== null && !isNaN(sgpaVal);
    semester = new Semester({
      student: userId,
      semesterNumber,
      semesterName: data.semesterName || `Semester ${semesterNumber}`,
      isManual,
      directSGPA: isManual ? sgpaVal : null,
      subjects: data.subjects || [],
      totalCredits: data.totalCredits !== undefined ? Number(data.totalCredits) : null,
    });
    await semester.save();
    return semester;
  }
}

const DEFAULT_CREDIT_PATTERN = [22, 21, 22, 24, 20, 12, 19, 21];

function getCreditsForSemesterNumber(semNum, semesters) {
  // If the semester exists in DB, use its actual credits
  const existing = semesters.find(s => s.semesterNumber === semNum);
  if (existing) {
    if (existing.isManual) return existing.totalCredits || 20;
    return (existing.subjects || []).reduce((sum, sub) => sum + (sub.credits || 0), 0) || 20;
  }
  // Else return from pattern or default to 20
  const idx = semNum - 1;
  if (idx >= 0 && idx < DEFAULT_CREDIT_PATTERN.length) {
    return DEFAULT_CREDIT_PATTERN[idx];
  }
  return 20;
}

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
    console.log('[AI] Calling Groq with model: llama-3.1-8b-instant, key prefix:', process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.substring(0, 10) : 'NONE');
    const completion = await groq.chat.completions.create({
      model     : 'llama-3.1-8b-instant',
      messages   : [
        { role: 'system', content: buildPrompt() },
        { role: 'user',   content: userInput },
      ],
      temperature: 0.1,
      max_tokens : 400,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    console.log('[Groq Raw]', raw);

    // ── Step 2: Extract + validate ────────────────────────────────────────
    const parsed = extractJSON(raw);

    if (!parsed || !validateParsed(parsed)) {
      console.warn('[AI Command] Unparseable:', raw);
      return res.json({ ...FALLBACK, raw });
    }

    if (parsed.action === 'unknown') {
      return res.json({ success: false, message: parsed.message || FALLBACK.message });
    }

    // ── Step 3: action === "answer" — direct conversational response ───────
 const userId = req.user._id;
let result   = null;

    if (parsed.action === 'answer') {

  // 1. CGPA prediction / hypothetical situation
  if (parsed.data?.hypotheticalSGPA || parsed.data?.query === 'cgpa_predict') {
    const hypo = parseFloat(parsed.data.hypotheticalSGPA);
    if (!isNaN(hypo)) {
      let semesters = [];
      let currentCGPAOverride = parsed.data.currentCGPA !== undefined ? parseFloat(parsed.data.currentCGPA) : null;
      let completedSemestersCount = parsed.data.completed !== undefined ? parseInt(parsed.data.completed, 10) : null;
      
      let completedCreditsCount = 0;
      let currentWeightedSum = 0;
      let N = 0;
      
      if (currentCGPAOverride !== null && completedSemestersCount !== null && !isNaN(currentCGPAOverride) && !isNaN(completedSemestersCount)) {
        // Manual override mode
        N = completedSemestersCount;
        // Estimate credits for manual override semesters based on pattern
        for (let i = 1; i <= N; i++) {
          const cr = getCreditsForSemesterNumber(i, []);
          completedCreditsCount += cr;
        }
        currentWeightedSum = currentCGPAOverride * completedCreditsCount;
      } else {
        // Database mode
        semesters = await Semester.find({ student: userId }).sort({ semesterNumber: 1 });
        N = semesters.length;
        for (const s of semesters) {
          const cr = s.isManual ? (s.totalCredits || 20) : (s.subjects || []).reduce((sum, sub) => sum + (sub.credits || 0), 0) || 20;
          currentWeightedSum += s.sgpa * cr;
          completedCreditsCount += cr;
        }
      }
      
      // Future semesters count (default to 1 if not specified)
      const futureCount = parsed.data.hypotheticalSemestersCount ? parseInt(parsed.data.hypotheticalSemestersCount, 10) : 1;
      
      let futureCredits = 0;
      let futureWeightedSum = 0;
      for (let i = 1; i <= futureCount; i++) {
        const nextSemNum = N + i;
        const cr = getCreditsForSemesterNumber(nextSemNum, semesters);
        futureCredits += cr;
        futureWeightedSum += hypo * cr;
      }
      
      const totalCredits = completedCreditsCount + futureCredits;
      const predictedCGPA = ((currentWeightedSum + futureWeightedSum) / totalCredits).toFixed(2);
      
      let message = "";
      if (currentCGPAOverride !== null) {
        message = `Starting with a CGPA of ${currentCGPAOverride} over ${N} semesters, if you score ${hypo} SGPA in the next ${futureCount === 1 ? 'semester' : `${futureCount} semesters`}, your overall CGPA will be ${predictedCGPA}.`;
      } else {
        if (N === 0) {
          message = `Since you don't have any semesters registered yet, if you score ${hypo} SGPA in the next ${futureCount === 1 ? 'semester' : `${futureCount} semesters`}, your CGPA will be ${hypo.toFixed(2)}.`;
        } else {
          message = `Based on your existing ${N} semesters, if you score ${hypo} SGPA in the next ${futureCount === 1 ? 'semester' : `${futureCount} semesters`}, your predicted CGPA will be ${predictedCGPA}.`;
        }
      }
      
      return res.json({
        success: true, action: 'answer', entity: 'none',
        message,
        data: { predictedCGPA, currentSemesters: N, hypotheticalSGPA: hypo, hypotheticalSemestersCount: futureCount }
      });
    }
  }

  // 1b. Target CGPA prediction (calculating required SGPA for a target CGPA)
  if (parsed.data?.targetCGPA || parsed.data?.query === 'sgpa_needed') {
    const semesters = await Semester.find({ student: userId }).sort({ semesterNumber: 1 });
    const target    = parseFloat(parsed.data.targetCGPA);
    if (!isNaN(target)) {
      const N = semesters.length;
      if (N === 0) {
        return res.json({
          success: true, action: 'answer', entity: 'none',
          message: `Since you don't have any semesters registered yet, you need to score an SGPA of ${target.toFixed(2)} in your next semester.`,
          data   : { targetSGPA: target, currentSemesters: 0, targetCGPA: target },
        });
      }
      
      // Sum current weighted score
      let currentWeightedSum = 0;
      let totalCredits = 0;
      for (const s of semesters) {
        const cr = s.isManual ? (s.totalCredits || 20) : (s.subjects || []).reduce((sum, sub) => sum + (sub.credits || 0), 0) || 20;
        currentWeightedSum += s.sgpa * cr;
        totalCredits += cr;
      }
      
      // Target next semester
      const nextSemNum = Math.max(...semesters.map(s => s.semesterNumber)) + 1;
      const nextSemCredits = getCreditsForSemesterNumber(nextSemNum, semesters);
      
      const totalDegreeCredits = totalCredits + nextSemCredits;
      const needed = (target * totalDegreeCredits - currentWeightedSum) / nextSemCredits;

      let msg = "";
      const currentCGPA = (currentWeightedSum / totalCredits).toFixed(2);
      if (needed < 0) {
        msg = `You have already exceeded a CGPA of ${target}! Your current CGPA is ${currentCGPA}.`;
      } else if (needed > 10) {
        const maxSGPA = 10.0;
        const maxPossibleCGPA = ((currentWeightedSum + maxSGPA * nextSemCredits) / totalDegreeCredits).toFixed(2);
        msg = `It is mathematically impossible to reach a CGPA of ${target} next semester. Even with a perfect 10.0 SGPA next semester, your max CGPA would be ${maxPossibleCGPA}.`;
      } else {
        msg = `To reach an overall CGPA of ${target}, you need to score an SGPA of ${needed.toFixed(2)} in your next semester (Semester ${nextSemNum}, assuming ${nextSemCredits} credits).`;
      }

      return res.json({
        success: true, action: 'answer', entity: 'none',
        message: msg,
        data   : { targetSGPA: parseFloat(needed.toFixed(2)), currentSemesters: N, targetCGPA: target, currentCGPA },
      });
    }
  }

  // 2. Attendance status/needed
  if ((parsed.data?.query === 'attendance_status' || parsed.data?.query === 'attendance_needed') && parsed.data?.subjectName) {
    const subject = await Subject.findOne({ userId, name: new RegExp(parsed.data.subjectName, 'i') });
    if (subject) {
      const records = await Attendance.find({ userId, subjectId: subject._id, status: { $ne: 'cancelled' } });
      const total   = records.length;
      const present = records.filter(r => r.status === 'present').length;
      const pct     = total ? (present / total * 100).toFixed(1) : 0;
      const needed  = total && present / total < 0.75 ? Math.ceil((0.75 * total - present) / 0.25) : 0;
      const msg     = needed > 0
        ? `You have ${pct}% attendance in ${parsed.data.subjectName}. Attend ${needed} more consecutive classes to reach 75%.`
        : `You're safe! ${parsed.data.subjectName} attendance is ${pct}%.`;
      return res.json({ success: true, action: 'answer', entity: 'none', message: msg, data: { total, present, pct, needed } });
    }
  }

    // Add this INSIDE the answer block, after the attendance_status handler:

// 3. Marks query for specific subject
if (parsed.data?.query === 'marks_status' || parsed.entity === 'marks') {
  const subjectName = parsed.data?.subjectName;
  const examType    = parsed.data?.examType;

  let marksQuery = { userId };

  if (subjectName) {
    const subject = await Subject.findOne({ userId, name: new RegExp(subjectName, 'i') });
    if (!subject) {
      return res.json({
        success: true, action: 'answer', entity: 'none',
        message: `No subject found matching "${subjectName}".`,
        data: {},
      });
    }
    marksQuery.subjectId = subject._id;
  }

  if (examType) marksQuery.examType = examType;

  const marksList = await Marks.find(marksQuery).populate('subjectId', 'name');

  if (!marksList.length) {
    return res.json({
      success: true, action: 'answer', entity: 'none',
      message: `No marks found${subjectName ? ` for ${subjectName}` : ''}${examType ? ` (${examType})` : ''}.`,
      data: {},
    });
  }

  const lines = marksList.map(m => {
    const pct = ((m.marksObtained / m.maxMarks) * 100).toFixed(1);
    return `• ${m.subjectId?.name || 'Unknown'} — ${m.examType}: ${m.marksObtained}/${m.maxMarks} (${pct}%) | Grade Point: ${m.gradePoint}`;
  });

  return res.json({
    success: true, action: 'answer', entity: 'none',
    message: `📊 Your marks:\n${lines.join('\n')}`,
    data: { marks: marksList },
  });
}
  // 3. Study suggestion
  if (parsed.data?.query === 'study_suggestion' || userInput.toLowerCase().match(/study|focus|prepare|prioritize/)) {
    const [subjects, tasks, marks, attendance] = await Promise.all([
      Subject.find({ userId }),
      Task.find({ user: userId, status: { $ne: 'completed' } }).sort({ dueDate: 1 }).limit(3),
      Marks.find({ userId }).populate('subjectId', 'name'),
      Attendance.find({ userId, status: { $ne: 'cancelled' } }),
    ]);

    const attMap = {};
    attendance.forEach(r => {
      const id = r.subjectId?.toString();
      if (!id) return;
      if (!attMap[id]) attMap[id] = { total: 0, present: 0 };
      attMap[id].total++;
      if (r.status === 'present') attMap[id].present++;
    });

    let lowestAttSubject = null, lowestPct = 100;
    subjects.forEach(s => {
      const a = attMap[s._id.toString()];
      if (a && a.total > 0) {
        const pct = (a.present / a.total) * 100;
        if (pct < lowestPct) { lowestPct = pct; lowestAttSubject = s.name; }
      }
    });

    const marksMap = {};
    marks.forEach(m => {
      const name = m.subjectId?.name;
      if (!name) return;
      if (!marksMap[name]) marksMap[name] = { total: 0, max: 0 };
      marksMap[name].total += m.marksObtained;
      marksMap[name].max   += m.maxMarks;
    });
    let lowestMarksSubject = null, lowestPctMarks = 100;
    Object.entries(marksMap).forEach(([name, v]) => {
      const pct = v.max ? (v.total / v.max) * 100 : 100;
      if (pct < lowestPctMarks) { lowestPctMarks = pct; lowestMarksSubject = name; }
    });

    const lines = ['📚 Here\'s what you should focus on today:\n'];
    if (lowestAttSubject) lines.push(`• ⚠️ Attend ${lowestAttSubject} — attendance is ${lowestPct.toFixed(1)}%`);
    if (lowestMarksSubject) lines.push(`• 📖 Study ${lowestMarksSubject} — scoring ${lowestPctMarks.toFixed(1)}% in marks`);
    if (tasks.length) lines.push(`• ✅ Pending: "${tasks[0].title}"${tasks[0].dueDate ? ` (due ${new Date(tasks[0].dueDate).toLocaleDateString()})` : ''}`);
    if (lines.length === 1) lines.push('• You\'re all caught up! Great work. 🎉');

    return res.json({
      success: true, action: 'answer', entity: 'none',
      message: lines.join('\n'),
      data: { lowestAttSubject, lowestMarksSubject, upcomingTask: tasks[0]?.title },
    });
  }

  // 4. Generic answer fallback
  return res.json({
    success: true, action: 'answer', entity: 'none',
    message: parsed.message, data: parsed.data || null,
  });
}

    // ── SUBJECT ──────────────────────────────────────────────────────────
    if (parsed.entity === 'subject') {

      if (parsed.action === 'add') {
        // Bulk insert
      // Bulk insert
if (parsed.data.items && Array.isArray(parsed.data.items)) {
  const results = await Promise.all(parsed.data.items.map(async (item) => {
    const r = await createSubject(item, userId);

    // If subject exists but has new schedule slots — merge them in
    if (r.skipped && item.schedule && Array.isArray(item.schedule)) {
      const existing = await Subject.findOne({ userId, name: new RegExp(item.name, 'i') });
      if (existing) {
        const newDays   = item.schedule.map(sc => sc.day);
        const keptSlots = (existing.schedule || []).filter(sc => !newDays.includes(sc.day));
        existing.schedule = [...keptSlots, ...item.schedule];
        const saved = await existing.save();
        return { merged: true, name: item.name, doc: saved };
      }
    }
    return r;
  }));

  const added   = results.filter(r => !r.skipped && !r.merged);
  const merged  = results.filter(r => r.merged).map(r => r.name);
  const skipped = results.filter(r => r.skipped).map(r => r.name);

  let msg = parsed.message;
  if (merged.length)  msg = `✅ Updated schedule for ${merged.join(', ')}.`;
  if (skipped.length) msg += ` (${skipped.join(', ')} already existed)`;

  return res.json({ success: true, action: 'add', entity: 'subject', message: msg, data: added });
}
        // Single insert
       const r = await createSubject(parsed.data, userId);
if (r.skipped) {
  if (parsed.data.schedule && Array.isArray(parsed.data.schedule)) {
    const existing = await Subject.findOne({ userId, name: new RegExp(parsed.data.name, 'i') });
    if (!existing) {
      return res.json({ success: false, message: `Subject "${parsed.data.name}" not found.` });
    }
const newDays    = parsed.data.schedule.map(sc => sc.day);
const keptSlots  = (existing.schedule || []).filter(sc => !newDays.includes(sc.day));
        existing.schedule = [...keptSlots, ...parsed.data.schedule];
        result = await existing.save();
        return res.json({
          success: true, action: 'add', entity: 'subject',
            message: `✅ Added ${parsed.data.name} class on ${newDays.join(', ')} (${parsed.data.schedule.map(s => `${s.startTime}–${s.endTime}`).join(', ')}).`,
          data: result,
        });
      }
      return res.json({ success: false, message: `Subject "${parsed.data.name}" already exists.` });
    }
    result = r;

      } else if (parsed.action === 'update') {
  if (!parsed.data.name) return res.json({ success: false, message: 'Please specify which subject to update.' });

  const s = await Subject.findOne({ userId, name: new RegExp(parsed.data.name, 'i') });
  if (!s) return res.json({ success: false, message: `Subject "${parsed.data.name}" not found.` });

  // If schedule update — replace entire schedule or merge by day
  if (parsed.data.schedule && Array.isArray(parsed.data.schedule)) {
    // Remove old slots for the days being updated, add new ones
    const updatedDays = parsed.data.schedule.map(sc => sc.day);
    const keptSlots   = s.schedule.filter(sc => !updatedDays.includes(sc.day));
    s.schedule        = [...keptSlots, ...parsed.data.schedule];
  }

  // Update other fields if provided
  if (parsed.data.credits)    s.credits    = parsed.data.credits;
  if (parsed.data.instructor) s.instructor = parsed.data.instructor;
  if (parsed.data.code)       s.code       = parsed.data.code;

  result = await s.save();
      } else if (parsed.action === 'delete') {
        if (parsed.data.name?.toLowerCase() === 'all' || parsed.data.all === true || parsed.data.deleteAll === true) {
          if (req.body.confirmed !== true) {
            return res.json({
              success: true,
              action: 'confirm',
              entity: 'subject',
              data: { originalAction: 'delete', name: 'all' },
              message: '⚠️ Warning: Deleting all subjects will permanently erase all subject, attendance, and exam marks records. Are you sure you want to proceed?'
            });
          }
          await Subject.deleteMany({ userId });
          await Attendance.deleteMany({ userId });
          await Marks.deleteMany({ userId });
          return res.json({ success: true, action: 'delete', entity: 'subject', message: 'All subjects, marks, and attendance records have been deleted.' });
        }
        if (!parsed.data.name) return res.json({ success: false, message: 'Please specify which subject to delete.' });
        const s = await Subject.findOne({ userId, name: new RegExp(`^${parsed.data.name}$`, 'i') });
        if (s) {
          if (req.body.confirmed !== true) {
            return res.json({
              success: true,
              action: 'confirm',
              entity: 'subject',
              data: { originalAction: 'delete', name: s.name },
              message: `Are you sure you want to delete the subject "${s.name}"? This will also delete all associated marks and attendance records.`
            });
          }
          await Subject.findByIdAndDelete(s._id);
          await Attendance.deleteMany({ userId, subjectId: s._id });
          await Marks.deleteMany({ userId, subjectId: s._id });
          return res.json({ success: true, action: 'delete', entity: 'subject', message: `Subject "${s.name}" deleted.`, data: s });
        } else {
          return res.json({ success: false, message: `Subject "${parsed.data.name}" not found.` });
        }

      } else if (parsed.action === 'get') {
        // Today's schedule
        if (parsed.data?.query === 'today') {
          const dayAbbr = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
          const subjects = await Subject.find({ userId, 'schedule.day': dayAbbr });
          const todayClasses = subjects.map(s => ({
            name    : s.name,
            code    : s.code,
            schedule: s.schedule.filter(sc => sc.day === dayAbbr),
          }));
          const msg = todayClasses.length
  ? `You have ${todayClasses.length} class${todayClasses.length > 1 ? 'es' : ''} today:\n${
      todayClasses.map(c =>
        `• ${c.name} — ${c.schedule.map(s => `${s.startTime}–${s.endTime}`).join(', ')}`
      ).join('\n')
    }`
  : 'No classes scheduled for today.';
          return res.json({ success: true, action: 'get', entity: 'subject', message: msg, data: todayClasses });
        }
        const subjects = await Subject.find({ userId });
        const count = subjects.length;
        const subjectNames = subjects.map(s => s.name).join(', ');
        const msg = count > 0
          ? `You have ${count} subjects this semester: ${subjectNames}.`
          : 'You do not have any subjects registered for this semester yet.';
        return res.json({
          success: true,
          action: 'get',
          entity: 'subject',
          message: msg,
          data: subjects
        });
      }
    }

    // ── ATTENDANCE ────────────────────────────────────────────────────────
else if (parsed.entity === 'attendance') {

  // [ADDED] Subject-specific attendance query
  if (parsed.action === 'get' && parsed.data?.subjectName) {
    const subject = await Subject.findOne({ userId, name: new RegExp(parsed.data.subjectName, 'i') });
    if (!subject) {
      return res.json({ success: false, message: `Subject "${parsed.data.subjectName}" not found.` });
    }
    const records = await Attendance.find({ userId, subjectId: subject._id, status: { $ne: 'cancelled' } });
    const total   = records.length;
    const present = records.filter(r => r.status === 'present').length;
    const absent  = total - present;
    const pct     = total ? ((present / total) * 100).toFixed(1) : 0;
    const needed  = present / total < 0.75 && total > 0
      ? Math.ceil((0.75 * total - present) / 0.25) : 0;
    const status  = pct >= 75 ? '✅ Safe' : pct >= 60 ? '⚠️ At Risk' : '🚨 Critical';

    const msg = total === 0
      ? `No attendance records found for ${subject.name}.`
      : `${subject.name} attendance: ${present}/${total} classes (${pct}%) — ${status}.${needed > 0 ? ` Attend ${needed} more to reach 75%.` : ''}`;

    return res.json({
      success: true, action: 'answer', entity: 'none',
      message: msg,
      data   : { total, present, absent, percentage: pct, needed },
    });
  }

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
     const userForNotif = await User.findById(userId);
if (userForNotif?.fcmToken) {
  await sendNotification(userForNotif.fcmToken, '📋 Attendance Marked', parsed.message);
}
      } else if (parsed.action === 'get') {
        const records = await Attendance.find({ userId }).populate('subjectId', 'name');
        const map = {};
        for (const r of records) {
          if (!r.subjectId) continue;
          const key = r.subjectId.name;
          if (!map[key]) map[key] = { total: 0, present: 0 };
          if (r.status !== 'cancelled') {
            map[key].total++;
            if (r.status === 'present') map[key].present++;
          }
        }
        const summary = Object.entries(map).map(([name, s]) => {
          const pct = s.total ? ((s.present / s.total) * 100).toFixed(1) : 0;
          return `• ${name}: ${s.present}/${s.total} (${pct}%)`;
        });
        const msg = summary.length > 0
          ? `📋 Your attendance summary:\n${summary.join('\n')}`
          : 'You don\'t have any attendance records marked yet.';
        return res.json({
          success: true,
          action: 'get',
          entity: 'attendance',
          message: msg,
          data: records
        });
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
        const userForNotif = await User.findById(userId);
if (userForNotif?.fcmToken) {
  await sendNotification(userForNotif.fcmToken, '📊 Marks Added', parsed.message);
}

      } else if (parsed.action === 'get') {
        const marksFound = await Marks.find({ userId }).populate('subjectId', 'name');
        if (!marksFound.length) {
          return res.json({ success: true, action: 'answer', entity: 'none', message: 'No marks added yet.', data: {} });
        }
        const lines = marksFound.map(m =>
          `• ${m.subjectId?.name} — ${m.examType}: ${m.marksObtained}/${m.maxMarks} (${((m.marksObtained/m.maxMarks)*100).toFixed(1)}%)`
        );
        return res.json({
          success: true, action: 'answer', entity: 'none',
          message: `📊 Your marks:\n${lines.join('\n')}`,
          data: { marks: marksFound },
        });
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
        // Bulk tasks
        if (parsed.data.items && Array.isArray(parsed.data.items)) {
          const results = await Promise.all(parsed.data.items.map(item => {
            if (!item.priority) item.priority = 'medium';
            return Task.create({ ...item, user: userId });
          }));
          return res.json({ success: true, action: 'add', entity: 'task', message: parsed.message, data: results });
        }
        result = await Task.create({ ...parsed.data, user: userId });
        const userForNotif = await User.findById(userId);
if (userForNotif?.fcmToken) {
  await sendNotification(userForNotif.fcmToken, '✅ Task Added', parsed.message);
}

      } else if (parsed.action === 'delete') {
        if (parsed.data.title?.toLowerCase() === 'all' || parsed.data.all === true || parsed.data.deleteAll === true) {
          if (req.body.confirmed !== true) {
            return res.json({
              success: true,
              action: 'confirm',
              entity: 'task',
              data: { originalAction: 'delete', title: 'all' },
              message: 'Are you sure you want to delete all pending tasks?'
            });
          }
          await Task.deleteMany({ user: userId });
          return res.json({ success: true, action: 'delete', entity: 'task', message: 'All tasks have been deleted.' });
        }
        if (!parsed.data.title) return res.json({ success: false, message: 'Please specify which task to delete.' });
        const t = await Task.findOne({ user: userId, title: new RegExp(parsed.data.title, 'i') });
        if (t) {
          if (req.body.confirmed !== true) {
            return res.json({
              success: true,
              action: 'confirm',
              entity: 'task',
              data: { originalAction: 'delete', title: t.title },
              message: `Are you sure you want to delete the task "${t.title}"?`
            });
          }
          await Task.findByIdAndDelete(t._id);
          return res.json({ success: true, action: 'delete', entity: 'task', message: `Task "${t.title}" deleted.`, data: t });
        } else {
          return res.json({ success: false, message: `Task "${parsed.data.title}" not found.` });
        }

      } else if (parsed.action === 'update') {
        if (!parsed.data.title) return res.json({ success: false, message: 'Please specify which task to update.' });
        const t = await Task.findOne({ user: userId, title: new RegExp(parsed.data.title, 'i') });
        if (t) result = await Task.findByIdAndUpdate(t._id, parsed.data, { new: true });
        else   return res.json({ success: false, message: `Task "${parsed.data.title}" not found.` });

      } else if (parsed.action === 'get') {
        const tasks = await Task.find({ user: userId, status: { $ne: 'completed' } }).sort({ dueDate: 1 });
        const lines = tasks.map(t => {
          const due = t.dueDate ? ` (due ${new Date(t.dueDate).toLocaleDateString()})` : '';
          return `• [${t.priority.toUpperCase()}] ${t.title}${due}`;
        });
        const msg = tasks.length > 0
          ? `🗓️ Your pending tasks:\n${lines.join('\n')}`
          : '🎉 You have no pending tasks!';
        return res.json({
          success: true,
          action: 'get',
          entity: 'task',
          message: msg,
          data: tasks
        });
      }
    }

    // ── SEMESTER ──────────────────────────────────────────────────────────
    else if (parsed.entity === 'semester') {
      if (parsed.action === 'add' || parsed.action === 'update') {
        if (parsed.data.items && Array.isArray(parsed.data.items)) {
          const results = await Promise.all(
            parsed.data.items.map(async (item) => {
              return await upsertSemester(item, userId);
            })
          );
          return res.json({
            success: true,
            action: parsed.action,
            entity: 'semester',
            message: parsed.message,
            data: results,
          });
        }
        result = await upsertSemester(parsed.data, userId);
      } else if (parsed.action === 'delete') {
        if (!parsed.data.semesterNumber) {
          return res.json({ success: false, message: 'Please specify which semester to delete.' });
        }
        const semesterNumber = Number(parsed.data.semesterNumber);
        const s = await Semester.findOne({ student: userId, semesterNumber });
        if (s) {
          if (req.body.confirmed !== true) {
            return res.json({
              success: true,
              action: 'confirm',
              entity: 'semester',
              data: { originalAction: 'delete', semesterNumber: s.semesterNumber },
              message: `Are you sure you want to delete Semester ${s.semesterNumber}? This will remove its SGPA and grade records.`
            });
          }
          await Semester.findByIdAndDelete(s._id);
          return res.json({ success: true, action: 'delete', entity: 'semester', message: `Semester ${s.semesterNumber} deleted.`, data: s });
        } else {
          return res.json({ success: false, message: `Semester ${parsed.data.semesterNumber} not found.` });
        }
      } else if (parsed.action === 'get') {
        const semesters = await Semester.find({ student: userId }).sort({ semesterNumber: 1 });
        const lines = semesters.map(s => `• Semester ${s.semesterNumber}: SGPA ${s.sgpa}`);
        const msg = semesters.length > 0
          ? `🎓 Your semester GPA summary:\n${lines.join('\n')}`
          : 'You don\'t have any semesters registered yet.';
        return res.json({
          success: true,
          action: 'get',
          entity: 'semester',
          message: msg,
          data: semesters
        });
      }
    }

    // ── Success ───────────────────────────────────────────────────────────
    return res.json({
      success: true,
      message: parsed.message,
      action : parsed.action,
      entity : parsed.entity,
      data   : result,
    });

  }catch (err) {
  console.error('[AI Command Error]', err.message);
  if (err.status === 429 || err.message?.includes('rate_limit')) {
    return res.status(429).json({
      ...FALLBACK,
      message: 'Daily AI limit reached. Please try again in a few minutes.',
    });
  }
  return res.status(500).json({ ...FALLBACK, message: 'Server error. Please try again.' });
}
};
