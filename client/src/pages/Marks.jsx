import { useEffect, useState } from 'react';
import { marksService, subjectService } from '../services/apiServices';
import toast from 'react-hot-toast';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const EMPTY = { subjectId: '', examType: 'midterm', marksObtained: '', maxMarks: 100, examDate: '' };

export default function Marks() {
  const [marks,    setMarks]    = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [cgpaData, setCgpaData] = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [loading,  setLoading]  = useState(true);

  const load = async () => {
    const [m, s, c] = await Promise.all([
      marksService.getAll(),
      subjectService.getAll(),
      marksService.getCGPA(),
    ]);
    setMarks(m.data.marks || []);
    setSubjects(s.data.subjects || []);
    setCgpaData(c.data);
    setLoading(false);
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

      <div className="grid-2 mb-4">
        {/* Add marks form */}
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
                {['midterm','final','quiz','assignment','practical'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
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

        {/* CGPA breakdown chart */}
        <div className="card">
          <div className="card-title">Grade Points (Final Exams)</div>
          {cgpaData?.breakdown?.length > 0
            ? <Bar data={chartData} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 10 } } }} />
            : <p className="text-muted">Add final exam marks to see CGPA breakdown.</p>
          }
        </div>
      </div>

      {/* Marks table */}
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
                      <td>{m.marksObtained} / {m.maxMarks} ({((m.marksObtained/m.maxMarks)*100).toFixed(1)}%)</td>
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
    </div>
  );
}
