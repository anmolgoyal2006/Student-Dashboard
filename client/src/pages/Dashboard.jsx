import { useEffect, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, ArcElement, Tooltip, Legend
} from 'chart.js';
import { attendanceService, marksService, aiService, notificationService, subjectService } from '../services/apiServices';
import { useAuth } from '../context/AuthContext';
import SmartPlanCard from '../components/SmartPlanCard';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

// Icons as SVG components
const Icons = {
  target: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  checkCircle: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  book: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
    </svg>
  ),
  alertTriangle: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  sparkles: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/>
      <path d="M19 17v4"/>
      <path d="M3 5h4"/>
      <path d="M17 19h4"/>
    </svg>
  ),
  bell: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
    </svg>
  ),
  arrowRight: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  bot: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8"/>
      <rect width="16" height="12" x="4" y="8" rx="2"/>
      <path d="M2 14h2"/>
      <path d="M20 14h2"/>
      <path d="M15 13v2"/>
      <path d="M9 13v2"/>
    </svg>
  ),
  barChart: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10"/>
      <line x1="18" y1="20" x2="18" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="16"/>
    </svg>
  ),
  graduation: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
      <path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  ),
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState([]);
  const [cgpa, setCgpa] = useState(null);
  const [recs, setRecs] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [subjectCount, setSubjectCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      attendanceService.getSummary(),
      marksService.getCGPAbySemester(),
      aiService.getRecommendations(),
      notificationService.getAll(),
      subjectService.getAll(),
    ]).then(([a, m, r, n, s]) => {
      setSummary(a.data.summary || []);
      setCgpa(m.data.cgpa);
      setRecs(r.data.suggestions || []);
      setNotifs(n.data.notifications || []);
      setSubjectCount((s.data.subjects || []).length);
    }).catch(() => {}).finally(() => setLoading(false));
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
        s.isLow ? 'rgba(239, 68, 68, 0.6)' : 'rgba(139, 92, 246, 0.6)'
      ),
      borderColor: summary.map(s =>
        s.isLow ? 'rgba(239, 68, 68, 0.9)' : 'rgba(139, 92, 246, 0.9)'
      ),
      borderWidth: 1,
      borderRadius: 6,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(9, 9, 11, 0.95)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        titleColor: '#fafafa',
        bodyColor: '#a1a1aa',
        padding: 12,
        cornerRadius: 8,
        titleFont: { weight: '600' },
      }
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: '#71717a', font: { size: 11 } },
        border: { display: false },
      },
      x: {
        grid: { display: false },
        ticks: { color: '#71717a', font: { size: 11 } },
        border: { display: false },
      }
    }
  };

  const cgpaGaugeData = {
    labels: ['CGPA', 'Remaining'],
    datasets: [{
      data: [cgpa || 0, 10 - (cgpa || 0)],
      backgroundColor: ['#8b5cf6', 'rgba(255, 255, 255, 0.04)'],
      borderWidth: 0,
    }],
  };

  const stats = [
    { label: 'CGPA', value: cgpa ?? '-', icon: Icons.target, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
    { label: 'Attendance', value: `${overallAttendance}%`, icon: Icons.checkCircle, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
    { label: 'Subjects', value: subjectCount, icon: Icons.book, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    { label: 'Alerts', value: summary.filter(s => s.isLow).length, icon: Icons.alertTriangle, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  ];

  if (loading) return <div className="spinner" />;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{getGreeting()}, {user?.name?.split(' ')[0]}</h1>
          <p className="page-subtitle">{"Here's your academic overview for today"}</p>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          color: 'var(--text-muted)',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-default)',
          borderRadius: 8,
          padding: '8px 14px',
          fontWeight: 500,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid-4 mb-4">
        {stats.map(stat => (
          <div className="card stat-card" key={stat.label} style={{ textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: stat.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: stat.color,
              flexShrink: 0,
            }}>
              {stat.icon}
            </div>
            <div>
              <div className="stat-label" style={{ marginBottom: 4 }}>{stat.label}</div>
              <div className="stat-value" style={{ fontSize: 28, color: stat.color }}>{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid-2 mb-4">
        <div className="card">
          <div className="card-title">
            {Icons.barChart}
            Attendance per Subject
          </div>
          {summary.length > 0
            ? <div style={{ height: 240 }}><Bar data={attendanceChartData} options={chartOptions} /></div>
            : <p className="text-muted">No attendance data yet.</p>
          }
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="card-title" style={{ alignSelf: 'flex-start' }}>
            {Icons.graduation}
            CGPA Overview
          </div>
          {cgpa != null && cgpa > 0
            ? <>
                <div style={{ position: 'relative', width: 180, height: 180 }}>
                  <Doughnut
                    data={cgpaGaugeData}
                    options={{
                      cutout: '78%',
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          backgroundColor: 'rgba(9, 9, 11, 0.95)',
                          borderColor: 'rgba(255, 255, 255, 0.1)',
                          borderWidth: 1,
                          titleColor: '#fafafa',
                          bodyColor: '#a1a1aa',
                        }
                      }
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                  }}>
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 32,
                      fontWeight: 700,
                      color: '#8b5cf6',
                      lineHeight: 1,
                    }}>
                      {cgpa}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>of 10.0</div>
                  </div>
                </div>
              </>
            : <p className="text-muted" style={{ marginTop: 40 }}>Add final exam marks to see CGPA.</p>
          }
        </div>
      </div>

      {/* AI Promo Banner */}
      <div className="card mb-4" style={{
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(59, 130, 246, 0.04) 100%)',
        border: '1px solid rgba(139, 92, 246, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        padding: '20px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 16px rgba(139, 92, 246, 0.3)',
          }}>
            {Icons.bot}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Talk to Dashboard AI</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Ask questions, predict CGPA, add subjects or marks with natural language.
            </p>
          </div>
        </div>
        <Link to="/ai-assistant?mode=assistant" className="btn btn-primary" style={{ textDecoration: 'none', gap: 6 }}>
          Open AI Assistant
          {Icons.arrowRight}
        </Link>
      </div>

      {/* Bottom Row */}
      <div className="grid-2">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div className="card-title" style={{ margin: 0 }}>
              {Icons.sparkles}
              AI Recommendations
            </div>
            <Link
              to="/ai-assistant?mode=assistant"
              style={{
                fontSize: 13,
                color: 'var(--primary-light)',
                textDecoration: 'none',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'opacity 0.15s',
              }}
            >
              Ask AI
              {Icons.arrowRight}
            </Link>
          </div>
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
          <div className="card-title">
            {Icons.bell}
            Notifications
          </div>
          {notifs.length > 0
            ? notifs.map((n, i) => (
                <div key={i} className="notification-item">
                  <div className={`notif-dot ${n.type}`} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</div>
                    <div className="text-muted">{n.message}</div>
                  </div>
                </div>
              ))
            : <p className="text-muted">No notifications.</p>
          }
        </div>
      </div>

      {/* Smart Study Plan */}
      <SmartPlanCard />
    </div>
  );
}
