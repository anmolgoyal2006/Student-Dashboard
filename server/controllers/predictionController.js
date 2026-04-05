const Semester = require('../models/Semester.model');

exports.getPredict = async (req, res) => {
  try {
    const { targetCGPA, totalSemesters } = req.query;
    const target = parseFloat(targetCGPA);
    const total  = parseInt(totalSemesters);

    const semesters = await Semester.find({ student: req.user.id }).sort({ semesterNumber: 1 });
    const sgpaList  = semesters.map(s => s.sgpa);
    const completed = sgpaList.length;

    if (completed === 0)
      return res.json({ sgpaList: [], predictedCGPA: null, requiredSGPA: null, message: 'No semesters found.' });

    const sumSoFar      = sgpaList.reduce((a, b) => a + b, 0);
    const currentCGPA   = parseFloat((sumSoFar / completed).toFixed(2));
    const trend         = completed >= 2 ? parseFloat((sgpaList[completed - 1] - sgpaList[0]).toFixed(2)) : 0;
    const remaining     = total - completed;

    // Predict future SGPAs based on last SGPA + trend drift
    const lastSGPA      = sgpaList[completed - 1];
    const futureSGPAs   = Array.from({ length: Math.max(remaining, 0) }, (_, i) => {
      const predicted = parseFloat(Math.min(10, Math.max(0, lastSGPA + (trend * (i + 1) * 0.3))).toFixed(2));
      return predicted;
    });

    const allSGPAs      = [...sgpaList, ...futureSGPAs];
    const predictedCGPA = parseFloat((allSGPAs.reduce((a, b) => a + b, 0) / allSGPAs.length).toFixed(2));

    // Required SGPA per remaining semester to hit target
    let requiredSGPA = null;
    if (!isNaN(target) && !isNaN(total) && remaining > 0) {
      requiredSGPA = parseFloat(((target * total - sumSoFar) / remaining).toFixed(2));
    }

    res.json({
      sgpaList,
      futureSGPAs,
      currentCGPA,
      predictedCGPA,
      requiredSGPA,
      completed,
      remaining: Math.max(remaining, 0),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};