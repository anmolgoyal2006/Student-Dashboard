import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { marksService } from '../services/apiServices';

const VALID_GRADES = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'];
const DEFAULT_CREDITS = 4;

const emptyStudent = () => ({ name: '', roll: '', grade: 'A' });
const emptySubject = () => ({
  id: Date.now() + Math.random(),
  name: '',
  credits: DEFAULT_CREDITS,
  students: [emptyStudent()],
  bulkText: '',
  showBulk: false,
});

export default function GradeEntryForm({ onLeaderboardGenerated }) {
  const [mode, setMode] = useState('manual'); // 'manual' | 'excel'
  const [subjects, setSubjects] = useState([emptySubject()]);
  const [loading, setLoading] = useState(false);
  const fileRefs = useRef({});

  // ── Subject helpers ──────────────────────────────────────────────────────

  const addSubject = () =>
    setSubjects((prev) => [...prev, emptySubject()]);

  const removeSubject = (id) =>
    setSubjects((prev) => prev.filter((s) => s.id !== id));

  const updateSubject = (id, field, value) =>
    setSubjects((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );

  // ── Student helpers (manual) ─────────────────────────────────────────────

  const addStudent = (subjectId) =>
    setSubjects((prev) =>
      prev.map((s) =>
        s.id === subjectId
          ? { ...s, students: [...s.students, emptyStudent()] }
          : s
      )
    );

  const removeStudent = (subjectId, idx) =>
    setSubjects((prev) =>
      prev.map((s) =>
        s.id === subjectId
          ? { ...s, students: s.students.filter((_, i) => i !== idx) }
          : s
      )
    );

  const updateStudent = (subjectId, idx, field, value) =>
    setSubjects((prev) =>
      prev.map((s) =>
        s.id === subjectId
          ? {
              ...s,
              students: s.students.map((st, i) =>
                i === idx ? { ...st, [field]: value } : st
              ),
            }
          : s
      )
    );

  // ── Bulk paste ───────────────────────────────────────────────────────────

  const applyBulkText = (subjectId) => {
    const subj = subjects.find((s) => s.id === subjectId);
    if (!subj) return;

    const lines = subj.bulkText.trim().split('\n').filter(Boolean);
    const parsed = lines.map((line) => {
      const parts = line.split('\t');
      return {
        name: (parts[0] || '').trim(),
        roll: (parts[1] || '').trim(),
        grade: VALID_GRADES.includes((parts[2] || '').trim().toUpperCase())
          ? (parts[2] || '').trim().toUpperCase()
          : 'A',
      };
    }).filter((s) => s.name || s.roll);

    if (!parsed.length) {
      toast.error('No valid rows found. Format: Name\\tRollNo\\tGrade');
      return;
    }

    setSubjects((prev) =>
      prev.map((s) =>
        s.id === subjectId
          ? { ...s, students: parsed, showBulk: false, bulkText: '' }
          : s
      )
    );
    toast.success(`Imported ${parsed.length} students`);
  };

  // ── Excel upload ─────────────────────────────────────────────────────────

  const handleExcelUpload = (subjectId, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        const students = rows.map((row) => {
          // Accept flexible column names
          const name =
            row['Name'] || row['name'] || row['Student Name'] || row['Student'] || '';
          const roll =
            row['Roll No'] || row['roll'] || row['Roll'] || row['RollNo'] || row['Roll Number'] || '';
          const rawGrade =
            row['Grade'] || row['grade'] || row['GRADE'] || '';
          const grade = VALID_GRADES.includes(String(rawGrade).trim().toUpperCase())
            ? String(rawGrade).trim().toUpperCase()
            : 'A';
          return { name: String(name).trim(), roll: String(roll).trim(), grade };
        }).filter((s) => s.name || s.roll);

        setSubjects((prev) =>
          prev.map((s) =>
            s.id === subjectId ? { ...s, students } : s
          )
        );
        toast.success(`Loaded ${students.length} students from ${file.name}`);
      } catch (err) {
        toast.error('Failed to parse Excel file');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    for (const subj of subjects) {
      if (!subj.name.trim()) {
        toast.error('All subjects need a name');
        return;
      }
      if (!subj.students.length) {
        toast.error(`Subject "${subj.name}" has no students`);
        return;
      }
    }

    const payload = {
      subjects: subjects.map((s) => ({
        name: s.name.trim(),
        credits: Number(s.credits) || DEFAULT_CREDITS,
        students: s.students
          .filter((st) => st.name || st.roll)
          .map((st) => ({
            name: st.name.trim(),
            roll: st.roll.trim(),
            grade: st.grade,
          })),
      })),
    };

    setLoading(true);
    try {
      const res = await marksService.generateGradeEntryLeaderboard(payload);
      toast.success('SGPA leaderboard generated!');
      onLeaderboardGenerated(res.data.leaderboard);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to generate leaderboard');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-title" style={{ marginBottom: 4 }}>📝 Grade Entry</div>
      <p className="text-muted" style={{ marginBottom: 16, fontSize: 13 }}>
        Enter grades manually or upload an Excel/CSV file per subject.
      </p>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['manual', 'excel'].map((m) => (
          <button
            key={m}
            className={`btn ${mode === m ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setMode(m)}
            style={{ fontSize: 13 }}
          >
            {m === 'manual' ? '✍️ Manual Entry' : '📊 Excel Upload'}
          </button>
        ))}
      </div>

      {/* Subjects */}
      {subjects.map((subj, sIdx) => (
        <div
          key={subj.id}
          style={{
            marginBottom: 20,
            padding: 16,
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          {/* Subject header */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            <input
              className="form-input"
              placeholder={`Subject ${sIdx + 1} name`}
              value={subj.name}
              onChange={(e) => updateSubject(subj.id, 'name', e.target.value)}
              style={{ flex: 1, minWidth: 160 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Credits:</label>
              <input
                className="form-input"
                type="number"
                min={1} max={6}
                value={subj.credits}
                onChange={(e) => updateSubject(subj.id, 'credits', e.target.value)}
                style={{ width: 60 }}
              />
            </div>
            {subjects.length > 1 && (
              <button
                className="btn btn-outline"
                onClick={() => removeSubject(subj.id)}
                style={{ fontSize: 12, padding: '4px 10px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
              >
                ✕ Remove
              </button>
            )}
          </div>

          {/* Excel mode: file upload */}
          {mode === 'excel' ? (
            <div>
              <input
                type="file"
                accept=".xlsx,.csv,.xls"
                ref={(el) => (fileRefs.current[subj.id] = el)}
                style={{ display: 'none' }}
                onChange={(e) => handleExcelUpload(subj.id, e.target.files[0])}
              />
              <button
                className="btn btn-outline"
                onClick={() => fileRefs.current[subj.id]?.click()}
                style={{ fontSize: 13, marginBottom: 10 }}
              >
                📂 Upload .xlsx / .csv
              </button>
              <p style={{ fontSize: 11, color: 'var(--muted)', margin: '4px 0 8px' }}>
                Columns: <code>Name</code>, <code>Roll No</code>, <code>Grade</code>
              </p>
              {subj.students.length > 0 && (
                <p style={{ fontSize: 12, color: '#10b981' }}>
                  ✓ {subj.students.length} students loaded
                </p>
              )}
            </div>
          ) : (
            /* Manual mode */
            <div>
              {/* Student rows */}
              <div style={{ overflowX: 'auto', marginBottom: 10 }}>
                <table style={{ minWidth: '100%', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 500, color: 'var(--muted)', fontSize: 11 }}>#</th>
                      <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 500, color: 'var(--muted)', fontSize: 11 }}>Name</th>
                      <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 500, color: 'var(--muted)', fontSize: 11 }}>Roll No</th>
                      <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 500, color: 'var(--muted)', fontSize: 11 }}>Grade</th>
                      <th style={{ width: 32 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {subj.students.map((st, stIdx) => (
                      <tr key={stIdx}>
                        <td style={{ padding: '4px 8px', color: 'var(--muted)', fontSize: 11 }}>{stIdx + 1}</td>
                        <td style={{ padding: '4px 6px' }}>
                          <input
                            className="form-input"
                            placeholder="Student name"
                            value={st.name}
                            onChange={(e) => updateStudent(subj.id, stIdx, 'name', e.target.value)}
                            style={{ fontSize: 12, padding: '5px 8px' }}
                          />
                        </td>
                        <td style={{ padding: '4px 6px' }}>
                          <input
                            className="form-input"
                            placeholder="Roll no"
                            value={st.roll}
                            onChange={(e) => updateStudent(subj.id, stIdx, 'roll', e.target.value)}
                            style={{ fontSize: 12, padding: '5px 8px', width: 100 }}
                          />
                        </td>
                        <td style={{ padding: '4px 6px' }}>
                          <select
                            className="form-select"
                            value={st.grade}
                            onChange={(e) => updateStudent(subj.id, stIdx, 'grade', e.target.value)}
                            style={{ fontSize: 12, padding: '5px 8px', width: 80, height: 'auto' }}
                          >
                            {VALID_GRADES.map((g) => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '4px 6px' }}>
                          {subj.students.length > 1 && (
                            <button
                              onClick={() => removeStudent(subj.id, stIdx)}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: '#ef4444', fontSize: 14, padding: '2px 4px',
                              }}
                            >✕</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Row actions */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-outline"
                  onClick={() => addStudent(subj.id)}
                  style={{ fontSize: 12 }}
                >
                  + Add Student
                </button>
                <button
                  className={`btn ${subj.showBulk ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => updateSubject(subj.id, 'showBulk', !subj.showBulk)}
                  style={{ fontSize: 12 }}
                >
                  📋 Bulk Paste
                </button>
              </div>

              {/* Bulk paste area */}
              {subj.showBulk && (
                <div style={{ marginTop: 10 }}>
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
                    Paste tab-separated rows: <code>Name{'\t'}RollNo{'\t'}Grade</code>
                  </p>
                  <textarea
                    className="form-input"
                    rows={5}
                    placeholder={`Alice\t12345\tA+\nBob\t12346\tB`}
                    value={subj.bulkText}
                    onChange={(e) => updateSubject(subj.id, 'bulkText', e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: 12, width: '100%', resize: 'vertical' }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={() => applyBulkText(subj.id)}
                    style={{ marginTop: 6, fontSize: 12 }}
                  >
                    ✓ Apply
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Add subject + Generate */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
        <button className="btn btn-outline" onClick={addSubject} style={{ fontSize: 13 }}>
          + Add Subject
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={loading}
          style={{ fontSize: 13 }}
        >
          {loading ? '⏳ Generating...' : '🏆 Generate SGPA Leaderboard'}
        </button>
      </div>
    </div>
  );
}