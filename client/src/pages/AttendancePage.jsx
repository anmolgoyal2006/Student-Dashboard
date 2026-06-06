// components/StudentAttendanceView.jsx — Enhanced UI/UX with modern design
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
  BarChart3, Clipboard, X, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, Calendar, Filter, Zap
} from 'lucide-react';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';

/* ═══════════════════════════════════════════════════════════════════════════ */
// ENHANCED DESIGN TOKENS
/* ═══════════════════════════════════════════════════════════════════════════ */

const COLORS = {
  bg: '#0a0e16',
  surface: '#0f1219',
  surface2: '#15191f',
  surface3: '#1a2028',
  border: 'rgba(255,255,255,0.05)',
  border2: 'rgba(255,255,255,0.1)',
  accent: '#6366f1',
  accentLight: '#818cf8',
  success: '#10b981',
  successLight: '#34d399',
  warning: '#f59e0b',
  warningLight: '#fbbf24',
  danger: '#ef4444',
  dangerLight: '#f87171',
  text: '#f1f5f9',
  textSub: '#cbd5e1',
  textMute: '#64748b',
  textDim: '#475569',
};

const ATTENDANCE_THRESHOLD = 75;

const STATUS_CONFIG = {
  present: {
    bg: 'rgba(16,185,129,0.1)',
    border: 'rgba(16,185,129,0.3)',
    color: '#34d399',
    label: 'Present',
    icon: '✓',
  },
  absent: {
    bg: 'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.3)',
    color: '#f87171',
    label: 'Absent',
    icon: '✕',
  },
  cancelled: {
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.3)',
    color: '#fbbf24',
    label: 'Cancelled',
    icon: '○',
  },
};

/**
 * Enhanced card style with glassmorphism and depth
 */
const cardStyle = (extras = {}) => ({
  background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.surface2} 100%)`,
  border: `1px solid ${COLORS.border2}`,
  borderRadius: 20,
  padding: '24px',
  marginBottom: 20,
  backdropFilter: 'blur(10px)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
  ...extras,
});

/* ═══════════════════════════════════════════════════════════════════════════ */
// UTILITIES
/* ═══════════════════════════════════════════════════════════════════════════ */

const getAttendanceColor = (percentage) => {
  if (percentage >= ATTENDANCE_THRESHOLD) return COLORS.success;
  if (percentage >= 50) return COLORS.warning;
  return COLORS.danger;
};

const getAttendanceColorLight = (percentage) => {
  if (percentage >= ATTENDANCE_THRESHOLD) return COLORS.successLight;
  if (percentage >= 50) return COLORS.warningLight;
  return COLORS.dangerLight;
};

const getAttendanceBg = (percentage) => {
  if (percentage >= ATTENDANCE_THRESHOLD) return 'rgba(16,185,129,0.12)';
  if (percentage >= 50) return 'rgba(245,158,11,0.12)';
  return 'rgba(239,68,68,0.12)';
};

const getAttendanceBorder = (percentage) => {
  if (percentage >= ATTENDANCE_THRESHOLD) return 'rgba(16,185,129,0.3)';
  if (percentage >= 50) return 'rgba(245,158,11,0.3)';
  return 'rgba(239,68,68,0.3)';
};

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/* ═══════════════════════════════════════════════════════════════════════════ */
// ENHANCED SUBCOMPONENTS
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Enhanced StatCard with hover animation
 */
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${COLORS.surface2} 0%, ${COLORS.surface3} 100%)`,
        border: `1px solid ${COLORS.border2}`,
        borderRadius: 16,
        padding: '16px 14px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: 'translateY(0)',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = `0 12px 24px ${color}20`;
        e.currentTarget.style.borderColor = color;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = COLORS.border2;
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 10,
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: `${color}15`,
            border: `1px solid ${color}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
          }}
        >
          <Icon size={18} color={color} strokeWidth={2.5} />
        </div>
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          marginBottom: 6,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          color: COLORS.textMute,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: 600,
        }}
      >
        {label}
      </div>
    </div>
  );
}

/**
 * Enhanced OverallBadge with circular progress
 */
function OverallBadge({ percentage }) {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (percentage / 100) * circumference;
  const color = getAttendanceColor(percentage);

  return (
    <div style={{ marginLeft: 'auto', textAlign: 'center' }}>
      <div
        style={{
          position: 'relative',
          width: 140,
          height: 140,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Outer glow */}
        <div
          style={{
            position: 'absolute',
            width: 140,
            height: 140,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${color}15, transparent)`,
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          }}
        />

        {/* SVG Circle Progress */}
        <svg
          width="140"
          height="140"
          style={{
            position: 'absolute',
            transform: 'rotate(-90deg)',
          }}
        >
          {/* Background circle */}
          <circle
            cx="70"
            cy="70"
            r="45"
            fill="none"
            stroke={COLORS.border2}
            strokeWidth="3"
          />
          {/* Progress circle */}
          <circle
            cx="70"
            cy="70"
            r="45"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
              filter: `drop-shadow(0 0 8px ${color}40)`,
            }}
          />
        </svg>

        {/* Inner content */}
        <div
          style={{
            textAlign: 'center',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 900,
              color,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {percentage}%
          </div>
          <div
            style={{
              fontSize: 11,
              color: COLORS.textMute,
              marginTop: 4,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Overall
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.1); opacity: 0.1; }
        }
      `}</style>
    </div>
  );
}

/**
 * Enhanced ProgressBar with gradient and animation
 */
function ProgressBar({ percentage, label, showThreshold = false }) {
  const color = getAttendanceColor(percentage);
  const isAtRisk = percentage < ATTENDANCE_THRESHOLD;

  return (
    <div style={{ marginTop: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 13,
          color: COLORS.textSub,
          marginBottom: 8,
          fontWeight: 500,
        }}
      >
        <span>{label}</span>
        <span
          style={{
            color,
            fontWeight: 700,
            fontSize: 14,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {percentage}%
        </span>
      </div>
      <div
        style={{
          height: 12,
          borderRadius: 8,
          background: COLORS.surface3,
          overflow: 'hidden',
          border: `1px solid ${COLORS.border2}`,
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            borderRadius: 8,
            background: `linear-gradient(90deg, ${color}, ${getAttendanceColorLight(percentage)})`,
            transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: `0 0 16px ${color}40, inset 0 0 8px ${color}20`,
          }}
        />
      </div>
      {showThreshold && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            fontSize: 11,
            color: COLORS.textMute,
            marginTop: 6,
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>Safe zone: {ATTENDANCE_THRESHOLD}%</span>
          {isAtRisk ? (
            <TrendingDown size={12} color={COLORS.danger} strokeWidth={2.5} />
          ) : (
            <TrendingUp size={12} color={COLORS.success} strokeWidth={2.5} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Enhanced SubjectRow with animated progress
 */
function SubjectRow({ subject, code, present, total, percentage }) {
  return (
    <div
      style={{
        marginBottom: 18,
        padding: 14,
        borderRadius: 14,
        background: COLORS.surface3,
        border: `1px solid ${COLORS.border}`,
        transition: 'all 0.3s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = getAttendanceColor(percentage);
        e.currentTarget.style.background = COLORS.surface2;
        e.currentTarget.style.boxShadow = `0 0 16px ${getAttendanceColor(percentage)}15`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = COLORS.border;
        e.currentTarget.style.background = COLORS.surface3;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <div>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: COLORS.text,
              display: 'block',
              marginBottom: 4,
            }}
          >
            {subject}
          </span>
          {code && (
            <span
              style={{
                fontSize: 11,
                color: COLORS.textMute,
                padding: '2px 8px',
                background: COLORS.surface2,
                borderRadius: 6,
                display: 'inline-block',
                fontWeight: 600,
                fontFamily: 'monospace',
              }}
            >
              {code}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontSize: 13,
              color: COLORS.textSub,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {present}/{total}
          </span>
          <div
            style={{
              padding: '4px 12px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 800,
              background: getAttendanceBg(percentage),
              color: getAttendanceColor(percentage),
              border: `1.5px solid ${getAttendanceBorder(percentage)}`,
              minWidth: 56,
              textAlign: 'center',
              boxShadow: `0 0 12px ${getAttendanceColor(percentage)}20`,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {percentage}%
          </div>
        </div>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 6,
          background: COLORS.surface2,
          overflow: 'hidden',
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            borderRadius: 6,
            background: `linear-gradient(90deg, ${getAttendanceColor(percentage)}, ${getAttendanceColorLight(percentage)})`,
            transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: `0 0 12px ${getAttendanceColor(percentage)}40`,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Enhanced AtRiskAlert with animation
 */
function AtRiskAlert({ subjects }) {
  if (!subjects || subjects.length === 0) return null;

  return (
    <div
      style={{
        ...cardStyle({
          padding: '16px 20px',
        }),
        background: `linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(245,158,11,0.04) 100%)`,
        border: '1px solid rgba(245,158,11,0.25)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        animation: 'slideIn 0.4s ease',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: 'rgba(245,158,11,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        <AlertTriangle size={20} color={COLORS.warning} strokeWidth={2.5} />
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: COLORS.text,
            marginBottom: 8,
          }}
        >
          ⚠️ {subjects.length} subject{subjects.length > 1 ? 's' : ''} need attention
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {subjects.map((s, i) => (
            <span
              key={i}
              style={{
                padding: '4px 11px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                background: 'rgba(239,68,68,0.12)',
                color: COLORS.dangerLight,
                border: '1px solid rgba(239,68,68,0.3)',
                animation: `fadeIn 0.4s ease ${i * 50}ms backwards`,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {s.subject} • {s.percentage}%
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

/**
 * Enhanced FilterPill with smooth transitions
 */
function FilterPill({ status, isActive, onClick }) {
  const config = STATUS_CONFIG[status] || {};
  const isAllFilter = status === 'all';

  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 20,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 700,
        background: isActive
          ? isAllFilter
            ? `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentLight})`
            : config.bg
          : COLORS.surface3,
        color: isActive ? (isAllFilter ? COLORS.text : config.color) : COLORS.textMute,
        border: `1.5px solid ${
          isActive
            ? isAllFilter
              ? COLORS.accent
              : config.color
            : COLORS.border
        }`,
        textTransform: 'capitalize',
        transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: isActive ? 'scale(1.05)' : 'scale(1)',
        boxShadow: isActive ? `0 0 12px ${isAllFilter ? COLORS.accent : config.color}30` : 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = isActive ? 'scale(1.05)' : 'scale(1)';
      }}
    >
      {status}
    </button>
  );
}

/**
 * Enhanced SearchBar with icon animation
 */
function SearchBar({ value, onChange }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div style={{ marginBottom: 16, position: 'relative' }}>
      <Filter
        size={14}
        color={isFocused ? COLORS.accentLight : COLORS.textMute}
        style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          transition: 'color 0.3s ease',
        }}
      />
      <input
        style={{
          width: '100%',
          paddingLeft: 38,
          padding: '10px 14px 10px 38px',
          background: COLORS.surface3,
          border: `1.5px solid ${isFocused ? COLORS.accent : COLORS.border2}`,
          borderRadius: 12,
          color: COLORS.text,
          fontSize: 13,
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'all 0.3s ease',
          boxShadow: isFocused ? `0 0 16px ${COLORS.accent}20` : 'none',
          fontWeight: 500,
        }}
        placeholder="Search by subject…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
    </div>
  );
}

/**
 * Enhanced RecordRow with hover effects
 */
function RecordRow({ date, subject, code, status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.absent;

  return (
    <tr
      style={{
        transition: 'all 0.25s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = COLORS.surface3;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <td
        style={{
          padding: '12px 14px',
          borderBottom: `1px solid ${COLORS.border}`,
          color: COLORS.textSub,
          fontSize: 13,
          whiteSpace: 'nowrap',
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatDate(date)}
      </td>
      <td
        style={{
          padding: '12px 14px',
          borderBottom: `1px solid ${COLORS.border}`,
          color: COLORS.text,
          fontWeight: 600,
        }}
      >
        {subject}
        {code && (
          <span
            style={{
              marginLeft: 8,
              fontSize: 11,
              color: COLORS.textMute,
              padding: '2px 6px',
              background: COLORS.surface2,
              borderRadius: 4,
              fontFamily: 'monospace',
              fontWeight: 600,
            }}
          >
            {code}
          </span>
        )}
      </td>
      <td
        style={{
          padding: '12px 14px',
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            background: config.bg,
            color: config.color,
            border: `1.5px solid ${config.border}`,
            boxShadow: `0 0 12px ${config.color}20`,
            textTransform: 'capitalize',
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: config.color,
              display: 'inline-block',
              boxShadow: `0 0 8px ${config.color}60`,
            }}
          />
          {config.label}
        </span>
      </td>
    </tr>
  );
}

/**
 * Enhanced RecordsTable
 */
function RecordsTable({ records, filter, search, sortDir, onSortChange, onFilterChange, onSearchChange }) {
  const filteredRecords = useMemo(() => {
    if (!records) return [];
    return records
      .filter((r) => filter === 'all' || r.status === filter)
      .filter((r) => !search || r.subject?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const da = new Date(a.date);
        const db = new Date(b.date);
        return sortDir === 'desc' ? db - da : da - db;
      });
  }, [records, filter, search, sortDir]);

  return (
    <div style={cardStyle()}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: COLORS.text,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: `${COLORS.accent}15`,
              border: `1px solid ${COLORS.accent}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clipboard size={16} color={COLORS.accent} strokeWidth={2.5} />
          </div>
          Attendance Records
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 20,
              fontSize: 11,
              background: `${COLORS.accent}15`,
              color: COLORS.accentLight,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              minWidth: 32,
              textAlign: 'center',
            }}
          >
            {filteredRecords.length}
          </span>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {['all', 'present', 'absent', 'cancelled'].map((status) => (
            <FilterPill
              key={status}
              status={status}
              isActive={filter === status}
              onClick={() => onFilterChange(status)}
            />
          ))}
        </div>
      </div>

      {/* Search */}
      <SearchBar value={search} onChange={onSearchChange} />

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${COLORS.border}` }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13.5,
          }}
        >
          <thead style={{ background: COLORS.surface3 }}>
            <tr>
              <th
                style={{
                  padding: '12px 14px',
                  textAlign: 'left',
                  color: COLORS.textMute,
                  fontWeight: 700,
                  fontSize: 11.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  borderBottom: `1px solid ${COLORS.border}`,
                }}
              >
                <button
                  onClick={onSortChange}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: COLORS.textMute,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: 0,
                    transition: 'color 0.2s ease',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = COLORS.accentLight;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = COLORS.textMute;
                  }}
                >
                  Date
                  <span style={{ fontSize: 12, marginLeft: 2 }}>
                    {sortDir === 'desc' ? '↓' : '↑'}
                  </span>
                </button>
              </th>
              <th
                style={{
                  padding: '12px 14px',
                  textAlign: 'left',
                  color: COLORS.textMute,
                  fontWeight: 700,
                  fontSize: 11.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  borderBottom: `1px solid ${COLORS.border}`,
                }}
              >
                Subject
              </th>
              <th
                style={{
                  padding: '12px 14px',
                  textAlign: 'left',
                  color: COLORS.textMute,
                  fontWeight: 700,
                  fontSize: 11.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  borderBottom: `1px solid ${COLORS.border}`,
                }}
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: 0 }}>
                  <EmptyState
                    title="No records found"
                    subtitle={`No ${
                      filter !== 'all' ? filter : ''
                    } records${search ? ` matching "${search}"` : ''}.`}
                    illustration="attendance"
                  />
                </td>
              </tr>
            ) : (
              filteredRecords.map((r, i) => (
                <RecordRow
                  key={i}
                  date={r.date}
                  subject={r.subject}
                  code={r.code}
                  status={r.status}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {filteredRecords.length > 0 && (
        <div
          style={{
            marginTop: 14,
            fontSize: 12,
            color: COLORS.textMute,
            textAlign: 'right',
            fontWeight: 500,
          }}
        >
          Showing {filteredRecords.length} of {records.length} record{records.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

/**
 * LoadingSkeleton
 */
function LoadingSkeleton() {
  return (
    <div
      style={{
        maxWidth: 800,
        margin: '0 auto',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {/* Header skeleton */}
      <div style={cardStyle()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Skeleton variant="circle" width="48px" height="48px" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <Skeleton width="200px" height="20px" />
            <Skeleton width="280px" height="14px" />
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: 12,
            marginTop: 22,
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                background: COLORS.surface2,
                borderRadius: 14,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Skeleton width="60px" height="32px" />
              <Skeleton width="80px" height="12px" />
            </div>
          ))}
        </div>
      </div>

      {/* Subject breakdown skeleton */}
      <div style={cardStyle()}>
        <Skeleton width="180px" height="18px" style={{ marginBottom: 20 }} />
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Skeleton width="140px" height="14px" />
              <Skeleton width="80px" height="14px" />
            </div>
            <Skeleton height="8px" style={{ borderRadius: 6 }} />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div style={cardStyle()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <Skeleton width="160px" height="18px" />
          <div style={{ display: 'flex', gap: 8 }}>
            <Skeleton variant="pill" width="60px" height="32px" />
            <Skeleton variant="pill" width="70px" height="32px" />
            <Skeleton variant="pill" width="64px" height="32px" />
          </div>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 16,
              padding: '14px 0',
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            <Skeleton width="90px" height="14px" />
            <Skeleton width="130px" height="14px" />
            <Skeleton variant="pill" width="80px" height="24px" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ErrorState
 */
function ErrorState({ message }) {
  return (
    <div
      style={{
        maxWidth: 800,
        margin: '0 auto',
        padding: 48,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: 'rgba(239,68,68,0.1)',
          border: '1.5px solid rgba(239,68,68,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={24} color={COLORS.danger} strokeWidth={2.5} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, color: COLORS.danger, fontWeight: 700, marginBottom: 4 }}>
          Unable to load attendance
        </div>
        <div style={{ fontSize: 13, color: COLORS.textMute }}>
          {message}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
// MAIN COMPONENT
/* ═══════════════════════════════════════════════════════════════════════════ */

export default function StudentAttendanceView({ sid }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    if (!sid) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError('');
        const token = localStorage.getItem('token');
        const res = await axios.get(
          `${process.env.REACT_APP_API_URL}/attendance/student/${sid}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setData(res.data);
      } catch (err) {
        const message = err.response?.data?.message || 'Failed to load attendance.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [sid]);

  const stats = useMemo(() => {
    if (!data) return null;
    const present = data.records.filter((r) => r.status === 'present').length;
    const absent = data.total - present;
    const atRisk = data.summary.filter((s) => s.percentage < ATTENDANCE_THRESHOLD);
    const overallPct = data.total ? Math.round((present / data.total) * 100) : 0;

    return { present, absent, atRisk, overallPct };
  }, [data]);

  const handleFilterChange = useCallback((newFilter) => {
    setFilter(newFilter);
  }, []);

  const handleSearchChange = useCallback((newSearch) => {
    setSearch(newSearch);
  }, []);

  const handleSortToggle = useCallback(() => {
    setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;
  if (!data || !stats) return null;

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', padding: '24px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <style>{`
          * {
            box-sizing: border-box;
          }
          body {
            background: ${COLORS.bg};
          }
        `}</style>

        {/* Student header */}
        <div style={cardStyle({ marginBottom: 20 })}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 16,
                flexShrink: 0,
                background: `linear-gradient(135deg, ${COLORS.accent}20, ${COLORS.accent}05)`,
                border: `1.5px solid ${COLORS.accent}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BarChart3 size={24} color={COLORS.accent} strokeWidth={2} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text, marginBottom: 3 }}>
                {data.student.name}
              </div>
              <div style={{ fontSize: 13, color: COLORS.textMute, marginTop: 2 }}>
                {data.student.email}
                {data.student.sid && (
                  <span
                    style={{
                      marginLeft: 10,
                      padding: '2px 10px',
                      background: COLORS.surface3,
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: 'monospace',
                    }}
                  >
                    {data.student.sid}
                  </span>
                )}
              </div>
            </div>
            <OverallBadge percentage={stats.overallPct} />
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
            <StatCard
              icon={Calendar}
              label="Total Classes"
              value={data.total}
              color={COLORS.accent}
            />
            <StatCard
              icon={CheckCircle2}
              label="Present"
              value={stats.present}
              color={COLORS.success}
            />
            <StatCard
              icon={X}
              label="Absent"
              value={stats.absent}
              color={COLORS.danger}
            />
            <StatCard
              icon={AlertTriangle}
              label="At Risk Subs"
              value={stats.atRisk.length}
              color={stats.atRisk.length > 0 ? COLORS.warning : COLORS.textMute}
            />
          </div>

          {/* Overall progress */}
          <ProgressBar percentage={stats.overallPct} label="Overall attendance" showThreshold />
        </div>

        {/* At-risk alert */}
        <AtRiskAlert subjects={stats.atRisk} />

        {/* Subject breakdown */}
        <div style={cardStyle()}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: COLORS.text,
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `${COLORS.accent}15`,
                border: `1px solid ${COLORS.accent}30`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BarChart3 size={16} color={COLORS.accent} strokeWidth={2.5} />
            </div>
            Subject-wise Breakdown
          </div>
          {data.summary.map((s, i) => (
            <SubjectRow
              key={i}
              subject={s.subject}
              code={s.code}
              present={s.present}
              total={s.total}
              percentage={s.percentage}
            />
          ))}
        </div>

        {/* Records table */}
        <RecordsTable
          records={data.records}
          filter={filter}
          search={search}
          sortDir={sortDir}
          onSortChange={handleSortToggle}
          onFilterChange={handleFilterChange}
          onSearchChange={handleSearchChange}
        />
      </div>
    </div>
  );
}