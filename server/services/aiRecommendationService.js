const Attendance     = require('../models/Attendance');
const Marks          = require('../models/Marks');
const CareerProgress = require('../models/CareerProgress');

const COMPANY_ROADMAPS = {
  Amazon: [
    'Master Arrays, Trees, DP (LeetCode top 100)',
    'Study all 16 Amazon Leadership Principles — prepare 2 stories each',
    'Practice System Design: URL shortener, Parking Lot, Amazon Cart',
    'Do 5+ mock interviews on Pramp or Interviewing.io',
  ],
  Microsoft: [
    'Strong grip on DSA + Object-Oriented Design',
    'Study Design Patterns (Singleton, Factory, Observer)',
    'Practice behavioral questions (Growth Mindset focus)',
    'Learn Azure basics — AZ-900 level understanding',
  ],
  Google: [
    'Advanced DSA — master Graphs, DP, Segment Trees',
    'Large-scale System Design (distributed systems concepts)',
    'Mathematics: Probability, Combinatorics, Number Theory',
    'Code quality — write clean, testable, well-named code in every interview',
  ],
  Flipkart: [
    'DSA focus — Arrays, Trees, DP (same as product companies)',
    'System Design: E-commerce scale (product catalog, cart, orders)',
    'Study Flipkart tech blogs and engineering challenges',
  ],
  Adobe: [
    'DSA medium-hard level (LeetCode)',
    'Creative problem solving — data structures for media',
    'OOPs and Design Patterns are heavily tested',
    'Behavioral: focus on collaboration and creativity stories',
  ],
  Infosys: [
    'Focus on fundamentals: Arrays, Strings, Sorting',
    'Strong aptitude + verbal reasoning preparation',
    'Learn at least one framework (React, Spring Boot)',
    'Practice HR round questions',
  ],
  TCS: [
    'Aptitude preparation (TCS NQT pattern)',
    'Basic DSA + Programming in C/C++/Java/Python',
    'Communication and soft skills round prep',
  ],
  Other: [
    'Solve 150+ LeetCode problems across all topics',
    'Learn System Design basics',
    'Build 2-3 strong projects for your resume',
    'Practice mock interviews regularly',
  ],
};

const getAttendanceSuggestions = async (userId) => {
  const records = await Attendance.find({ userId }).populate('subjectId', 'name');
  const map = {};
  for (const r of records) {
    if (!r.subjectId) continue;
    const key = r.subjectId._id.toString();
    if (!map[key]) map[key] = { name: r.subjectId.name, total: 0, present: 0 };
    if (r.status !== 'cancelled') {
      map[key].total++;
      if (r.status === 'present') map[key].present++;
    }
  }
  const suggestions = [];
  for (const s of Object.values(map)) {
    if (!s.total) continue;
    const pct = (s.present / s.total) * 100;
    if (pct < 75) {
      const needed = Math.ceil((0.75 * s.total - s.present) / 0.25);
      suggestions.push({
        type:     'warning',
        priority: 'high',
        icon:     '⚠️',
        title:    `Low Attendance: ${s.name}`,
        message:  `Your attendance is ${pct.toFixed(1)}%. You need to attend ${needed} more consecutive classes to reach 75%.`,
      });
    }
  }
  return suggestions;
};

const getCGPASuggestions = async (userId) => {
  const marks = await Marks.find({ userId, examType: 'final' }).populate('subjectId', 'name credits');
  if (!marks.length) return [];

  let totalWt = 0, totalCr = 0;
  const weak = [];
  for (const m of marks) {
    const cr = m.subjectId?.credits || 3;
    totalWt += m.gradePoint * cr;
    totalCr += cr;
    if (m.gradePoint <= 6) weak.push(m.subjectId?.name || 'Unknown');
  }
  const cgpa = totalCr ? totalWt / totalCr : 0;
  const suggestions = [];

  if (cgpa > 0 && cgpa < 6.0) {
    suggestions.push({
      type:     'study',
      priority: 'high',
      icon:     '📚',
      title:    'CGPA Needs Attention',
      message:  `Current CGPA: ${cgpa.toFixed(2)}. Focus on theory revision and practice papers for: ${weak.join(', ')}.`,
    });
  } else if (cgpa >= 6 && cgpa < 7.5) {
    suggestions.push({
      type:     'study',
      priority: 'medium',
      icon:     '📖',
      title:    'Improve CGPA',
      message:  `CGPA is ${cgpa.toFixed(2)}. Improving weak subjects (${weak.join(', ')}) could push you above 8.`,
    });
  }
  return suggestions;
};

const getCareerSuggestions = async (userId) => {
  const career = await CareerProgress.findOne({ userId });
  if (!career) return [];

  const suggestions = [];
  const { problemsSolved, targetCompany, dsaTopics, readiness } = career;

  if (problemsSolved < 50) {
    const incomplete = dsaTopics.filter(t => !t.completed).slice(0, 3).map(t => t.name);
    suggestions.push({
      type:     'dsa',
      priority: 'high',
      icon:     '💻',
      title:    'Start DSA Practice',
      message:  `Only ${problemsSolved} problems solved. Begin with: ${incomplete.join(', ')}. Target 150+ for placements.`,
    });
  } else if (problemsSolved < 150) {
    suggestions.push({
      type:     'dsa',
      priority: 'medium',
      icon:     '💡',
      title:    'Keep Going with DSA',
      message:  `${problemsSolved} problems done — good progress! Push to 150+ and tackle Hard problems on LeetCode.`,
    });
  }

  const roadmap = COMPANY_ROADMAPS[targetCompany] || COMPANY_ROADMAPS.Other;
  suggestions.push({
    type:     'career',
    priority: 'medium',
    icon:     '🎯',
    title:    `${targetCompany} Preparation Roadmap`,
    message:  roadmap.join(' → '),
  });

  suggestions.push({
    type:     'readiness',
    priority: 'info',
    icon:     readiness === 'Ready' ? '🏆' : readiness === 'Intermediate' ? '🔥' : '🌱',
    title:    'Placement Readiness',
    message:  `You are currently at: ${readiness} level. ${
      readiness === 'Beginner'     ? 'Focus on DSA fundamentals and improve CGPA.' :
      readiness === 'Intermediate' ? 'Start mock interviews and System Design.' :
                                     'You are placement ready! Practice HR rounds and final mock interviews.'
    }`,
    value: readiness,
  });

  return suggestions;
};

exports.getRecommendations = async (userId) => {
  const [attendanceSuggestions, cgpaSuggestions, careerSuggestions] = await Promise.all([
    getAttendanceSuggestions(userId),
    getCGPASuggestions(userId),
    getCareerSuggestions(userId),
  ]);

  const all = [...attendanceSuggestions, ...cgpaSuggestions, ...careerSuggestions];

  // Sort by priority
  const order = { high: 0, medium: 1, info: 2 };
  all.sort((a, b) => order[a.priority] - order[b.priority]);

  return all;
};
