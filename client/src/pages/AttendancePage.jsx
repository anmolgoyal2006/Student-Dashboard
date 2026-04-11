// components/StudentAttendanceView.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';

const styles = {
  container:  { maxWidth: 800, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' },
  card:       { background: '#1e1e2e', borderRadius: 12, padding: 24, color: '#fff', marginBottom: 16 },
  title:      { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  subtitle:   { fontSize: 13, color: '#aaa', marginBottom: 20 },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 },
  statCard:   { background: '#2a2a3e', borderRadius: 10, padding: 16, textAlign: 'center' },
  statVal:    { fontSize: 28, fontWeight: 700, marginBottom: 4 },
  statLabel:  { fontSize: 12, color: '#aaa' },
  table:      { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th:         { background: '#2a2a3e', padding: '10px 14px', textAlign: 'left', color: '#aaa', fontWeight: 600 },
  td:         { padding: '10px 14px', borderBottom: '1px solid #2a2a3e' },
  badge:      { display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  present:    { background: '#1a3a2a', color: '#4caf7d' },
  absent:     { background: '#3a1a1a', color: '#f44336' },
  cancelled:  { background: '#2a2a1a', color: '#ff9800' },
  bar:        { height: 8, borderRadius: 4, background: '#2a2a3e', overflow: 'hidden', marginTop: 6 },
  barFill:    (pct) => ({
    height: '100%',
    width:  `${pct}%`,
    borderRadius: 4,
    background: pct >= 75 ? '#4caf7d' : pct >= 50 ? '#ff9800' : '#f44336',
    transition: 'width 0.4s ease',
  }),
  loading:    { color: '#aaa', textAlign: 'center', padding: 40 },
  error:      { color: '#f44336', textAlign: 'center', padding: 40 },
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
        const res   = await axios.get(`/api/attendance/student/${sid}`, {
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

  if (loading) return <div style={styles.loading}>⏳ Loading attendance...</div>;
  if (error)   return <div style={styles.error}>❌ {error}</div>;
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
        <div style={styles.title}>📊 Attendance — {data.student.name}</div>
        <div style={styles.subtitle}>{data.student.email} · SID: {data.student.sid || sid}</div>

        {/* ── Overall Stats ── */}
        <div style={styles.grid}>
          <div style={styles.statCard}>
            <div style={{ ...styles.statVal, color: '#6c63ff' }}>{data.total}</div>
            <div style={styles.statLabel}>Total Classes</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statVal, color: '#4caf7d' }}>{overallPresent}</div>
            <div style={styles.statLabel}>Present</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statVal, color: '#f44336' }}>{data.total - overallPresent}</div>
            <div style={styles.statLabel}>Absent</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statVal, color: overallPct >= 75 ? '#4caf7d' : '#f44336' }}>
              {overallPct}%
            </div>
            <div style={styles.statLabel}>Overall</div>
          </div>
        </div>

        {/* ── Per Subject Summary ── */}
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, color: '#aaa', marginBottom: 10 }}>Subject-wise Breakdown:</div>
          {data.summary.map((s, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{s.subject} {s.code ? `(${s.code})` : ''}</span>
                <span style={{ color: s.percentage >= 75 ? '#4caf7d' : '#f44336', fontWeight: 600 }}>
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
          <div style={{ fontWeight: 600 }}>📋 Attendance Records</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['all', 'present', 'absent'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  background: filter === f ? '#6c63ff' : '#2a2a3e',
                  color: '#fff', border: 'none', borderRadius: 6,
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
                  <td colSpan={3} style={{ ...styles.td, textAlign: 'center', color: '#aaa' }}>
                    No records found.
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