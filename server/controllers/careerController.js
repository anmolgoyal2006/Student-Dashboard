const CareerProgress = require('../models/CareerProgress');

const DSA_TOPICS = [
  'Arrays', 'Strings', 'Linked Lists', 'Stacks & Queues',
  'Trees', 'Graphs', 'Dynamic Programming', 'Recursion & Backtracking',
  'Sorting & Searching', 'Hashing', 'Greedy', 'Tries',
];

// GET /api/career
exports.getCareer = async (req, res) => {
  try {
    let career = await CareerProgress.findOne({ userId: req.user.id });
    if (!career) {
      // Auto-create with default DSA topics
      career = await CareerProgress.create({
        userId: req.user.id,
        dsaTopics: DSA_TOPICS.map(name => ({ name, completed: false, problems: 0 })),
      });
    }
    res.json({ career });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/career
exports.updateCareer = async (req, res) => {
  try {
    const { targetCompany, targetRole, skills, dsaTopics, problemsSolved } = req.body;

    // Recalculate readiness
    const problems = problemsSolved ?? 0;
    let readiness = 'Beginner';
    if (problems >= 200) readiness = 'Ready';
    else if (problems >= 100) readiness = 'Intermediate';

    const career = await CareerProgress.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { targetCompany, targetRole, skills, dsaTopics, problemsSolved, readiness } },
      { new: true, upsert: true, runValidators: true }
    );
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
    res.json({ message: 'Topic updated', career });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_CHAT_KEY || process.env.GROQ_API_KEY });

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

    const systemPrompt = `You are an expert technical recruiter and resume analyzer. Return a JSON object with:
- score (integer, 0 to 100) based on target company, target role, and resume text
- feedback (array of strings, max 4 items, constructive feedback)
- missingKeywords (array of strings, key technical skills/technologies missing for target role/company)

Strictly return RAW JSON matching:
{ "score": 85, "feedback": ["Improve DSA examples"], "missingKeywords": ["Redis"] }
No markdown, no fences.`;

    const userPrompt = `Analyze this resume:
${resumeText}

For Target Role: ${targetRole}
Target Company: ${targetCompany}
Current Skills Listed: ${skills}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 600,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    const parsed = extractJSON(content);
    if (!parsed || typeof parsed.score !== 'number') {
      console.error('[AnalyzeResume] Llama returned invalid JSON:', content);
      return res.status(500).json({ message: 'Failed to analyze resume structure.' });
    }

    // Save score in DB
    career.resumeScore = parsed.score;
    await career.save();

    res.json({
      score: parsed.score,
      feedback: parsed.feedback || [],
      missingKeywords: parsed.missingKeywords || []
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

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 600,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    const parsed = extractJSON(content);
    if (!parsed || !Array.isArray(parsed.questions)) {
      console.error('[GenerateQuestions] Llama returned invalid JSON:', content);
      return res.status(500).json({ message: 'Failed to generate interview questions.' });
    }

    res.json({ questions: parsed.questions });

  } catch (err) {
    console.error('[GenerateQuestions]', err.message);
    res.status(500).json({ message: err.message });
  }
};

// POST /api/career/evaluate-answer
exports.evaluateInterviewAnswer = async (req, res) => {
  try {
    const { question, userAnswer } = req.body;
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

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 600,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    const parsed = extractJSON(content);
    if (!parsed || typeof parsed.score !== 'number') {
      console.error('[EvaluateAnswer] Llama returned invalid JSON:', content);
      return res.status(500).json({ message: 'Failed to evaluate your answer.' });
    }

    res.json({
      score: parsed.score,
      feedback: parsed.feedback || '',
      modelAnswer: parsed.modelAnswer || ''
    });

  } catch (err) {
    console.error('[EvaluateAnswer]', err.message);
    res.status(500).json({ message: err.message });
  }
};

