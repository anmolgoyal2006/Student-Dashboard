import { Scale } from 'lucide-react';
/**
 * WeightInput.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders a weight input for each SELECTED column.
 * Shows original max and lets user override the out-of value.
 *
 * Props
 *   columns         : Array<{ name, max }>   — ALL detected columns
 *   selectedColumns : string[]               — filtered by MarksFilter
 *   weights         : { [colName]: number }  — current weight values
 *   onChange        : (newWeights: Object) => void
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default function WeightInput({ columns = [], selectedColumns = [], weights = {}, onChange }) {
  if (!selectedColumns.length) return null;

  const activeCols = columns.filter(c => selectedColumns.includes(c.name));
  if (!activeCols.length) return null;

  const totalWeight = activeCols.reduce((sum, c) => {
    const w = weights[c.name] !== undefined ? weights[c.name] : c.max;
    return sum + (Number(w) || 0);
  }, 0);

  const handleChange = (name, raw) => {
    const val = raw === '' ? '' : Math.max(0, Number(raw));
    onChange({ ...weights, [name]: val });
  };

  const resetAll = () => {
    const reset = {};
    activeCols.forEach(c => { reset[c.name] = c.max; });
    onChange({ ...weights, ...reset });
  };

  return (
    <div style={{
      background   : 'var(--card-bg, rgba(255,255,255,0.04))',
      border       : '1px solid var(--card-border, rgba(255,255,255,0.08))',
      borderRadius : 12,
      padding      : '14px 18px',
      marginBottom : 16,
    }}>
      {/* Header */}
      <div style={{
        display        : 'flex',
        justifyContent : 'space-between',
        alignItems     : 'center',
        marginBottom   : 14,
      }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Scale size={15} /> Custom Weights</span>
          </span>
          <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)' }}>
            Total out-of:&nbsp;
            <strong style={{ color: 'var(--color-accent)' }}>{Math.round(totalWeight * 100) / 100}</strong>
          </span>
        </div>
        <button
          className="btn btn-outline btn-sm"
          style={{ fontSize: 11, padding: '3px 10px' }}
          onClick={resetAll}
        >
          Reset
        </button>
      </div>

      {/* Weight rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {activeCols.map(col => {
          const currentWeight = weights[col.name] !== undefined ? weights[col.name] : col.max;
          const isModified    = Number(currentWeight) !== col.max;

          return (
           <div key={`weight-col-${col.name}`} style={{
              display     : 'flex',
              alignItems  : 'center',
              gap         : 12,
              padding     : '8px 12px',
              borderRadius: 8,
              background  : isModified
                ? 'rgba(129,140,248,0.07)'
                : 'rgba(255,255,255,0.02)',
              border: `1px solid ${isModified
                ? 'rgba(129,140,248,0.2)'
                : 'rgba(255,255,255,0.05)'}`,
              transition  : 'all 0.15s ease',
            }}>
              {/* Column name */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                  {col.name}
                  {isModified && (
                    <span style={{
                      marginLeft   : 6,
                      fontSize     : 10,
                      color        : 'var(--color-accent)',
                      background   : 'rgba(129,140,248,0.15)',
                      padding      : '1px 6px',
                      borderRadius : 99,
                    }}>
                      modified
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                  original max: {col.max}
                </div>
              </div>

              {/* Formula preview */}
              <div style={{
                fontSize  : 11,
                color     : 'var(--muted)',
                whiteSpace: 'nowrap',
                display   : 'flex',
                alignItems: 'center',
                gap       : 4,
              }}>
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  (x / {col.max}) ×
                </span>
              </div>

              {/* Weight input */}
              <input
                type="number"
                min="0"
                step="0.5"
                value={currentWeight}
                onChange={e => handleChange(col.name, e.target.value)}
                className="form-input"
                style={{
                  width       : 72,
                  textAlign   : 'center',
                  fontWeight  : 600,
                  fontSize    : 14,
                  padding     : '5px 8px',
                  borderColor : isModified ? 'rgba(129,140,248,0.4)' : undefined,
                  color       : isModified ? 'var(--color-accent)' : 'var(--text)',
                }}
              />

              {/* Reset single */}
              {isModified && (
                <button
                  style={{
                    background   : 'none',
                    border       : 'none',
                    cursor       : 'pointer',
                    color        : 'var(--muted)',
                    fontSize     : 14,
                    padding      : 2,
                    lineHeight   : 1,
                    borderRadius : 4,
                  }}
                  title="Reset to original"
                  onClick={() => handleChange(col.name, col.max)}
                >
                  ↺
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Formula note */}
      <p style={{
        margin    : '12px 0 0',
        fontSize  : 11,
        color     : 'var(--muted)',
        fontStyle : 'italic',
      }}>
        Score = (student marks ÷ original max) × your weight — for each column
      </p>
    </div>
  );
}