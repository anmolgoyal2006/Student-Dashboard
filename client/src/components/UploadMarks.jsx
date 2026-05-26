/**
 * UploadMarks.jsx — dynamic multi-PDF leaderboard
 *
 * Flow:
 *   1. Select one or more PDFs → parse via POST /marks/parse-pdfs
 *   2. Set label + per-score weights (file weight is auto sum of column weights)
 *   3. Generate leaderboard → POST /marks/generate-leaderboard
 */
import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import Leaderboard from './Leaderboard';
import MarksFilter from './MarksFilter';
import WeightInput from './WeightInput';
import { marksService } from '../services/apiServices';

/** Sum of selected column weights for one PDF (drives file-level weight in merge). */
function getSourceFileWeight(src) {
  const selected = src.selectedColumns || [];
  const weights = src.columnWeights || {};
  const maxByCol = Object.fromEntries((src.columns || []).map((c) => [c.name, c.max]));
  return selected.reduce((sum, col) => {
    const w = weights[col];
    const effective = w !== undefined && w !== '' ? Number(w) : (maxByCol[col] || 0);
    return sum + (Number.isFinite(effective) ? effective : 0);
  }, 0);
}

export default function UploadMarks({ onResult }) {
  const [sources, setSources]       = useState([]);
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const [bestOfGroups, setBestOfGroups] = useState([]);
  const [relativeGradingEnabled, setRelativeGradingEnabled] = useState(false);
  const [gradeCounts, setGradeCounts] = useState({
    'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C+': 0, 'C': 0, 'D': 0, 'F': 0
  });

  const gradedStudents = useMemo(() => {
    const rawStudents = leaderboard?.leaderboard?.[0]?.students || [];
    if (!relativeGradingEnabled) return rawStudents;

    const gradesOrder = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'];
    let idx = 0;
    return rawStudents.map((s) => {
      let grade = 'F';
      let cumulative = 0;
      for (const g of gradesOrder) {
        const quota = parseInt(gradeCounts[g]) || 0;
        cumulative += quota;
        if (idx < cumulative) {
          grade = g;
          break;
        }
      }
      idx++;
      return { ...s, grade };
    });
  }, [leaderboard, relativeGradingEnabled, gradeCounts]);

  const totalWeight = useMemo(
    () => sources.reduce((s, src) => s + getSourceFileWeight(src), 0),
    [sources]
  );

  const normalizedPreview = useMemo(() => {
    if (totalWeight <= 0) return {};
    return Object.fromEntries(
      sources.map((src) => {
        const fw = getSourceFileWeight(src);
        return [src.id, Math.round((fw / totalWeight) * 10000) / 100];
      })
    );
  }, [sources, totalWeight]);

  const formatParsedSource = (s) => {
    const cols = s.columns || [];
    const defaultColWeights = Object.fromEntries(
      cols.map((c) => [c.name, s.columnWeights?.[c.name] ?? c.max])
    );
    return {
      ...s,
      selectedColumns: s.selectedColumns?.length
        ? s.selectedColumns
        : cols.map((c) => c.name),
      columnWeights: { ...defaultColWeights, ...(s.columnWeights || {}) },
      studentLimit: s.studentLimit !== undefined ? s.studentLimit : s.studentCount,
    };
  };

  const handleFilesSelected = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) =>
      f.name.toLowerCase().endsWith('.pdf')
    );
    if (!files.length) {
      setError('Please select at least one PDF file.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const form = new FormData();
      files.forEach((f) => form.append('files', f));

      const res = await marksService.parsePdfs(form);
      const incoming = (res.data.sources || []).map(formatParsedSource);

      let addedCount = 0;
      setSources((prev) => {
        const existingFiles = new Set(
          prev.map((p) => (p.fileName || '').toLowerCase())
        );
        const novel = incoming.filter(
          (s) => !existingFiles.has((s.fileName || '').toLowerCase())
        );
        addedCount = novel.length;
        return novel.length ? [...prev, ...novel] : prev;
      });

      if (addedCount) {
        setLeaderboard(null);
        onResult?.(null);
        setError('');
      } else if (incoming.length) {
        setError('Those PDF(s) are already in the list.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to parse PDFs.');
    } finally {
      setLoading(false);
    }
  };

  const updateSource = (id, field, value) => {
    setSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const updateSourceNested = (id, patch) => {
    setSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  const removeSource = (id) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
    setBestOfGroups((prev) =>
      prev.map((g) => ({
        ...g,
        items: (g.items || []).filter((item) => item.sourceId !== id),
      })).filter((g) => (g.items || []).length > 0)
    );
    setLeaderboard(null);
    onResult?.(null);
  };

  const addBestOfGroup = () => {
    setBestOfGroups((prev) => [
      ...prev,
      { id: `bg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, bestOf: 2, items: [] },
    ]);
  };

  const updateBestOfGroup = (id, patch) => {
    setBestOfGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const removeBestOfGroup = (id) => {
    setBestOfGroups((prev) => prev.filter((g) => g.id !== id));
  };

  const addItemToGroup = (groupId) => {
    const firstSrc = sources[0];
    const firstCol = firstSrc?.columns?.[0]?.name || '';
    setBestOfGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return { ...g, items: [...g.items, { sourceId: firstSrc?.id || '', columnName: firstCol }] };
      })
    );
  };

  const updateItemInGroup = (groupId, itemIndex, patch) => {
    setBestOfGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const items = (g.items || []).map((item, idx) =>
          idx === itemIndex ? { ...item, ...patch } : item
        );
        return { ...g, items };
      })
    );
  };

  const removeItemFromGroup = (groupId, itemIndex) => {
    setBestOfGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return { ...g, items: (g.items || []).filter((_, idx) => idx !== itemIndex) };
      })
    );
  };

  const handleGenerate = async () => {
    if (!sources.length) {
      setError('Upload at least one PDF first.');
      return;
    }

    // ── Compute best-of column map (used for validations + payload) ──
    const bestOfColsBySource = new Map();
    for (const g of bestOfGroups) {
      for (const item of (g.items || [])) {
        if (!bestOfColsBySource.has(item.sourceId)) {
          bestOfColsBySource.set(item.sourceId, new Set());
        }
        bestOfColsBySource.get(item.sourceId).add(item.columnName);
      }
    }

    const isSourceCoveredByBestOf = (s) => {
      const cols = bestOfColsBySource.get(s.id);
      if (!cols || cols.size === 0) return false;
      const allSourceCols = new Set((s.columns || []).map((c) => c.name));
      return [...cols].every((c) => allSourceCols.has(c));
    };

    if (totalWeight <= 0 && sources.some((s) => !isSourceCoveredByBestOf(s))) {
      setError('Total weight must be greater than zero.');
      return;
    }
    if (sources.some((s) => !String(s.label || '').trim())) {
      setError('Every PDF must have a label.');
      return;
    }
    // Allow 0 selected columns if source is fully covered by best-of groups
    if (sources.some((s) => {
      if (s.selectedColumns?.length) return false;
      return !isSourceCoveredByBestOf(s);
    })) {
      setError('Each PDF must have at least one score column selected.');
      return;
    }
    // Weight check: skip sources fully covered by best-of
    if (sources.some((s) => {
      if (isSourceCoveredByBestOf(s)) return false;
      return getSourceFileWeight(s) <= 0;
    })) {
      setError('Each PDF must have at least one score with a weight greater than zero.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const bestOfConfigs = bestOfGroups
        .filter((g) => (g.items || []).length >= 1)
        .map((g) => ({
          items: (g.items || []).map((item) => ({
            sourceId: item.sourceId,
            columnName: item.columnName,
          })),
          bestOf: Math.max(1, parseInt(g.bestOf, 10) || 2),
        }));

      const groupedIds = new Set(
        bestOfConfigs.flatMap((c) => c.items.map((i) => i.sourceId))
      );

      const payload = {
        sources: sources.map((s) => {
          // Auto-include best-of columns so breakdown data is available
          const bestOfCols = bestOfColsBySource.get(s.id);
          let selectedColumns = s.selectedColumns || [];
          if (bestOfCols) {
            const merged = new Set(selectedColumns);
            for (const col of bestOfCols) merged.add(col);
            selectedColumns = [...merged];
          }
          return {
            id              : s.id,
            label           : s.label.trim(),
            weight          : isSourceCoveredByBestOf(s) ? 0 : getSourceFileWeight(s),
            columns         : s.columns,
            studentRows     : s.studentLimit ? s.studentRows.slice(0, s.studentLimit) : s.studentRows,
            selectedColumns,
            columnWeights   : s.columnWeights,
            studentLimit    : s.studentLimit || s.studentRows.length,
          };
        }),
        bestOfConfigs,
        relativeGradingEnabled,
        gradeCounts,
      };

      const res = await marksService.generateLeaderboard(payload);

      setLeaderboard(res.data);
      onResult?.(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate leaderboard.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    if (!gradedStudents.length) {
      alert('No leaderboard data to export.');
      return;
    }

    const labels = (leaderboard.sources || sources).map((s) => s.label);
    const rows = gradedStudents.map((s) => {
      const row = { Rank: s.rank, Name: s.name, Roll: s.roll || '' };
      labels.forEach((label) => {
        row[label] = s.breakdown?.[label]?.raw ?? 0;
      });
      row['Final Score'] = s.totalScore;
      if (relativeGradingEnabled) {
        row['Grade'] = s.grade || 'F';
      }
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leaderboard');
    XLSX.writeFile(wb, 'leaderboard.xlsx');
  };

  const handleReset = () => {
    setSources([]);
    setBestOfGroups([]);
    setLeaderboard(null);
    setError('');
    onResult?.(null);
  };

  return (
    <>
      <div className="card">
        <div className="card-title">📄 Upload Marks PDFs</div>
        <p className="text-muted" style={{ marginBottom: 16 }}>
          Upload PDFs one batch or use &quot;+ Add more PDFs&quot; to keep earlier files. Students are
          matched by name across PDFs. Set weights on each score — file weight is calculated automatically.
        </p>

        <div
          style={{
            border: '2px dashed var(--card-border)',
            borderRadius: 10,
            padding: 24,
            textAlign: 'center',
            marginBottom: 16,
            cursor: 'pointer',
          }}
          onClick={() => document.getElementById('pdf-multi-input').click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFilesSelected(e.dataTransfer.files);
          }}
        >
          <span>🗂 Drag & drop PDFs here, or <u>click to browse</u></span>
          <input
            id="pdf-multi-input"
            type="file"
            accept=".pdf"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {sources.length > 0 && (
          <>
            <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--muted)' }}>
              {sources.length} PDF{sources.length > 1 ? 's' : ''} loaded · total weight:{' '}
              <strong style={{ color: 'var(--text)' }}>{totalWeight}</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {sources.map((src) => (
                <div
                  key={src.id}
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>📄 {src.fileName}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {src.studentCount} students · {src.columns?.length || 0} score column(s)
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: 11, flexShrink: 0 }}
                      onClick={() => removeSource(src.id)}
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 0 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Label</label>
                      <input
                        className="form-input"
                        type="text"
                        value={src.label}
                        placeholder="e.g. Mid Sem, Quiz 1"
                        onChange={(e) => updateSource(src.id, 'label', e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Include first N students</label>
                      <input
                        className="form-input"
                        type="number"
                        min="1"
                        max={src.studentCount}
                        value={src.studentLimit !== undefined ? src.studentLimit : src.studentCount}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Math.max(1, Math.min(src.studentCount, parseInt(e.target.value) || 1));
                          updateSource(src.id, 'studentLimit', val);
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
                    File weight (auto):{' '}
                    <strong style={{ color: '#818cf8' }}>{getSourceFileWeight(src)}</strong>
                    {totalWeight > 0 && (
                      <span style={{ marginLeft: 8, color: '#a5b4fc' }}>
                        · {normalizedPreview[src.id] ?? 0}% of total
                      </span>
                    )}
                  </div>

                  {src.columns?.length > 0 && (
                    <>
                      <div style={{ marginTop: 14, marginBottom: 4, fontSize: 12, fontWeight: 600 }}>
                        Scores in this PDF
                      </div>
                      <MarksFilter
                        columns={src.columns}
                        selected={src.selectedColumns || []}
                        onChange={(selected) =>
                          updateSourceNested(src.id, { selectedColumns: selected })
                        }
                      />
                      <WeightInput
                        columns={src.columns}
                        selectedColumns={src.selectedColumns || []}
                        weights={src.columnWeights || {}}
                        onChange={(columnWeights) =>
                          updateSourceNested(src.id, { columnWeights })
                        }
                      />
                    </>
                  )}
                </div>
              ))}
            </div>

            {sources.length >= 1 && (
              <div
                style={{
                  marginTop: 8,
                  marginBottom: 12,
                  padding: 14,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'rgba(52,211,153,0.04)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                  🎯 Best-Of Groups
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                  Group multiple PDFs so each student&apos;s <strong>top N</strong> scores are used
                  (e.g. best 2 out of 3 midterms). Sources in a group skip weighted averaging.
                </p>

                {bestOfGroups.map((g) => (
                  <div
                    key={g.id}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>Best</span>
                        <input
                          className="form-input"
                          type="number"
                          min="1"
                          max={Math.max(1, (g.items || []).length)}
                          value={g.bestOf}
                          onChange={(e) => updateBestOfGroup(g.id, { bestOf: Math.max(1, parseInt(e.target.value) || 1) })}
                          style={{ width: 60, textAlign: 'center' }}
                        />
                        <span style={{ fontSize: 13 }}>of {(g.items || []).length}</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: 11, flexShrink: 0 }}
                        onClick={() => removeBestOfGroup(g.id)}
                      >
                        ✕ Remove group
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(g.items || []).map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <select
                            className="form-select"
                            value={item.sourceId}
                            onChange={(e) => {
                              const src = sources.find((s) => s.id === e.target.value);
                              const firstCol = src?.columns?.[0]?.name || '';
                              updateItemInGroup(g.id, idx, { sourceId: e.target.value, columnName: firstCol });
                            }}
                            style={{ flex: 1, fontSize: 12, color: 'var(--text)', background: 'var(--bg-2)' }}
                          >
                            {sources.map((src) => (
                              <option key={src.id} value={src.id}>
                                {src.label}
                              </option>
                            ))}
                          </select>
                          <select
                            className="form-select"
                            value={item.columnName}
                            onChange={(e) => updateItemInGroup(g.id, idx, { columnName: e.target.value })}
                            style={{ flex: 1, fontSize: 12, color: 'var(--text)', background: 'var(--bg-2)' }}
                          >
                            {(sources.find((s) => s.id === item.sourceId)?.columns || []).map((col) => (
                              <option key={col.name} value={col.name}>
                                {col.name} ({col.max})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ fontSize: 11, flexShrink: 0 }}
                            onClick={() => removeItemFromGroup(g.id, idx)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      className="btn btn-outline btn-sm"
                      style={{ marginTop: 8 }}
                      onClick={() => addItemToGroup(g.id)}
                    >
                      + Add score
                    </button>
                  </div>
                ))}

                <button className="btn btn-outline btn-sm" onClick={addBestOfGroup}>
                  + Add Group
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={loading || !sources.length}
              >
                {loading ? '⏳ Generating…' : '🏆 Generate Leaderboard'}
              </button>
              <button
                className="btn btn-outline"
                onClick={() => document.getElementById('pdf-multi-input').click()}
                disabled={loading}
              >
                + Add more PDFs
              </button>
              <button className="btn btn-outline" onClick={handleReset} disabled={loading}>
                ✕ Clear all
              </button>
            </div>
          </>
        )}

        {!sources.length && (
          <button
            className="btn btn-primary"
            disabled={loading}
            onClick={() => document.getElementById('pdf-multi-input').click()}
          >
            {loading ? '⏳ Parsing PDFs…' : '🚀 Select PDFs'}
          </button>
        )}

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 8,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#f87171',
              fontSize: 13,
            }}
          >
            ❌ {error}
          </div>
        )}
      </div>

      {leaderboard && (
        <div className="card" style={{ marginTop: 16 }}>
          {leaderboard.sources?.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 14,
                fontSize: 12,
              }}
            >
              {leaderboard.sources.map((s) => {
                const isBestOf = s.isBestOf || s.bestOfGroup;
                const colsInfo = s.bestOfColumns?.length ? ` columns: ${s.bestOfColumns.join(', ')}` : '';
                return (
                  <span
                    key={s.id || s.label}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: isBestOf ? 'rgba(52,211,153,0.1)' : 'rgba(129,140,248,0.1)',
                      border: `1px solid ${isBestOf ? 'rgba(52,211,153,0.25)' : 'rgba(129,140,248,0.25)'}`,
                      color: isBestOf ? '#34d399' : '#a5b4fc',
                    }}
                  >
                    {s.label}{isBestOf
                      ? ` (best ${s.bestOfGroup.bestOf}/${s.bestOfGroup.total}${colsInfo})`
                      : `: w=${s.weight} (${Math.round(s.normalizedWeight * 100)}%)`
                    }
                  </span>
                );
              })}
            </div>
          )}
          <Leaderboard
            data={{
              ...leaderboard,
              leaderboard: leaderboard.leaderboard ? [{
                ...leaderboard.leaderboard[0],
                students: gradedStudents
              }] : []
            }}
            onDownloadExcel={handleDownloadExcel}
            scoreLabel="Final Score"
            relativeGradingEnabled={relativeGradingEnabled}
            setRelativeGradingEnabled={setRelativeGradingEnabled}
            gradeCounts={gradeCounts}
            setGradeCounts={setGradeCounts}
          />
        </div>
      )}
    </>
  );
}
