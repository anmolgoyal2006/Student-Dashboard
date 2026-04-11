// ============================================================
// Attendance.jsx — uses existing dashboard CSS classes
// No more inline style objects — everything matches the app theme
// ============================================================

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import BulkAttendanceUpload from '../components/BulkAttendanceUpload';
import StudentAttendanceView from '../components/StudentAttendanceView';
import { attendanceService, subjectService } from '../services/apiServices';
import toast from 'react-hot-toast';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  PointElement, LineElement,
  Tooltip, Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

// ── Pure helpers ──────────────────────────────────────────────────────────────

const neededToReach75 = (total, present) => {
  if (total === 0 || present / total >= 0.75) return 0;
  return Math.ceil((0.75 * total - present) / 0.25);
};

const projectMiss = (total, present, miss) => {
  const newTotal = total + miss;
  if (newTotal === 0) return 100;
  return +((present / newTotal) * 100).toFixed(1);
};

// Maps to existing CSS: badge-success/warning/danger & progress-bar success/warning/danger
const themeFor = pct =>
  pct >= 75
    ? { badge: 'badge-success', bar: 'success', text: 'var(--success)', tag: 'SAFE'     }
  : pct >= 60
    ? { badge: 'badge-warning', bar: 'warning', text: 'var(--warning)', tag: 'AT RISK'  }
    : { badge: 'badge-danger',  bar: 'danger',  text: 'var(--danger)',  tag: 'CRITICAL' };

// ─────────────────────────────────────────────────────────────────────────────
export default function Attendance() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';

  const [summary,  setSummary]  = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [trends,   setTrends]   = useState([]);
  const [form,     setForm]     = useState({
    subjectId: '',
    date     : new Date().toISOString().slice(0, 10),
    status   : 'present',
  });
 const [loading,      setLoading]      = useState(true);
  const [classSummary, setClassSummary] = useState([]);

const load = async () => {
    try {
      const [s, sub, t] = await Promise.all([
        attendanceService.getSummary(),
        subjectService.getAll(),
        attendanceService.getTrends(),
      ]);
      setSummary(s.data.summary     || []);
      setSubjects(sub.data.subjects || []);
      setTrends(t.data.trends       || []);

      if (isTeacher) {
        const cs = await attendanceService.getClassSummary();
        setClassSummary(cs.data.students || []);
      }
   } catch (err) {
  console.error(err);
      toast.error('Failed to load attendance data.');
    } finally {
      setLoading(false);
    }
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

  const safeCount     = summary.filter(s => s.percentage >= 75).length;
  const atRiskCount   = summary.filter(s => s.percentage >= 60 && s.percentage < 75).length;
  const criticalCount = summary.filter(s => s.percentage < 60).length;

  const trendChart = {
    labels  : trends.map(t => t.month),
    datasets: [{
      label               : 'Monthly Attendance %',
      data                : trends.map(t => t.percentage),
      borderColor         : '#818cf8',
      backgroundColor     : 'rgba(129,140,248,0.08)',
      tension             : 0.4,
      fill                : true,
      pointRadius         : 4,
      pointBackgroundColor: '#818cf8',
    }],
  };

  const trendOptions = {
    responsive: true,
    plugins   : { legend: { display: false } },
    scales    : {
      x: { ticks: { color: '#6e7681' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { min: 0, max: 100, ticks: { color: '#6e7681', callback: v => `${v}%` }, grid: { color: 'rgba(255,255,255,0.05)' } },
    },
  };

if (loading) return <div className="spinner" />;

 if (isStudent) {
    return <StudentAttendanceView sid={user?.sid} />;
  }

  return (
    <div>
   {/* Bulk upload — teachers only */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Tracker</h1>
          <p  className="page-subtitle">Mark and monitor your attendance per subject</p>
       </div>
      </div>

      {isTeacher && (
        <div className="card mb-4">
          <div className="card-title">📤 Bulk Attendance Upload</div>
          <p className="text-muted">
            Upload an Excel file to mark attendance for multiple students at once.
          </p>
          <BulkAttendanceUpload />
        </div>
      )}

{/* Insight cards — students only */}
      {!isTeacher && summary.length > 0 && (
        <div className="grid-4 mb-4">
          <InsightCard emoji="✅" value={safeCount}      label="Subjects Safe"     color="var(--success)" />
          <InsightCard emoji="⚠️" value={atRiskCount}    label="Subjects At Risk"  color="var(--warning)" />
          <InsightCard emoji="🚨" value={criticalCount}  label="Subjects Critical" color="var(--danger)"  />
          <InsightCard emoji="📚" value={summary.length} label="Total Subjects"    color="var(--primary)" />
        </div>
      )}

    {/* Form + chart — students only */}
      {!isTeacher && <div className="grid-2 mb-4">

        <div className="card">
          <div className="card-title">Mark Today's Attendance</div>
          {subjects.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📋</div>
              <p style={{ fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>No subjects yet</p>
              <p className="text-muted">Add subjects in Timetable first.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <select
                  className="form-select"
                  value={form.subjectId}
                  onChange={e => setForm(p => ({ ...p, subjectId: e.target.value }))}
                  required
                >
                  <option value="">Select subject…</option>
                  {subjects.map(s => (
                    <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={form.status}
                  onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="cancelled">Cancelled (Holiday)</option>
                </select>
              </div>

              <button className="btn btn-primary" type="submit">Mark Attendance</button>
            </form>
          )}
        </div>

        <div className="card">
          <div className="card-title">📈 Monthly Trend</div>
          {trends.length > 0 ? (
            <Line data={trendChart} options={trendOptions} />
          ) : (
            <div className="empty-state">
              <div className="icon">📉</div>
              <p style={{ fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>No trend data yet</p>
              <p className="text-muted">Mark attendance to see your monthly trend.</p>
            </div>
          )}
        </div>
   </div>}

      {/* Subject summary — only for non-teachers */}
      {!isTeacher && <div className="card">
        <div className="card-title">Subject-wise Summary</div>
        {summary.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🗂️</div>
            <p style={{ fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>No records yet</p>
            <p className="text-muted">Mark your first class above to start tracking.</p>
          </div>
        ) : (
          summary.map(s => <SubjectRow key={s.subject} data={s} />)
        )}
      </div>}

      {/* Class summary — teachers only */}
      {isTeacher && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">👥 Student Attendance Summary</div>
          {classSummary.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📋</div>
              <p style={{ fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>No data yet</p>
              <p className="text-muted">Upload attendance Excel to see student summary.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600 }}>Student</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600 }}>SID</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600 }}>Overall %</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600 }}>Subjects</th>
                  </tr>
                </thead>
                <tbody>
                  {classSummary.map((s, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--card-border)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text)' }}>
                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.email}</div>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{s.sid}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontWeight: 700,
                          color: s.overall >= 75 ? 'var(--success)' : s.overall >= 60 ? 'var(--warning)' : 'var(--danger)'
                        }}>
                          {s.overall}%
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {s.subjects.map((sub, j) => (
                            <span key={j} style={{
                              padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                              background: sub.percentage >= 75 ? 'rgba(34,197,94,0.15)' : sub.percentage >= 60 ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.15)',
                              color: sub.percentage >= 75 ? '#4ade80' : sub.percentage >= 60 ? '#fbbf24' : '#f87171',
                            }}>
                              {sub.subject}: {sub.percentage}%
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

// ── SubjectRow ────────────────────────────────────────────────────────────────

function SubjectRow({ data }) {
  const { subject, present, total, percentage } = data;
  const theme  = themeFor(percentage);
  const needed = neededToReach75(total, present);
  const miss1  = projectMiss(total, present, 1);
  const miss2  = projectMiss(total, present, 2);
  const showMissWarning = percentage >= 75 && miss2 < 75;

  return (
   <div className={`subject-row subject-row--${theme.bar}`}>
      {/* Header row */}
      <div className="flex justify-between items-center" style={{ marginBottom: 8 }}>
        <div>
<span className="subject-name">
            {subject}
          </span>
          <span className="text-muted">{present}/{total} classes attended</span>
        </div>
        <div className="flex items-center gap-2">
         <span className={`subject-pct subject-pct--${theme.bar}`}>{percentage}%</span>
          <span className={`badge ${theme.badge}`}>{theme.tag}</span>
        </div>
      </div>

      {/* Progress — .progress / .progress-bar.success|warning|danger from index.css */}
      <div className="progress" style={{ marginBottom: 8, position: 'relative', overflow: 'visible' }}>
        <div className={`progress-bar ${theme.bar}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
     <div className="progress-marker" title="75% threshold" />
      </div>

      {/* Smart insights */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {percentage >= 75 && (
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--success)' }}>
            ✅ You're safe in this subject.
          </p>
        )}
        {percentage < 75 && needed > 0 && (
          <p style={{ margin: 0, fontSize: 12.5, color: theme.text }}>
            ⚠️ Attend <strong>{needed} consecutive class{needed > 1 ? 'es' : ''}</strong> to reach 75%.
          </p>
        )}
        {showMissWarning && (
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--warning)' }}>
            🔮 Miss 1 → <strong>{miss1}%</strong>
            {' · '}
            Miss 2 → <strong style={{ color: miss2 < 75 ? 'var(--danger)' : 'inherit' }}>
              {miss2}%
            </strong>
            {miss2 < 75 && ' ⚠️ drops below 75%!'}
          </p>
        )}
        {percentage < 75 && (
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>
            🔮 Miss 1 → <strong>{miss1}%</strong>
            {' · '}
            Miss 2 → <strong>{miss2}%</strong>
          </p>
        )}
      </div>
    </div>
  );
}

// ── InsightCard ───────────────────────────────────────────────────────────────

function InsightCard({ emoji, value, label, color }) {
  return (
    <div className={`card stat-card stat-card--${color === 'var(--success)' ? 'success' : color === 'var(--warning)' ? 'warning' : color === 'var(--danger)' ? 'danger' : 'primary'}`}>
      <span className="stat-icon">{emoji}</span>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}