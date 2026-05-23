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
    setLeaderboard(null);
    onResult?.(null);
  };

  const handleGenerate = async () => {
    if (!sources.length) {
      setError('Upload at least one PDF first.');
      return;
    }
    if (totalWeight <= 0) {
      setError('Total weight must be greater than zero.');
      return;
    }
    if (sources.some((s) => !String(s.label || '').trim())) {
      setError('Every PDF must have a label.');
      return;
    }
    if (sources.some((s) => !(s.selectedColumns?.length))) {
      setError('Each PDF must have at least one score column selected.');
      return;
    }
    if (sources.some((s) => getSourceFileWeight(s) <= 0)) {
      setError('Each PDF must have at least one score with a weight greater than zero.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        sources: sources.map((s) => ({
          id              : s.id,
          label           : s.label.trim(),
          weight          : getSourceFileWeight(s),
          columns         : s.columns,
          studentRows     : s.studentRows,
          selectedColumns : s.selectedColumns,
          columnWeights   : s.columnWeights,
        })),
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
    const students = leaderboard?.leaderboard?.[0]?.students || [];
    if (!students.length) {
      alert('No leaderboard data to export.');
      return;
    }

    const labels = (leaderboard.sources || sources).map((s) => s.label);
    const rows = students.map((s) => {
      const row = { Rank: s.rank, Name: s.name, Roll: s.roll || '' };
      labels.forEach((label) => {
        row[label] = s.breakdown?.[label]?.raw ?? 0;
      });
      row['Final Score'] = s.totalScore;
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leaderboard');
    XLSX.writeFile(wb, 'leaderboard.xlsx');
  };

  const handleReset = () => {
    setSources([]);
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
              {leaderboard.sources.map((s) => (
                <span
                  key={s.id || s.label}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: 'rgba(129,140,248,0.1)',
                    border: '1px solid rgba(129,140,248,0.25)',
                    color: '#a5b4fc',
                  }}
                >
                  {s.label}: w={s.weight} ({s.normalizedWeight * 100}%)
                </span>
              ))}
            </div>
          )}
          <Leaderboard
            data={leaderboard}
            onDownloadExcel={handleDownloadExcel}
            scoreLabel="Final Score"
          />
        </div>
      )}
    </>
  );
}
