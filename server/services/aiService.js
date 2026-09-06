const https = require('https');
const { getBreaker } = require('../utils/circuitBreaker');

// Shared breaker for all Gemini calls. Trips after 5 consecutive failures and
// fast-fails for 30s so a Gemini brownout can't pile up ~30s-each hung requests
// on the user-facing AI routes (chat, DSA coach, predictions) and starve the
// connection pool. The 30s per-call timeout mirrors the socket timeout below.
const geminiBreaker = getBreaker('gemini', {
  failureThreshold: 5,
  cooldownMs: 30000,
  timeoutMs: 30000,
});

function sanitizeModel(envVal, fallback) {
  if (!envVal || typeof envVal !== 'string') return fallback;
  const v = envVal.trim();
  return v;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Heavy model: used for quality-critical analysis (resume, predictions)
const HEAVY_MODEL = sanitizeModel(process.env.GEMINI_HEAVY_MODEL, 'gemini-3.8-flash');
// Light model: used for general AI tasks (chat, DSA coach, timetable, etc.)
const LIGHT_MODEL = sanitizeModel(process.env.GEMINI_LIGHT_MODEL, 'gemini-3.8-flash');
// Nano model: used for small fast tasks (transcription, study planner)
const NANO_MODEL = sanitizeModel(process.env.GEMINI_NANO_MODEL, 'gemini-3.8-flash');
// GEMINI_MODEL kept for backward compat — any code importing it gets the light model
const GEMINI_MODEL = LIGHT_MODEL;
// Embedding model: used for RAG (semantic search over uploaded notes)
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
const BASE_URL = 'generativelanguage.googleapis.com';

if (!GEMINI_API_KEY) {
  console.warn('[AI Service] GEMINI_API_KEY is not set. AI features will fail.');
}

function geminiFetchRaw(path, body, model = LIGHT_MODEL) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: BASE_URL,
      path: `/v1beta/models/${model}:${path}?key=${GEMINI_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      let chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const errBody = raw.slice(0, 500);
          console.error(`[Gemini/${model}] HTTP ${res.statusCode} response:`, errBody);
          const err = new Error(`Gemini API error (${res.statusCode}): ${errBody}`);
          err.statusCode = res.statusCode;
          return reject(err);
        }
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new Error(`Gemini returned non-JSON: ${raw.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Gemini request timed out')); });
    req.write(data);
    req.end();
  });
}

// Breaker-gated entry point. All callers go through this; if Gemini is tripped
// the call fails fast with a CircuitOpenError instead of hanging.
function geminiFetch(path, body, model = LIGHT_MODEL) {
  return geminiBreaker.exec(() => geminiFetchRaw(path, body, model));
}

function extractTextFromResponse(json) {
  try {
    const candidate = json.candidates[0];
    if (candidate.finishReason === 'MAX_TOKENS') {
      console.warn('[Gemini] Response truncated due to MAX_TOKENS');
    }
    return candidate.content.parts[0].text || '';
  } catch {
    throw new Error('Gemini response missing text: ' + JSON.stringify(json).slice(0, 200));
  }
}

async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      // A tripped breaker means the dependency is known-down — retrying just
      // burns the request's time budget, so fail fast straight through.
      if (err.code === 'CIRCUIT_OPEN') break;
      const isModelNotFound = err.statusCode === 404 || (err.message && /not found|not available|models\//i.test(err.message));
      const nonRetryable = err.statusCode >= 400 && err.statusCode < 500 && err.statusCode !== 429 && !isModelNotFound;
      if (nonRetryable || attempt === maxRetries - 1) break;
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(`[AI Service] Attempt ${attempt + 1} failed (${err.message}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

function buildGeminiContents(messages) {
  if (!messages || !Array.isArray(messages)) return [];
  const contents = [];
  for (const msg of messages) {
    if (msg.role === 'system') continue;
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content || msg.text || '' }],
    });
  }
  return contents;
}

async function generateContent(contents, options = {}) {
  const model = options.model || LIGHT_MODEL;
  const modelCascade = [model, 'gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
  return withRetry(async (attempt) => {
    const targetModel = modelCascade[attempt] || 'gemini-3.8-flash';
    const body = { contents };

    if (options.systemInstruction) {
      body.systemInstruction = { parts: [{ text: options.systemInstruction }] };
    }

    body.generationConfig = {};
    if (options.temperature !== undefined) body.generationConfig.temperature = options.temperature;
    if (options.maxOutputTokens !== undefined) body.generationConfig.maxOutputTokens = options.maxOutputTokens;
    if (options.responseMimeType) body.generationConfig.responseMimeType = options.responseMimeType;
    if (options.thinkingBudget !== undefined) {
      body.generationConfig.thinkingConfig = { thinkingBudget: options.thinkingBudget };
    }

    const json = await geminiFetch('generateContent', body, targetModel);
    return extractTextFromResponse(json);
  });
}

/**
 * Returns a numeric embedding vector for the given text via Gemini's
 * embedContent endpoint. Used for semantic (vector) search over uploaded
 * notes — see server/services/ragService.js.
 */
async function embedText(text) {
  return withRetry(async () => {
    const json = await geminiFetch('embedContent', {
      content: { parts: [{ text }] },
    }, EMBEDDING_MODEL);

    const values = json?.embedding?.values;
    if (!Array.isArray(values) || !values.length) {
      throw new Error('Gemini embedding response missing values: ' + JSON.stringify(json).slice(0, 200));
    }
    return values;
  });
}

async function chatCompletionsCreate({ messages, temperature, max_tokens, response_format, thinkingBudget, model }) {
  const systemMsg = messages.find(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');
  const responseMimeType = response_format?.type === 'json_object' ? 'application/json' : null;

  const text = await generateContent(buildGeminiContents(otherMessages), {
    model: model || LIGHT_MODEL,
    systemInstruction: systemMsg?.content,
    temperature: temperature ?? 0.7,
    maxOutputTokens: max_tokens ?? 1000,
    responseMimeType,
    thinkingBudget: thinkingBudget !== undefined ? thinkingBudget : 0,
  });

  return {
    choices: [{ message: { content: text } }],
  };
}

async function transcribeAudio(audioBuffer, mimetype) {
  return withRetry(async () => {
    const json = await geminiFetch('generateContent', {
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: mimetype || 'audio/webm', data: audioBuffer.toString('base64') } },
          { text: 'Transcribe this audio exactly. Return only the transcribed text, nothing else.' },
        ],
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 500, thinkingConfig: { thinkingBudget: 0 } },
    }, NANO_MODEL);
    return (extractTextFromResponse(json) || '').trim();
  });
}

async function generateContentWithInlineData(parts, options = {}) {
  const model = options.model || LIGHT_MODEL;
  const modelCascade = [model, 'gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
  return withRetry(async (attempt) => {
    const targetModel = modelCascade[attempt] || 'gemini-3.8-flash';
    const body = {
      contents: [{ role: 'user', parts }],
    };

    body.generationConfig = {};
    if (options.temperature !== undefined) body.generationConfig.temperature = options.temperature;
    if (options.maxOutputTokens !== undefined) body.generationConfig.maxOutputTokens = options.maxOutputTokens;
    if (options.responseMimeType) body.generationConfig.responseMimeType = options.responseMimeType;
    body.generationConfig.thinkingConfig = { thinkingBudget: options.thinkingBudget ?? 0 };

    const json = await geminiFetch('generateContent', body, targetModel);
    return extractTextFromResponse(json);
  });
}

module.exports = {
  GEMINI_MODEL,
  HEAVY_MODEL,
  LIGHT_MODEL,
  NANO_MODEL,
  EMBEDDING_MODEL,
  GEMINI_API_KEY,
  generateText: generateContent,
  generateContent,
  chatCompletionsCreate,
  transcribeAudio,
  generateContentWithInlineData,
  embedText,
  withRetry,
};
