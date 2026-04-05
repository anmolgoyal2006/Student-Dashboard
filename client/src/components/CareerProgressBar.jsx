export default function CareerProgressBar({ label, done, target, showCount = true }) {
  const pct   = Math.min(100, target > 0 ? Math.round((done / target) * 100) : 0);
  const color = pct >= 80 ? 'success' : pct >= 40 ? 'warning' : 'danger';

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
        {showCount && (
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {done}/{target}
            <span style={{ marginLeft: 6, color: pct >= 80 ? '#34d399' : 'var(--muted)' }}>
              ({pct}%)
            </span>
          </span>
        )}
      </div>
      <div className="progress">
        <div
          className={`progress-bar ${color}`}
          style={{ width: `${pct}%`, minWidth: pct > 0 ? 4 : 0 }}
        />
      </div>
    </div>
  );
}