/**
 * MarksFilter.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders a pill-toggle for each detected column so the user can select
 * which ones to include in the final score.
 *
 * Props
 *   columns         : Array<{ name, max }>   — from backend detectColumns()
 *   selected        : string[]               — currently selected column names
 *   onChange        : (newSelected: string[]) => void
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState } from 'react';

export default function MarksFilter({ columns = [], selected = [], onChange }) {
  if (!columns.length) return null;

  const toggle = (name) => {
    const next = selected.includes(name)
      ? selected.filter(s => s !== name)
      : [...selected, name];
    onChange(next);
  };

  const selectAll   = () => onChange(columns.map(c => c.name));
  const selectNone  = () => onChange([]);
  const allSelected = selected.length === columns.length;

  return (
    <div style={{
      background    : 'var(--card-bg, rgba(255,255,255,0.04))',
      border        : '1px solid var(--card-border, rgba(255,255,255,0.08))',
      borderRadius  : 12,
      padding       : '14px 18px',
      marginBottom  : 16,
    }}>
      {/* Header row */}
      <div style={{
        display        : 'flex',
        justifyContent : 'space-between',
        alignItems     : 'center',
        marginBottom   : 12,
      }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
            🎯 Select Columns
          </span>
          <span style={{
            marginLeft   : 8,
            fontSize     : 11,
            color        : 'var(--muted)',
            background   : 'rgba(129,140,248,0.12)',
            border       : '1px solid rgba(129,140,248,0.2)',
            borderRadius : 99,
            padding      : '2px 8px',
          }}>
            {selected.length} / {columns.length} selected
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-outline btn-sm"
            style={{ fontSize: 11, padding: '3px 10px' }}
            onClick={selectAll}
            disabled={allSelected}
          >
            All
          </button>
          <button
            className="btn btn-outline btn-sm"
            style={{ fontSize: 11, padding: '3px 10px' }}
            onClick={selectNone}
            disabled={selected.length === 0}
          >
            None
          </button>
        </div>
      </div>

      {/* Column toggles */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {columns.map(col => {
          const isOn = selected.includes(col.name);
          return (
            <button
              key={`filter-col-${col.name}`}
              onClick={() => toggle(col.name)}
              style={{
                display      : 'inline-flex',
                alignItems   : 'center',
                gap          : 5,
                padding      : '5px 13px',
                borderRadius : 99,
                fontSize     : 12,
                fontWeight   : 600,
                cursor       : 'pointer',
                border       : `1.5px solid ${isOn ? 'rgba(129,140,248,0.6)' : 'rgba(255,255,255,0.1)'}`,
                background   : isOn ? 'rgba(129,140,248,0.15)' : 'transparent',
                color        : isOn ? '#818cf8' : 'var(--muted)',
                transition   : 'all 0.15s ease',
              }}
            >
              {isOn ? '✓' : '○'} {col.name}
              <span style={{
                fontSize     : 10,
                padding      : '1px 5px',
                borderRadius : 4,
                background   : isOn ? 'rgba(129,140,248,0.2)' : 'rgba(255,255,255,0.06)',
                color        : isOn ? '#a5b4fc' : 'var(--muted)',
              }}>
                /{col.max}
              </span>
            </button>
          );
        })}
      </div>

      {selected.length === 0 && (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#f87171' }}>
          ⚠ No columns selected — please select at least one to rank students.
        </p>
      )}
    </div>
  );
}