const Semester = require('../models/Semester.model');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const DEFAULT_CREDIT_PATTERN = [22, 21, 22, 24, 20, 12, 19, 21];

/**
 * Computes a weighted recent trend from the last `window` semesters.
 */
function computeWeightedTrend(sgpas, window = 3) {
  if (sgpas.length < 2) return 0;

  const recent = sgpas.slice(-Math.min(window, sgpas.length));
  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 1; i < recent.length; i++) {
    const weight     = i;
    weightedSum     += (recent[i] - recent[i - 1]) * weight;
    totalWeight     += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

function clamp(value, min = 0, max = 10) {
  return Math.min(max, Math.max(min, value));
}

/**
 * GET /predict
 *
 * Query params:
 *   currentCGPA       — manual current CGPA override (optional)
 *   completed         — manual completed semesters count (optional)
 *   targetCGPA        — target CGPA to reach (optional)
 *   totalSemesters    — total semesters in the degree
 *   totalDegreeCredits — total course credits (default 161)
 */
exports.getPredict = async (req, res) => {
  try {
    const { currentCGPA: manualCGPA, completed: manualCompleted, targetCGPA, totalSemesters, totalDegreeCredits, semesterCredits: rawSemCredits } = req.query;
    const target     = parseFloat(targetCGPA);
    const total      = parseInt(totalSemesters, 10) || 8;

    // ── 1. Fetch DB semesters first if not in manual mode ─────────────────────
    let semesters = [];
    if (!manualCGPA) {
      semesters = await Semester.find({ student: req.user.id }).sort({ semesterNumber: 1 });
    }
    const completed = manualCGPA ? (parseInt(manualCompleted, 10) || 0) : semesters.length;

    // Extract actual database credits
    const dbCredits = semesters.map(s => {
      if (s.isManual) return s.totalCredits || 20;
      return (s.subjects || []).reduce((sum, sub) => sum + sub.credits, 0) || 20;
    });

    // ── 2. Build per-semester credit distribution ──────────────────────────
    let adjustedCredits = rawSemCredits
      ? rawSemCredits.split(',').map(s => parseInt(s, 10) || 20).slice(0, total)
      : (() => {
          const p = DEFAULT_CREDIT_PATTERN.slice(0, total);
          while (p.length < total) p.push(DEFAULT_CREDIT_PATTERN[DEFAULT_CREDIT_PATTERN.length - 1]);
          return p;
        })();
    while (adjustedCredits.length < total) adjustedCredits.push(20);
    adjustedCredits = adjustedCredits.slice(0, total);

    // Merge actual database credits for completed semesters
    if (!manualCGPA) {
      for (let i = 0; i < completed; i++) {
        if (i < dbCredits.length) {
          adjustedCredits[i] = dbCredits[i];
        }
      }
    }

    const sumCredits = adjustedCredits.reduce((a, b) => a + b, 0);

    // ── 3. Determine current CGPA and completed count ──────────────────────
    let currentCGPA, sgpaList, currentWeightedSum;

    if (manualCGPA) {
      currentCGPA = clamp(parseFloat(manualCGPA), 0, 10);
      sgpaList    = [];
      currentWeightedSum = currentCGPA * adjustedCredits.slice(0, completed).reduce((a, b) => a + b, 0);
    } else {
      sgpaList  = semesters.map(s => s.sgpa);

      if (completed === 0 && isNaN(target)) {
        return res.json({
          sgpaList:    [],
          futureSGPAs: [],
          currentCGPA: null,
          predictedCGPA: null,
          requiredSGPA: null,
          creditBreakdown: adjustedCredits,
          completed: 0,
          remaining: total,
          message: 'No semester data found. Enter your Current CGPA manually above.',
        });
      }

      if (completed === 0) {
        currentWeightedSum = 0;
        currentCGPA = null;
      } else {
        const completedCredits = adjustedCredits.slice(0, completed);
        currentWeightedSum = sgpaList.reduce((sum, sgpa, i) => {
          const cr = i < completedCredits.length ? completedCredits[i] : 0;
          return sum + sgpa * cr;
        }, 0);
        const totalCompletedCredits = completedCredits.reduce((a, b) => a + b, 0);
        currentCGPA = totalCompletedCredits > 0
          ? round2(currentWeightedSum / totalCompletedCredits)
          : round2(sgpaList.reduce((a, b) => a + b, 0) / completed);
      }
    }

    const remaining = Math.max(total - completed, 0);

    // ── 4. Required SGPA to hit target ────────────────────────────────────
    let requiredSGPA = null;
    let targetInsight = null;

    if (!isNaN(target) && remaining > 0) {
      const futureCredits = adjustedCredits.slice(completed).reduce((a, b) => a + b, 0);

      if (futureCredits > 0) {
        const raw = (target * sumCredits - currentWeightedSum) / futureCredits;
        requiredSGPA = round2(clamp(raw));

        if (raw > 10) {
          targetInsight = `Target CGPA ${target} is not achievable — it would require an average of ${raw.toFixed(2)} per semester.`;
        } else if (raw < 0) {
          targetInsight = `You have already surpassed your target CGPA of ${target}.`;
        } else {
          targetInsight = `You need an average of ${requiredSGPA} per remaining semester to reach CGPA ${target}.`;
        }
      }
    }

    // ── 5. Future SGPA prediction ─────────────────────────────────────────
    let futureSGPAs = [];
    let predictedCGPA = currentCGPA;

    if (remaining > 0) {
      if (sgpaList.length > 0) {
        const recentTrend = computeWeightedTrend(sgpaList);
        const lastSGPA    = sgpaList[sgpaList.length - 1];
        const AVERAGE_WEIGHT = 0.70;
        const TREND_WEIGHT   = 0.30;
        const DAMP_FACTOR    = 0.65;

        futureSGPAs = Array.from({ length: remaining }, (_, i) => {
          const dampedTrend = recentTrend * Math.pow(DAMP_FACTOR, i + 1);
          const trendBased  = lastSGPA + dampedTrend;
          const blended     = (AVERAGE_WEIGHT * (currentCGPA || 0)) + (TREND_WEIGHT * trendBased);
          return round2(clamp(blended));
        });
      } else if (requiredSGPA !== null) {
        // If fresh student (0 sems) but target is set, predict target-aligned roadmap
        futureSGPAs = Array(remaining).fill(requiredSGPA);
      }

      // Credit-weighted predicted CGPA
      const allSGPAs = [...sgpaList, ...futureSGPAs];
      const weightedSum = allSGPAs.reduce((sum, sgpa, i) => {
        const cr = i < adjustedCredits.length ? adjustedCredits[i] : 0;
        return sum + sgpa * cr;
      }, 0);
      predictedCGPA = round2(weightedSum / sumCredits);
    }

    // ── 6. Response ───────────────────────────────────────────────────────
    const recentTrend = sgpaList.length > 0 ? computeWeightedTrend(sgpaList) : 0;
    const trendLabel =
      recentTrend > 0.2  ? 'improving 📈' :
      recentTrend < -0.2 ? 'declining 📉' :
                           'stable ➡️';

    res.json({
      sgpaList,
      futureSGPAs,
      currentCGPA,
      predictedCGPA,
      requiredSGPA,
      completed,
      remaining,
      creditBreakdown: adjustedCredits,
      insights: {
        recentTrend  : round2(recentTrend),
        performance  : trendLabel,
        targetInsight: targetInsight ?? 'Set a target CGPA to see goal analysis.',
      },
    });

  } catch (err) {
    console.error('[getPredict] Error:', err.message);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};
