import { useEffect, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, ArcElement, Tooltip, Legend
} from 'chart.js';
import { attendanceService, marksService, aiService, notificationService } from '../services/apiServices';
import { useAuth } from '../context/AuthContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

export default function Dashboard() {
  const { user }  = useAuth();
  const [summary, setSummary]   = useState([]);
  const [cgpa, setCgpa]         = useState(null);
  const [recs, setRecs]         = useState([]);
  const [notifs, setNotifs]     = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      attendanceService.getSummary(),
      marksService.getCGPA(),
      aiService.getRecommendations(),
      notificationService.getAll(),
    ]).then(([a, m, r, n]) => {
      setSummary(a.data.summary || []);
      setCgpa(m.data.cgpa);
      setRecs(r.data.suggestions || []);
      setNotifs(n.data.notifications || []);
    }).finally(() => setLoading(false));
  }, []);

  const overallAttendance = summary.length
    ? (summary.reduce((s, i) => s + parseFloat(i.percentage), 0) / summary.length).toFixed(1)
    : 0;

  const attendanceChartData = {
    labels: summary.map(s => s.subject),
    datasets: [{
      label: 'Attendance %',
      data: summary.map(s => s.percentage),
      backgroundColor: summary.map(s => s.isLow ? '#fca5a5' : '#a5b4fc'),
      borderRadius: 6,
    }],
  };

  const cgpaGaugeData = {
    labels: ['CGPA', 'Remaining'],
    datasets: [{
      data: [cgpa || 0, 10 - (cgpa || 0)],
      backgroundColor: ['#6366f1', '#e2e8f0'],
      borderWidth: 0,
    }],
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Good morning, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">Here's your academic overview for today</p>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid-4 mb-4">
        {[
          { label: 'CGPA',          value: cgpa ?? '—',         icon: '🎯', color: '#6366f1' },
          { label: 'Overall Attend.', value: `${overallAttendance}%`, icon: '✅', color: '#22c55e' },
          { label: 'Subjects',      value: summary.length,      icon: '📚', color: '#f59e0b' },
          { label: 'Low Alerts',    value: summary.filter(s => s.isLow).length, icon: '⚠️', color: '#ef4444' },
        ].map(stat => (
          <div className="card stat-card" key={stat.label}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{stat.icon}</div>
            <div className="stat-value" style={{ color: stat.color }}>{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid-2 mb-4">
        {/* Attendance bar chart */}
        <div className="card">
          <div className="card-title">📊 Attendance per Subject</div>
          {summary.length > 0
            ? <Bar data={attendanceChartData} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100 } } }} />
            : <p className="text-muted">No attendance data yet.</p>
          }
        </div>

        {/* CGPA gauge */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="card-title" style={{ alignSelf: 'flex-start' }}>🎓 CGPA Gauge</div>
          {cgpa != null && cgpa > 0
            ? <>
                <Doughnut data={cgpaGaugeData} options={{ cutout: '75%', plugins: { legend: { display: false } } }} style={{ maxWidth: 180 }} />
                <p style={{ marginTop: 12, fontSize: 28, fontWeight: 700, color: 'var(--primary)' }}>{cgpa}</p>
                <p className="text-muted">out of 10.0</p>
              </>
            : <p className="text-muted">Add final exam marks to see CGPA.</p>
          }
        </div>
      </div>

      <div className="grid-2">
        {/* AI Recommendations */}
        <div className="card">
          <div className="card-title">🤖 AI Recommendations</div>
          {recs.length > 0 ? recs.map((r, i) => (
            <div key={i} className={`suggestion ${r.priority}`}>
              <span className="suggestion-icon">{r.icon}</span>
              <div>
                <div className="suggestion-title">{r.title}</div>
                <div className="suggestion-msg">{r.message}</div>
              </div>
            </div>
          )) : <p className="text-muted">No recommendations yet. Add subjects, attendance and marks to get insights.</p>}
        </div>

        {/* Notifications */}
        <div className="card">
          <div className="card-title">🔔 Notifications</div>
          {notifs.map((n, i) => (
            <div key={i} className="notification-item">
              <div className={`notif-dot ${n.type}`} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</div>
                <div className="text-muted">{n.message}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
