/**
 * Merge multiple PDF sources — format-agnostic student matching.
 * Supports column-level best-of groups (e.g. best 3 out of 4 quizzes across PDFs).
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
 * Build a student lookup that returns the full student object (with breakdown).
 */
function buildFullStudentLookup(students) {
  const bySid = new Map();
  const byRoll = new Map();
  const byName = new Map();
  const nameList = [];

  for (const st of students || []) {
    const roll = normalizeRoll(st.roll);
    const nk = normalizeName(st.name);
    if (roll && /^\d{5,12}$/.test(roll) && !bySid.has(roll)) bySid.set(roll, st);
    else if (roll && !byRoll.has(roll)) byRoll.set(roll, st);
    if (nk && !byName.has(nk)) {
      byName.set(nk, st);
      nameList.push({ nk, name: st.name, s: st });
    }
  }
  return { bySid, byRoll, byName, nameList };
}

function findFullStudent(entry, lookup) {
  const roll = normalizeRoll(entry.roll);
  if (roll && /^\d{5,12}$/.test(roll) && lookup.bySid.has(roll)) return lookup.bySid.get(roll);
  if (roll && lookup.byRoll.has(roll)) return lookup.byRoll.get(roll);
  const nk = normalizeName(entry.name);
  if (nk && lookup.byName.has(nk)) return lookup.byName.get(nk);
  for (const { name, s } of lookup.nameList) {
    if (fuzzyNameMatch(entry.name, name)) return s;
  }
  return null;
}

/**
 * @param {Object[]} sources         - Normalized PDF sources
 * @param {Object[]} [bestOfConfigs] - Best-of group definitions
 *   [{ bestOf: number, items: [{ sourceId, columnName }] }]
 */
function mergeSourcesAndScore(sources, bestOfConfigs = []) {
  if (!sources?.length) throw new Error('At least one PDF source is required.');

  // ── Track which (sourceId, columnName) pairs are in best-of groups ──
  const groupedColumns = new Map(); // sourceId → Set<columnName>
  for (const cfg of bestOfConfigs) {
    for (const item of (cfg.items || [])) {
      if (!groupedColumns.has(item.sourceId)) {
        groupedColumns.set(item.sourceId, new Set());
      }
      groupedColumns.get(item.sourceId).add(item.columnName);
    }
  }

  const hasGroupedColumns = (sid) => groupedColumns.has(sid) && groupedColumns.get(sid).size > 0;

  // Sources that have ALL selected columns in best-of groups → excluded from non-grouped scoring
  const isFullyGrouped = (s) => {
    if (!hasGroupedColumns(s.id)) return false;
    const grouped = groupedColumns.get(s.id);
    const selected = s.selectedColumns || s.columns.map((c) => c.name);
    return selected.every((col) => grouped.has(col));
  };

  const ungrouped = sources.filter((s) => !isFullyGrouped(s));
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

  // ── Process non-grouped sources ─────────────────────────────────────
  // For sources that have SOME columns in best-of groups, subtract those
  // column scores so they aren't double-counted.
  let ungroupedIdx = 0;
  for (const source of ungrouped) {
    const label = source.label || `Source ${ungroupedIdx + 1}`;
    const nw = normalizedWeights[ungroupedIdx];
    const w = weights[ungroupedIdx];
    const lookup = buildScoreLookup(source.students);
    const fullLookup = hasGroupedColumns(source.id)
      ? buildFullStudentLookup(source.students)
      : null;
    const groupedCols = groupedColumns.get(source.id);

    for (const entry of studentMap.values()) {
      let raw = lookupScore(entry, lookup) || 0;

      // Subtract scores of columns that are in best-of groups
      if (fullLookup && groupedCols) {
        const studentData = findFullStudent(entry, fullLookup);
        if (studentData?.breakdown) {
          for (const colName of groupedCols) {
            const colScore = studentData.breakdown[colName]?.score ?? 0;
            raw -= colScore;
          }
        }
      }

      raw = Math.max(0, raw);
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

  // ── Process best-of groups (column-level) ──────────────────────────
  const processedGroups = [];
  const bestOfItemMeta = []; // { groupIdx, itemIndex, srcId, colName }

  for (let gi = 0; gi < bestOfConfigs.length; gi++) {
    const cfg = bestOfConfigs[gi];
    const { bestOf, items } = cfg;
    if (!items || items.length === 0) continue;

    // Build a lookup per unique sourceId among items
    const sourceLookups = new Map(); // sourceId → { fullLookup, source }
    for (const item of items) {
      if (!sourceLookups.has(item.sourceId)) {
        const src = sources.find((s) => s.id === item.sourceId);
        if (src) {
          sourceLookups.set(item.sourceId, {
            source: src,
            fullLookup: buildFullStudentLookup(src.students),
          });
        }
      }
    }

    const groupLabel = [...new Set(items.map((i) => {
      const src = sources.find((s) => s.id === i.sourceId);
      return src ? `${src.label} · ${i.columnName}` : i.columnName;
    }))].join(' / ');

    // Map column scores to human-readable labels for the breakdown
    const scoreLabels = items.map((item) => {
      const src = sources.find((s) => s.id === item.sourceId);
      return src ? `${src.label} · ${item.columnName}` : item.columnName;
    });

    for (const entry of studentMap.values()) {
      const rawScores = items.map((item) => {
        const cache = sourceLookups.get(item.sourceId);
        if (!cache) return 0;
        const studentData = findFullStudent(entry, cache.fullLookup);
        return studentData?.breakdown?.[item.columnName]?.score ?? 0;
      });

      const validScores = rawScores.filter(
        (s) => s !== null && s !== undefined && !isNaN(s)
      );
      const sorted = [...validScores].sort((a, b) => b - a);
      const topN = sorted.slice(0, Math.min(bestOf, sorted.length));
      const groupScore = topN.reduce((a, b) => a + b, 0);

      // Store individual column scores in marksByLabel
      scoreLabels.forEach((label, idx) => {
        entry.marksByLabel[label] = rawScores[idx];
      });

      // Store the best-of combined breakdown
      entry.breakdown[`🎯 ${groupLabel}`] = {
        raw: rawScores,
        bestOf: {
          selected: topN,
          n: bestOf,
          total: items.length,
        },
        score: round2(groupScore),
      };
      entry.totalScore += groupScore;
    }

    processedGroups.push({
      label: groupLabel,
      bestOf,
      itemCount: items.length,
      items: items.map((item) => ({
        sourceId: item.sourceId,
        columnName: item.columnName,
        sourceLabel: sources.find((s) => s.id === item.sourceId)?.label || '',
      })),
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

  const allSourceIds = new Set(sources.map((s) => s.id));
  const sourceMeta = sources.map((s, i) => {
    const gCols = groupedColumns.get(s.id);
    const isPartiallyGrouped = gCols && gCols.size > 0;
    const fullyGrouped = isFullyGrouped(s);
    const group = bestOfConfigs.find((g) =>
      (g.items || []).some((item) => item.sourceId === s.id)
    );
    return {
      id               : s.id,
      label            : s.label || `Source ${i + 1}`,
      weight           : fullyGrouped ? 0 : (weights[ungrouped.indexOf(s)] || 0),
      normalizedWeight : fullyGrouped
        ? 0
        : round2(normalizedWeights[ungrouped.indexOf(s)] || 0),
      studentCount     : (s.students || []).length,
      isBestOf         : isPartiallyGrouped,
      bestOfColumns    : isPartiallyGrouped ? [...gCols] : undefined,
      bestOfGroup      : group
        ? { bestOf: group.bestOf, total: group.items.length }
        : undefined,
    };
  });

  const labels = sources.map((s, i) => s.label || `Source ${i + 1}`);
  const metaColumns = labels.map((label, i) => {
    const src = sources[i];
    const gCols = groupedColumns.get(src.id);
    const isPartiallyGrouped = gCols && gCols.size > 0;
    const fullyGrouped = isFullyGrouped(src);
    const group = bestOfConfigs.find((g) =>
      (g.items || []).some((item) => item.sourceId === src.id)
    );
    return {
      name             : label,
      max              : fullyGrouped ? 0 : (weights[ungrouped.indexOf(src)] || 0),
      effectiveWeight  : fullyGrouped ? 0 : (weights[ungrouped.indexOf(src)] || 0),
      normalizedWeight : fullyGrouped
        ? 0
        : round2(normalizedWeights[ungrouped.indexOf(src)] || 0),
      isBestOf         : isPartiallyGrouped,
      bestOfColumns    : isPartiallyGrouped ? [...gCols] : undefined,
      bestOfGroup      : group
        ? { bestOf: group.bestOf, total: group.items.length }
        : undefined,
    };
  });

  const entry = buildLeaderboard(ranked, metaColumns, 'Combined', { showBreakdown: true });

  return {
    leaderboard     : [entry],
    rankedStudents  : ranked,
    totalStudents   : ranked.length,
    sources         : sourceMeta,
    bestOfGroups    : processedGroups,
  };
}

module.exports = { mergeSourcesAndScore, normalizeName };
