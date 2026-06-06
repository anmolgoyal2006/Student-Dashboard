import { Sparkles, Check } from 'lucide-react';
export default function CareerProgressBar({ label, done, target, showCount = true }) {
  const safeDone  = Math.max(0, Number(done) || 0);
  const safeTarget = Math.max(0, Number(target) || 0);
  const pct       = safeTarget > 0 ? Math.round((safeDone / safeTarget) * 100) : 0;
  const cappedPct = Math.min(100, pct);                          // Fix overflow bug
  const completed = safeTarget > 0 && safeDone >= safeTarget;
  const mastered  = safeTarget > 0 && safeDone > safeTarget;

  const color = completed        ? 'var(--color-success)'
              : cappedPct >= 50  ? 'var(--color-success)'
              : cappedPct >= 20  ? 'var(--color-warning)'
              : 'var(--color-danger)';

  const glowStyle = completed
    ? { boxShadow: '0 0 8px rgba(52,211,153,0.6)' }
    : {};

  const StatusIcon = mastered ? Sparkles : Check;
  const statusLabel = mastered ? 'Mastered' : 'Completed';

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        {label && (
          <span style={{
            flex: '1 1 auto',
            minWidth: 0,
            fontSize: 13,
            lineHeight: 1.35,
            fontWeight: 500,
            color: 'var(--color-text-primary)',
          }}>
            {label}
          </span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {completed ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
              fontSize: 11,
              lineHeight: 1,
              fontWeight: 500,
              color: 'var(--color-success)',
              background: 'rgba(52,211,153,0.12)',
              border: '1px solid rgba(52,211,153,0.3)',
              borderRadius: 99,
              padding: '5px 8px',
            }}>
              <StatusIcon size={11} />
              {statusLabel}
            </span>
          ) : showCount && (
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
              {safeDone}/{safeTarget}
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
          background:   completed
            ? 'linear-gradient(90deg, var(--color-success), var(--color-success))'
            : cappedPct >= 50
              ? 'linear-gradient(90deg, var(--color-success), var(--color-success))'
              : cappedPct >= 20
                ? 'linear-gradient(90deg, var(--color-warning), var(--color-warning))'
                : 'linear-gradient(90deg, var(--color-danger), var(--color-danger))',
          transition:   'width 0.6s cubic-bezier(.4,0,.2,1)',
          minWidth:     cappedPct > 0 ? 4 : 0,
          ...glowStyle,
        }} />
      </div>
    </div>
  );
}
