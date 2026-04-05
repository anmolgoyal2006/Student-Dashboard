const Semester = require('../models/Semester.model');

/**
 * Computes a weighted recent trend from the last `window` semesters.
 * Recent semester-to-semester changes are weighted more heavily than older ones,
 * so a single bad early semester doesn't distort the entire forecast.
 *
 * @param {number[]} sgpas  - Full list of past SGPAs
 * @param {number}   window - How many recent semesters to consider (default: 3)
 * @returns {number} Weighted average change per semester
 */
function computeWeightedTrend(sgpas, window = 3) {
  if (sgpas.length < 2) return 0;

  const recent = sgpas.slice(-Math.min(window, sgpas.length));
  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 1; i < recent.length; i++) {
    const weight     = i; // weight increases for more recent differences
    weightedSum     += (recent[i] - recent[i - 1]) * weight;
    totalWeight     += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Clamps a value between a minimum and maximum bound.
 * Ensures predicted SGPAs never go below 0 or above 10.
 */
function clamp(value, min = 0, max = 10) {
  return Math.min(max, Math.max(min, value));
}

/**
 * GET /predict
 *
 * Predicts future semester SGPAs and overall CGPA using:
 *   - Weighted recent trend  (captures momentum, not outliers)
 *   - Average SGPA anchor    (pulls wild predictions back toward reality)
 *   - Exponential dampening  (trend influence fades further into the future)
 *
 * Query params:
 *   targetCGPA     {number} - The CGPA the student wants to achieve
 *   totalSemesters {number} - Total semesters in the programme
 */
exports.getPredict = async (req, res) => {
  try {
    const { targetCGPA, totalSemesters } = req.query;
    const target = parseFloat(targetCGPA);
    const total  = parseInt(totalSemesters, 10);

    // ── 1. Fetch completed semesters ────────────────────────────────────────
    const semesters = await Semester.find({ student: req.user.id })
      .sort({ semesterNumber: 1 });

    const sgpaList  = semesters.map(s => s.sgpa);
    const completed = sgpaList.length;

    if (completed === 0) {
      return res.json({
        sgpaList     : [],
        futureSGPAs  : [],
        predictedCGPA: null,
        currentCGPA  : null,
        requiredSGPA : null,
        message      : 'No semester data found. Add your first semester to get predictions.',
      });
    }

    // ── 2. Core stats ────────────────────────────────────────────────────────
    const sumSoFar    = sgpaList.reduce((a, b) => a + b, 0);
    const currentCGPA = parseFloat((sumSoFar / completed).toFixed(2));
    const remaining   = Math.max((isNaN(total) ? 0 : total) - completed, 0);

    // ── 3. Intelligent trend calculation ─────────────────────────────────────
    // OLD: trend = last - first  →  punishes students who had a rough start
    // NEW: weighted diff of last 3 semesters  →  reflects current momentum
    const recentTrend = computeWeightedTrend(sgpaList);

    // ── 4. Predict future SGPAs ──────────────────────────────────────────────
    // Each future SGPA is a blend of:
    //   70% average SGPA  — keeps predictions grounded
    //   30% last SGPA + dampened trend  — reflects recent trajectory
    // Dampening (0.65^i) ensures the trend fades the further out we predict.
    const lastSGPA    = sgpaList[completed - 1];
    const AVERAGE_WEIGHT = 0.70;
    const TREND_WEIGHT   = 0.30;
    const DAMP_FACTOR    = 0.65;

    const futureSGPAs = Array.from({ length: remaining }, (_, i) => {
      const dampedTrend    = recentTrend * Math.pow(DAMP_FACTOR, i + 1);
      const trendBased     = lastSGPA + dampedTrend;
      const blended        = (AVERAGE_WEIGHT * currentCGPA) + (TREND_WEIGHT * trendBased);
      return parseFloat(clamp(blended).toFixed(2));
    });

    // ── 5. Predicted CGPA across all semesters ───────────────────────────────
    const allSGPAs      = [...sgpaList, ...futureSGPAs];
    const predictedCGPA = parseFloat(
      (allSGPAs.reduce((a, b) => a + b, 0) / allSGPAs.length).toFixed(2)
    );

    // ── 6. Required SGPA to hit target ───────────────────────────────────────
    // Edge cases handled:
    //   - No target provided → null
    //   - No remaining semesters → null (nothing to plan for)
    //   - Required exceeds 10 → flagged as unachievable
    let requiredSGPA = null;
    let targetInsight = null;

    if (!isNaN(target) && !isNaN(total) && remaining > 0) {
      const raw = (target * total - sumSoFar) / remaining;
      requiredSGPA = parseFloat(clamp(raw, 0, 10).toFixed(2));

      if (raw > 10) {
        targetInsight = `Target CGPA of ${target} is not achievable — it would require an average of ${raw.toFixed(2)} per semester, which exceeds the maximum of 10.`;
      } else if (raw < 0) {
        targetInsight = `You have already surpassed your target CGPA of ${target}. Keep it up!`;
      } else {
        targetInsight = `You need an average of ${requiredSGPA} per remaining semester to reach a CGPA of ${target}.`;
      }
    }

    // ── 7. Performance insight ───────────────────────────────────────────────
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
      insights: {
        recentTrend  : parseFloat(recentTrend.toFixed(3)),
        performance  : trendLabel,
        targetInsight: targetInsight ?? 'Provide a targetCGPA and totalSemesters to see goal analysis.',
      },
    });

  } catch (err) {
    console.error('[getPredict] Error:', err.message);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};