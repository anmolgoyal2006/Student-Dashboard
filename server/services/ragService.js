const mongoose  = require('mongoose');
const NoteChunk = require('../models/NoteChunk');
const { chatCompletionsCreate, LIGHT_MODEL } = require('./aiService');

function chunkText(text, size = 500, overlap = 50) {
  const words  = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += size - overlap) {
    chunks.push(words.slice(i, i + size).join(' '));
    if (i + size >= words.length) break;
  }
  return chunks;
}

async function storeNoteEmbeddings(userId, filename, text) {
  // Always convert to ObjectId before saving
  const userObjectId = new mongoose.Types.ObjectId(userId);

  await NoteChunk.deleteMany({ user: userObjectId, filename });

  const chunks = chunkText(text);
  const docs   = chunks.map((chunk, i) => ({
    user:       userObjectId,   // ← always ObjectId
    filename,
    chunkIndex: i,
    text:       chunk,
    embedding:  [],
  }));

  await NoteChunk.insertMany(docs);
  console.log('[RAG] Stored', docs.length, 'chunks for user:', userId);
  return docs.length;
}

async function retrieveRelevantChunks(userId, query, topK = 4) {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const allChunks    = await NoteChunk.find({ user: userObjectId });

  console.log('[RAG] Total chunks for user:', allChunks.length);
  if (!allChunks.length) return [];

  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  const scored = allChunks.map(chunk => {
    const text  = chunk.text.toLowerCase();
    const score = keywords.reduce((s, kw) => s + (text.includes(kw) ? 1 : 0), 0);
    return { text: chunk.text, filename: chunk.filename, score };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

async function chatWithRAG(userId, message, mode = 'chat', history = []) {
  console.log('[RAG] userId:', userId, 'mode:', mode);
  console.log('[RAG] GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);

  if (!process.env.GEMINI_API_KEY)
    throw new Error('GEMINI_API_KEY is not set');

  const relevantChunks = await retrieveRelevantChunks(userId, message);
  console.log('[RAG] Found chunks:', relevantChunks.length);

  const context = relevantChunks.length
    ? relevantChunks.map((c, i) => `[Source ${i+1} — ${c.filename}]:\n${c.text}`).join('\n\n')
    : null;

  const systemPrompts = {
    chat: `You are a helpful AI study assistant.
${context ? `Use these notes to answer:\n\n${context}` : 'Answer from general knowledge.'}
Be concise and use bullet points where helpful.`,

    summarize: `Summarize the following notes with headings and bullet points.
${context ? `Notes:\n\n${context}` : 'No notes found.'}`,

    quiz: `Generate 5 multiple-choice questions from these notes.
Format:
Q1: [question]
A) B) C) D)
Answer: [letter]

${context ? `Notes:\n\n${context}` : 'No notes found.'}`,
  };

  const historyMessages = [];
  if (Array.isArray(history)) {
    const recentHistory = history.slice(-6);
    for (const msg of recentHistory) {
      const role = msg.role === 'user' ? 'user' : 'assistant';
      historyMessages.push({ role, content: msg.text || '' });
    }
  }

  const completion = await chatCompletionsCreate({
    model: LIGHT_MODEL,
    messages: [
      { role: 'system', content: systemPrompts[mode] || systemPrompts.chat },
      ...historyMessages,
      { role: 'user',   content: message },
    ],
    max_tokens:  1000,
    temperature: 0.7,
    thinkingBudget: 512,
  });

  const answer  = completion.choices[0].message.content;
  const sources = relevantChunks
    .filter(c => c.score > 0)
    .map(c => ({ filename: c.filename, preview: c.text.slice(0, 120) + '...' }));

  return { answer, sources };
}

module.exports = { storeNoteEmbeddings, chatWithRAG };