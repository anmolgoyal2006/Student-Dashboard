// components/BulkAttendanceUpload.jsx
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { FileSpreadsheet, Download, Upload, Link2, AlertCircle, CheckCircle } from 'lucide-react';
import toast from '../context/ToastContext';

export default function BulkAttendanceUpload({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const inputRef = useRef();

  // Parse Excel for preview
  const handleFile = (f) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit.');
      return;
    }
    setFile(f);
    setResult(null);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        setPreview(rows.slice(0, 5)); // show first 5 rows for preview
      } catch (err) {
        console.error(err);
        toast.error('Failed to parse Excel file preview.');
      }
    };
    reader.readAsBinaryString(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  // Upload
  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/attendance/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`,
        },
      });

      setResult(res.data);
      toast.success(`Attendance marked for ${res.data.inserted} students`);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Upload failed. Please try again.';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // URL Link Upload
  const handleUrlUpload = async () => {
    if (!url.trim() || !url.trim().startsWith('http')) return;
    setUrlLoading(true);
    setError('');
    setResult(null);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/attendance/upload-url`, {
        url: url.trim()
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      setResult(res.data);
      toast.success(`Attendance marked for ${res.data.inserted} students`);
      setUrl('');
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?.error || 'Failed to process Excel sheet from the link.';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setUrlLoading(false);
    }
  };

  // Download template
  const downloadTemplate = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_API_URL}/attendance/template`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const templateUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = templateUrl;
      a.download = 'attendance_template.xlsx';
      a.click();
      URL.revokeObjectURL(templateUrl);
      toast.success('Template downloaded successfully.');
    } catch (err) {
      console.error('Template download failed:', err);
      toast.error('Failed to download template.');
    }
  };

  const showUrlError = url.trim() !== '' && !url.trim().startsWith('http');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      {/* Drag & Drop Zone */}
      <div
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          height: 140,
          border: dragging ? '1.5px solid var(--color-accent)' : '1.5px dashed rgba(99, 102, 241, 0.35)',
          background: dragging ? 'rgba(99, 102, 241, 0.06)' : 'rgba(255, 255, 255, 0.01)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          gap: 6,
          padding: '0 16px',
        }}
      >
        <FileSpreadsheet size={32} color="var(--color-accent)" style={{ opacity: 0.9 }} />
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
          {file ? file.name : 'Drop your Excel file here'}
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
          {file ? `${(file.size / 1024).toFixed(1)} KB` : 'XLS, XLSX up to 10MB'}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={downloadTemplate}
          className="btn btn-outline"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, background: 'transparent' }}
        >
          <Download size={15} /> Download template
        </button>
        
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || loading}
          className="btn btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            opacity: (!file || loading) ? 0.5 : 1,
            cursor: (!file || loading) ? 'not-allowed' : 'pointer'
          }}
        >
          <Upload size={15} />
          {loading ? 'Uploading...' : 'Upload'}
        </button>

        {file && (
          <button
            type="button"
            className="btn btn-outline"
            style={{ fontSize: 13, color: 'var(--color-text-secondary)', background: 'transparent', borderColor: 'var(--border)' }}
            onClick={() => { setFile(null); setPreview([]); setResult(null); setError(''); }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', margin: '8px 0', gap: 12 }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.06)' }} />
        <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)', fontWeight: 500, textTransform: 'none' }}>
          Or paste a OneDrive / Excel link
        </span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.06)' }} />
      </div>

      {/* OneDrive URL flex input */}
      <div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            className="form-input"
            style={{ flex: 1, height: 38 }}
            placeholder="Paste OneDrive or direct Excel link (https://...)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading || urlLoading}
          />
          <button
            type="button"
            onClick={handleUrlUpload}
            disabled={!url.trim() || showUrlError || loading || urlLoading}
            className="btn btn-primary"
            style={{
              width: 140,
              height: 38,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              opacity: (!url.trim() || showUrlError || loading || urlLoading) ? 0.5 : 1,
              cursor: (!url.trim() || showUrlError || loading || urlLoading) ? 'not-allowed' : 'pointer',
              flexShrink: 0
            }}
          >
            <Link2 size={15} />
            {urlLoading ? 'Fetching...' : 'Fetch & upload'}
          </button>
        </div>
        {showUrlError && (
          <div style={{ color: 'var(--color-danger, var(--color-danger))', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={12} /> Please paste a valid link
          </div>
        )}
      </div>

      {/* Preview table */}
      {preview.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 6, fontWeight: 500 }}>
            Previewing first {preview.length} rows:
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-3)' }}>
                  {Object.keys(preview[0]).map(k => (
                    <th key={k} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} style={{ borderBottom: i < preview.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    {Object.values(row).map((v, j) => {
                      const val = String(v).trim().toLowerCase();
                      const isPresent = val === 'present' || val === 'p';
                      const isAbsent = val === 'absent' || val === 'a';
                      return (
                        <td key={j} style={{ padding: '6px 10px', color: 'var(--color-text-primary)' }}>
                          {isPresent && <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Present</span>}
                          {isAbsent && <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>Absent</span>}
                          {!isPresent && !isAbsent && String(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result report logs */}
      {result && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.08)',
          border: '1.5px solid rgba(34, 197, 94, 0.2)',
          borderRadius: 'var(--radius-md)',
          padding: 14,
          marginTop: 10,
          color: 'var(--color-text-primary)'
        }}>
          <div style={{ fontWeight: 600, color: 'var(--color-success)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle size={16} /> Upload completed
          </div>
          <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div>Successfully imported: <strong>{result.inserted}</strong></div>
            <div>Updated records: <strong>{result.updated}</strong></div>
            <div>Skipped records: <strong>{result.skipped}</strong></div>
          </div>

          {result.errors?.length > 0 && (
            <div style={{ marginTop: 10, borderTop: '1px solid rgba(34, 197, 94, 0.15)', paddingTop: 10 }}>
              <div style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: 12.5, marginBottom: 4 }}>
                Skipped rows details:
              </div>
              <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: 'var(--color-text-secondary)' }}>
                      <th style={{ textAlign: 'left', padding: '2px 4px' }}>Row</th>
                      <th style={{ textAlign: 'left', padding: '2px 4px' }}>SID</th>
                      <th style={{ textAlign: 'left', padding: '2px 4px' }}>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                        <td style={{ padding: '2px 4px' }}>{e.row}</td>
                        <td style={{ padding: '2px 4px' }}>{e.sid || '—'}</td>
                        <td style={{ padding: '2px 4px', color: 'var(--color-danger)' }}>{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}