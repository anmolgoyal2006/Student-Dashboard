/**
 * Pulls a JSON value out of an LLM reply that may be bare JSON, fenced in a
 * ```json block, or wrapped in prose. Returns null rather than throwing, so
 * callers can fall back instead of 500-ing on a malformed model response.
 *
 * Handles both object and array roots — several copies of this logic exist
 * inline across older controllers; new code should import this one.
 */
function extractJSON(raw) {
  if (!raw) return null;

  try { return JSON.parse(raw); } catch { /* fall through */ }

  const fenceStripped = raw.replace(/```(?:json)?\s*([\s\S]*?)```/i, '$1').trim();
  try { return JSON.parse(fenceStripped); } catch { /* fall through */ }

  const start = raw.search(/[[{]/);
  if (start === -1) return null;

  const open = raw[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === open) depth++;
    else if (raw[i] === close) {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(raw.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

module.exports = { extractJSON };
