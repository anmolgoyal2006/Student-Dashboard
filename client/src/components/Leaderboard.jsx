import { useState, useEffect, useMemo } from 'react';
import { FolderOpen, Flag, Trophy, Search, BarChart3, AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Leaderboard.jsx
 * 
 * Renders the ranked student leaderboard with premium Spatial Dark aesthetics,
 * interactive relative grading control panel, live validation, and dynamic colored badges.
 */

const targetRatios = {
  'A+' : 0.1077,
  'A'  : 0.1538,
  'B+' : 0.1923,
  'B'  : 0.2308,
  'C+' : 0.1538,
  'C'  : 0.0769,
  'D'  : 0.0462,
  'F'  : 0.0385,
};

const gradesOrder = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'];

const getProportionalCounts = (total) => {
  if (!total || total <= 0) {
    return { 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C+': 0, 'C': 0, 'D': 0, 'F': 0 };
  }
  
  const floorCounts = {};
  const remainders = [];
  let allocated = 0;

  gradesOrder.forEach((grade) => {
    const exact = total * targetRatios[grade];
    const floor = Math.floor(exact);
    const rem = exact - floor;
    floorCounts[grade] = floor;
    allocated += floor;
    remainders.push({ grade, rem });
  });

  remainders.sort((a, b) => {
    if (Math.abs(a.rem - b.rem) < 1e-9) {
      return gradesOrder.indexOf(a.grade) - gradesOrder.indexOf(b.grade);
    }
    return b.rem - a.rem;
  });

  let remaining = total - allocated;
  for (let i = 0; i < remaining; i++) {
    const targetGrade = remainders[i].grade;
    floorCounts[targetGrade] += 1;
  }

  return floorCounts;
};

const getGradeBadgeStyle = (grade) => {
  const colors = {
    'A+': { bg: 'rgba(16,185,129,0.12)', text: 'var(--color-success)', border: 'rgba(16,185,129,0.25)' },
    'A' : { bg: 'rgba(34,197,94,0.12)', text: 'var(--color-success)', border: 'rgba(34,197,94,0.25)' },
    'B+': { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6', border: 'rgba(59,130,246,0.25)' },
    'B' : { bg: 'rgba(99,102,241,0.12)', text: 'var(--color-accent)', border: 'rgba(99,102,241,0.25)' },
    'C+': { bg: 'rgba(234,179,8,0.12)', text: 'var(--color-warning)', border: 'rgba(234,179,8,0.25)' },
    'C' : { bg: 'rgba(249,115,22,0.12)', text: 'var(--color-warning)', border: 'rgba(249,115,22,0.25)' },
    'D' : { bg: 'rgba(239,68,68,0.12)', text: 'var(--color-danger)', border: 'rgba(239,68,68,0.25)' },
    'F' : { bg: 'rgba(148,163,184,0.12)', text: 'var(--color-text-secondary)', border: 'rgba(148,163,184,0.25)' }
  };
  const c = colors[grade] || colors['F'];
  return {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.5px',
    backgroundColor: c.bg,
    color: c.text,
    border: `1px solid ${c.border}`,
    textAlign: 'center',
    minWidth: '40px',
    boxShadow: `0 0 6px ${c.bg}`,
  };
};

export default function Leaderboard({
  data,
  onDownloadExcel,
  loading = false,
  scoreLabel = 'Total',
  relativeGradingEnabled = false,
  setRelativeGradingEnabled,
  gradeCounts = {},
  setGradeCounts,
}) {
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const leaderboard = data?.leaderboard?.[0]?.students || [];

  useEffect(() => { setPage(0); }, [searchQuery, leaderboard.length]);

  const filteredLeaderboard = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return leaderboard;
    return leaderboard.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.roll && String(s.roll).toLowerCase().includes(q))
    );
  }, [leaderboard, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredLeaderboard.length / PAGE_SIZE));
  const pagedStudents = useMemo(
    () => filteredLeaderboard.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredLeaderboard, page]
  );

  useEffect(() => {
    if (leaderboard.length > 0 && setGradeCounts) {
      setGradeCounts(getProportionalCounts(leaderboard.length));
    }
  }, [leaderboard.length]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div className="spinner" />
        <p className="text-muted" style={{ marginTop: 12 }}>Processing PDF…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="empty-state">
        <div className="icon"><FolderOpen size={40} style={{ opacity: 0.4 }} /></div>
        <p style={{ fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>No data uploaded yet</p>
        <p className="text-muted">Upload a PDF to generate the leaderboard.</p>
      </div>
    );
  }

  if (!leaderboard?.length) {
    return (
      <div className="empty-state">
        <div className="icon"><Flag size={40} style={{ opacity: 0.4 }} /></div>
        <p style={{ fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>No results found</p>
        <p className="text-muted">The uploaded file had no rankable student data.</p>
      </div>
    );
  }

  const medalFor = rank => {
    if (rank === 1) return <span style={{ display:'inline-flex', alignItems:'center', gap:3, color:'#facc15', fontWeight:700 }}><Trophy size={14} color="#facc15" /> 1st</span>;
    if (rank === 2) return <span style={{ display:'inline-flex', alignItems:'center', gap:3, color:'#94a3b8', fontWeight:700 }}><Trophy size={14} color="#94a3b8" /> 2nd</span>;
    if (rank === 3) return <span style={{ display:'inline-flex', alignItems:'center', gap:3, color:'#cd7c2f', fontWeight:700 }}><Trophy size={14} color="#cd7c2f" /> 3rd</span>;
    return `#${rank}`;
  };

  const fmt = val => {
    const n = parseFloat(val);
    return isNaN(n) ? '—' : Number.isInteger(n) ? n : n.toFixed(2);
  };

  // Derive column names from first student's breakdown keys
  const breakdownCols = leaderboard[0]?.breakdown
    ? Object.keys(leaderboard[0].breakdown)
    : [];

  const topper = leaderboard[0];

  // Allocation status calculations
  const totalStudents = leaderboard.length;
  const allocatedCount = Object.values(gradeCounts || {}).reduce((sum, val) => sum + (Math.max(0, parseInt(val) || 0)), 0);
  const remainingCount = Math.max(0, totalStudents - allocatedCount);
  const overflowCount = Math.max(0, allocatedCount - totalStudents);

  // Grade Boundary Preview
  const gradeBoundaries = {};
  gradesOrder.forEach((g) => {
    const matches = leaderboard.filter((s) => s.grade === g);
    if (matches.length > 0) {
      const minScore = Math.min(...matches.map((s) => s.totalScore));
      gradeBoundaries[g] = minScore;
    } else {
      gradeBoundaries[g] = null;
    }
  });

  return (
    <div>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <div className="card-title" style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: "6px" }}><Trophy size={16} color="var(--color-warning)" /> Leaderboard</div>
          <div className="text-muted" style={{ fontSize: 13 }}>
            {leaderboard.length} students ranked
          </div>
        </div>
        <button className="btn btn-primary" onClick={onDownloadExcel}>
          ⬇ Download Excel
        </button>
      </div>

      {/* ── Topper highlight ── */}
      {topper && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', borderRadius: 10, marginBottom: 12,
          background: 'rgba(250,204,21,0.08)',
          border: '1px solid rgba(250,204,21,0.25)',
        }}>
          <Trophy size={28} color="var(--color-warning)" />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
              {topper.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Topper · {fmt(topper.totalScore)} {scoreLabel === 'Final Score' ? 'final score' : 'pts'}
              {topper.roll ? ` · Roll: ${topper.roll}` : ''}
              {relativeGradingEnabled && topper.grade ? ` · Grade: ${topper.grade}` : ''}
            </div>
          </div>
        </div>
      )}

      {/* ── Search Bar ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 16,
            color: 'var(--muted)',
            pointerEvents: 'none'
          }}><Search size={16} /></span>
          <input
            type="text"
            className="form-input"
            placeholder="Search student by Name or Student ID (SID)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              paddingLeft: 40,
              fontSize: 14,
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              transition: 'all 0.2s',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Rank Finder Highlight Cards ── */}
      {searchQuery.trim() && filteredLeaderboard.length > 0 && (
        <div style={{
          padding: '16px',
          borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(129, 140, 248, 0.1) 100%)',
          border: '1px solid rgba(129, 140, 248, 0.25)',
          marginBottom: 16,
          boxShadow: '0 8px 32px 0 rgba(99, 102, 241, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Search size={14} /> Rank Finder Results ({filteredLeaderboard.length})</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {filteredLeaderboard.slice(0, 3).map((st) => (
              <div key={st.roll || st.name} style={{
                flex: '1 1 240px',
                padding: '12px 16px',
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{st.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    Roll/SID: {st.roll || '—'} · Score: {fmt(st.totalScore)}
                  </div>
                </div>
                <div style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color: st.rank === 1 ? '#facc15' : st.rank === 2 ? '#94a3b8' : st.rank === 3 ? '#cd7c2f' : 'var(--color-accent)',
                  paddingLeft: 8,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  {st.rank <= 3
                    ? <><Trophy size={16} color={st.rank === 1 ? "#facc15" : st.rank === 2 ? "#94a3b8" : "#cd7c2f"} />
                        <span style={{ fontSize: 14 }}>{st.rank === 1 ? '1st' : st.rank === 2 ? '2nd' : '3rd'}</span>
                      </>
                    : `#${st.rank}`
                  }
                </div>
              </div>
            ))}
            {filteredLeaderboard.length > 3 && (
              <div style={{ alignSelf: 'center', fontSize: 12, color: 'var(--muted)', paddingLeft: 8 }}>
                + {filteredLeaderboard.length - 3} more matches...
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Relative Grading Options Panel ── */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '16px',
        marginBottom: 16,
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
        transition: 'all 0.3s ease',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }} onClick={() => setPanelExpanded(!panelExpanded)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 14 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><BarChart3 size={14} /> Relative Grading Options</span>
            {relativeGradingEnabled && (
              <span style={{
                backgroundColor: 'rgba(16,185,129,0.15)',
                color: 'var(--color-success)',
                padding: '2px 8px',
                borderRadius: 20,
                fontSize: 11,
                border: '1px solid rgba(16,185,129,0.3)',
              }}>Active</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} onClick={(e) => e.stopPropagation()}>
            {/* Toggle Switch */}
            <label style={{
              position: 'relative',
              display: 'inline-block',
              width: 44,
              height: 22,
              marginBottom: 0,
              cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={relativeGradingEnabled}
                onChange={(e) => setRelativeGradingEnabled?.(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: relativeGradingEnabled ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                transition: '.3s',
                borderRadius: 34,
                boxShadow: relativeGradingEnabled ? '0 0 10px rgba(129,140,248,0.5)' : 'none',
              }}>
                <span style={{
                  position: 'absolute',
                  height: 16, width: 16,
                  left: relativeGradingEnabled ? 25 : 3,
                  bottom: 3,
                  backgroundColor: 'var(--color-text-primary)',
                  transition: '.3s',
                  borderRadius: '50%',
                }} />
              </span>
            </label>
            <span style={{
              fontSize: 16,
              transform: panelExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              cursor: 'pointer',
            }} onClick={() => setPanelExpanded(!panelExpanded)}>▼</span>
          </div>
        </div>

        {panelExpanded && (
          <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16 }}>
            {/* Status bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 8,
            }}>
              <div>
                {allocatedCount === totalStudents ? (
                  <div style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    ✓ {allocatedCount}/{totalStudents} students allocated (Exact distribution)
                  </div>
                ) : allocatedCount < totalStudents ? (
                  <div style={{ color: 'var(--color-warning)', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><AlertTriangle size={14} /> {allocatedCount}/{totalStudents} students allocated</span> ({remainingCount} remaining will receive F)
                  </div>
                ) : (
                  <div style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    ❌ {allocatedCount}/{totalStudents} students allocated (Over-allocated by {overflowCount})
                  </div>
                )}
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => setGradeCounts?.(getProportionalCounts(totalStudents))}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><RefreshCw size={13} /> Reset to Proportional Distribution</span>
              </button>
            </div>

            {/* Grid of grade inputs */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
              marginBottom: 8,
            }}>
              {gradesOrder.map((g) => {
                const count = gradeCounts?.[g] ?? 0;
                const percentage = totalStudents > 0 ? ((count / totalStudents) * 100).toFixed(1) : '0.0';
                const boundary = gradeBoundaries[g];

                return (
                  <div key={g} style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.04)',
                    background: 'rgba(255,255,255,0.01)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={getGradeBadgeStyle(g)}>{g}</span>
                      {relativeGradingEnabled && boundary !== null && boundary !== undefined && (
                        <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>
                          ({fmt(boundary)}+)
                        </span>
                      )}
                    </div>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="1"
                      value={count}
                      style={{ fontSize: 13, padding: '6px 10px', height: 'auto', background: 'rgba(255,255,255,0.02)' }}
                      disabled={!relativeGradingEnabled}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setGradeCounts?.({
                          ...gradeCounts,
                          [g]: val,
                        });
                      }}
                    />
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                      {percentage}% of total
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>SID / Roll</th>
              {relativeGradingEnabled && <th>Grade</th>}
              {breakdownCols.map(col => (
                <th key={col} style={{ fontSize: 12 }}>{col}</th>
              ))}
              <th>{scoreLabel}</th>
            </tr>
          </thead>
          <tbody>
            {pagedStudents.length === 0 ? (
              <tr><td colSpan={99} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>No students found</td></tr>
            ) : pagedStudents.map((s, i) => (
              <tr
                key={s.roll || s.name || i}
                style={{ background: s.rank <= 3 ? 'rgba(250,204,21,0.04)' : 'transparent' }}
              >
                <td>
                  <span style={{ fontWeight: 700, fontSize: 15, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {s.rank <= 3
                      ? <>
                          <Trophy
                            size={16}
                            color={s.rank === 1 ? "#facc15" : s.rank === 2 ? "#94a3b8" : "#cd7c2f"}
                          />
                          <span style={{ color: s.rank === 1 ? "#facc15" : s.rank === 2 ? "#94a3b8" : "#cd7c2f" }}>
                            {s.rank === 1 ? '1st' : s.rank === 2 ? '2nd' : '3rd'}
                          </span>
                        </>
                      : `#${s.rank}`
                    }
                  </span>
                </td>
                <td style={{ fontWeight: s.rank <= 3 ? 600 : 400 }}>{s.name}</td>
                <td style={{ color: 'var(--muted)', fontSize: 13 }}>{s.roll || '—'}</td>
                {relativeGradingEnabled && (
                  <td>
                    <span style={getGradeBadgeStyle(s.grade)}>{s.grade || 'F'}</span>
                  </td>
                )}
                {breakdownCols.map(col => (
                  <td key={col} style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {fmt(s.breakdown?.[col]?.score?? '')}
                    <span style={{ fontSize: 10, opacity: 0.6 }}>
                      {s.breakdown?.[col]?.raw ? ` (${s.breakdown[col].raw})` : ''}
                    </span>
                  </td>
                ))}
                <td>
                  <span style={{
                    fontWeight: 700,
                    color: s.rank === 1 ? 'var(--color-warning)'
                         : s.rank === 2 ? 'var(--color-text-secondary)'
                         : s.rank === 3 ? 'var(--color-warning)'
                         : 'var(--text)',
                  }}>
                    {fmt(s.totalScore)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {filteredLeaderboard.length > PAGE_SIZE && (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
          marginTop: 16, flexWrap: 'wrap',
        }}>
          <button
            className="btn btn-outline btn-sm"
            disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
            style={{ fontSize: 12, padding: '4px 12px' }}
          >
            ‹ Prev
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const start = Math.max(0, Math.min(page - 3, totalPages - 7));
            const pageNum = start + i;
            if (pageNum >= totalPages) return null;
            return (
              <button
                key={pageNum}
                className="btn btn-outline btn-sm"
                style={{
                  fontSize: 12, padding: '4px 10px', minWidth: 32,
                  background: page === pageNum ? 'var(--color-accent-muted)' : 'transparent',
                  border: page === pageNum ? '1px solid rgba(99,102,241,0.4)' : '1px solid var(--border)',
                }}
                onClick={() => setPage(pageNum)}
              >
                {pageNum + 1}
              </button>
            );
          })}
          <button
            className="btn btn-outline btn-sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            style={{ fontSize: 12, padding: '4px 12px' }}
          >
            Next ›
          </button>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredLeaderboard.length)} of {filteredLeaderboard.length}
          </span>
        </div>
      )}
    </div>
  );
}