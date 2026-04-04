import { useEffect, useState, useCallback } from 'react';
import API from '../api/axios';

/* ─── Risk config ──────────────────────────────────────────────────── */
const RISK_CONFIG = {
  High:   { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.28)',   dot: '#ef4444', label: 'High Risk'   },
  Medium: { color: '#d97706', bg: 'rgba(217,119,6,0.12)',   border: 'rgba(217,119,6,0.28)',   dot: '#f59e0b', label: 'Medium Risk' },
  Low:    { color: '#16a34a', bg: 'rgba(22,163,74,0.12)',   border: 'rgba(22,163,74,0.28)',   dot: '#22c55e', label: 'Low Risk'    },
};

/* ─── Priority → accent colour ─────────────────────────────────────── */
const PRIORITY_COLOR = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#6366f1',
};

const getPriorityColor = (priority) =>
  PRIORITY_COLOR[priority?.toLowerCase()] ?? '#6366f1';

/* ─── Skeleton loader ───────────────────────────────────────────────── */
function Skeleton({ width = '100%', height = 14, radius = 6, style = {} }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'var(--surface-3, rgba(255,255,255,0.06))',
        animation: 'ssp-pulse 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

/* ─── Checkmark icon ────────────────────────────────────────────────── */
function CheckIcon() {
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
      <path
        d="M1 4L3.5 6.5L9 1"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Single plan item ──────────────────────────────────────────────── */
function PlanItem({ item, index, checked, onToggle }) {
  const accentColor = getPriorityColor(item.priority);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '13px 16px',
        borderRadius: 12,
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`,
        borderLeft: `2.5px solid ${accentColor}`,
        background: hovered
          ? 'rgba(255,255,255,0.04)'
          : checked
          ? 'rgba(255,255,255,0.02)'
          : 'rgba(255,255,255,0.03)',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'all 0.18s ease',
        cursor: 'pointer',
        opacity: checked ? 0.5 : 1,
      }}
    >
      {/* Step number bubble */}
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          flexShrink: 0,
          background: accentColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: '#fff',
          marginTop: 1,
        }}
      >
        {index + 1}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 5,
          }}
        >
          {item.icon && (
            <span style={{ fontSize: 14, lineHeight: 1 }}>{item.icon}</span>
          )}
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary, #f1f5f9)',
              flex: 1,
              minWidth: 0,
              textDecoration: checked ? 'line-through' : 'none',
              transition: 'text-decoration 0.15s',
            }}
          >
            {item.action}
          </span>
          {item.tag && (
            <span
              style={{
                flexShrink: 0,
                fontSize: 10,
                fontWeight: 600,
                padding: '3px 9px',
                borderRadius: 99,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-secondary, #94a3b8)',
                letterSpacing: '0.02em',
              }}
            >
              {item.tag}
            </span>
          )}
        </div>

        {item.reason && (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: 'var(--text-secondary, #64748b)',
              lineHeight: 1.55,
            }}
          >
            {item.reason}
          </p>
        )}
      </div>

      {/* Checkbox */}
      <div
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          flexShrink: 0,
          border: checked
            ? '1.5px solid #22c55e'
            : '1.5px solid rgba(255,255,255,0.2)',
          background: checked ? '#22c55e' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 3,
          transition: 'all 0.18s ease',
          cursor: 'pointer',
        }}
      >
        {checked && <CheckIcon />}
      </div>
    </div>
  );
}

/* ─── Progress bar ──────────────────────────────────────────────────── */
function ProgressBar({ total, done }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div
      style={{
        height: 3,
        background: 'rgba(255,255,255,0.07)',
        borderRadius: 99,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #7c3aed, #818cf8)',
          borderRadius: 99,
          transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
        }}
      />
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────────── */
export default function SmartPlanCard() {
  const [plan, setPlan]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [checked, setChecked] = useState(new Set());

  useEffect(() => {
    API.get('/decision/today-plan')
      .then((r) => setPlan(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const toggleItem = useCallback((index) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }, []);

  const rc = RISK_CONFIG[plan?.riskLevel] ?? RISK_CONFIG.Low;
  const totalItems  = plan?.todayPlan?.length ?? 0;
  const doneCount   = checked.size;

  /* ── keyframes injected once ── */
  useEffect(() => {
    const id = 'ssp-styles';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes ssp-pulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.4; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  /* ── wrapper styles ── */
  const cardStyle = {
    marginTop: 28,
    maxWidth: 800,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'var(--surface-1, #1e1e2e)',
    overflow: 'hidden',
  };

  /* ── Loading state ── */
  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Skeleton width={34} height={34} radius={10} />
            <div>
              <Skeleton width={140} height={14} style={{ marginBottom: 6 }} />
              <Skeleton width={100} height={11} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Skeleton width={90} height={24} radius={99} />
            <Skeleton width={110} height={24} radius={99} />
          </div>
        </div>
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <Skeleton width={26} height={26} radius={99} />
              <div style={{ flex: 1 }}>
                <Skeleton width="60%" height={13} style={{ marginBottom: 8 }} />
                <Skeleton width="85%" height={11} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Error / empty state ── */
  if (error || !plan) return null;

  return (
    <div style={cardStyle}>

      {/* ── Header ── */}
      <div
        style={{
          padding: '16px 20px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        {/* Title + icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'rgba(124,58,237,0.15)',
              border: '1px solid rgba(124,58,237,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            🧠
          </div>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--text-primary, #f1f5f9)',
                lineHeight: 1.3,
              }}
            >
              Smart Study Plan
            </p>
            <p
              style={{
                margin: '2px 0 0',
                fontSize: 11,
                color: 'var(--text-secondary, #64748b)',
              }}
            >
              Today's recommended actions
            </p>
          </div>
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {plan.focusArea && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 12px',
                borderRadius: 99,
                background: 'rgba(124,58,237,0.15)',
                border: '1px solid rgba(124,58,237,0.3)',
                color: '#a78bfa',
              }}
            >
              🎯 {plan.focusArea}
            </span>
          )}
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 12px',
              borderRadius: 99,
              background: rc.bg,
              border: `1px solid ${rc.border}`,
              color: rc.color,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: rc.dot,
                display: 'inline-block',
              }}
            />
            {rc.label}
          </span>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div style={{ padding: '0 20px' }}>
        <ProgressBar total={totalItems} done={doneCount} />
      </div>

      {/* ── Plan items ── */}
      <div
        style={{
          padding: '12px 16px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {plan.todayPlan.map((item, i) => (
          <PlanItem
            key={i}
            item={item}
            index={i}
            checked={checked.has(i)}
            onToggle={() => toggleItem(i)}
          />
        ))}
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          padding: '10px 20px 14px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)' }}>
          Progress today
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary, #94a3b8)' }}>
          {doneCount} of {totalItems} completed
          {doneCount === totalItems && totalItems > 0 && ' 🎉'}
        </span>
      </div>

    </div>
  );
}