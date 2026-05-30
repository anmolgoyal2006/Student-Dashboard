const { GRADE_MAP } = require('../config/gradeConfig');
const {
  studentKey,
  normalizeRoll,
  normalizeName,
  fuzzyNameMatch,
} = require('./studentMatcher');

const DEFAULT_CREDITS = 4;
const VALID_GRADES = new Set(Object.keys(GRADE_MAP));

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function normalizeGrade(value) {
  let raw = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!raw) return '';

  // Strip annotations like (UMC), (I), (W)
  raw = raw.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();

  // Cursive "t" suffix means "+" — Bt→B+, Ct→C+, At→A+
  raw = raw.replace(/^([ABC])T$/, '$1+');

  // Named variants
  if (raw === 'APLUS' || raw === 'A PLUS') return 'A+';
  if (raw === 'BPLUS' || raw === 'B PLUS') return 'B+';
  if (raw === 'CPLUS' || raw === 'C PLUS') return 'C+';

  // Strip trailing junk from single-letter grades
  const cleaned = raw.replace(/[^A-F+]/g, '');
  if (['A+','A','B+','B','C+','C','D','F'].includes(cleaned)) return cleaned;

  return raw;
}

function getGradeFromStudentRow(row) {
  if (row.grade) return normalizeGrade(row.grade);

  const marks = row.marks || {};
  for (const [key, value] of Object.entries(marks)) {
    const header = String(key || '').toLowerCase();
    if (header.includes('grade') || header.includes('result')) {
      return normalizeGrade(value);
    }
  }

  for (const value of Object.values(marks)) {
    const v = String(value ?? '').trim();
    if (!v) continue;
    const normal = normalizeGrade(v);
    if (normal && VALID_GRADES.has(normal)) return normal;
  }

  for (const [key, value] of Object.entries(row)) {
    if (key === 'name' || key === 'roll' || key === 'marks' || key === 'grade') continue;
    const normal = normalizeGrade(value);
    if (normal && VALID_GRADES.has(normal)) return normal;
  }

  return '';
}

function dedupeSourceStudents(studentRows) {
  const seen = new Set();
  const unique = [];
  const warnings = [];

  for (const row of studentRows || []) {
    const key = studentKey(row.name, row.roll);
    if (!key) {
      warnings.push(`Skipped a row with missing student identity.`);
      continue;
    }
    if (seen.has(key)) {
      warnings.push(`Ignored duplicate entry for ${row.roll || row.name}.`);
      continue;
    }
    seen.add(key);
    unique.push(row);
  }

  return { unique, warnings };
}

function ensureStudent(studentMap, row) {
  const key = studentKey(row.name, row.roll);
  if (!key) return null;

  if (!studentMap.has(key)) {
    studentMap.set(key, {
      key,
      sid: /^\d{5,12}$/.test(normalizeRoll(row.roll)) ? normalizeRoll(row.roll) : '',
      roll: normalizeRoll(row.roll),
      name: String(row.name || '').trim() || 'Unknown Student',
      subjects: [],
      totalCredits: 0,
      totalWeightedGradePoints: 0,
      sgpa: 0,
    });
  }

  const entry = studentMap.get(key);
  const roll = normalizeRoll(row.roll);
  if (roll && !entry.roll) entry.roll = roll;
  if (roll && /^\d{5,12}$/.test(roll) && !entry.sid) entry.sid = roll;
  if (row.name && String(row.name).trim().length > entry.name.length) {
    entry.name = String(row.name).trim();
  }
  return entry;
}

function mergeFuzzyDuplicates(studentMap) {
  const entries = Array.from(studentMap.entries());
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [keepKeyCandidate, a] = entries[i];
      const [dropKeyCandidate, b] = entries[j];
      const sameSid = a.sid && b.sid && a.sid === b.sid;
      const sameRoll = a.roll && b.roll && a.roll === b.roll;
      const sameName = fuzzyNameMatch(a.name, b.name);
      if (!sameSid && !sameRoll && !sameName) continue;

      const keepKey = keepKeyCandidate.startsWith('sid:') || keepKeyCandidate.startsWith('roll:')
        ? keepKeyCandidate
        : dropKeyCandidate;
      const dropKey = keepKey === keepKeyCandidate ? dropKeyCandidate : keepKeyCandidate;
      const kept = studentMap.get(keepKey);
      const dropped = studentMap.get(dropKey);

      if (!kept || !dropped) continue;
      if (!kept.sid && dropped.sid) kept.sid = dropped.sid;
      if (!kept.roll && dropped.roll) kept.roll = dropped.roll;
      if (dropped.name.length > kept.name.length) kept.name = dropped.name;
      kept.subjects.push(...dropped.subjects);
      studentMap.delete(dropKey);
      entries.splice(entries.findIndex(([k]) => k === dropKey), 1);
      j--;
    }
  }
}

function rankBySgpa(students) {
  const sorted = [...students].sort((a, b) => {
    if (b.sgpa !== a.sgpa) return b.sgpa - a.sgpa;
    return a.name.localeCompare(b.name);
  });

  let rank = 1;
  return sorted.map((student, idx) => {
    if (idx > 0 && student.sgpa < sorted[idx - 1].sgpa) rank = idx + 1;
    return { ...student, rank };
  });
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : round2((sorted[mid - 1] + sorted[mid]) / 2);
}

function calculateStats(rankedStudents) {
  const sgpas = rankedStudents.map((s) => s.sgpa).filter((n) => Number.isFinite(n));
  const total = rankedStudents.length;
  const average = total ? round2(sgpas.reduce((sum, n) => sum + n, 0) / total) : 0;

  return {
    totalStudents: total,
    highestSGPA: total ? Math.max(...sgpas) : 0,
    lowestSGPA: total ? Math.min(...sgpas) : 0,
    averageSGPA: average,
    medianSGPA: median(sgpas),
    top10Students: rankedStudents.slice(0, 10),
  };
}

function buildSgpaLeaderboard(sources) {
  if (!Array.isArray(sources) || !sources.length) {
    throw new Error('At least one PDF source is required.');
  }

  const warnings = [];
  const studentMap = new Map();
  const sourceMeta = [];

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i] || {};
    const label = String(source.label || source.fileName || `Subject ${i + 1}`).trim() || `Subject ${i + 1}`;
    const credits = Number(source.credits ?? DEFAULT_CREDITS);
    if (!Number.isFinite(credits) || credits <= 0) {
      throw new Error(`Credits for "${label}" must be a positive number.`);
    }

    const { unique, warnings: duplicateWarnings } = dedupeSourceStudents(source.studentRows || []);
    duplicateWarnings.forEach((w) => warnings.push(`${label}: ${w}`));

    let validGradeCount = 0;
    for (const row of unique) {
      const grade = getGradeFromStudentRow(row);
      if (!grade) {
        warnings.push(`${label}: Missing grade for ${row.roll || row.name || 'a student'}.`);
        continue;
      }
      if (!VALID_GRADES.has(grade)) {
        warnings.push(`${label}: Invalid grade "${grade}" for ${row.roll || row.name}.`);
        continue;
      }

      const student = ensureStudent(studentMap, row);
      if (!student) continue;
      const gradePoint = GRADE_MAP[grade];
      student.subjects.push({
        subjectName: label,
        grade,
        gradePoint,
        credits,
        weightedContribution: round2(gradePoint * credits),
      });
      validGradeCount++;
    }

    sourceMeta.push({
      id: source.id || `source_${i}`,
      label,
      fileName: source.fileName || label,
      credits,
      studentCount: unique.length,
      validGradeCount,
    });
  }

  mergeFuzzyDuplicates(studentMap);

  const students = Array.from(studentMap.values())
    .map((student) => {
      const bySubject = new Map();
      for (const subject of student.subjects) {
        if (!bySubject.has(subject.subjectName)) bySubject.set(subject.subjectName, subject);
      }
      const subjects = Array.from(bySubject.values());
      const totalCredits = subjects.reduce((sum, s) => sum + s.credits, 0);
      const totalWeightedGradePoints = round2(
        subjects.reduce((sum, s) => sum + s.weightedContribution, 0)
      );
      const sgpa = totalCredits > 0 ? round2(totalWeightedGradePoints / totalCredits) : 0;

      return {
        sid: student.sid || '',
        roll: student.roll || '',
        name: student.name,
        subjectsCount: subjects.length,
        totalCredits,
        totalWeightedGradePoints,
        sgpa,
        subjects,
        searchKey: normalizeName(`${student.sid} ${student.roll} ${student.name}`),
      };
    })
    .filter((student) => student.subjectsCount > 0);

  const rankedStudents = rankBySgpa(students);

  return {
    leaderboard: [{
      subject: 'SGPA Leaderboard',
      students: rankedStudents,
    }],
    rankedStudents,
    totalStudents: rankedStudents.length,
    sources: sourceMeta,
    warnings,
    stats: calculateStats(rankedStudents),
    gradeMapping: GRADE_MAP,
  };
}

module.exports = {
  DEFAULT_CREDITS,
  buildSgpaLeaderboard,
  normalizeGrade,
};
