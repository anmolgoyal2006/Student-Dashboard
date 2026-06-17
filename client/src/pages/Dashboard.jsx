import { useEffect, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, ArcElement, Tooltip, Legend
} from 'chart.js';
import { Target, BookOpen, AlertTriangle, Bot, Bell, GraduationCap, Clock } from 'lucide-react';
import { attendanceService, marksService, aiService, notificationService, subjectService } from '../services/apiServices';

import { useAuth } from '../context/AuthContext';
import SmartPlanCard from '../components/SmartPlanCard';
import UpcomingDeadlines from '../components/UpcomingDeadlines';
import RiskAlertsCard from '../components/RiskAlertsCard';
import ClassroomConnect from '../components/ClassroomConnect';
import EmptyState from '../components/EmptyState';
import Skeleton, { StatsSkeleton } from '../components/Skeleton';
import useResponsive from '../utils/useResponsive';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

/* ─── colour helpers ─────────────────────────────────────────────────────── */
const getCgpaColor = (val) => {
  if (val === '—' || val == null) return '#94a3b8';
  const n = parseFloat(val);
  if (n > 8)  return '#22c55e';
  if (n >= 6) return '#f59e0b';
  return '#ef4444';
};

/* ─── tiny inline styles so nothing depends on external CSS vars ─────────── */
const card = {
  background: '#13161f',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 14,
  padding: '20px 22px',
};

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const [summary,      setSummary]      = useState([]);
  const [cgpa,         setCgpa]         = useState(null);
  const [recs,         setRecs]         = useState([]);
  const [notifs,       setNotifs]       = useState([]);
  const [subjects,     setSubjects]     = useState([]);
  const [subjectCount, setSubjectCount] = useState(0);
  const [loading,      setLoading]      = useState(true);
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
    if (isTeacher) promises.push(attendanceService.getClassSummary());

    Promise.all(promises)
      .then(([a, m, r, n, s, cs]) => {
        setSummary(a.data.summary || []);
        setCgpa(m.data.cgpa);
        setRecs(r.data.suggestions || []);
        setNotifs(n.data.notifications || []);
        setSubjects(s.data.subjects || []);
        setSubjectCount((s.data.subjects || []).length);
        if (cs) setClassSummary(cs.data.students || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  /* ── derived values ────────────────────────────────────────────────────── */
  const isStudent = user?.role !== 'teacher';

  const classSummaryList = classSummary || [];

  const subjectAverages = {};
  classSummaryList.forEach(student =>
    (student.subjects || []).forEach(sub => {
      if (!subjectAverages[sub.subject]) subjectAverages[sub.subject] = { sum: 0, count: 0 };
      subjectAverages[sub.subject].sum   += parseFloat(sub.percentage || 0);
      subjectAverages[sub.subject].count += 1;
    })
  );
  const classSubjectLabels = Object.keys(subjectAverages);
  const classSubjectData   = classSubjectLabels.map(l =>
    (subjectAverages[l].sum / subjectAverages[l].count).toFixed(1)
  );

  const lowCnt  = isStudent
    ? summary.filter(s => s.isLow).length
    : classSummaryList.filter(s => parseFloat(s.overall || 0) < 75).length;

  /* ── schedule ──────────────────────────────────────────────────────────── */
  const dayNames  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const todayName = dayNames[new Date().getDay()];
  const todayClasses = [];
  subjects.forEach(sub =>
    (sub.schedule || []).filter(sl => sl.day === todayName).forEach(sl =>
      todayClasses.push({ ...sl, name: sub.name })
    )
  );
  const todayScheduleSummary = todayClasses.length > 0
    ? `Today · ${todayClasses.length} class${todayClasses.length > 1 ? 'es' : ''}: ${todayClasses.map(c => c.name).join(', ')}`
    : 'No classes scheduled for today';

  const totalToday = todayClasses.length;

  /* ── stat cards ────────────────────────────────────────────────────────── */
  const stats = [
    { label: 'CGPA',
      value: cgpa ?? '—',
      icon: Target,
      color: getCgpaColor(cgpa),
      accent: true },
    { label: 'CLASSES TODAY',
      value: totalToday,
      icon: Clock,
      color: totalToday > 0 ? '#6366f1' : '#64748b' },
    { label: 'Subjects',
      value: subjectCount,
      icon: BookOpen,
      color: '#6366f1' },
    { label: isStudent ? 'Low Alerts' : 'Class Low Alerts',
      value: lowCnt,
      icon: AlertTriangle,
      color: lowCnt > 0 ? '#ef4444' : '#64748b' },
  ];

  /* ── bar chart ─────────────────────────────────────────────────────────── */
  const barLabels = isStudent ? summary.map(s => s.subject) : classSubjectLabels;
  const barValues = isStudent ? summary.map(s => parseFloat(s.percentage || 0)) : classSubjectData.map(Number);

  // Generate per-bar colours based on value
  const barBg = barValues.map(v =>
    v < 50 ? 'rgba(239,68,68,0.75)' : v < 75 ? 'rgba(245,158,11,0.75)' : 'rgba(99,102,241,0.80)'
  );
  const barBorder = barValues.map(v =>
    v < 50 ? 'rgba(239,68,68,1)' : v < 75 ? 'rgba(245,158,11,1)' : 'rgba(99,102,241,1)'
  );

  const attendanceChartData = {
    labels: barLabels,
    datasets: [{
      label: 'Attendance %',
      data: barValues,
      backgroundColor: barBg,
      borderColor: barBorder,
      borderWidth: 1.5,
      borderRadius: 7,
      borderSkipped: false,
    }],
  };

  const chartOptions = {
    responsive: true,
    animation: { duration: 800, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0d0f17',
        borderColor: 'rgba(255,255,255,0.10)',
        borderWidth: 1,
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        padding: 12,
        callbacks: {
          label: function(ctx) { return ' ' + ctx.parsed.y.toFixed(1) + '%'; },
        },
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        grid:  { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#64748b', font: { size: 11 }, callback: function(v) { return v + '%'; } },
        border: { display: false },
      },
      x: {
        grid:  { display: false },
        ticks: {
          color: '#94a3b8',
          font:  { size: 11 },
          maxRotation: 30,
          callback: function(_, idx) {
            const lbl = this.getLabelForValue(idx);
            return lbl && lbl.length > 14 ? lbl.slice(0, 13) + '…' : (lbl || '');
          },
        },
        border: { display: false },
      },
    },
  };

  /* ── CGPA doughnut ─────────────────────────────────────────────────────── */
  const cgpaNum    = cgpa != null ? Math.min(parseFloat(cgpa) || 0, 10) : 0;
  const cgpaRemain = Math.max(0, 10 - cgpaNum);
  const cgpaColor  = getCgpaColor(cgpa);

  // Capture in stable locals so closures inside chartjs options don't reference stale outer vars
  const _cgpaNum    = cgpaNum;
  const _cgpaRemain = cgpaRemain;

  const cgpaGaugeData = {
    labels: ['CGPA', 'Remaining'],
    datasets: [{
      data: [cgpaNum, cgpaRemain],
      backgroundColor: [cgpaColor, 'rgba(255,255,255,0.06)'],
      hoverBackgroundColor: [cgpaColor, 'rgba(255,255,255,0.08)'],
      borderWidth: 0,
    }],
  };

  const doughnutOptions = {
    cutout: '76%',
    animation: { duration: 900, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0d0f17',
        borderColor: 'rgba(255,255,255,0.10)',
        borderWidth: 1,
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        padding: 12,
        callbacks: {
          label: function(ctx) {
            if (ctx.label === 'CGPA') return ' ' + _cgpaNum.toFixed(2) + ' / 10';
            return ' ' + _cgpaRemain.toFixed(2) + ' remaining';
          },
        },
      },
    },
  };

  /* ── loading skeleton ──────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton width="220px" height="26px" />
            <Skeleton width="300px" height="14px" />
          </div>
          <Skeleton width="110px" height="30px" variant="pill" />
        </div>

        {/* Stat cards skeleton — reuses StatsSkeleton with count=4 */}
        <StatsSkeleton count={4} />

        {/* Charts row skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          {/* Bar chart card */}
          <div style={{
            background: 'var(--color-surface-2)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 22px',
            border: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <Skeleton width="55%" height="18px" />
            {/* Legend chips row */}
            <div style={{ display: 'flex', gap: 10 }}>
              <Skeleton variant="pill" width="60px" height="18px" />
              <Skeleton variant="pill" width="60px" height="18px" />
              <Skeleton variant="pill" width="60px" height="18px" />
            </div>
            {/* Fake bar columns */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 160, paddingTop: 12 }}>
              {[72, 45, 90, 60, 80, 55].map((h, i) => (
                <Skeleton key={i} width="100%" height={`${h}%`} style={{ borderRadius: '6px 6px 0 0' }} />
              ))}
            </div>
            {/* X-axis labels */}
            <div style={{ display: 'flex', gap: 10 }}>
              {[60, 80, 50, 70, 65, 55].map((w, i) => (
                <Skeleton key={i} width={`${w}%`} height="11px" />
              ))}
            </div>
          </div>

          {/* CGPA gauge card */}
          <div style={{
            background: 'var(--color-surface-2)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 22px',
            border: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          }}>
            <Skeleton width="120px" height="18px" style={{ alignSelf: 'flex-start' }} />
            {/* Doughnut ring approximation */}
            <Skeleton variant="circle" width="170px" height="170px" style={{ borderRadius: '50%' }} />
            {/* Grade band chips */}
            <div style={{ display: 'flex', gap: 8 }}>
              <Skeleton variant="pill" width="80px"  height="24px" />
              <Skeleton variant="pill" width="64px"  height="24px" />
              <Skeleton variant="pill" width="72px"  height="24px" />
            </div>
          </div>
        </div>

        {/* AI promo banner skeleton */}
        <div style={{
          background: 'var(--color-surface-2)',
          borderRadius: 'var(--radius-lg)',
          padding: '18px 22px',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Skeleton variant="rect" width="46px" height="46px" style={{ borderRadius: 12 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <Skeleton width="170px" height="16px" />
              <Skeleton width="280px" height="13px" />
            </div>
          </div>
          <Skeleton variant="pill" width="150px" height="36px" />
        </div>

        {/* Bottom row skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          {[3, 4].map(rowCount => (
            <div key={rowCount} style={{
              background: 'var(--color-surface-2)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px 22px',
              border: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <Skeleton width="50%" height="18px" />
              {Array.from({ length: rowCount }).map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingBottom: 12,
                  borderBottom: i < rowCount - 1 ? '1px solid var(--border)' : 'none' }}>
                  <Skeleton variant="circle" width="32px" height="32px" />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Skeleton width="65%" height="14px" />
                    <Skeleton width="90%" height="12px" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#f1f5f9', letterSpacing: '-0.3px' }}>
            {getGreeting()}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>{todayScheduleSummary}</p>
        </div>
        <div style={{
          fontSize: 12, color: '#94a3b8',
          background: '#1e2230',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, padding: '6px 14px', fontWeight: 500,
        }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: isMobile ? 12 : 20 }}>
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              style={{
                ...card,
                borderLeft: stat.accent ? `3px solid ${stat.color}` : undefined,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '22px 16px', gap: 8, transition: 'transform 0.18s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'rgba(99,102,241,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={18} color={stat.color} />
              </div>
              <div style={{ fontSize: 30, fontWeight: 700, color: stat.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {stat.value}
              </div>
              {stat.subLabel && (
                <div style={{ fontSize: 11, color: stat.color, fontWeight: 500, marginTop: -4 }}>
                  {stat.subLabel}
                </div>
              )}
              <div style={{ fontSize: 11.5, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>

        {/* Attendance bar chart */}
        <div style={{ ...card }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
              {isStudent ? 'Attendance per Subject' : 'Class Avg Attendance'}
            </span>
          </div>

          {/* Legend chips */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            {[
              { color: 'rgba(99,102,241,0.80)',  label: '≥ 75%' },
              { color: 'rgba(245,158,11,0.75)',  label: '50–74%' },
              { color: 'rgba(239,68,68,0.75)',   label: '< 50%' },
            ].map(leg => (
              <span key={leg.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94a3b8' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: leg.color, display: 'inline-block' }} />
                {leg.label}
              </span>
            ))}
          </div>

          {barLabels.length > 0
            ? <Bar data={attendanceChartData} options={chartOptions} />
            : <EmptyState
                title="No Attendance Data"
                subtitle="Import your attendance report or mark attendance manually."
                actionLabel="Add Attendance"
                onAction={() => window.location.href = '/attendance'}
                illustration="attendance"
              />
          }
        </div>

        {/* CGPA Gauge */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, alignSelf: 'flex-start' }}>
            <GraduationCap size={16} color="#6366f1" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>CGPA Gauge</span>
          </div>

          {cgpa != null && cgpa > 0 ? (
            <div style={{ position: 'relative', width: 180, height: 180 }}>
              <Doughnut data={cgpaGaugeData} options={doughnutOptions} />
              {/* centre label */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <span style={{ fontSize: 30, fontWeight: 700, color: cgpaColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {parseFloat(cgpa).toFixed(2)}
                </span>
                <span style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>out of 10.0</span>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No CGPA Data"
              subtitle="Add your semesters or exam marks to compute your gauge score."
              actionLabel="Add Marks"
              onAction={() => window.location.href = '/marks'}
              illustration="marks"
            />
          )}

          {/* grade band indicator */}
          {cgpa != null && cgpa > 0 && (
            <div style={{
              marginTop: 16, display: 'flex', gap: 8, fontSize: 12,
            }}>
              {[
                { label: 'Excellent', range: '> 8', active: cgpa > 8,    color: '#22c55e' },
                { label: 'Good',      range: '6–8', active: cgpa >= 6 && cgpa <= 8, color: '#f59e0b' },
                { label: 'At Risk',   range: '< 6', active: cgpa < 6,    color: '#ef4444' },
              ].map(band => (
                <span key={band.label} style={{
                  padding: '3px 10px', borderRadius: 20,
                  background: band.active ? `${band.color}22` : 'rgba(255,255,255,0.04)',
                  color: band.active ? band.color : '#475569',
                  border: `1px solid ${band.active ? band.color + '55' : 'transparent'}`,
                  fontWeight: band.active ? 600 : 400,
                  transition: 'all 0.2s',
                }}>
                  {band.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── AI Promo Banner ── */}
      <div style={{
        ...card,
        background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(129,140,248,0.04) 100%)',
        border: '1px solid rgba(129,140,248,0.22)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 16, padding: '18px 22px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            background: 'rgba(99,102,241,0.15)', color: '#818cf8',
            borderRadius: 12, width: 46, height: 46,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bot size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>Talk to Dashboard AI</h3>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#64748b', lineHeight: 1.45 }}>
              Ask questions, predict CGPA, add subjects or marks with natural language.
            </p>
          </div>
        </div>
        <Link
          to="/ai-assistant?mode=assistant"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', borderRadius: 10,
            background: '#6366f1', color: '#fff',
            fontWeight: 600, fontSize: 13.5, textDecoration: 'none',
            transition: 'background 0.18s, transform 0.15s',
            boxShadow: '0 0 0 0 rgba(99,102,241,0.4)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#4f46e5'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#6366f1'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          Open Dashboard AI ➔
        </Link>
      </div>

      {/* ── Bottom row: AI recs + Notifications ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>

        {/* AI Recommendations */}
        <div style={{ ...card }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
              <Bot size={16} color="#6366f1" /> AI Recommendations
            </div>
            <Link
              to="/ai-assistant?mode=assistant"
              style={{ fontSize: 12, color: '#6366f1', textDecoration: 'none', fontWeight: 500 }}
            >
              Ask AI ➔
            </Link>
          </div>

          {recs.length > 0
            ? recs.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  padding: '10px 12px', borderRadius: 10, marginBottom: 8,
                  background: r.priority === 'high'
                    ? 'rgba(239,68,68,0.07)'
                    : r.priority === 'medium'
                      ? 'rgba(245,158,11,0.07)'
                      : 'rgba(99,102,241,0.07)',
                  border: `1px solid ${
                    r.priority === 'high'   ? 'rgba(239,68,68,0.18)' :
                    r.priority === 'medium' ? 'rgba(245,158,11,0.18)' :
                                              'rgba(99,102,241,0.15)'}`,
                }}>
                  <span style={{ fontSize: 18 }}>{r.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{r.message}</div>
                  </div>
                </div>
              ))
            : <EmptyState
                title="No Recommendations"
                subtitle="Chat with the AI assistant to get personalised advice."
                actionLabel="Go to Assistant"
                onAction={() => window.location.href = '/ai-assistant'}
              />
          }
        </div>

        {/* Notifications */}
        <div style={{ ...card }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Bell size={16} color="#6366f1" />
                {notifs.filter(n => !n.read).length > 0 && (
                  <span style={{
                    position: 'absolute', top: -5, right: -6,
                    background: '#ef4444', color: '#fff',
                    fontSize: 9, fontWeight: 700,
                    width: 14, height: 14, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1
                  }}>
                    {notifs.filter(n => !n.read).length > 9 ? '9+' : notifs.filter(n => !n.read).length}
                  </span>
                )}
              </div>
              Notifications
            </div>
            {notifs.filter(n => !n.read).length > 0 && (
              <button
                onClick={async () => {
                  try {
                    await notificationService.markAllRead?.();
                    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
                  } catch (_) {}
                }}
                style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
              >
                Mark all read
              </button>
            )}
          </div>

          {notifs.length === 0 && (
            <button
              onClick={async () => {
                try {
                  await notificationService.sendTest();
                  const { data } = await notificationService.getAll();
                  setNotifs(data.notifications || []);
                } catch (_) {}
              }}
              style={{
                width: '100%', padding: '9px 0', borderRadius: 8,
                background: 'rgba(99,102,241,0.10)', border: '1px dashed rgba(99,102,241,0.35)',
                color: '#818cf8', fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                marginBottom: 12,
              }}
            >
              🔔 Send test notification
            </button>
          )}

          {notifs.length > 0
            ? notifs.map((n, i) => {
                const isClassroom = ['NEW_ASSIGNMENT', 'OVERDUE', 'URGENT', 'DUE_SOON'].includes(n.type);
                const dotColor = n.type === 'OVERDUE' ? '#ef4444' : n.type === 'URGENT' ? '#f59e0b' : n.type === 'DUE_SOON' ? '#818cf8' : n.type === 'NEW_ASSIGNMENT' ? '#22c55e' : n.type === 'warning' ? '#f59e0b' : n.type === 'danger' ? '#ef4444' : '#6366f1';
                return (
                  <div key={i} style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    padding: '10px 0',
                    borderBottom: i < notifs.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}>
                    <span style={{
                      width: 9, height: 9, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                      background: dotColor,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>{n.title}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>
                      {n.courseName && (
                        <span style={{ fontSize: 10.5, color: '#818cf8', marginTop: 3, display: 'inline-block', fontWeight: 500 }}>{n.courseName}</span>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: '#475569', whiteSpace: 'nowrap' }}>
                      {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                );
              })
            : <EmptyState title="All Caught Up" subtitle="No new notifications at this time." />
          }
        </div>
      </div>

      {/* ── Classroom + Deadlines + Risks ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
        <UpcomingDeadlines />
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 24, padding: isMobile ? '0 4px' : 0 }}>
          <RiskAlertsCard />
          <ClassroomConnect />
        </div>
      </div>

      {/* ── Smart Study Plan ── */}
      <SmartPlanCard />
    </div>
  );
}