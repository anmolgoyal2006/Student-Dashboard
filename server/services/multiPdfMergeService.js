/**
 * Merge multiple PDF sources — format-agnostic student matching.
 * Supports best-of groups (e.g. best 2 out of 3).
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

/**
 * @param {Object[]} sources         - Normalized PDF sources
 * @param {Object[]} [bestOfConfigs] - Best-of group definitions
 *   [{ sourceIds: string[], bestOf: number }]
 */
function mergeSourcesAndScore(sources, bestOfConfigs = []) {
  if (!sources?.length) throw new Error('At least one PDF source is required.');

  // Sources that belong to best-of groups are excluded from weight calculation
  const groupedIds = new Set();
  for (const cfg of bestOfConfigs) {
    for (const sid of (cfg.sourceIds || [])) {
      groupedIds.add(sid);
    }
  }

  const ungrouped = sources.filter((s) => !groupedIds.has(s.id));
  const weights = ungrouped.map((s) => Number(s.weight) || 0);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  if (ungrouped.length > 0 && totalWeight <= 0) {
    throw new Error('Total weight must be greater than zero.');
  }

  const normalizedWeights = weights.map((w) => (totalWeight > 0 ? w / totalWeight : 0));
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

  // Merge entries that fuzzy-match by name but had different keys
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

  // ── Process non-grouped sources (current behavior) ───────────────────
  let ungroupedIdx = 0;
  for (const source of ungrouped) {
    const label = source.label || `Source ${ungroupedIdx + 1}`;
    const nw = normalizedWeights[ungroupedIdx];
    const w = weights[ungroupedIdx];
    const lookup = buildScoreLookup(source.students);

    for (const entry of studentMap.values()) {
      const raw = lookupScore(entry, lookup) || 0;
      entry.marksByLabel[label] = raw;
      entry.breakdown[label] = {
        raw,
        weight           : w,
        normalizedWeight : round2(nw),
        score            : round2(raw),
      };
      entry.totalScore += raw;
    }
    ungroupedIdx++;
  }

  // ── Process best-of groups ─────────────────────────────────────────
  const processedGroups = [];
  for (const cfg of bestOfConfigs) {
    const { sourceIds, bestOf } = cfg;
    const groupSources = sourceIds
      .map((id) => sources.find((s) => s.id === id))
      .filter(Boolean);

    const groupLabel = groupSources.map((s) => s.label).join(' / ');
    const lookups = groupSources.map((s) => buildScoreLookup(s.students));

    for (const entry of studentMap.values()) {
      const rawScores = lookups.map((lk) => lookupScore(entry, lk));
      const validScores = rawScores.filter(
        (s) => s !== null && s !== undefined && !isNaN(s)
      );
      const sorted = [...validScores].sort((a, b) => b - a);
      const topN = sorted.slice(0, Math.min(bestOf, sorted.length));
      const groupScore = topN.reduce((a, b) => a + b, 0);

      // Store individual source scores in marksByLabel
      groupSources.forEach((src, idx) => {
        entry.marksByLabel[src.label] = rawScores[idx];
      });

      // Store the best-of combined breakdown
      entry.breakdown[groupLabel] = {
        raw: rawScores,
        bestOf: {
          selected: topN,
          n: bestOf,
          total: groupSources.length,
        },
        score: round2(groupScore),
      };
      entry.totalScore += groupScore;
    }

    processedGroups.push({
      label: groupLabel,
      bestOf,
      sourceCount: groupSources.length,
      sourceIds: groupSources.map((s) => s.id),
    });
  }

  // ── Build final response ────────────────────────────────────────────
  const scoredStudents = Array.from(studentMap.values()).map((e) => ({
    name      : e.name,
    roll      : e.roll,
    marks     : e.marksByLabel,
    breakdown : e.breakdown,
    totalScore: round2(e.totalScore),
  }));

  const ranked = rankStudents(scoredStudents);

  const labels = sources.map((s, i) => s.label || `Source ${i + 1}`);
  const metaColumns = labels.map((label, i) => {
    const isGrouped = groupedIds.has(sources[i].id);
    // Find the group this source belongs to
    const group = bestOfConfigs.find((g) => (g.sourceIds || []).includes(sources[i].id));
    return {
      name             : label,
      max              : isGrouped ? 0 : (weights[ungrouped.indexOf(sources[i])] || 0),
      effectiveWeight  : isGrouped ? 0 : (weights[ungrouped.indexOf(sources[i])] || 0),
      normalizedWeight : isGrouped
        ? 0
        : round2(normalizedWeights[ungrouped.indexOf(sources[i])] || 0),
      isBestOf         : isGrouped,
      bestOfGroup      : group ? { bestOf: group.bestOf, total: group.sourceIds.length } : undefined,
    };
  });

  const entry = buildLeaderboard(ranked, metaColumns, 'Combined', { showBreakdown: true });

  return {
    leaderboard     : [entry],
    rankedStudents  : ranked,
    totalStudents   : ranked.length,
    sources         : sources.map((s, i) => {
      const isGrouped = groupedIds.has(s.id);
      const group = bestOfConfigs.find((g) => (g.sourceIds || []).includes(s.id));
      return {
        id               : s.id,
        label            : s.label || `Source ${i + 1}`,
        weight           : isGrouped ? 0 : (weights[ungrouped.indexOf(s)] || 0),
        normalizedWeight : isGrouped
          ? 0
          : round2(normalizedWeights[ungrouped.indexOf(s)] || 0),
        studentCount     : (s.students || []).length,
        isBestOf         : isGrouped,
        bestOfGroup      : group
          ? { bestOf: group.bestOf, total: group.sourceIds.length }
          : undefined,
      };
    }),
    bestOfGroups    : processedGroups,
  };
}

module.exports = { mergeSourcesAndScore, normalizeName };
