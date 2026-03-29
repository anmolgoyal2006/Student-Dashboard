import { useEffect, useState } from 'react';
import { attendanceService, subjectService } from '../services/apiServices';
import toast from 'react-hot-toast';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function Attendance() {
  const [summary,  setSummary]  = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [trends,   setTrends]   = useState([]);
  const [form,     setForm]     = useState({ subjectId: '', date: new Date().toISOString().slice(0,10), status: 'present' });
  const [loading,  setLoading]  = useState(true);

  const load = async () => {
    const [s, sub, t] = await Promise.all([
      attendanceService.getSummary(),
      subjectService.getAll(),
      attendanceService.getTrends(),
    ]);
    setSummary(s.data.summary || []);
    setSubjects(sub.data.subjects || []);
    setTrends(t.data.trends || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await attendanceService.mark(form);
      toast.success('Attendance marked!');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark attendance');
    }
  };

  const getBarColor = pct => pct >= 75 ? 'success' : pct >= 60 ? 'warning' : 'danger';
  const getBadge    = pct => pct >= 75 ? 'badge-success' : pct >= 60 ? 'badge-warning' : 'badge-danger';

  const trendChart = {
    labels: trends.map(t => t.month),
    datasets: [{
      label: 'Monthly Attendance %',
      data:  trends.map(t => t.percentage),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99,102,241,0.1)',
      tension: 0.4,
      fill: true,
    }],
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">✅ Attendance Tracker</h1>
          <p className="page-subtitle">Mark and monitor your attendance per subject</p>
        </div>
      </div>

      <div className="grid-2 mb-4">
        {/* Mark attendance form */}
        <div className="card">
          <div className="card-title">Mark Today's Attendance</div>
          {subjects.length === 0
            ? <p className="text-muted">Add subjects in Timetable first.</p>
            : (
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <select className="form-select" value={form.subjectId} onChange={e => setForm(p => ({ ...p, subjectId: e.target.value }))} required>
                    <option value="">Select subject</option>
                    {subjects.map(s => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="cancelled">Cancelled (Holiday)</option>
                  </select>
                </div>
                <button className="btn btn-primary" type="submit">Mark Attendance</button>
              </form>
            )
          }
        </div>

        {/* Trend chart */}
        <div className="card">
          <div className="card-title">📈 Monthly Trend</div>
          {trends.length > 0
            ? <Line data={trendChart} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100 } } }} />
            : <p className="text-muted">No trend data yet.</p>
          }
        </div>
      </div>

      {/* Summary table */}
      <div className="card">
        <div className="card-title">Subject-wise Summary</div>
        {summary.length === 0
          ? <p className="text-muted">No attendance records yet.</p>
          : summary.map(s => (
            <div key={s.subject} style={{ marginBottom: 16 }}>
              <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
                <div>
                  <strong style={{ fontSize: 14 }}>{s.subject}</strong>
                  <span className="text-muted" style={{ marginLeft: 8 }}>{s.present}/{s.total} classes</span>
                </div>
                <span className={`badge ${getBadge(s.percentage)}`}>{s.percentage}%</span>
              </div>
              <div className="progress">
                <div className={`progress-bar ${getBarColor(s.percentage)}`} style={{ width: `${s.percentage}%` }} />
              </div>
              {s.isLow && (
                <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>
                  ⚠️ Below 75% — attend more classes to avoid shortage
                </p>
              )}
            </div>
          ))
        }
      </div>
    </div>
  );
}
