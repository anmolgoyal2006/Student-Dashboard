import { useEffect, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, ArcElement, Tooltip, Legend
} from 'chart.js';
import { attendanceService, marksService, aiService, notificationService } from '../services/apiServices';
import { useAuth } from '../context/AuthContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

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
      backgroundColor: summary.map(s =>
        s.isLow ? 'rgba(248,113,113,0.7)' : 'rgba(129,140,248,0.7)'
      ),
      borderColor: summary.map(s =>
        s.isLow ? 'rgba(248,113,113,1)' : 'rgba(129,140,248,1)'
      ),
      borderWidth: 1,
      borderRadius: 7,
    }],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(13,17,23,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        titleColor: '#e6edf3',
        bodyColor: '#6e7681',
        padding: 10,
      }
    },
    scales: {
      y: {
        min: 0, max: 100,
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#6e7681', font: { size: 11 } },
      },
      x: {
        grid: { display: false },
        ticks: { color: '#6e7681', font: { size: 11 } },
      }
    }
  };

  const cgpaGaugeData = {
    labels: ['CGPA', 'Remaining'],
    datasets: [{
      data: [cgpa || 0, 10 - (cgpa || 0)],
      backgroundColor: ['#818cf8', 'rgba(255,255,255,0.06)'],
      borderWidth: 0,
    }],
  };

  const stats = [
    { label: 'CGPA',            value: cgpa ?? '—',                              icon: '🎯', color: '#818cf8' },
    { label: 'Attendance',      value: `${overallAttendance}%`,                  icon: '✅', color: '#34d399' },
    { label: 'Subjects',        value: summary.length,                           icon: '📚', color: '#fbbf24' },
    { label: 'Low Alerts',      value: summary.filter(s => s.isLow).length,      icon: '⚠️', color: '#f87171' },
  ];

  if (loading) return <div className="spinner" />;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {getGreeting()}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="page-subtitle">Here's your academic overview for today</p>
        </div>
        <div style={{
          fontSize: 12, color: 'var(--muted)',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border)',
          borderRadius: 8, padding: '6px 14px',
          fontWeight: 500,
        }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>
      </div>

      {/* Stat row */}
      <div className="grid-4 mb-4">
        {stats.map(stat => (
          <div className="card stat-card" key={stat.label}>
            <span className="stat-icon">{stat.icon}</span>
            <div className="stat-value" style={{ color: stat.color }}>{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid-2 mb-4">
        <div className="card">
          <div className="card-title">📊 Attendance per Subject</div>
          {summary.length > 0
            ? <Bar data={attendanceChartData} options={chartOptions} />
            : <p className="text-muted">No attendance data yet.</p>
          }
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="card-title" style={{ alignSelf: 'flex-start' }}>🎓 CGPA Gauge</div>
          {cgpa != null && cgpa > 0
            ? <>
                <Doughnut
                  data={cgpaGaugeData}
                  options={{
                    cutout: '76%',
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: 'rgba(13,17,23,0.95)',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        titleColor: '#e6edf3',
                        bodyColor: '#6e7681',
                      }
                    }
                  }}
                  style={{ maxWidth: 180 }}
                />
                <p style={{ marginTop: 14, fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 700, color: 'var(--primary)' }}>
                  {cgpa}
                </p>
                <p className="text-muted">out of 10.0</p>
              </>
            : <p className="text-muted" style={{ marginTop: 20 }}>Add final exam marks to see CGPA.</p>
          }
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid-2">
        <div className="card">
          <div className="card-title">🤖 AI Recommendations</div>
          {recs.length > 0
            ? recs.map((r, i) => (
                <div key={i} className={`suggestion ${r.priority}`}>
                  <span className="suggestion-icon">{r.icon}</span>
                  <div>
                    <div className="suggestion-title">{r.title}</div>
                    <div className="suggestion-msg">{r.message}</div>
                  </div>
                </div>
              ))
            : <p className="text-muted">No recommendations yet. Add subjects, attendance and marks to get insights.</p>
          }
        </div>

        <div className="card">
          <div className="card-title">🔔 Notifications</div>
          {notifs.length > 0
            ? notifs.map((n, i) => (
                <div key={i} className="notification-item">
                  <div className={`notif-dot ${n.type}`} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{n.title}</div>
                    <div className="text-muted">{n.message}</div>
                  </div>
                </div>
              ))
            : <p className="text-muted">No notifications.</p>
          }
        </div>
      </div>
    </div>
  );
}