const Groq    = require('groq-sdk');
const Subject = require('../models/Subject');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const EXPLAIN_KEYWORDS = ['explain', 'what is', 'tell me about', 'describe'];

// ── Groq prompt ───────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a command parser for a student dashboard. 
Your ONLY job is to convert natural language into a strict JSON object.

RULES:
- Return ONLY valid JSON. No explanation. No markdown. No extra text.
- Always return exactly this structure:
  {"action":"add"|"update"|"delete","entity":"subject","subjectName":"string","credits":number|null}
- "credits" is null if not mentioned or not applicable (e.g. for delete)
- Normalize subjectName: capitalize first letter of each word
- If command is unclear or not about subjects, return:
  {"action":"unknown","entity":"subject","subjectName":null,"credits":null}

EXAMPLES:
Input: "Add DSA subject with 4 credits"
Output: {"action":"add","entity":"subject","subjectName":"DSA","credits":4}

Input: "Update Operating Systems credits to 3"
Output: {"action":"update","entity":"subject","subjectName":"Operating Systems","credits":3}

Input: "Delete DBMS"
Output: {"action":"delete","entity":"subject","subjectName":"DBMS","credits":null}

Input: "remove machine learning subject"
Output: {"action":"delete","entity":"subject","subjectName":"Machine Learning","credits":null}

Input: "add computer networks with 3 credits"
Output: {"action":"add","entity":"subject","subjectName":"Computer Networks","credits":3}`;

// ── POST /api/ai-command ──────────────────────────────────────────────────
exports.processCommand = async (req, res) => {
  try {
    const { command } = req.body;

    if (!command?.trim())
      return res.status(400).json({ message: 'Command is required.' });

    console.log('[AI Command] Input:', command);

    // ── Check for explain intent ──────────────────────────────────────
    const hasExplain = EXPLAIN_KEYWORDS.some(k =>        // ← moved INSIDE function
      command.toLowerCase().includes(k)
    );

    // ── Call Groq ─────────────────────────────────────────────────────
    const completion = await groq.chat.completions.create({
      model:       'llama-3.3-70b-versatile',
      temperature: 0,
      max_tokens:  150,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: command.trim() },
      ],
    });

    const raw = completion.choices[0].message.content.trim();
    console.log('[AI Command] Groq raw output:', raw);

    // ── Parse JSON safely ─────────────────────────────────────────────
    let parsed;
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      return res.status(422).json({
        message: 'AI could not parse your command. Please try again.',
        raw,
      });
    }

    // ── Validate ──────────────────────────────────────────────────────
    const { action, entity, subjectName, credits } = parsed;

    if (action === 'unknown' || !subjectName) {
      return res.status(422).json({
        message: "I didn't understand that command. Try: 'Add DSA with 4 credits'",
      });
    }

    if (entity !== 'subject') {
      return res.status(422).json({ message: 'Only subject commands are supported.' });
    }

    const userId = req.user.id;

    // ── ADD ───────────────────────────────────────────────────────────
    if (action === 'add') {
      if (!credits) {
        return res.status(400).json({
          message: `Please specify credits for "${subjectName}". Example: "Add ${subjectName} with 4 credits"`,
        });
      }
      const existing = await Subject.findOne({
        userId,
        name: { $regex: new RegExp(`^${subjectName}$`, 'i') },
      });
      if (existing) {
        return res.status(409).json({ message: `Subject "${subjectName}" already exists.` });
      }
      const autoCode = subjectName
  .split(' ')
  .map(w => w[0].toUpperCase())
  .join('') + Math.floor(100 + Math.random() * 900);

const subject = await Subject.create({
  userId,
  name:       subjectName,
  credits,
  code:       autoCode,   // ← e.g. "DSA101", "OS302", "CN215"
  instructor: '',
  schedule:   [],
});

      return res.json({
        message:      `✅ Added "${subjectName}" with ${credits} credits.`,
        action,
        subject,
        explainTopic: hasExplain ? subjectName : null,  // ← correctly placed here
      });
    }

    // ── UPDATE ────────────────────────────────────────────────────────
    if (action === 'update') {
      if (!credits) {
        return res.status(400).json({
          message: `Please specify new credits for "${subjectName}".`,
        });
      }
      const subject = await Subject.findOneAndUpdate(
        { userId, name: { $regex: new RegExp(`^${subjectName}$`, 'i') } },
        { $set: { credits } },
        { new: true }
      );
      if (!subject) {
        return res.status(404).json({ message: `Subject "${subjectName}" not found.` });
      }
      return res.json({
        message: `✅ Updated "${subjectName}" credits to ${credits}.`,
        action,
        subject,
      });
    }

    // ── DELETE ────────────────────────────────────────────────────────
    if (action === 'delete') {
      const subject = await Subject.findOneAndDelete({
        userId,
        name: { $regex: new RegExp(`^${subjectName}$`, 'i') },
      });
      if (!subject) {
        return res.status(404).json({ message: `Subject "${subjectName}" not found.` });
      }
      return res.json({
        message:   `✅ Deleted "${subjectName}".`,
        action,
        deletedId: subject._id,
      });
    }

    return res.status(400).json({ message: 'Unknown action.' });

  } catch (err) {
    console.error('[AI Command ERROR]', err.message);
    res.status(500).json({ message: 'AI command failed. Please try again.' });
  }
};