/**
 * Leaderboard.jsx  (FIXED)
 *
 * Backend /marks/rank returns:
 *   { leaderboard: [{ rank, name, roll, total, breakdown }] }
 *
 * Excel comes via a separate "Download Excel" button that calls
 * /marks/rank again with exportExcel:true — handled by onDownloadExcel prop.
 */
export default function Leaderboard({ data, onDownloadExcel, loading = false, scoreLabel = 'Total' }) {

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div className="spinner" />
        <p className="text-muted" style={{ marginTop: 12 }}>Processing PDF…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="empty-state">
        <div className="icon">📭</div>
        <p style={{ fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>No data uploaded yet</p>
        <p className="text-muted">Upload a PDF to generate the leaderboard.</p>
      </div>
    );
  }

  // ── data shape from backend ──────────────────────────────────────────────
  // { leaderboard: [{ rank, name, roll, total, breakdown }] }
  const leaderboard = data?.leaderboard?.[0]?.students || [];

  if (!leaderboard?.length) {
    return (
      <div className="empty-state">
        <div className="icon">🏁</div>
        <p style={{ fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>No results found</p>
        <p className="text-muted">The uploaded file had no rankable student data.</p>
      </div>
    );
  }

  const medalFor = rank =>
    rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

  const fmt = val => {
    const n = parseFloat(val);
    return isNaN(n) ? '—' : Number.isInteger(n) ? n : n.toFixed(2);
  };

  // Derive column names from first student's breakdown keys
  const breakdownCols = leaderboard[0]?.breakdown
    ? Object.keys(leaderboard[0].breakdown)
    : [];

  const topper = leaderboard[0];

  return (
    <div>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <div className="card-title" style={{ margin: 0 }}>🏆 Leaderboard</div>
          <div className="text-muted" style={{ fontSize: 13 }}>
            {leaderboard.length} students ranked
          </div>
        </div>
        <button className="btn btn-primary" onClick={onDownloadExcel}>
          ⬇ Download Excel
        </button>
      </div>

      {/* ── Topper highlight ── */}
      {topper && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', borderRadius: 10, marginBottom: 12,
          background: 'rgba(250,204,21,0.08)',
          border: '1px solid rgba(250,204,21,0.25)',
        }}>
          <span style={{ fontSize: 28 }}>🏆</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
              {topper.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Topper · {fmt(topper.totalScore)} {scoreLabel === 'Final Score' ? 'final score' : 'pts'}
              {topper.roll ? ` · Roll: ${topper.roll}` : ''}
            </div>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>SID / Roll</th>
              {breakdownCols.map(col => (
                <th key={col} style={{ fontSize: 12 }}>{col}</th>
              ))}
              <th>{scoreLabel}</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((s, i) => (
              <tr
                key={s.roll || s.name || i}
                style={{ background: s.rank <= 3 ? 'rgba(250,204,21,0.04)' : 'transparent' }}
              >
                <td>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{medalFor(s.rank)}</span>
                </td>
                <td style={{ fontWeight: s.rank <= 3 ? 600 : 400 }}>{s.name}</td>
                <td style={{ color: 'var(--muted)', fontSize: 13 }}>{s.roll || '—'}</td>
                {breakdownCols.map(col => (
                  <td key={col} style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {fmt(s.breakdown?.[col]?.score?? '')}
                    <span style={{ fontSize: 10, opacity: 0.6 }}>
                      {s.breakdown?.[col]?.raw ? ` (${s.breakdown[col].raw})` : ''}
                    </span>
                  </td>
                ))}
                <td>
                  <span style={{
                    fontWeight: 700,
                    color: s.rank === 1 ? '#facc15'
                         : s.rank === 2 ? '#94a3b8'
                         : s.rank === 3 ? '#cd7c2f'
                         : 'var(--text)',
                  }}>
                    {fmt(s.totalScore)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}