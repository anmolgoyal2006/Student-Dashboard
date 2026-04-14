/**
 * UploadMarks.jsx  (FIXED)
 *
 * Key fixes:
 *  1. Passes onDownloadExcel to Leaderboard (Excel is a separate /rank call
 *     with exportExcel:true — backend sends a binary buffer, not base64)
 *  2. WeightInput is now included inline (was missing as a separate file)
 *  3. rankPayload is stored so Excel re-uses the same columns/weights
 */
import { useState } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';
import MarksFilter from './MarksFilter';
import Leaderboard from './Leaderboard';
import WeightInput from './WeightInput';

const API = process.env.REACT_APP_API_URL;

const STEP_UPLOAD    = 'upload';
const STEP_CONFIGURE = 'configure';
const STEP_DONE      = 'done';

export default function UploadMarks({ onResult }) {
  const [file,            setFile]            = useState(null);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');
  const [step,            setStep]            = useState(STEP_UPLOAD);

  const [parsedData,      setParsedData]      = useState(null);
  const [columns,         setColumns]         = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [weights,         setWeights]         = useState({});
  const [originalMax,     setOriginalMax]     = useState({});

  // Leaderboard result (shown inline here after STEP_DONE)
  const [leaderboard,     setLeaderboard]     = useState(null);

  // Stored so Excel re-uses same payload

  // ── Step 1: Upload ──────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError('');

    try {
      const form  = new FormData();
      form.append('file', file);

      const token = localStorage.getItem('token');
      const res   = await axios.post(`${API}/marks/upload-pdf`, form, {
        headers: {
          'Content-Type' : 'multipart/form-data',
          'Authorization': `Bearer ${token}`,
        },
      });

      // Backend returns: { studentRows, columns: [{ name, max }], method }
      const { studentRows, columns: detectedCols } = res.data;

      setParsedData({ studentRows });
      setColumns(detectedCols);

      const defaultW = {};
      const maxMap   = {};
      detectedCols.forEach(c => {
        defaultW[c.name] = c.max;
        maxMap[c.name]   = c.max;
      });

      setSelectedColumns(detectedCols.map(c => c.name));
      setWeights(defaultW);
      setOriginalMax(maxMap);
      setStep(STEP_CONFIGURE);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Generate leaderboard ────────────────────────────────────────
  const handleRank = async () => {
    if (!selectedColumns.length) {
      setError('Please select at least one column.');
      return;
    }
    setLoading(true);
    setError('');

try {
  const token = localStorage.getItem('token');

  const form = new FormData();
  form.append('file', file);
  form.append('selectedColumns', JSON.stringify(selectedColumns));
  form.append('weights', JSON.stringify(weights));

  const res = await axios.post(`${API}/marks/upload-pdf`, form, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'Authorization': `Bearer ${token}`,
    },
  });

  setLeaderboard(res.data);
  onResult(res.data);
  setStep(STEP_DONE);
    } catch (err) {
      setError(err.response?.data?.message || 'Ranking failed.');
    } finally {
      setLoading(false);
    }
  };

  // ── Excel download (separate request with exportExcel:true) ─────────────
const handleDownloadExcel = () => {
    try {
      if (!leaderboard?.leaderboard) {
        alert('No leaderboard data to export.');
        return;
      }

      // Build rows from leaderboard data
      const students = leaderboard?.leaderboard?.[0]?.students || [];

const rows = students.map(s => {
        const row = {
          Rank : s.rank,
          Name : s.name,
          Roll : s.roll || '',
        };
        // Add breakdown columns
        if (s.breakdown) {
          Object.entries(s.breakdown).forEach(([col, val]) => {
            row[col] = val?.score ?? val ?? '';
          });
        }
        row['Total'] = s.totalScore ?? s.total ?? '';
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Leaderboard');
      XLSX.writeFile(wb, 'leaderboard.xlsx');
    } catch (err) {
      alert('Excel export failed: ' + err.message);
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setFile(null);
    setError('');
    setStep(STEP_UPLOAD);
    setParsedData(null);
    setColumns([]);
    setSelectedColumns([]);
    setWeights({});
    setLeaderboard(null);
    onResult(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <div className="card">
        <div className="card-title">📄 Upload Marks PDF</div>

        {/* STEP 1 — File picker */}
        {step === STEP_UPLOAD && (
          <>
            <p className="text-muted" style={{ marginBottom: 16 }}>
              Upload a PDF with student names and marks to generate a ranked leaderboard.
            </p>

            <div
              style={{
                border      : '2px dashed var(--card-border)',
                borderRadius: 10,
                padding     : 24,
                textAlign   : 'center',
                marginBottom: 16,
                cursor      : 'pointer',
              }}
              onClick={() => document.getElementById('pdf-input').click()}
            >
              {file
                ? <span>📄 <strong>{file.name}</strong> — {(file.size / 1024).toFixed(1)} KB</span>
                : <span>🗂 Drag & drop a PDF, or <u>click to browse</u></span>
              }
              <input
                id="pdf-input"
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={e => setFile(e.target.files[0])}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={!file || loading}
              >
                {loading ? '⏳ Parsing PDF…' : '🚀 Upload & Detect Columns'}
              </button>
              {file && (
                <button className="btn btn-outline" onClick={() => { setFile(null); setError(''); }}>
                  ✕ Clear
                </button>
              )}
            </div>
          </>
        )}

        {/* STEP 2 — Configure */}
        {step === STEP_CONFIGURE && (
          <>
            <div style={{
              display     : 'flex', alignItems: 'center', gap: 8,
              marginBottom: 20, padding: '10px 14px', borderRadius: 8,
              background  : 'rgba(129,140,248,0.07)',
              border      : '1px solid rgba(129,140,248,0.2)',
            }}>
              <span style={{ fontSize: 13, color: '#818cf8', fontWeight: 600 }}>
                ✅ {parsedData?.studentRows?.length ?? 0} students detected
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>·</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {columns.length} columns found
              </span>
              <button
                style={{
                  marginLeft: 'auto', fontSize: 11, color: 'var(--muted)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  textDecoration: 'underline',
                }}
                onClick={handleReset}
              >
                ← Upload different file
              </button>
            </div>

            <MarksFilter
              columns={columns}
              selected={selectedColumns}
              onChange={setSelectedColumns}
            />

            <WeightInput
              columns={columns}
              selectedColumns={selectedColumns}
              weights={weights}
              onChange={setWeights}
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-primary"
                onClick={handleRank}
                disabled={loading || selectedColumns.length === 0}
              >
                {loading ? '⏳ Ranking…' : '🏆 Generate Leaderboard'}
              </button>
              <button className="btn btn-outline" onClick={handleReset}>✕ Cancel</button>
            </div>
          </>
        )}

        {/* STEP 3 — Done banner */}
        {step === STEP_DONE && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px', borderRadius: 8,
            background: 'rgba(34,197,94,0.07)',
            border: '1px solid rgba(34,197,94,0.2)',
          }}>
            <span style={{ fontSize: 13, color: '#4ade80', fontWeight: 600 }}>
              ✅ Leaderboard generated
            </span>
            <button
              className="btn btn-outline btn-sm"
              style={{ marginLeft: 'auto', fontSize: 11 }}
              onClick={handleReset}
            >
              Upload another PDF
            </button>
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 12, padding: 12, borderRadius: 8,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171', fontSize: 13,
          }}>
            ❌ {error}
          </div>
        )}
      </div>

      {/* ── Leaderboard shown right below the upload card ── */}
      {leaderboard && step === STEP_DONE && (
        <div className="card" style={{ marginTop: 16 }}>
          <Leaderboard
            data={leaderboard}
            onDownloadExcel={handleDownloadExcel}
          />
        </div>
      )}
    </>
  );
}