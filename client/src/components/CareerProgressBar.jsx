export default function CareerProgressBar({ label, done, target, showCount = true }) {
  const pct       = target > 0 ? Math.round((done / target) * 100) : 0;
  const cappedPct = Math.min(100, pct);                          // Fix overflow bug
  const mastered  = done >= target;

  const color = mastered         ? '#34d399'
              : cappedPct >= 50  ? '#34d399'
              : cappedPct >= 20  ? '#fbbf24'
              : '#f87171';

  const glowStyle = mastered
    ? { boxShadow: '0 0 8px rgba(52,211,153,0.6)' }
    : {};

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {mastered ? (
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: '#34d399',
              background: 'rgba(52,211,153,0.12)',
              border: '1px solid rgba(52,211,153,0.3)',
              borderRadius: 99, padding: '1px 8px',
            }}>
              {done > target ? '🎉 Mastered' : '✔ Completed'}
            </span>
          ) : showCount && (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {done}/{target}
              <span style={{ marginLeft: 5, color }}> ({cappedPct}%)</span>
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        background: 'rgba(255,255,255,0.07)',
        borderRadius: 99, height: 7, overflow: 'hidden',
      }}>
        <div style={{
          width:        `${cappedPct}%`,
          height:       '100%',
          borderRadius: 99,
          background:   mastered
            ? 'linear-gradient(90deg, #34d399, #10b981)'
            : cappedPct >= 50
              ? 'linear-gradient(90deg, #34d399, #10b981)'
              : cappedPct >= 20
                ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
                : 'linear-gradient(90deg, #f87171, #ef4444)',
          transition:   'width 0.6s cubic-bezier(.4,0,.2,1)',
          minWidth:     cappedPct > 0 ? 4 : 0,
          ...glowStyle,
        }} />
      </div>
    </div>
  );
}