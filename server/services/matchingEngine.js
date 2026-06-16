
function calculateMatchScore(student, opportunity) {
  let score = 50; // Base score
  const reasons = [];

  // Normalize skill case for matching
  const studentSkillsLower = student.skills.map(skill => skill.toLowerCase());
  const opportunitySkillsLower = opportunity.requiredSkills.map(skill => skill.toLowerCase());

  // Skill matching
  const matchedSkillsLower = opportunitySkillsLower.filter(
    skill => studentSkillsLower.includes(skill)
  );
  // Get original case matched skills for display
  const matchedSkills = opportunity.requiredSkills.filter(
    skill => matchedSkillsLower.includes(skill.toLowerCase())
  );
  
  if (opportunity.requiredSkills.length > 0) {
    const skillMatch = (matchedSkills.length / opportunity.requiredSkills.length) * 30;
    score += skillMatch;
    if (matchedSkills.length > 0) {
      reasons.push(`Skills detected: ${matchedSkills.join(', ')}`);
    }
  } else {
    // If no required skills, give some base points for flexibility
    score += 15;
    reasons.push('No specific skills required');
  }

  // Category interest matching (normalize case)
  const studentInterestsLower = student.interests.map(interest => interest.toLowerCase());
  if (studentInterestsLower.includes(opportunity.category.toLowerCase())) {
    score += 15;
    reasons.push(`Matches your interest: ${opportunity.category}`);
  }

  // CGPA/Difficulty matching
  const difficultyMap = { beginner: 3.0, intermediate: 3.5, advanced: 3.8 };
  if (student.cgpa >= difficultyMap[opportunity.difficulty]) {
    score += 10;
    reasons.push(`You're ready for ${opportunity.difficulty} level`);
  }

  return { score: Math.min(Math.max(score, 0), 100), reasons };
}

function getTopMatches(student, opportunities, limit = 20) {
  return opportunities
    .map(opp => ({
      ...opp._doc,
      matchScore: calculateMatchScore(student, opp)
    }))
    .sort((a, b) => b.matchScore.score - a.matchScore.score)
    .slice(0, limit);
}

module.exports = { calculateMatchScore, getTopMatches };

