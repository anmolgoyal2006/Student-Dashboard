const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Heavy model: used for resume analysis and grade prediction (quality-critical)
const HEAVY_MODEL = process.env.GEMINI_HEAVY_MODEL || 'gemini-2.5-flash';
// Light model: used for mid-complexity tasks (DSA coach, chat, AI commands, etc.)
const LIGHT_MODEL = process.env.GEMINI_LIGHT_MODEL || 'gemini-2.0-flash';
// Nano model: used for small, fast tasks (transcription, OCR cells, study planner, interview Qs)
const NANO_MODEL = process.env.GEMINI_NANO_MODEL || 'gemini-1.5-flash';
// GEMINI_MODEL kept for backward compat — any code importing it gets the light model
const GEMINI_MODEL = LIGHT_MODEL;
const BASE_URL = 'generativelanguage.googleapis.com';

if (!GEMINI_API_KEY) {
  console.warn('[AI Service] GEMINI_API_KEY is not set. AI features will fail.');
}

function geminiFetch(path, body, model = LIGHT_MODEL) {
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
      return await fn();
    } catch (err) {
      lastError = err;
      const nonRetryable = err.statusCode >= 400 && err.statusCode < 500 && err.statusCode !== 429;
      if (nonRetryable || attempt === maxRetries - 1) break;
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(`[AI Service] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, err.message);
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
  return withRetry(async () => {
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

    const json = await geminiFetch('generateContent', body, model);
    return extractTextFromResponse(json);
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
  return withRetry(async () => {
    const body = {
      contents: [{ role: 'user', parts }],
    };

    body.generationConfig = {};
    if (options.temperature !== undefined) body.generationConfig.temperature = options.temperature;
    if (options.maxOutputTokens !== undefined) body.generationConfig.maxOutputTokens = options.maxOutputTokens;
    body.generationConfig.thinkingConfig = { thinkingBudget: options.thinkingBudget ?? 0 };

    const json = await geminiFetch('generateContent', body, model);
    return extractTextFromResponse(json);
  });
}

module.exports = {
  GEMINI_MODEL,
  HEAVY_MODEL,
  LIGHT_MODEL,
  NANO_MODEL,
  GEMINI_API_KEY,
  generateText: generateContent,
  generateContent,
  chatCompletionsCreate,
  transcribeAudio,
  generateContentWithInlineData,
  withRetry,
};
