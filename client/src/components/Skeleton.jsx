import React from 'react';

export default function Skeleton({ className = '', style = {}, variant = 'rect', width, height, count = 1 }) {
  const baseStyle = {
    background: 'linear-gradient(90deg, var(--color-surface-3) 25%, var(--color-surface-2) 50%, var(--color-surface-3) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: variant === 'circle' ? '50%' : variant === 'pill' ? '100px' : 'var(--radius-md)',
    width: width || (variant === 'circle' ? '40px' : '100%'),
    height: height || (variant === 'circle' ? '40px' : '16px'),
    ...style,
  };

  if (count > 1) {
    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={baseStyle} />
        ))}
      </div>
    );
  }

  return <div className={className} style={baseStyle} />;
}

// Card skeleton for loading cards
export function CardSkeleton({ count = 1 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          background: 'var(--color-surface-2)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          border: '1px solid var(--border)',
        }}>
          <Skeleton variant="rect" height="20" width="60%" style={{ marginBottom: '12px' }} />
          <Skeleton variant="rect" height="16" count={2} />
        </div>
      ))}
    </div>
  );
}

// Table skeleton for loading tables
export function TableSkeleton({ rows = 3, cols = 4 }) {
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', padding: '0 14px' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} variant="rect" height="14" width="20%" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: '12px', padding: '14px', borderBottom: '1px solid var(--border)' }}>
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} variant="rect" height="14" width="20%" />
          ))}
        </div>
      ))}
    </div>
  );
}

// Stats skeleton for loading stat cards
export function StatsSkeleton({ count = 4 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          background: 'var(--color-surface-3)',
          borderRadius: '10px',
          padding: '16px',
          textAlign: 'center',
        }}>
          <Skeleton variant="rect" height="28" width="60%" style={{ margin: '0 auto 4px' }} />
          <Skeleton variant="rect" height="12" width="40%" style={{ margin: '0 auto' }} />
        </div>
      ))}
    </div>
  );
}
