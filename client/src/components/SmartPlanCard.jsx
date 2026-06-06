import { useEffect, useState, useCallback } from 'react';
import API from '../api/axios';
import toast from '../context/ToastContext';
import { taskService } from '../services/apiServices';
import { Brain, Target, Calendar, Sparkles } from 'lucide-react';


/* ─── Risk config ──────────────────────────────────────────────────── */
const RISK_CONFIG = {
  High:   { color: 'var(--color-danger)', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.28)',   dot: 'var(--color-danger)', label: 'High Risk'   },
  Medium: { color: 'var(--color-warning)', bg: 'rgba(217,119,6,0.12)',   border: 'rgba(217,119,6,0.28)',   dot: 'var(--color-warning)', label: 'Medium Risk' },
  Low:    { color: 'var(--color-success)', bg: 'rgba(22,163,74,0.12)',   border: 'rgba(22,163,74,0.28)',   dot: 'var(--color-success)', label: 'Low Risk'    },
};

/* ─── Priority → accent colour ─────────────────────────────────────── */
const PRIORITY_COLOR = {
  high:   'var(--color-danger)',
  medium: 'var(--color-warning)',
  low:    'var(--color-accent)',
};

const getPriorityColor = (priority) =>
  PRIORITY_COLOR[priority?.toLowerCase()] ?? 'var(--color-accent)';

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
        stroke="var(--color-text-primary)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Single plan item ──────────────────────────────────────────────── */
function PlanItem({ item, index, checked, onToggle, scheduled, onSchedule }) {
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
        borderTop: `1px solid ${hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`,
        borderRight: `1px solid ${hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`,
        borderBottom: `1px solid ${hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`,
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
          color: 'var(--color-text-primary)',
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
              color: 'var(--text-primary, var(--color-text-primary))',
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
                color: 'var(--text-secondary, var(--color-text-secondary))',
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
              color: 'var(--text-secondary, var(--color-text-secondary))',
              lineHeight: 1.55,
            }}
          >
            {item.reason}
          </p>
        )}

        {/* Schedule Action Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!scheduled && onSchedule) onSchedule();
          }}
          disabled={scheduled}
          style={{
            marginTop: '8px',
            background: scheduled ? 'rgba(255,255,255,0.02)' : 'rgba(99,102,241,0.1)',
            border: `1px solid ${scheduled ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.25)'}`,
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: '600',
            color: scheduled ? 'var(--color-success)' : 'var(--color-accent)',
            cursor: scheduled ? 'default' : 'pointer',
            transition: 'all 0.15s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}
          onMouseEnter={(e) => {
            if (!scheduled) {
              e.currentTarget.style.background = 'rgba(99,102,241,0.2)';
              e.currentTarget.style.transform = 'translateY(-0.5px)';
            }
          }}
          onMouseLeave={(e) => {
            if (!scheduled) {
              e.currentTarget.style.background = 'rgba(99,102,241,0.1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }
          }}
        >
          {scheduled ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              ✓ Scheduled
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={12} />
              Schedule
            </span>
          )}
        </button>
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
            ? '1.5px solid var(--color-success)'
            : '1.5px solid rgba(255,255,255,0.2)',
          background: checked ? 'var(--color-success)' : 'transparent',
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
          background: 'linear-gradient(90deg, var(--color-accent), var(--color-accent))',
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
  // Load checked items from localStorage on mount, keyed by today's date
  const [checked, setChecked] = useState(() => {
    try {
      const d = new Date();
      const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      const saved = localStorage.getItem(`ssp_checked_${dateKey}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Sync checked items to localStorage when it changes
  useEffect(() => {
    try {
      const d = new Date();
      const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      localStorage.setItem(`ssp_checked_${dateKey}`, JSON.stringify(Array.from(checked)));
    } catch (err) {
      console.error(err);
    }
  }, [checked]);

  // Load scheduled items from localStorage on mount, keyed by today's date
  const [scheduled, setScheduled] = useState(() => {
    try {
      const d = new Date();
      const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      const saved = localStorage.getItem(`ssp_scheduled_${dateKey}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Sync scheduled items to localStorage when it changes
  useEffect(() => {
    try {
      const d = new Date();
      const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      localStorage.setItem(`ssp_scheduled_${dateKey}`, JSON.stringify(Array.from(scheduled)));
    } catch (err) {
      console.error(err);
    }
  }, [scheduled]);

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

  const handleSchedule = useCallback(async (item, index) => {
    // Determine priority
    const priority = ['high', 'medium', 'low'].includes(item.priority?.toLowerCase())
      ? item.priority.toLowerCase()
      : 'medium';

    // Determine type
    let type = 'other';
    const tag = item.tag?.toLowerCase();
    if (tag === 'attendance') {
      type = 'other';
    } else if (tag === 'academics') {
      type = 'revision';
    } else if (tag === 'career') {
      type = 'project';
    }

    // Today's date local YYYY-MM-DD
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const taskData = {
      title: item.action,
      subject: item.tag || 'General',
      description: item.reason || '',
      dueDate: todayStr,
      dueTime: '23:59',
      priority,
      type,
      status: 'pending',
    };

    try {
      await taskService.create(taskData);
      toast.success(`Task scheduled: "${item.action}"`);
      setScheduled((prev) => {
        const next = new Set(prev);
        next.add(item.action);
        return next;
      });
    } catch (err) {
      console.error(err);
      toast.error('Failed to add task to scheduler');
    }
  }, [scheduled]);

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
    background: 'var(--surface-1, var(--color-surface-1))',
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
              color: 'var(--color-accent)',
              flexShrink: 0,
            }}
          >
            <Brain size={18} />
          </div>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--text-primary, var(--color-text-primary))',
                lineHeight: 1.3,
              }}
            >
              Smart Study Plan
            </p>
            <p
              style={{
                margin: '2px 0 0',
                fontSize: 11,
                color: 'var(--text-secondary, var(--color-text-secondary))',
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
                color: 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Target size={12} />
              {plan.focusArea}
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
            scheduled={scheduled.has(item.action)}
            onSchedule={() => handleSchedule(item, i)}
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
        <span style={{ fontSize: 11, color: 'var(--text-secondary, var(--color-text-secondary))' }}>
          Progress today
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary, var(--color-text-secondary))' }}>
          {doneCount} of {totalItems} completed
        </span>
      </div>

    </div>
  );
}
