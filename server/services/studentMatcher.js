/**
 * Match students across PDFs — SID/roll first, then normalized name, then fuzzy name.
 */

function normalizeName(name) {
  const cleaned = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[.,']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.split(' ').filter(Boolean).sort().join(' ');
}

function nameTokens(name) {
  return normalizeName(name).split(' ').filter((t) => t.length > 1);
}

function normalizeRoll(roll) {
  return String(roll || '').trim().replace(/\s+/g, '').toLowerCase();
}

function fuzzyNameMatch(a, b) {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return false;

  // Exact normalized match (handles word-order differences like "KUMAR SUMIT" vs "SUMIT KUMAR")
  if (normalizeName(a) === normalizeName(b)) return true;

  // Token overlap — require ALL tokens of BOTH names to overlap.
  // This prevents "SUMIT" (1 token) from matching "SUMIT KUMAR" (2 tokens):
  // overlap=1, ta.length=1, tb.length=2 → 1 < 2 → no match.
  const setB = new Set(tb);
  const overlap = ta.filter((t) => setB.has(t)).length;
  if (overlap === ta.length && overlap === tb.length) return true;

  return false;
}

function studentKey(name, roll) {
  const r = normalizeRoll(roll);
  if (r && /^\d{5,12}$/.test(r)) return `sid:${r}`;
  if (r && r.length >= 4) return `roll:${r}`;
  const n = normalizeName(name);
  return n ? `name:${n}` : '';
}

function buildScoreLookup(students) {
  const bySid = new Map();
  const byRoll = new Map();
  const byName = new Map();
  const nameList = [];

  for (const st of students || []) {
    const score = Number(st.score) || 0;
    const roll = normalizeRoll(st.roll);
    const nameKey = normalizeName(st.name);

    if (roll && /^\d{5,12}$/.test(roll) && !bySid.has(roll)) bySid.set(roll, score);
    else if (roll && !byRoll.has(roll)) byRoll.set(roll, score);

    if (nameKey && !byName.has(nameKey)) {
      byName.set(nameKey, score);
      nameList.push({ nameKey, displayName: st.name, score });
    }
  }

  return { bySid, byRoll, byName, nameList };
}

function lookupScore(entry, lookup) {
  const roll = normalizeRoll(entry.roll);

  if (roll && /^\d{5,12}$/.test(roll) && lookup.bySid.has(roll)) {
    return lookup.bySid.get(roll);
  }
  if (roll && lookup.byRoll.has(roll)) return lookup.byRoll.get(roll);

  const nameKey = normalizeName(entry.name);
  if (nameKey && lookup.byName.has(nameKey)) return lookup.byName.get(nameKey);

  for (const { displayName, score } of lookup.nameList) {
    if (fuzzyNameMatch(entry.name, displayName)) return score;
  }

  return 0;
}

module.exports = {
  normalizeName,
  normalizeRoll,
  fuzzyNameMatch,
  studentKey,
  buildScoreLookup,
  lookupScore,
};
