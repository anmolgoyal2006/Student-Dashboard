import { useState, useEffect } from 'react';
import API from '../api/axios';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BarChart3, Clock, CheckCircle, AlertTriangle, BookOpen, TrendingUp, Target } from 'lucide-react';

const card = {
  background: '#13161f',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 14,
  padding: '20px 22px',
};

const tooltipStyle = {
  background: '#0d0f17',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 8,
  fontSize: 12,
  color: '#e2e8f0',
};

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/analytics')
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ height: 28, width: 200, background: 'rgba(255,255,255,0.05)', borderRadius: 6 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {[1,2,3,4].map(i => <div key={i} style={{ height: 100, background: 'rgba(255,255,255,0.03)', borderRadius: 14 }} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ height: 300, background: 'rgba(255,255,255,0.03)', borderRadius: 14 }} />
          <div style={{ height: 300, background: 'rgba(255,255,255,0.03)', borderRadius: 14 }} />
        </div>
      </div>
    );
  }

  if (!data) return <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>No analytics data available.</div>;

  const { overview, charts, atRiskSubjects } = data;
  const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#818cf8', '#34d399', '#fbbf24', '#f87171'];

  const statCards = [
    { label: 'Total Assignments', value: overview.totalAssignments, icon: BookOpen, color: '#6366f1' },
    { label: 'Completed', value: overview.completed, icon: CheckCircle, color: '#22c55e' },
    { label: 'Completion Rate', value: `${overview.completionRate}%`, icon: TrendingUp, color: overview.completionRate >= 75 ? '#22c55e' : '#f59e0b' },
    { label: 'Overdue', value: overview.overdue, icon: AlertTriangle, color: overview.overdue > 0 ? '#ef4444' : '#64748b' },
    { label: 'Most Demanding', value: overview.mostDemanding.name, icon: Target, color: '#f59e0b', sub: `${overview.mostDemanding.count} assignments` },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#f1f5f9', letterSpacing: '-0.3px' }}>
          <BarChart3 size={20} style={{ display: 'inline', marginRight: 8, color: '#6366f1', verticalAlign: -2 }} />
          Analytics
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Assignment trends, workload distribution, and productivity insights</p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
        {statCards.map(s => (
          <div key={s.label} style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px 12px', gap: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <s.icon size={16} color={s.color} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums', textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.value}>{s.value}</div>
            <div style={{ fontSize: 10.5, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500, textAlign: 'center' }}>{s.label}</div>
            {s.sub && <div style={{ fontSize: 10, color: '#64748b', marginTop: -2 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Weekly completion trend */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <TrendingUp size={16} color="#6366f1" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Weekly Completion Trend</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={charts.weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Line type="monotone" dataKey="assigned" stroke="#64748b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="completed" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4, fill: '#22c55e' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Subject workload distribution */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <BookOpen size={16} color="#818cf8" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Subject Workload</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={charts.subjectWorkload}
                cx="50%" cy="45%"
                outerRadius={80}
                innerRadius={45}
                dataKey="assignments"
                nameKey="subject"
                label={false}
              >
                {charts.subjectWorkload.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, name, props) => [value, props.payload.subject]}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
                formatter={(value, entry) => {
                  const item = charts.subjectWorkload.find(s => s.subject === value);
                  return `${value} (${item ? item.assignments : 0})`;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Second row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Deadline timeline */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Clock size={16} color="#f59e0b" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Deadline Timeline</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={charts.deadlineTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Assignments Due" radius={[6,6,0,0]}>
                {charts.deadlineTimeline.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly productivity */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <TrendingUp size={16} color="#22c55e" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Weekly Productivity</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={charts.productivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="tasks" name="Tasks Completed" stroke="#22c55e" fill="rgba(34,197,94,0.15)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* At-risk subjects */}
      {atRiskSubjects.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <AlertTriangle size={16} color="#ef4444" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Attendance Risk Subjects</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {atRiskSubjects.map(s => (
              <div key={s.subject} style={{
                padding: '10px 14px', borderRadius: 10,
                background: 'rgba(239,68,68,0.07)',
                border: '1px solid rgba(239,68,68,0.18)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{s.subject}</div>
                <div style={{ fontSize: 12, color: '#ef4444', marginTop: 2 }}>{s.percentage}% attendance</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
