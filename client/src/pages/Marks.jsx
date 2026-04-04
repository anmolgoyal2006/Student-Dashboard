import { useEffect, useState, useCallback } from 'react';
import { marksService, subjectService } from '../services/apiServices';
import toast from 'react-hot-toast';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const EMPTY = { subjectId: '', examType: 'midterm', marksObtained: '', maxMarks: 100, examDate: '' };

export default function Marks() {
  const [marks,        setMarks]        = useState([]);
  const [subjects,     setSubjects]     = useState([]);
  const [cgpaData,     setCgpaData]     = useState(null);
  const [form,         setForm]         = useState(EMPTY);
  const [loading,      setLoading]      = useState(true);

  // ── new state ──
  const [semesters,    setSemesters]    = useState([]);
  const [gradeOptions, setGradeOptions] = useState([]);
  const [semForm,      setSemForm]      = useState({
    semesterNumber: '',
    semesterName:   '',
    subjects:       [{ name: '', credits: '', grade: '' }],
  });
  const [semLoading,   setSemLoading]   = useState(false);
  const [cgpaSem,      setCgpaSem]      = useState(null);

  const load = async () => {
  try {
    const m = await marksService.getAll();
    console.log("marks OK");

    const s = await subjectService.getAll();
    console.log("subjects OK");

    const c = await marksService.getCGPA();
    console.log("cgpa OK");

    const sems = await marksService.getSemesters();
    console.log("semesters OK");

    const grades = await marksService.getGradeOptions();
    console.log("grades OK");

    const cgpas = await marksService.getCGPAbySemester();
    console.log("cgpa-sem OK");

    setMarks(m.data.marks || []);
    setSubjects(s.data.subjects || []);
    setCgpaData(c.data);
    setSemesters(sems.data.semesters || []);
    setGradeOptions(grades.data.gradeOptions || []);
    setCgpaSem(cgpas.data);
    setLoading(false);
  } catch (err) {
    console.log("❌ FAILED API:", err.config?.url);
    console.log(err);
  }
};

  useEffect(() => { load(); }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await marksService.add(form);
      toast.success('Marks added!');
      setForm(EMPTY);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleDelete = async id => {
    await marksService.remove(id);
    toast.success('Deleted');
    load();
  };

  // ── semester helpers ──
  const updateSubjectRow = (i, field, value) =>
    setSemForm(p => ({
      ...p,
      subjects: p.subjects.map((s, idx) => idx === i ? { ...s, [field]: value } : s),
    }));

  const addSubjectRow = () =>
    setSemForm(p => ({
      ...p,
      subjects: [...p.subjects, { name: '', credits: '', grade: gradeOptions[0]?.grade || '' }],
    }));

  const removeSubjectRow = (i) =>
    setSemForm(p => ({ ...p, subjects: p.subjects.filter((_, idx) => idx !== i) }));

  const handleAddSemester = async () => {
    try {
      setSemLoading(true);
      await marksService.addSemester({
        semesterNumber: Number(semForm.semesterNumber),
        semesterName:   semForm.semesterName,
        subjects: semForm.subjects.map(s => ({
          name:    s.name,
          credits: Number(s.credits),
          grade:   s.grade,
        })),
      });
      toast.success('Semester added!');
      setSemForm({
        semesterNumber: '',
        semesterName:   '',
        subjects:       [{ name: '', credits: '', grade: gradeOptions[0]?.grade || '' }],
      });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSemLoading(false);
    }
  };

  const handleDeleteSemester = async (id) => {
    await marksService.deleteSemester(id);
    toast.success('Semester deleted');
    load();
  };

  const chartData = {
    labels: (cgpaData?.breakdown || []).map(b => b.subject),
    datasets: [{
      label: 'Grade Point',
      data:  (cgpaData?.breakdown || []).map(b => b.gradePoint),
      backgroundColor: '#a5b4fc',
      borderRadius: 6,
    }],
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">📝 Marks & CGPA</h1>
          <p className="page-subtitle">Track your exam performance and calculate CGPA</p>
        </div>
        {cgpaData?.cgpa > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--primary)' }}>{cgpaData.cgpa}</div>
            <div className="text-muted">Current CGPA</div>
          </div>
        )}
      </div>

      {/* ── Add marks form + chart ── */}
      <div className="grid-2 mb-4">
        <div className="card">
          <div className="card-title">Add Exam Marks</div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Subject</label>
              <select className="form-select" value={form.subjectId} onChange={e => setForm(p => ({ ...p, subjectId: e.target.value }))} required>
                <option value="">Select subject</option>
                {subjects.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Exam Type</label>
              <select className="form-select" value={form.examType} onChange={e => setForm(p => ({ ...p, examType: e.target.value }))}>
                {['midterm', 'final', 'quiz', 'assignment', 'practical'].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Marks Obtained</label>
                <input className="form-input" type="number" min="0" value={form.marksObtained} onChange={e => setForm(p => ({ ...p, marksObtained: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Max Marks</label>
                <input className="form-input" type="number" min="1" value={form.maxMarks} onChange={e => setForm(p => ({ ...p, maxMarks: e.target.value }))} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Exam Date</label>
              <input className="form-input" type="date" value={form.examDate} onChange={e => setForm(p => ({ ...p, examDate: e.target.value }))} />
            </div>
            <button className="btn btn-primary" type="submit">Add Marks</button>
          </form>
        </div>

        <div className="card">
          <div className="card-title">Grade Points (Final Exams)</div>
          {cgpaData?.breakdown?.length > 0
            ? <Bar data={chartData} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 10 } } }} />
            : <p className="text-muted">Add final exam marks to see CGPA breakdown.</p>
          }
        </div>
      </div>

      {/* ── All marks table ── */}
      <div className="card">
        <div className="card-title">All Marks</div>
        {marks.length === 0
          ? <p className="text-muted">No marks added yet.</p>
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Subject</th><th>Type</th><th>Marks</th><th>Grade Pt.</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {marks.map(m => (
                    <tr key={m._id}>
                      <td>{m.subjectId?.name || '—'}</td>
                      <td><span className="badge badge-info">{m.examType}</span></td>
                      <td>{m.marksObtained} / {m.maxMarks} ({((m.marksObtained / m.maxMarks) * 100).toFixed(1)}%)</td>
                      <td><strong>{m.gradePoint}</strong></td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m._id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>

      {/* ── Semester CGPA banner ── */}
      {cgpaSem?.totalSemesters > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 20,
          padding: '14px 20px', borderRadius: 14, margin: '28px 0 16px',
          background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.25)',
          flexWrap: 'wrap',
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Semester CGPA
            </p>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#818cf8' }}>
              {cgpaSem.cgpa}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)' }}>
              {cgpaSem.totalSemesters} semester{cgpaSem.totalSemesters > 1 ? 's' : ''}
            </p>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
              SGPA per Semester
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {cgpaSem.sgpaList.map((s, i) => (
                <span key={i} style={{
                  fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text)',
                }}>
                  S{i + 1}: {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Add semester + semester list ── */}
      <div className="grid-2" style={{ marginTop: 16 }}>

        {/* Add semester form */}
        <div className="card">
          <div className="card-title">➕ Add Semester (SGPA)</div>
          <div className="form-group">
            <label className="form-label">Semester No. *</label>
            <input
              className="form-input" type="number" min="1" placeholder="e.g. 1"
              value={semForm.semesterNumber}
              onChange={e => setSemForm(p => ({ ...p, semesterNumber: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Label (optional)</label>
            <input
              className="form-input" type="text" placeholder="e.g. Fall 2024"
              value={semForm.semesterName}
              onChange={e => setSemForm(p => ({ ...p, semesterName: e.target.value }))}
            />
          </div>

          <label className="form-label" style={{ marginBottom: 8 }}>Subjects *</label>
          {semForm.subjects.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <input
                className="form-input" style={{ flex: 2, minWidth: 120 }}
                placeholder="Subject name"
                value={s.name}
                onChange={e => updateSubjectRow(i, 'name', e.target.value)}
              />
              <input
                className="form-input" style={{ width: 80 }}
                type="number" min="1" placeholder="Credits"
                value={s.credits}
                onChange={e => updateSubjectRow(i, 'credits', e.target.value)}
              />
              <select
                className="form-select" style={{ width: 100 }}
                value={s.grade}
                onChange={e => updateSubjectRow(i, 'grade', e.target.value)}
              >
                {gradeOptions.map(({ grade, point }) => (
                  <option key={grade} value={grade}>{grade} ({point})</option>
                ))}
              </select>
              {semForm.subjects.length > 1 && (
                <button className="btn btn-danger btn-sm" onClick={() => removeSubjectRow(i)}>✕</button>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button className="btn btn-secondary" onClick={addSubjectRow}>+ Subject</button>
            <button className="btn btn-primary" onClick={handleAddSemester} disabled={semLoading}>
              {semLoading ? 'Saving…' : 'Save Semester'}
            </button>
          </div>
        </div>

        {/* Semester list */}
        <div className="card">
          <div className="card-title">📚 Semesters</div>
          {semesters.length === 0
            ? <p className="text-muted">No semesters added yet.</p>
            : semesters.map(sem => (
                <div key={sem._id} style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                        Semester {sem.semesterNumber}{sem.semesterName ? ` — ${sem.semesterName}` : ''}
                      </span>
                      <span style={{
                        marginLeft: 10, fontSize: 11, fontWeight: 600, color: '#818cf8',
                        background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.25)',
                        borderRadius: 99, padding: '2px 8px',
                      }}>
                        SGPA {sem.sgpa}
                      </span>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteSemester(sem._id)}>
                      Delete
                    </button>
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {sem.subjects.map((s, i) => (
                      <span key={i} style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 99,
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                        color: 'var(--muted)',
                      }}>
                        {s.name} · {s.grade} · {s.credits}cr
                      </span>
                    ))}
                  </div>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  );
}