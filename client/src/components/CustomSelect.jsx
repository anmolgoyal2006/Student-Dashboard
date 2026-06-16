import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export default function CustomSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} style={{ position: 'relative', userSelect: 'none' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          color: selected ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
          fontSize: 13,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8
        }}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} style={{
          color: 'var(--color-text-tertiary)',
          transition: 'transform 0.2s',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)'
        }} />
      </div>
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          background: 'var(--color-surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          overflow: 'hidden',
          zIndex: 100,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
        }}>
          <div
            onClick={() => { onChange(''); setOpen(false); }}
            style={{
              padding: '8px 12px',
              fontSize: 13,
              color: !value ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              background: !value ? 'rgba(99,102,241,0.08)' : 'transparent',
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = !value ? 'rgba(99,102,241,0.08)' : 'transparent'}
          >
            {placeholder}
          </div>
          {options.map(opt => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                padding: '8px 12px',
                fontSize: 13,
                color: value === opt.value ? 'var(--color-accent)' : 'var(--color-text-primary)',
                cursor: 'pointer',
                background: value === opt.value ? 'rgba(99,102,241,0.08)' : 'transparent',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = value === opt.value ? 'rgba(99,102,241,0.08)' : 'transparent'}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
