// components/BulkAttendanceUpload.jsx
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';

// ─── Styles (inline for portability) ─────────────────────────────────────────
const styles = {
  container:   { maxWidth: 700, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' },
  card:        { background: '#1e1e2e', borderRadius: 12, padding: 24, color: '#fff' },
  title:       { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  subtitle:    { fontSize: 14, color: '#aaa', marginBottom: 24 },
  dropzone:    { border: '2px dashed #555', borderRadius: 10, padding: 32, textAlign: 'center', cursor: 'pointer', marginBottom: 16, transition: 'border-color 0.2s' },
  dropzoneActive: { borderColor: '#6c63ff' },
  btn:         { background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  btnSecondary:{ background: '#2e2e3e', color: '#ccc', border: 'none', borderRadius: 8, padding: '10px 22px', cursor: 'pointer', fontWeight: 600, fontSize: 14, marginRight: 8 },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  success:     { background: '#1a3a2a', border: '1px solid #2e7d52', borderRadius: 8, padding: 16, marginTop: 16, color: '#4caf7d' },
  error:       { background: '#3a1a1a', border: '1px solid #7d2e2e', borderRadius: 8, padding: 16, marginTop: 16, color: '#f44336' },
  table:       { width: '100%', borderCollapse: 'collapse', marginTop: 12, fontSize: 13 },
  th:          { background: '#2a2a3e', padding: '8px 12px', textAlign: 'left', color: '#aaa' },
  td:          { padding: '8px 12px', borderBottom: '1px solid #333' },
  tag:         { display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 },
  tagPresent:  { background: '#1a3a2a', color: '#4caf7d' },
  tagAbsent:   { background: '#3a1a1a', color: '#f44336' },
};

export default function BulkAttendanceUpload() {
  const [file,      setFile]      = useState(null);
  const [preview,   setPreview]   = useState([]);
  const [result,    setResult]    = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [dragging,  setDragging]  = useState(false);
  const [error,     setError]     = useState('');
  const inputRef = useRef();

  // ── Parse Excel for preview ──────────────────────────────────────────────
  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      const wb   = XLSX.read(e.target.result, { type: 'binary' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      setPreview(rows.slice(0, 10)); // show first 10 rows
    };
    reader.readAsBinaryString(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  // ── Upload ───────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const res   = await axios.post(`${process.env.REACT_APP_API_URL}/attendance/upload`, formData, {
        headers: {
          'Content-Type':  'multipart/form-data',
          'Authorization': `Bearer ${token}`,
        },
      });

      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Download template ────────────────────────────────────────────────────
const downloadTemplate = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_API_URL}/attendance/template`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'attendance_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Template download failed:', err);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.title}>📤 Bulk Attendance Upload</div>
        <div style={styles.subtitle}>Upload an Excel file to mark attendance for multiple students at once.</div>

        {/* ── Dropzone ── */}
        <div
          style={{ ...styles.dropzone, ...(dragging ? styles.dropzoneActive : {}) }}
          onClick={() => inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          {file
            ? <span>📄 <strong>{file.name}</strong> — {(file.size / 1024).toFixed(1)} KB</span>
            : <span>🗂 Drag & drop an Excel file here, or <u>click to browse</u></span>
          }
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </div>

        {/* ── Buttons ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button style={styles.btnSecondary} onClick={downloadTemplate}>
            ⬇ Download Template
          </button>
          <button
            style={{ ...styles.btn, ...((!file || loading) ? styles.btnDisabled : {}) }}
            onClick={handleUpload}
            disabled={!file || loading}
          >
            {loading ? '⏳ Uploading...' : '🚀 Upload'}
          </button>
          {file && (
            <button style={styles.btnSecondary} onClick={() => { setFile(null); setPreview([]); setResult(null); }}>
              ✕ Clear
            </button>
          )}
        </div>

        {/* ── Preview ── */}
        {preview.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#aaa', marginBottom: 8 }}>
              📋 Preview (first {preview.length} rows):
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {Object.keys(preview[0]).map(k => (
                      <th key={k} style={styles.th}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((v, j) => (
                        <td key={j} style={styles.td}>
                          {String(v) === 'Present' && <span style={{ ...styles.tag, ...styles.tagPresent }}>Present</span>}
                          {String(v) === 'Absent'  && <span style={{ ...styles.tag, ...styles.tagAbsent  }}>Absent</span>}
                          {String(v) !== 'Present' && String(v) !== 'Absent' && String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && <div style={styles.error}>❌ {error}</div>}

        {/* ── Result ── */}
        {result && (
          <div style={styles.success}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>✅ Upload Complete</div>
            <div>✔ Inserted: <strong>{result.inserted}</strong></div>
            <div>🔄 Updated:  <strong>{result.updated}</strong></div>
            <div>⚠ Skipped:  <strong>{result.skipped}</strong></div>

            {result.errors?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ color: '#f44336', fontWeight: 600, marginBottom: 6 }}>
                  ⚠ Invalid Rows:
                </div>
                <table style={{ ...styles.table, fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Row</th>
                      <th style={styles.th}>SID</th>
                      <th style={styles.th}>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e, i) => (
                      <tr key={i}>
                        <td style={styles.td}>{e.row}</td>
                        <td style={styles.td}>{e.sid || '—'}</td>
                        <td style={{ ...styles.td, color: '#f44336' }}>{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}