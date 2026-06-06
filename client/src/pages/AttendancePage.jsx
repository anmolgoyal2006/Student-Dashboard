// components/StudentAttendanceView.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart3, Clipboard, Loader2, X } from 'lucide-react';
import EmptyState from '../components/EmptyState';

const styles = {
  container:  { maxWidth: 800, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' },
  card:       { background: 'var(--color-surface-1)', borderRadius: 12, padding: 24, color: 'var(--color-text-primary)', marginBottom: 16 },
  title:      { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  subtitle:   { fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20 },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 },
  statCard:   { background: 'var(--color-surface-3)', borderRadius: 10, padding: 16, textAlign: 'center' },
  statVal:    { fontSize: 28, fontWeight: 700, marginBottom: 4 },
  statLabel:  { fontSize: 12, color: 'var(--color-text-secondary)' },
  table:      { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th:         { background: 'var(--color-surface-3)', padding: '10px 14px', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 600 },
  td:         { padding: '10px 14px', borderBottom: '1px solid var(--color-surface-3)' },
  badge:      { display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  present:    { background: 'var(--color-success-muted)', color: 'var(--color-success)' },
  absent:     { background: 'var(--color-danger-muted)', color: 'var(--color-danger)' },
  cancelled:  { background: 'var(--color-warning-muted)', color: 'var(--color-warning)' },
  bar:        { height: 8, borderRadius: 4, background: 'var(--color-surface-3)', overflow: 'hidden', marginTop: 6 },
  barFill:    (pct) => ({
    height: '100%',
    width:  `${pct}%`,
    borderRadius: 4,
    background: pct >= 75 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-warning)' : 'var(--color-danger)',
    transition: 'width 0.4s ease',
  }),
  loading:    { color: 'var(--color-text-secondary)', textAlign: 'center', padding: 40 },
  error:      { color: 'var(--color-danger)', textAlign: 'center', padding: 40 },
};

export default function StudentAttendanceView({ sid }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [filter,  setFilter]  = useState('all'); // all | present | absent

  useEffect(() => {
    if (!sid) return;
    const fetch = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const res   = await axios.get(`${process.env.REACT_APP_API_URL}/attendance/student/${sid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load attendance.');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [sid]);

  if (loading) return <div style={{...styles.loading, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'}}><Loader2 size={16} className="spinner" /> Loading attendance...</div>;
  if (error)   return <div style={{...styles.error, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'}}><X size={16} /> {error}</div>;
  if (!data)   return null;

  const filteredRecords = data.records.filter(r =>
    filter === 'all' ? true : r.status === filter
  );

  const overallPresent = data.records.filter(r => r.status === 'present').length;
  const overallPct     = data.total ? Math.round((overallPresent / data.total) * 100) : 0;

  return (
    <div style={styles.container}>

      {/* ── Student Info ── */}
      <div style={styles.card}>
        <div style={{...styles.title, display: 'flex', alignItems: 'center', gap: '6px'}}><BarChart3 size={16} /> Attendance — {data.student.name}</div>
        <div style={styles.subtitle}>{data.student.email} · SID: {data.student.sid || sid}</div>

        {/* ── Overall Stats ── */}
        <div style={styles.grid}>
          <div style={styles.statCard}>
            <div style={{ ...styles.statVal, color: 'var(--color-accent)' }}>{data.total}</div>
            <div style={styles.statLabel}>Total Classes</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statVal, color: 'var(--color-success)' }}>{overallPresent}</div>
            <div style={styles.statLabel}>Present</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statVal, color: 'var(--color-danger)' }}>{data.total - overallPresent}</div>
            <div style={styles.statLabel}>Absent</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statVal, color: overallPct >= 75 ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {overallPct}%
            </div>
            <div style={styles.statLabel}>Overall</div>
          </div>
        </div>

        {/* ── Per Subject Summary ── */}
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 10 }}>Subject-wise Breakdown:</div>
          {data.summary.map((s, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{s.subject} {s.code ? `(${s.code})` : ''}</span>
                <span style={{ color: s.percentage >= 75 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>
                  {s.present}/{s.total} — {s.percentage}%
                </span>
              </div>
              <div style={styles.bar}>
                <div style={styles.barFill(s.percentage)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Records Table ── */}
      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><Clipboard size={16} /> Attendance Records</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['all', 'present', 'absent'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  background: filter === f ? 'var(--color-accent)' : 'var(--color-surface-3)',
                  color: 'var(--color-text-primary)', border: 'none', borderRadius: 6,
                  padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  textTransform: 'capitalize',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Subject</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ ...styles.td, padding: 0 }}>
                    <EmptyState
                      title="No attendance records"
                      subtitle={`No records found for the selected filter (${filter}).`}
                      illustration="attendance"
                    />
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, i) => (
                  <tr key={i}>
                    <td style={styles.td}>
                      {new Date(r.date).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                    </td>
                    <td style={styles.td}>{r.subject} {r.code ? `(${r.code})` : ''}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, ...(styles[r.status] || {}) }}>
                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}