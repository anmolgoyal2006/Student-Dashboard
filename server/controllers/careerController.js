const CareerProgress = require('../models/CareerProgress');
const { TTLCache } = require('../utils/ttlCache');

// 2-minute read cache — avoids hitting MongoDB on every Career page mount
const careerCache = new TTLCache({ ttlMs: 2 * 60 * 1000, maxEntries: 500 });

const DSA_TOPICS = [
  'Arrays', 'Strings', 'Linked Lists', 'Stacks & Queues',
  'Trees', 'Graphs', 'Dynamic Programming', 'Recursion & Backtracking',
  'Sorting & Searching', 'Hashing', 'Greedy', 'Tries',
];

// GET /api/career
exports.getCareer = async (req, res) => {
  const uid = req.user.id;
  try {
    const cached = careerCache.get(uid);
    if (cached) return res.json({ career: cached, cached: true });

    let career = await CareerProgress.findOne({ userId: uid });
    if (!career) {
      career = await CareerProgress.create({
        userId: uid,
        dsaTopics: DSA_TOPICS.map(name => ({ name, completed: false, problems: 0 })),
      });
    }
    careerCache.set(uid, career);
    res.json({ career });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/career
exports.updateCareer = async (req, res) => {
  try {
    const { targetCompany, targetRole, skills, dsaTopics, problemsSolved, leetcodeUsername } = req.body;

    const problems = problemsSolved ?? 0;
    let readiness = 'Beginner';
    if (problems >= 200) readiness = 'Ready';
    else if (problems >= 100) readiness = 'Intermediate';

    const $set = { targetCompany, targetRole, skills, dsaTopics, problemsSolved, readiness };
    if (leetcodeUsername !== undefined) {
      $set.leetcodeUsername = String(leetcodeUsername).trim().toLowerCase();
    }

    const career = await CareerProgress.findOneAndUpdate(
      { userId: req.user.id },
      { $set },
      { new: true, upsert: true, runValidators: true }
    );
    careerCache.del(req.user.id);
    res.json({ message: 'Career progress updated', career });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/career/topic/:topicName
exports.updateTopic = async (req, res) => {
  const { completed, problems } = req.body;
  try {
    const career = await CareerProgress.findOneAndUpdate(
      { userId: req.user.id, 'dsaTopics.name': req.params.topicName },
      {
        $set: {
          'dsaTopics.$.completed': completed,
          'dsaTopics.$.problems':  problems,
        },
      },
      { new: true }
    );
    careerCache.del(req.user.id);
    res.json({ message: 'Topic updated', career });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const { chatCompletionsCreate, HEAVY_MODEL, NANO_MODEL } = require('../services/aiService');

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

// Extracts an array of strings from a raw JSON array fragment like:
// "item one", "item, with comma", "item three"
// Splits on `","` boundaries to avoid shredding sentences that contain commas.
function extractStringArray(raw) {
  if (!raw) return [];
  const items = [];
  // Match each quoted JSON string value (handles escaped quotes inside)
  const re = /"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const val = m[1].replace(/\\"/g, '"').trim();
    if (val) items.push(val);
  }
  return items;
}

// POST /api/career/analyze-resume
exports.analyzeResume = async (req, res) => {
  try {
    const { resumeText } = req.body;
    if (!resumeText) return res.status(400).json({ message: 'Resume text is required.' });

    const career = await CareerProgress.findOne({ userId: req.user.id });
    if (!career) return res.status(404).json({ message: 'Setup your career progress first.' });

    const targetCompany = career.targetCompany || 'Other';
    const targetRole = career.targetRole || 'Software Engineer';
    const skills = (career.skills || []).join(', ');

    const systemPrompt = `You are an expert technical recruiter and resume analyzer for Software Engineering roles. Analyze the resume against the target role and target company, then return STRICT JSON only — no markdown, no code fences, no commentary before or after.

PROJECT ANALYSIS (do this before assigning a score):
For each project listed on the resume, evaluate:
- Technical depth: does it show real engineering decisions (architecture, algorithms, tradeoffs) or just a list of technologies used?
- Relevance: how closely does the tech stack and problem domain match the target role and company?
- Evidence of scale/impact: are there concrete numbers, user counts, performance figures, or system constraints handled?
- Originality: does it solve a non-trivial problem, or is it a common tutorial-style clone?
Weigh the STRONGEST 1-2 projects more heavily than weaker ones — a resume with one excellent, deep project should score higher than one with three shallow ones. Do not treat project count as a substitute for project depth.

OUTPUT SCHEMA (return fields in this exact order):
{
  "score": <integer 0-100>,
  "atsRisk": "<low|medium|high>",
  "strengths": [<1-3 short strings, max 12 words each>],
  "feedback": [<2-4 short strings, max 18 words each, one clear idea per item, avoid compound sentences with multiple commas>],
  "missingKeywords": [<0-6 short strings, single skill/tech names only, e.g. "Kubernetes" not "experience with Kubernetes">]
}

RULES:
- score: weigh relevance of skills/projects to target role and company, resume clarity, and quantified impact. Base a meaningful portion of the score on the depth and quality of the strongest project, not just presence of relevant keywords across all projects.
- atsRisk: "high" if resume uses tables/columns/graphics/unusual fonts that ATS parsers commonly fail on, non-standard section headers, or missing a skills section. "medium" if partially structured. "low" if clean, standard, parseable format.
- strengths: concrete, specific things this candidate does well — reference actual project names, technologies, or metrics from the resume, not generic praise. Prefer citing the single most technically impressive detail in each project over broad statements.
- feedback: each item must reference something specific from THIS resume (a project name, a missing metric, a specific technical gap). If a project's description doesn't explain why a technical choice was made (e.g. why a specific database, algorithm, or architecture pattern was used), that is valid, high-value feedback — call it out by project name. Before suggesting the candidate add something (metrics, a summary, specific contributions, scale details), verify it is not already present in the resume text. Do not suggest adding a metric if quantified numbers already appear in that project's description. Each item must be actionable.
- Do not suggest adding a "Summary" or "About Me" section as filler advice unless it is the single most valuable improvement for this specific resume — prefer feedback about project depth, technical decisions, or specific gaps over generic structural suggestions.
- missingKeywords: BEFORE listing a keyword, verify it does not already appear anywhere in the resume text, including the Technical Skills, Projects, or Coursework sections. Do not list a skill as missing if it is present anywhere in the resume, even if not emphasized. Double-check this list against the full resume text before finalizing.
- Do not restate strengths as feedback.
- Every string must be a single JSON string with no unescaped quotes or line breaks.
- Do not exceed the array length limits above under any circumstances, even if you think more detail would help — brevity is required for reliable parsing.
- Output nothing except the JSON object. No leading or trailing text.`;

    const userPrompt = `Resume:
"""
${resumeText}
"""

Target Role: ${targetRole}
Target Company: ${targetCompany}
Candidate's Self-Reported Skills: ${skills || 'None listed'}

Evaluate this resume specifically for how a recruiter at ${targetCompany} would screen it for a ${targetRole} position. Be honest about experience-level mismatches (e.g. student/early-career resumes evaluated against senior-level bars) rather than inflating the score.`;

    const completion = await chatCompletionsCreate({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model: HEAVY_MODEL,
      temperature: 0.1,
      max_tokens: 900,
      thinkingBudget: 256,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    let parsed = extractJSON(content);
    if (!parsed || typeof parsed.score !== 'number') {
      console.warn('[AnalyzeResume] Gemini returned invalid JSON, using regex fallback:', content);
      const scoreMatch = content.match(/"score"\s*:\s*(\d+)/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 70;
      const feedbackMatch = content.match(/"feedback"\s*:\s*\[([\s\S]*?)\]/);
      const feedback = feedbackMatch ? extractStringArray(feedbackMatch[1]) : ["Review DSA examples and formatting."];
      const kwMatch = content.match(/"missingKeywords"\s*:\s*\[([\s\S]*?)\]/);
      const missingKeywords = kwMatch ? extractStringArray(kwMatch[1]) : [];
      parsed = { score, feedback, missingKeywords, strengths: [], atsRisk: 'medium', isFallback: true };
    }

    // Save score, feedback, keywords, strengths and atsRisk in DB
    career.resumeScore = parsed.score;
    career.resumeFeedback = parsed.feedback || [];
    career.resumeKeywords = parsed.missingKeywords || [];
    career.resumeStrengths = parsed.strengths || [];
    career.resumeAtsRisk = ['low', 'medium', 'high'].includes(parsed.atsRisk) ? parsed.atsRisk : 'low';
    await career.save();

    res.json({
      score: parsed.score,
      atsRisk: career.resumeAtsRisk,
      atsRiskEstimated: Boolean(parsed.isFallback),
      strengths: career.resumeStrengths,
      feedback: parsed.feedback || [],
      missingKeywords: parsed.missingKeywords || [],
    });

  } catch (err) {
    console.error('[AnalyzeResume]', err.message);
    res.status(500).json({ message: err.message });
  }
};

// POST /api/career/mock-questions
exports.generateMockQuestions = async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ message: 'Topic is required.' });

    const career = await CareerProgress.findOne({ userId: req.user.id });
    if (!career) return res.status(404).json({ message: 'Setup your career progress first.' });

    const targetCompany = career.targetCompany || 'Other';
    const targetRole = career.targetRole || 'Software Engineer';
    const completedTopics = (career.dsaTopics || []).filter(t => t.completed).map(t => t.name).join(', ');

    const systemPrompt = `You are an expert technical interviewer at ${targetCompany}. Return a JSON object with:
- questions (array of objects containing: id (integer, 1 to 3), question (string, clear, company-specific coding or behavioral question), type ("technical" | "behavioral")).

Strictly return RAW JSON matching:
{ "questions": [ { "id": 1, "question": "Explain a time when...", "type": "behavioral" } ] }
No markdown, no fences.`;

    const userPrompt = `Generate 3 interview questions for role: ${targetRole} at company: ${targetCompany} on topic: ${topic}.
DSA topics completed: ${completedTopics || 'None'}`;

    const completion = await chatCompletionsCreate({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model: NANO_MODEL,
      temperature: 0.3,
      max_tokens: 600,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    const parsed = extractJSON(content);
    if (!parsed || !Array.isArray(parsed.questions)) {
      console.error('[GenerateQuestions] Gemini returned invalid JSON:', content);
      return res.status(500).json({ message: 'Failed to generate interview questions.' });
    }

    // Save active interview session in DB
    career.activeInterview = {
      topic,
      activeIndex: 0,
      questions: parsed.questions.map(q => ({
        id: q.id,
        question: q.question,
        type: q.type,
        userAnswer: '',
        score: 0,
        feedback: '',
        modelAnswer: '',
        isEvaluated: false
      }))
    };
    career.markModified('activeInterview');
    await career.save();

    res.json({
      activeInterview: career.activeInterview,
      questions: parsed.questions
    });

  } catch (err) {
    console.error('[GenerateQuestions]', err.message);
    res.status(500).json({ message: err.message });
  }
};

// POST /api/career/evaluate-answer
exports.evaluateInterviewAnswer = async (req, res) => {
  try {
    const { question, userAnswer, topic } = req.body;
    if (!question || !userAnswer) {
      return res.status(400).json({ message: 'Question and answer are required.' });
    }

    const career = await CareerProgress.findOne({ userId: req.user.id });
    const targetCompany = career?.targetCompany || 'Other';
    const targetRole = career?.targetRole || 'Software Engineer';

    const systemPrompt = `You are a technical interviewer. Evaluate the candidate's response to the interview question. Return a JSON object with:
- score (integer out of 10)
- feedback (string, helpful criticism, max 30 words)
- modelAnswer (string, high-quality reference response, max 60 words)

Strictly return RAW JSON matching:
{ "score": 7, "feedback": "Good analysis but explain space complexity.", "modelAnswer": "A reference answer should cover..." }
No markdown, no fences.`;

    const userPrompt = `Question: ${question}
User Answer: ${userAnswer}
Target Role: ${targetRole}
Target Company: ${targetCompany}`;

    const completion = await chatCompletionsCreate({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model: NANO_MODEL,
      temperature: 0.1,
      max_tokens: 600,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    const parsed = extractJSON(content);
    if (!parsed || typeof parsed.score !== 'number') {
      console.error('[EvaluateAnswer] Gemini returned invalid JSON:', content);
      return res.status(500).json({ message: 'Failed to evaluate your answer.' });
    }

    if (career) {
      // Find matching question in active session
      if (career.activeInterview && Array.isArray(career.activeInterview.questions)) {
        const qIndex = career.activeInterview.questions.findIndex(
          q => q.question.trim().toLowerCase() === question.trim().toLowerCase()
        );
        if (qIndex !== -1) {
          career.activeInterview.questions[qIndex].userAnswer = userAnswer;
          career.activeInterview.questions[qIndex].score = parsed.score;
          career.activeInterview.questions[qIndex].feedback = parsed.feedback || '';
          career.activeInterview.questions[qIndex].modelAnswer = parsed.modelAnswer || '';
          career.activeInterview.questions[qIndex].isEvaluated = true;
        }
      }

      // Add to historical mockInterviews log
      if (!career.mockInterviews) career.mockInterviews = [];
      career.mockInterviews.unshift({
        topic: topic || career.activeInterview?.topic || 'General',
        question,
        userAnswer,
        score: parsed.score,
        feedback: parsed.feedback || '',
        modelAnswer: parsed.modelAnswer || '',
        createdAt: new Date()
      });

      // Cap at 10 items
      if (career.mockInterviews.length > 10) {
        career.mockInterviews = career.mockInterviews.slice(0, 10);
      }

      career.markModified('activeInterview');
      career.markModified('mockInterviews');
      await career.save();
    }

    res.json({
      score: parsed.score,
      feedback: parsed.feedback || '',
      modelAnswer: parsed.modelAnswer || '',
      career
    });

  } catch (err) {
    console.error('[EvaluateAnswer]', err.message);
    res.status(500).json({ message: err.message });
  }
};

const pdfParse = require('pdf-parse');

async function extractPDFText(buffer) {
  try {
    const data = await pdfParse(buffer);
    if (data?.text?.trim()) return data.text.trim();
    throw new Error('Empty text');
  } catch (e1) {
    try {
      const mod = require('pdf-parse');
      const fn = mod.default || mod.PDF || mod.parse;
      const data = await fn(buffer);
      if (data?.text?.trim()) return data.text.trim();
      throw new Error('Empty text');
    } catch (e2) {
      try {
        const { PdfReader } = require('pdfreader');
        return await new Promise((resolve, reject) => {
          const reader = new PdfReader();
          const lines = {};
          reader.parseBuffer(buffer, (err, item) => {
            if (err) return reject(err);
            if (!item) {
              const text = Object.keys(lines)
                .sort((a, b) => a - b)
                .map(y => lines[y].join(' '))
                .join('\n');
              return resolve(text.trim());
            }
            if (item.text) {
              if (!lines[item.y]) lines[item.y] = [];
              lines[item.y].push(item.text);
            }
          });
        });
      } catch (e3) {
        throw new Error('All PDF extraction methods failed: ' + e3.message);
      }
    }
  }
}

async function extractImageText(buffer) {
  const Tesseract = require('tesseract.js');
  const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
  return text.trim();
}

// POST /api/career/upload-resume
exports.uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    // Size limit check (5MB)
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ message: 'File size exceeds the 5MB limit.' });
    }

    // Support PDF and common image formats
    const isPdf = req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf');
    const isImage = req.file.mimetype.startsWith('image/') || /\.(png|jpe?g)$/i.test(req.file.originalname);

    if (!isPdf && !isImage) {
      return res.status(400).json({ message: 'Only PDF and image formats (PNG, JPG, JPEG) are supported.' });
    }

    let resumeText = '';
    if (isPdf) {
      resumeText = await extractPDFText(req.file.buffer);
    } else {
      resumeText = await extractImageText(req.file.buffer);
    }

    if (!resumeText || !resumeText.trim()) {
      return res.status(422).json({ message: 'Failed to extract text from the file.' });
    }

    // Run AI analysis
    const career = await CareerProgress.findOne({ userId: req.user.id });
    if (!career) return res.status(404).json({ message: 'Setup your career progress first.' });

    const targetCompany = career.targetCompany || 'Other';
    const targetRole = career.targetRole || 'Software Engineer';
    const skills = (career.skills || []).join(', ');

    const systemPrompt = `You are an expert technical recruiter and resume analyzer for Software Engineering roles. Analyze the resume against the target role and target company, then return STRICT JSON only — no markdown, no code fences, no commentary before or after.

PROJECT ANALYSIS (do this before assigning a score):
For each project listed on the resume, evaluate:
- Technical depth: does it show real engineering decisions (architecture, algorithms, tradeoffs) or just a list of technologies used?
- Relevance: how closely does the tech stack and problem domain match the target role and company?
- Evidence of scale/impact: are there concrete numbers, user counts, performance figures, or system constraints handled?
- Originality: does it solve a non-trivial problem, or is it a common tutorial-style clone?
Weigh the STRONGEST 1-2 projects more heavily than weaker ones — a resume with one excellent, deep project should score higher than one with three shallow ones. Do not treat project count as a substitute for project depth.

OUTPUT SCHEMA (return fields in this exact order):
{
  "score": <integer 0-100>,
  "atsRisk": "<low|medium|high>",
  "strengths": [<1-3 short strings, max 12 words each>],
  "feedback": [<2-4 short strings, max 18 words each, one clear idea per item, avoid compound sentences with multiple commas>],
  "missingKeywords": [<0-6 short strings, single skill/tech names only, e.g. "Kubernetes" not "experience with Kubernetes">]
}

RULES:
- score: weigh relevance of skills/projects to target role and company, resume clarity, and quantified impact. Base a meaningful portion of the score on the depth and quality of the strongest project, not just presence of relevant keywords across all projects.
- atsRisk: "high" if resume uses tables/columns/graphics/unusual fonts that ATS parsers commonly fail on, non-standard section headers, or missing a skills section. "medium" if partially structured. "low" if clean, standard, parseable format.
- strengths: concrete, specific things this candidate does well — reference actual project names, technologies, or metrics from the resume, not generic praise. Prefer citing the single most technically impressive detail in each project over broad statements.
- feedback: each item must reference something specific from THIS resume (a project name, a missing metric, a specific technical gap). If a project's description doesn't explain why a technical choice was made (e.g. why a specific database, algorithm, or architecture pattern was used), that is valid, high-value feedback — call it out by project name. Before suggesting the candidate add something (metrics, a summary, specific contributions, scale details), verify it is not already present in the resume text. Do not suggest adding a metric if quantified numbers already appear in that project's description. Each item must be actionable.
- Do not suggest adding a "Summary" or "About Me" section as filler advice unless it is the single most valuable improvement for this specific resume — prefer feedback about project depth, technical decisions, or specific gaps over generic structural suggestions.
- missingKeywords: BEFORE listing a keyword, verify it does not already appear anywhere in the resume text, including the Technical Skills, Projects, or Coursework sections. Do not list a skill as missing if it is present anywhere in the resume, even if not emphasized. Double-check this list against the full resume text before finalizing.
- Do not restate strengths as feedback.
- Every string must be a single JSON string with no unescaped quotes or line breaks.
- Do not exceed the array length limits above under any circumstances, even if you think more detail would help — brevity is required for reliable parsing.
- Output nothing except the JSON object. No leading or trailing text.`;

    const userPrompt = `Resume:
"""
${resumeText}
"""

Target Role: ${targetRole}
Target Company: ${targetCompany}
Candidate's Self-Reported Skills: ${skills || 'None listed'}

Evaluate this resume specifically for how a recruiter at ${targetCompany} would screen it for a ${targetRole} position. Be honest about experience-level mismatches (e.g. student/early-career resumes evaluated against senior-level bars) rather than inflating the score.`;

    const completion = await chatCompletionsCreate({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model: HEAVY_MODEL,
      temperature: 0.1,
      max_tokens: 900,
      thinkingBudget: 256,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    let parsed = extractJSON(content);
    if (!parsed || typeof parsed.score !== 'number') {
      console.warn('[UploadResume] Gemini returned invalid JSON, using regex fallback:', content);
      const scoreMatch = content.match(/"score"\s*:\s*(\d+)/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 70;
      const feedbackMatch = content.match(/"feedback"\s*:\s*\[([\s\S]*?)\]/);
      const feedback = feedbackMatch ? extractStringArray(feedbackMatch[1]) : ["Review DSA examples and formatting."];
      const kwMatch = content.match(/"missingKeywords"\s*:\s*\[([\s\S]*?)\]/);
      const missingKeywords = kwMatch ? extractStringArray(kwMatch[1]) : [];
      parsed = { score, feedback, missingKeywords, strengths: [], atsRisk: 'medium', isFallback: true };
    }

    // Save score, feedback, keywords, strengths and atsRisk in DB
    career.resumeScore = parsed.score;
    career.resumeFeedback = parsed.feedback || [];
    career.resumeKeywords = parsed.missingKeywords || [];
    career.resumeStrengths = parsed.strengths || [];
    career.resumeAtsRisk = ['low', 'medium', 'high'].includes(parsed.atsRisk) ? parsed.atsRisk : 'low';
    await career.save();

    res.json({
      score: parsed.score,
      atsRisk: career.resumeAtsRisk,
      atsRiskEstimated: Boolean(parsed.isFallback),
      strengths: career.resumeStrengths,
      feedback: parsed.feedback || [],
      missingKeywords: parsed.missingKeywords || [],
    });

  } catch (err) {
    console.error('[UploadResume]', err.message);
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/career/active-interview/index
exports.updateActiveIndex = async (req, res) => {
  try {
    const { index } = req.body;
    if (typeof index !== 'number') {
      return res.status(400).json({ message: 'Index must be a number.' });
    }

    const career = await CareerProgress.findOne({ userId: req.user.id });
    if (!career) return res.status(404).json({ message: 'Setup your career progress first.' });

    if (career.activeInterview) {
      career.activeInterview.activeIndex = index;
      career.markModified('activeInterview');
      await career.save();
    }

    res.json({ message: 'Active index updated', activeIndex: index });
  } catch (err) {
    console.error('[UpdateActiveIndex]', err.message);
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/career/active-interview
exports.resetActiveInterview = async (req, res) => {
  try {
    const career = await CareerProgress.findOne({ userId: req.user.id });
    if (!career) return res.status(404).json({ message: 'Setup your career progress first.' });

    career.activeInterview = {
      topic: '',
      activeIndex: 0,
      questions: []
    };
    career.markModified('activeInterview');
    await career.save();

    res.json({ message: 'Active interview reset', career });
  } catch (err) {
    console.error('[ResetActiveInterview]', err.message);
    res.status(500).json({ message: err.message });
  }
};

