const XLSX = require('xlsx');

/**
 * Generates Excel buffer from ranked leaderboard data.
 * Supports single or multi-subject.
 * @param {Object} rankedBySubject - { subjectName: [{ rank, name, roll, marks }] }
 */
function generateMarksExcel(rankedBySubject) {
  const wb = XLSX.utils.book_new();

  for (const [subject, students] of Object.entries(rankedBySubject)) {
    const rows = students.map(s => ({
      Rank  : s.rank,
      Name  : s.name,
      Roll  : s.roll || '—',
      Marks : s.marks,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
      { wch: 6  }, // Rank
      { wch: 25 }, // Name
      { wch: 12 }, // Roll
      { wch: 8  }, // Marks
    ];

    // Sheet name max 31 chars (Excel limit)
    const sheetName = subject.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { generateMarksExcel };