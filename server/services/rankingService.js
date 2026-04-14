/**
 * rankingService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Sorts weighted student scores into a ranked leaderboard.
 * Handles ties: same score → same rank (dense ranking: 1, 2, 2, 3 …).
 *
 * EXPORTS
 *   rankStudents(scoredStudents)  → Array<{ ...student, rank }>
 *   buildLeaderboard(scoredStudents, columns, subjectName)
 *     → leaderboard entry shaped for the existing Leaderboard.jsx component
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Assign dense ranks to an array of scored students.
 *
 * @param {Array<{ name, roll, marks, breakdown, totalScore }>} scoredStudents
 * @returns {Array<{ name, roll, marks, breakdown, totalScore, rank }>}
 */
function rankStudents(scoredStudents) {
  if (!scoredStudents || !scoredStudents.length) return [];

  // Sort descending by totalScore
  const sorted = [...scoredStudents].sort((a, b) => b.totalScore - a.totalScore);

  // Dense ranking: 1, 2, 2, 3 …
  let rank = 1;
  return sorted.map((student, idx) => {
    if (idx > 0 && student.totalScore < sorted[idx - 1].totalScore) {
      rank = idx + 1;
    }
    return { ...student, rank };
  });
}

/**
 * Build a leaderboard entry compatible with the existing Leaderboard.jsx shape.
 *
 * Leaderboard.jsx expects:
 *   leaderboard: [
 *     {
 *       subject  : string,
 *       students : [{ name, roll, rank, marks }]
 *     }
 *   ]
 *
 * `marks` here is the display string for the "Marks" column.
 *
 * @param {Array<{ name, roll, totalScore, rank, breakdown }>} rankedStudents
 * @param {Array<{ name, max, effectiveWeight? }>}             columns
 * @param {string}                                             subjectName
 * @param {{ showBreakdown?: boolean }}                        options
 */
function buildLeaderboard(rankedStudents, columns, subjectName = 'Overall', options = {}) {
  const totalWeight = columns.reduce((s, c) => s + (c.effectiveWeight ?? c.max), 0);

  const students = rankedStudents.map(s => ({
    name      : s.name,
    roll      : s.roll,
    rank      : s.rank,
    marks     : s.totalScore,                 // number shown in "Marks" column
    totalScore: s.totalScore,
    outOf     : Math.round(totalWeight * 100) / 100,
    breakdown : options.showBreakdown ? s.breakdown : undefined,
  }));

  return { subject: subjectName, students };
}

/**
 * Full pipeline convenience function.
 *
 * Given scored students + column metadata, returns:
 *   {
 *     leaderboard   : [{ subject, students }],   ← for Leaderboard.jsx
 *     rankedStudents: [...],                      ← full data if needed
 *     totalStudents : number,
 *   }
 */
function processLeaderboard(scoredStudents, columns, subjectName = 'Overall') {
  const ranked      = rankStudents(scoredStudents);
  const entry       = buildLeaderboard(ranked, columns, subjectName, { showBreakdown: true });

  return {
    leaderboard   : [entry],
    rankedStudents: ranked,
    totalStudents : ranked.length,
  };
}

module.exports = { rankStudents, buildLeaderboard, processLeaderboard };