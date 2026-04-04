const Groq      = require('groq-sdk');
const NoteChunk = require('../models/NoteChunk');

// ── Initialize Groq ───────────────────────────────────────────────────────
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ── Split text into chunks ─────────────────────────────────────────────────
function chunkText(text, size = 500, overlap = 50) {
  const words  = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += size - overlap) {
    chunks.push(words.slice(i, i + size).join(' '));
    if (i + size >= words.length) break;
  }
  return chunks;
}

// ── Store note chunks in MongoDB ──────────────────────────────────────────
async function storeNoteEmbeddings(userId, filename, text) {
  await NoteChunk.deleteMany({ user: userId, filename });

  const chunks = chunkText(text);
  const docs   = chunks.map((chunk, i) => ({
    user:       userId,
    filename,
    chunkIndex: i,
    text:       chunk,
    embedding:  [],
  }));

  await NoteChunk.insertMany(docs);
  return docs.length;
}

// ── FREE keyword search ───────────────────────────────────────────────────
async function retrieveRelevantChunks(userId, query, topK = 4) {
  const allChunks = await NoteChunk.find({ user: userId });
  if (!allChunks.length) return [];

  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2);

  if (!keywords.length) return allChunks.slice(0, topK).map(c => ({
    text: c.text, filename: c.filename, score: 1,
  }));

  const scored = allChunks.map(chunk => {
    const text  = chunk.text.toLowerCase();
    const score = keywords.reduce(
      (s, kw) => s + (text.includes(kw) ? 1 : 0), 0
    );
    return { text: chunk.text, filename: chunk.filename, score };
  });

  const results = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // Return top results even if score is 0 (use all notes as context)
  return results;
}

// ── Main chat function ─────────────────────────────────────────────────────
async function chatWithRAG(userId, message, mode = 'chat') {
  console.log('[RAG] userId:', userId, 'mode:', mode);
  console.log('[RAG] GROQ_API_KEY exists:', !!process.env.GROQ_API_KEY);

  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set in environment variables');
  }

  const relevantChunks = await retrieveRelevantChunks(userId, message);
  console.log('[RAG] Found chunks:', relevantChunks.length);

  const context = relevantChunks.length
    ? relevantChunks
        .map((c, i) => `[Source ${i + 1} — ${c.filename}]:\n${c.text}`)
        .join('\n\n')
    : null;

  const systemPrompts = {
    chat: `You are a helpful AI study assistant for a student dashboard.
${context
  ? `Use the following notes to answer:\n\n${context}`
  : 'No notes uploaded yet. Answer based on general knowledge.'
}
Be concise, clear, and helpful. Use bullet points where appropriate.`,

    summarize: `You are a study assistant. Summarize the following notes clearly.
Organize with headings and bullet points.
${context ? `Notes:\n\n${context}` : 'No notes found. Ask the student to upload notes first.'}`,

    quiz: `You are a study assistant. Generate 5 multiple-choice questions based on these notes.
Format each as:
Q1: [question]
A) [option]  B) [option]  C) [option]  D) [option]
Answer: [letter]

${context ? `Notes:\n\n${context}` : 'No notes found. Ask the student to upload notes first.'}`,
  };

  console.log('[RAG] Calling Groq API...');

  const completion = await groq.chat.completions.create({
    model:       'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompts[mode] || systemPrompts.chat },
      { role: 'user',   content: message },
    ],
    max_tokens:  1000,
    temperature: 0.7,
  });

  console.log('[RAG] Groq response received');

  const answer  = completion.choices[0].message.content;
  const sources = relevantChunks
    .filter(c => c.score > 0)
    .map(c => ({
      filename: c.filename,
      preview:  c.text.slice(0, 120) + '...',
    }));

  return { answer, sources };
}

module.exports = { storeNoteEmbeddings, chatWithRAG };