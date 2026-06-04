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
    let parsed = extractJSON(content);
    if (!parsed || typeof parsed.score !== 'number') {
      console.warn('[AnalyzeResume] Llama returned invalid JSON, using regex fallback:', content);
      const scoreMatch = content.match(/"score"\s*:\s*(\d+)/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 70;
      const feedbackMatch = content.match(/"feedback"\s*:\s*\[([\s\S]*?)\]/);
      const feedback = feedbackMatch ? feedbackMatch[1].split(',').map(s => s.replace(/"/g, '').trim()).filter(Boolean) : ["Review DSA examples and formatting."];
      const kwMatch = content.match(/"missingKeywords"\s*:\s*\[([\s\S]*?)\]/);
      const missingKeywords = kwMatch ? kwMatch[1].split(',').map(s => s.replace(/"/g, '').trim()).filter(Boolean) : [];
      parsed = { score, feedback, missingKeywords };
    }

    // Save score, feedback and keywords in DB
    career.resumeScore = parsed.score;
    career.resumeFeedback = parsed.feedback || [];
    career.resumeKeywords = parsed.missingKeywords || [];
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
    let parsed = extractJSON(content);
    if (!parsed || typeof parsed.score !== 'number') {
      console.warn('[UploadResume] Llama returned invalid JSON, using regex fallback:', content);
      const scoreMatch = content.match(/"score"\s*:\s*(\d+)/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 70;
      const feedbackMatch = content.match(/"feedback"\s*:\s*\[([\s\S]*?)\]/);
      const feedback = feedbackMatch ? feedbackMatch[1].split(',').map(s => s.replace(/"/g, '').trim()).filter(Boolean) : ["Review DSA examples and formatting."];
      const kwMatch = content.match(/"missingKeywords"\s*:\s*\[([\s\S]*?)\]/);
      const missingKeywords = kwMatch ? kwMatch[1].split(',').map(s => s.replace(/"/g, '').trim()).filter(Boolean) : [];
      parsed = { score, feedback, missingKeywords };
    }

    // Save score, feedback and keywords in DB
    career.resumeScore = parsed.score;
    career.resumeFeedback = parsed.feedback || [];
    career.resumeKeywords = parsed.missingKeywords || [];
    await career.save();

    res.json({
      score: parsed.score,
      feedback: parsed.feedback || [],
      missingKeywords: parsed.missingKeywords || []
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

