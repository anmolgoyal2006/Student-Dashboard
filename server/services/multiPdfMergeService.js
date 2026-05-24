/**
 * Merge multiple PDF sources — format-agnostic student matching.
 */

const { rankStudents, buildLeaderboard } = require('./rankingService');
const {
  studentKey,
  buildScoreLookup,
  lookupScore,
  normalizeName,
  normalizeRoll,
  fuzzyNameMatch,
} = require('./studentMatcher');

const round2 = (n) => Math.round(n * 100) / 100;

function mergeSourcesAndScore(sources) {
  if (!sources?.length) throw new Error('At least one PDF source is required.');

  const weights = sources.map((s) => Number(s.weight) || 0);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) throw new Error('Total weight must be greater than zero.');

  const normalizedWeights = weights.map((w) => w / totalWeight);
  const studentMap = new Map();

  const ensureStudent = (name, roll) => {
    const key = studentKey(name, roll);
    if (!key) return null;

    if (!studentMap.has(key)) {
      studentMap.set(key, {
        name       : String(name).trim(),
        roll       : normalizeRoll(roll),
        marksByLabel: {},
        totalScore : 0,
        breakdown  : {},
      });
      return studentMap.get(key);
    }

    const entry = studentMap.get(key);
    if (roll && !entry.roll) entry.roll = normalizeRoll(roll);
    if (name && entry.name.length < String(name).trim().length) {
      entry.name = String(name).trim();
    }
    return entry;
  };

  for (const source of sources) {
    for (const st of source.students || []) {
      ensureStudent(st.name, st.roll);
    }
  }

  // Merge entries that fuzzy-match by name but had different keys (no SID in one PDF)
  const entries = Array.from(studentMap.entries());
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [ki, ei] = entries[i];
      const [kj, ej] = entries[j];
      if (ki === kj) continue;
      const sameSid = ei.roll && ej.roll && ei.roll === ej.roll;
      const sameName = fuzzyNameMatch(ei.name, ej.name);
      if (!sameSid && !sameName) continue;

      const keep = ki.startsWith('sid:') || ki.startsWith('roll:') ? ki : kj;
      const drop = keep === ki ? kj : ki;
      const kept = studentMap.get(keep);
      const dropped = studentMap.get(drop);
      if (dropped.roll && !kept.roll) kept.roll = dropped.roll;
      if (dropped.name.length > kept.name.length) kept.name = dropped.name;
      studentMap.delete(drop);
      entries.splice(entries.findIndex(([k]) => k === drop), 1);
      j--;
    }
  }

  for (const entry of studentMap.values()) {
    entry.marksByLabel = {};
    entry.breakdown = {};
    entry.totalScore = 0;
  }

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const label = source.label || `Source ${i + 1}`;
    const nw = normalizedWeights[i];
    const w = weights[i];
    const lookup = buildScoreLookup(source.students);

    for (const entry of studentMap.values()) {
      const raw = lookupScore(entry, lookup);
      const contribution = raw;
      entry.marksByLabel[label] = raw;
      entry.breakdown[label] = {
        raw,
        weight           : w,
        normalizedWeight : round2(nw),
        score            : round2(contribution),
      };
      entry.totalScore += contribution;
    }
  }

  const scoredStudents = Array.from(studentMap.values()).map((e) => ({
    name      : e.name,
    roll      : e.roll,
    marks     : e.marksByLabel,
    breakdown : e.breakdown,
    totalScore: round2(e.totalScore),
  }));

  const ranked = rankStudents(scoredStudents);
  const labels = sources.map((s, i) => s.label || `Source ${i + 1}`);
  const metaColumns = labels.map((label, i) => ({
    name             : label,
    max              : weights[i],
    effectiveWeight  : weights[i],
    normalizedWeight : round2(normalizedWeights[i]),
  }));

  const entry = buildLeaderboard(ranked, metaColumns, 'Combined', { showBreakdown: true });

  return {
    leaderboard    : [entry],
    rankedStudents : ranked,
    totalStudents  : ranked.length,
    sources        : sources.map((s, i) => ({
      id               : s.id,
      label            : s.label || `Source ${i + 1}`,
      weight           : weights[i],
      normalizedWeight : round2(normalizedWeights[i]),
      studentCount     : (s.students || []).length,
    })),
  };
}

module.exports = { mergeSourcesAndScore, normalizeName };
