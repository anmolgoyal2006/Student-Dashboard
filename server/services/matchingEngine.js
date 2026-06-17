
function calculateMatchScore(student, opportunity) {
  let score = 0;
  const reasons = [];

  // ── 1. Skill match (up to 40 pts) ─────────────────────────────────────────
  // Combine User.skills + CareerProgress.skills (merged before calling)
  const studentSkillsLower = (student.skills || []).map(s => s.toLowerCase());
  const reqSkills = opportunity.requiredSkills || [];
  const reqSkillsLower = reqSkills.map(s => s.toLowerCase());

  if (reqSkills.length > 0) {
    const matched = reqSkillsLower.filter(s => studentSkillsLower.includes(s));
    const skillPct = matched.length / reqSkills.length;
    const pts = Math.round(skillPct * 40);
    score += pts;
    if (matched.length > 0) {
      const origMatched = reqSkills.filter(s => studentSkillsLower.includes(s.toLowerCase()));
      reasons.push(`Skill match: ${origMatched.join(', ')}`);
    }
  } else {
    // No skills required — give partial credit, not full
    score += 20;
    reasons.push('Open to all skill levels');
  }

  // ── 2. Category / interest match (up to 20 pts) ──────────────────────────
  // Check User.interests + CareerProgress topic names + title keywords
  const interestsLower = (student.interests || []).map(s => s.toLowerCase());
  const dsaTopicNames = (student.dsaTopics || []).map(t => t.name.toLowerCase());
  const catLower = (opportunity.category || '').toLowerCase();
  const titleLower = (opportunity.title || '').toLowerCase();
  const descLower = (opportunity.description || '').toLowerCase();

  const categoryMatch =
    interestsLower.includes(catLower) ||
    dsaTopicNames.some(t => catLower.includes(t) || titleLower.includes(t)) ||
    studentSkillsLower.some(s => catLower.includes(s) || titleLower.includes(s) || descLower.includes(s));

  if (categoryMatch) {
    score += 20;
    reasons.push(`Matches your interest in ${opportunity.category}`);
  }

  // ── 3. Difficulty / readiness match (up to 20 pts) ───────────────────────
  const readiness = student.readiness || 'Beginner';
  const difficulty = opportunity.difficulty || 'intermediate';

  const readinessOrder = { Beginner: 0, Intermediate: 1, Ready: 2 };
  const difficultyOrder = { beginner: 0, intermediate: 1, advanced: 2 };
  const rLevel = readinessOrder[readiness] ?? 0;
  const dLevel = difficultyOrder[difficulty] ?? 1;

  if (rLevel >= dLevel) {
    // Perfect or overqualified — full points
    score += 20;
    reasons.push(`Your ${readiness} level suits this ${difficulty} hackathon`);
  } else if (rLevel === dLevel - 1) {
    // One level below — partial points, good stretch goal
    score += 10;
    reasons.push(`Good challenge — slightly above your current level`);
  }

  // ── 4. Problems solved / activity signal (up to 10 pts) ──────────────────
  const solved = student.problemsSolved || 0;
  if (solved >= 200) {
    score += 10;
    reasons.push('Strong DSA practice background');
  } else if (solved >= 100) {
    score += 7;
    reasons.push('Good problem-solving foundation');
  } else if (solved >= 30) {
    score += 4;
    reasons.push('Building problem-solving skills');
  }

  // ── 5. Target company alignment (up to 10 pts) ───────────────────────────
  const COMPANY_TAGS = {
    Amazon: ['cloud', 'e-commerce', 'logistics', 'scalability', 'aws'],
    Google: ['ai', 'ml', 'search', 'cloud', 'data'],
    Microsoft: ['cloud', 'azure', 'enterprise', 'productivity'],
    Meta: ['social', 'web', 'mobile', 'ar', 'vr'],
    Flipkart: ['e-commerce', 'logistics', 'fintech', 'mobile'],
    Adobe: ['design', 'creative', 'web', 'mobile'],
    Uber: ['mobility', 'maps', 'logistics', 'real-time'],
    Infosys: ['enterprise', 'it', 'consulting'],
    TCS: ['enterprise', 'it', 'consulting'],
  };
  const companyTags = COMPANY_TAGS[student.targetCompany] || [];
  const eventText = `${catLower} ${titleLower} ${descLower}`;
  const companyMatch = companyTags.some(tag => eventText.includes(tag));
  if (companyMatch) {
    score += 10;
    reasons.push(`Relevant to ${student.targetCompany} domain`);
  }

  const finalScore = Math.min(Math.max(Math.round(score), 0), 100);

  // Ensure reasons always has something
  if (reasons.length === 0) {
    reasons.push('General hackathon experience');
  }

  return { score: finalScore, reasons };
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

