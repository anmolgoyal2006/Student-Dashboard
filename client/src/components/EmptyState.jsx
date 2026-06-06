import React from 'react';

export default function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  illustration = 'default'
}) {
  return (
    <div className="empty-state" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      textAlign: 'center',
      background: 'var(--color-surface-2)',
      border: '1.5px dashed var(--border)',
      borderRadius: 'var(--radius-lg)',
      margin: '16px 0',
      minHeight: '260px',
      width: '100%',
    }}>
      {/* SVG illustration */}
      <div style={{ marginBottom: 18, color: 'var(--color-accent)', opacity: 0.85, display: 'flex', justifyContent: 'center' }}>
        {illustration === 'default' ? (
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="12" y="16" width="40" height="32" rx="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 3" />
            <circle cx="32" cy="32" r="5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M22 40H42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ) : illustration === 'attendance' ? (
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="1.8" strokeDasharray="4 3" />
            <path d="M32 18V32L38 38" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="32" cy="32" r="2.5" fill="currentColor" />
          </svg>
        ) : illustration === 'dsa' ? (
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M32 10L14 20V44L32 54L50 44V20L32 10Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" />
            <circle cx="32" cy="32" r="6" stroke="currentColor" strokeWidth="1.8" fill="var(--color-surface-2)" />
            <path d="M32 16V26" stroke="currentColor" strokeWidth="1.5" />
            <path d="M32 38V48" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        ) : illustration === 'marks' ? (
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 10H42L50 18V54H14V10Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" />
            <path d="M38 10V20H50" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="22" y1="28" x2="34" y2="28" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="22" y1="36" x2="38" y2="36" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="22" y1="44" x2="30" y2="44" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ) : (
          icon || <span>📋</span>
        )}
      </div>
      <h3 style={{
        fontSize: 16,
        fontWeight: 500,
        color: 'var(--color-text-primary)',
        margin: '0 0 6px 0',
      }}>{title}</h3>
      <p style={{
        fontSize: 14,
        color: 'var(--color-text-secondary)',
        margin: '0 0 18px 0',
        maxWidth: 340,
        lineHeight: 1.45,
      }}>{subtitle}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="btn btn-primary"
          style={{ minHeight: 'auto', padding: '8px 18px', fontSize: 13, fontWeight: 500 }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
