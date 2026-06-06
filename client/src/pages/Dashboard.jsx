import { useEffect, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, ArcElement, Tooltip, Legend
} from 'chart.js';
import { Target, CheckCircle, BookOpen, AlertTriangle, Bot, Bell } from 'lucide-react';
import { attendanceService, marksService, aiService, notificationService, subjectService } from '../services/apiServices';
import { useAuth } from '../context/AuthContext';
import SmartPlanCard from '../components/SmartPlanCard';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

function EmptyState({ title, description, buttonText, buttonLink }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', gap: '8px' }}>
      <svg width="80" height="60" viewBox="0 0 120 90" fill="none" style={{ opacity: 0.4, marginBottom: '8px' }}>
        <rect x="10" y="10" width="100" height="70" rx="8" fill="var(--color-surface-3)" stroke="var(--border)" strokeWidth="2" />
        <circle cx="60" cy="40" r="16" fill="var(--color-accent-muted)" stroke="var(--color-accent)" strokeWidth="2" strokeDasharray="4 4" />
        <path d="M40 70h40" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{title}</div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', maxWidth: '240px' }}>{description}</div>
      {buttonText && (
        <Link to={buttonLink} className="btn btn-primary btn-sm" style={{ marginTop: '12px', textDecoration: 'none' }}>
          {buttonText}
        </Link>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user }  = useAuth();
  const [summary, setSummary]         = useState([]);
  const [cgpa, setCgpa]               = useState(null);
  const [recs, setRecs]               = useState([]);
  const [notifs, setNotifs]           = useState([]);
  const [subjects, setSubjects]       = useState([]);
  const [subjectCount, setSubjectCount] = useState(0);
  const [loading, setLoading]         = useState(true);
  const [classSummary, setClassSummary] = useState([]);

  useEffect(() => {
    const isTeacher = user?.role === 'teacher';
    const promises = [
      attendanceService.getSummary(),
      marksService.getCGPAbySemester(),
      aiService.getRecommendations(),
      notificationService.getAll(),
      subjectService.getAll(),
    ];

    if (isTeacher) {
      promises.push(attendanceService.getClassSummary());
    }

    Promise.all(promises).then(([a, m, r, n, s, cs]) => {
      setSummary(a.data.summary || []);
      setCgpa(m.data.cgpa);
      setRecs(r.data.suggestions || []);
      setNotifs(n.data.notifications || []);
      setSubjects(s.data.subjects || []);
      setSubjectCount((s.data.subjects || []).length);
      if (cs) {
        setClassSummary(cs.data.students || []);
      }
    }).catch(() => {
      // 401 is handled globally; swallow
    }).finally(() => setLoading(false));
  }, [user]);

  const overallAttendance = summary.length
    ? (summary.reduce((s, i) => s + parseFloat(i.percentage), 0) / summary.length).toFixed(1)
    : 0;

  const classSummaryList = classSummary || [];
  const classAvgAttendance = classSummaryList.length
    ? (classSummaryList.reduce((acc, s) => acc + parseFloat(s.overall || 0), 0) / classSummaryList.length).toFixed(1)
    : 0;

  const subjectAverages = {};
  classSummaryList.forEach(student => {
    (student.subjects || []).forEach(sub => {
      if (!subjectAverages[sub.subject]) {
        subjectAverages[sub.subject] = { sum: 0, count: 0 };
      }
      subjectAverages[sub.subject].sum += parseFloat(sub.percentage || 0);
      subjectAverages[sub.subject].count += 1;
    });
  });

  const classSubjectLabels = Object.keys(subjectAverages);
  const classSubjectData = classSubjectLabels.map(label => 
    (subjectAverages[label].sum / subjectAverages[label].count).toFixed(1)
  );

  const getCgpaColor = (val) => {
    if (val === '—' || val == null) return 'var(--color-text-primary)';
    const num = parseFloat(val);
    if (num > 8) return 'var(--color-success)';
    if (num >= 6) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  const getAttendanceColor = (val) => {
    if (val === '—' || val == null) return 'var(--color-text-primary)';
    const num = parseFloat(val);
    if (num > 75) return 'var(--color-success)';
    if (num >= 50) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  const dayNames  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const todayName = dayNames[new Date().getDay()];

  const todayClasses = [];
  subjects.forEach(sub => {
    (sub.schedule || []).filter(sl => sl.day === todayName).forEach(sl => {
      todayClasses.push({ ...sl, name: sub.name });
    });
  });

  const todayScheduleSummary = todayClasses.length > 0
    ? `Today: ${todayClasses.length} class${todayClasses.length > 1 ? 'es' : ''} scheduled (${todayClasses.map(c => c.name).join(', ')})`
    : 'No classes scheduled for today';

  const isStudent = user?.role === 'student';

  const attendanceChartData = isStudent ? {
    labels: summary.map(s => s.subject),
    datasets: [{
      label: 'Attendance %',
      data: summary.map(s => s.percentage),
      backgroundColor: summary.map(s =>
        s.isLow ? 'rgba(239, 68, 68, 0.7)' : 'rgba(99, 102, 241, 0.7)'
      ),
      borderColor: summary.map(s =>
        s.isLow ? 'rgba(239, 68, 68, 1)' : 'rgba(99, 102, 241, 1)'
      ),
      borderWidth: 1,
      borderRadius: 6,
    }],
  } : {
    labels: classSubjectLabels,
    datasets: [{
      label: 'Class Avg Attendance %',
      data: classSubjectData,
      backgroundColor: 'rgba(99, 102, 241, 0.7)',
      borderColor: 'rgba(99, 102, 241, 1)',
      borderWidth: 1,
      borderRadius: 6,
    }],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(19, 22, 31, 0.95)',
        borderColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        padding: 10,
      }
    },
    scales: {
      y: {
        min: 0, max: 100,
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#94a3b8', font: { size: 11 } },
      },
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { size: 11 } },
      }
    }
  };

  const cgpaGaugeData = {
    labels: ['CGPA', 'Remaining'],
    datasets: [{
      data: [cgpa || 0, 10 - (cgpa || 0)],
      backgroundColor: ['#6366f1', 'rgba(255,255,255,0.05)'],
      borderWidth: 0,
    }],
  };

  const stats = [
    { label: 'CGPA',        value: cgpa ?? '—',                  icon: Target,        color: getCgpaColor(cgpa), isPrimary: true },
    { 
      label: isStudent ? 'Attendance' : 'Class Attendance',  
      value: isStudent ? `${overallAttendance}%` : `${classAvgAttendance}%`,      
      icon: CheckCircle,   
      color: getAttendanceColor(isStudent ? overallAttendance : classAvgAttendance) 
    },
    { label: 'Subjects',    value: subjectCount,                 icon: BookOpen,      color: 'var(--color-text-primary)' },
    { 
      label: isStudent ? 'Low Alerts' : 'Class Low Alerts',  
      value: isStudent ? summary.filter(s => s.isLow).length : classSummaryList.filter(s => parseFloat(s.overall || 0) < 75).length, 
      icon: AlertTriangle, 
      color: (isStudent ? summary.filter(s => s.isLow).length : classSummaryList.filter(s => parseFloat(s.overall || 0) < 75).length) > 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)' 
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="shimmer" style={{ height: 60, width: '40%', borderRadius: 8 }} />
        <div className="grid-4">
          {[1,2,3,4].map(i => <div key={i} className="card shimmer" style={{ height: 100 }} />)}
        </div>
        <div className="grid-2">
          <div className="card shimmer" style={{ height: 240 }} />
          <div className="card shimmer" style={{ height: 240 }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: '20px', fontWeight: 500 }}>
            {getGreeting()}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="page-subtitle">{todayScheduleSummary}</p>
        </div>
        <div style={{
          fontSize: 12, color: 'var(--color-text-secondary)',
          background: 'var(--color-surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '6px 14px',
          fontWeight: 500,
        }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>
      </div>

      {/* Stat row */}
      <div className="grid-4 mb-4">
        {stats.map(stat => {
          const IconComponent = stat.icon;
          return (
            <div 
              className="card stat-card" 
              key={stat.label}
              style={stat.isPrimary ? { borderLeft: '2px solid var(--color-accent)' } : undefined}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--color-accent-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--color-accent)',
                }}>
                  <IconComponent size={18} />
                </div>
              </div>
              <div className="stat-value" style={{ color: stat.color, fontSize: '28px' }}>{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid-2 mb-4">
        <div className="card">
          <div className="card-title">
            {isStudent ? '📊 Attendance per Subject' : '📊 Class Avg Attendance per Subject'}
          </div>
          {isStudent ? (
            summary.length > 0
              ? <Bar data={attendanceChartData} options={chartOptions} />
              : <EmptyState 
                  title="No Attendance Data" 
                  description="Import your attendance report or mark attendance manually to unlock metrics." 
                  buttonText="Add Attendance" 
                  buttonLink="/attendance" 
                />
          ) : (
            classSummaryList.length > 0
              ? <Bar data={attendanceChartData} options={chartOptions} />
              : <EmptyState 
                  title="No Class Summary Data" 
                  description="Upload attendance register sheets to view class metrics." 
                  buttonText="Upload Attendance" 
                  buttonLink="/attendance" 
                />
          )}
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
                        backgroundColor: 'rgba(19, 22, 31, 0.95)',
                        borderColor: 'rgba(255,255,255,0.06)',
                        borderWidth: 1,
                        titleColor: '#f1f5f9',
                        bodyColor: '#94a3b8',
                      }
                    }
                  }}
                  style={{ maxWidth: 180 }}
                />
                <p style={{ marginTop: 14, fontFamily: 'inherit', fontSize: 28, fontWeight: 500, color: 'var(--color-accent)' }}>
                  {cgpa}
                </p>
                <p className="text-muted">out of 10.0</p>
              </>
            : <EmptyState 
                title="No CGPA Data" 
                description="Add your semesters or exam marks to compute your gauge score." 
                buttonText="Add Marks" 
                buttonLink="/marks" 
              />
          }
        </div>
      </div>

      {/* Dashboard AI Promo Banner */}
      <div className="card mb-4" style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(129,140,248,0.05) 100%)',
        border: '1px solid rgba(129,140,248,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        padding: '18px 22px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            background: 'var(--color-accent-muted)',
            color: 'var(--color-accent)',
            borderRadius: 'var(--radius-md)',
            width: 46,
            height: 46,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Bot size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)' }}>Talk to Dashboard AI</h3>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
              Ask questions, predict CGPA, add subjects or marks with natural language commands.
            </p>
          </div>
        </div>
        <Link to="/ai-assistant?mode=assistant" className="btn btn-primary" style={{ padding: '8px 16px', textDecoration: 'none' }}>
          Open Dashboard AI ➔
        </Link>
      </div>

      {/* Bottom row */}
      <div className="grid-2">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="card-title" style={{ margin: 0 }}>🤖 AI Recommendations</div>
            <Link
              to="/ai-assistant?mode=assistant"
              style={{
                fontSize: 12,
                color: 'var(--color-accent)',
                textDecoration: 'none',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = 0.8}
              onMouseLeave={(e) => e.currentTarget.style.opacity = 1}
            >
              Ask Dashboard AI ➔
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
            : <EmptyState 
                title="No Recommendations" 
                description="Get personalized AI advice by chatting with the assistant." 
                buttonText="Go to Assistant" 
                buttonLink="/ai-assistant" 
              />
          }
        </div>

        <div className="card">
          <div className="card-title">🔔 Notifications</div>
          {notifs.length > 0
            ? notifs.map((n, i) => (
                <div key={i} className="notification-item">
                  <div className={`notif-dot ${n.type}`} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{n.title}</div>
                    <div className="text-muted">{n.message}</div>
                  </div>
                </div>
              ))
            : <EmptyState 
                title="All Caught Up" 
                description="No new notifications at this time. Check back later!" 
              />
          }
        </div>
      </div>

      {/* Smart Study Plan */}
      <SmartPlanCard />
    </div>
  );
}