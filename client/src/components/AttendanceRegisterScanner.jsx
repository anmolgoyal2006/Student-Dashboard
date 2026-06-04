// src/components/AttendanceRegisterScanner.jsx
import { useState, useRef, useCallback } from "react";
import Tesseract from "tesseract.js";
import * as XLSX from "xlsx";

// ─── Enhanced Parser ──────────────────────────────────────────────────────────
function parseOcrText(rawText, fallbackSubject = "", fallbackDate = "") {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  const results = [];

  // More flexible SID: pure numbers 4-8 digits, or letters+digits
  const sidRe = /\b([A-Z]{0,3}\d{4,8}|[A-Z]\d{2,6}|\d{4,8})\b/i;
 const dateRe = /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{1,2}[-/]\d{1,2}[-/]\d{2})/;

  // Handwriting-aware status: catches P, A, p, a, ✓, ✗, 'pres', 'abs', etc.
  const presentRe = /\b(present|pres|p)\b|✓|√/i;
  const absentRe  = /\b(absent|abs|a)\b|✗|×|x\b/i;

  // Skip lines that are clearly headers or footers
  const skipRe = /^(sid|roll|name|student|date|status|subject|class|total|sign|teacher|sr\.?\s*no|no\.)/i;

  for (const line of lines) {
    if (skipRe.test(line)) continue;
    if (line.replace(/\s/g, "").length < 2) continue;

    const sidMatch    = line.match(sidRe);
    const dateMatch   = line.match(dateRe);
    const isPresentMatch = presentRe.test(line);
    const isAbsentMatch  = absentRe.test(line);

    // Need at least a SID or a status to be a valid row
    if (!sidMatch && !isPresentMatch && !isAbsentMatch) continue;

    // Determine status
    let status = "UNKNOWN";
    if (isPresentMatch && !isAbsentMatch) status = "Present";
    else if (isAbsentMatch && !isPresentMatch) status = "Absent";
    else if (isPresentMatch && isAbsentMatch) {
      // Both matched — pick whichever appears first in the line
      const pIdx = line.search(presentRe);
      const aIdx = line.search(absentRe);
      status = pIdx < aIdx ? "Present" : "Absent";
    }

    // Normalise date
    let date = fallbackDate;
    if (dateMatch) {
      const raw = dateMatch[1].replace(/\//g, "-");
      if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(raw)) {
        const parts = raw.split("-");
        date = `${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`;
      } else if (/^\d{1,2}-\d{1,2}-\d{2}$/.test(raw)) {
        const parts = raw.split("-");
        date = `20${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`;
      } else {
        date = raw;
      }
    }

    // Infer subject from leftover text
    let subject = fallbackSubject;
    if (!subject) {
      const leftover = line
        .replace(sidRe, "")
        .replace(dateRe, "")
        .replace(presentRe, "")
        .replace(absentRe, "")
        .replace(/[|,\t\-_]+/g, " ")
        .trim();
      const words = leftover.split(/\s+/).filter((w) => w.length > 2 && /[a-zA-Z]/.test(w));
      if (words.length) subject = words[words.length - 1];
    }

    results.push({
      sid: sidMatch ? sidMatch[1].toUpperCase() : "",
      date,
      status,
      subject,
    });
  }

  return results;
}

// ─── Image preprocessing: converts to high-contrast grayscale ─────────────────
function preprocessImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Scale up small images for better OCR
      const scale = Math.max(1, Math.min(3, 2000 / Math.max(img.width, img.height)));
      canvas.width  = img.width  * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");

      // White background
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Grayscale + contrast boost
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        // Grayscale
        const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        // Contrast stretch: push toward black or white
        const contrasted = gray < 128 ? Math.max(0, gray - 40) : Math.min(255, gray + 40);
        data[i] = data[i+1] = data[i+2] = contrasted;
      }
      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        resolve(blob);
      }, "image/png");
    };
    img.src = url;
  });
}

// ─── Excel builder ────────────────────────────────────────────────────────────
function buildExcelBlob(rows) {
  const wsData = [
    ["SID", "Date", "Status", "Subject"],
    ...rows.map((r) => [r.sid, r.date, r.status, r.subject]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = ["Present", "Absent", "Late", "UNKNOWN"];

export default function AttendanceRegisterScanner({
  uploadUrl = "/api/attendance/upload",
}) {
  const [stage, setStage]               = useState("idle");
  const [ocrProgress, setOcrProgress]   = useState(0);
  const [ocrLog, setOcrLog]             = useState("");
  const [rawOcrText, setRawOcrText]     = useState("");
  const [showRaw, setShowRaw]           = useState(false);
  const [rows, setRows]                 = useState([]);
  const [globalSubject, setGlobalSubject] = useState("");
  const [globalDate, setGlobalDate]     = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [errorMsg, setErrorMsg]         = useState("");
  const fileInputRef = useRef(null);

  // ── Step 1: Select image ─────────────────────────────────────────────────
  const handleImageSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImagePreviewUrl(URL.createObjectURL(file));
    setStage("ocr");
    setOcrProgress(0);
    setOcrLog("Preprocessing image…");
    setRows([]);
    setRawOcrText("");
    setErrorMsg("");

    try {
      // Preprocess for better handwriting recognition
      const processedBlob = await preprocessImage(file);

      setOcrLog("Running OCR…");

      const result = await Tesseract.recognize(processedBlob, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setOcrProgress(Math.round(m.progress * 100));
          }
          setOcrLog(m.status);
        },
        // Tesseract config tuned for register tables
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 /-:.,|✓✗",
        tessedit_pageseg_mode: "6", // Assume single uniform block of text
      });

      const text = result.data.text;
      setRawOcrText(text);

      const parsed = parseOcrText(text, globalSubject, globalDate);

      if (parsed.length === 0) {
        setErrorMsg(
          "OCR completed but no rows detected. See raw text below to understand what was read. " +
          "Tips: use better lighting, hold camera directly above, ensure text is horizontal."
        );
        setShowRaw(true);
        setStage("error");
        return;
      }

      setRows(parsed);
      setStage("parsed");
    } catch (err) {
      setErrorMsg("OCR failed: " + (err?.message ?? String(err)));
      setStage("error");
    }
  }, [globalSubject, globalDate]);

  // ── Table editing ────────────────────────────────────────────────────────
  const updateRow = (idx, field, value) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { sid: "", date: globalDate, status: "Present", subject: globalSubject },
    ]);

  const removeRow = (idx) =>
    setRows((prev) => prev.filter((_, i) => i !== idx));

  const applyGlobals = () =>
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        subject: globalSubject || r.subject,
        date:    globalDate    || r.date,
      }))
    );

  // ── Download Excel ───────────────────────────────────────────────────────
  const downloadExcel = () => {
    const blob = buildExcelBlob(rows);
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `attendance_${globalDate || "scan"}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const invalid = rows.filter((r) => !r.sid || r.status === "UNKNOWN");
    if (invalid.length > 0) {
      setErrorMsg(`${invalid.length} row(s) have missing SID or unresolved status.`);
      return;
    }

    setStage("submitting");
    setErrorMsg("");

    try {
      const blob     = buildExcelBlob(rows);
      const formData = new FormData();
      formData.append("file", blob, "attendance_scan.xlsx");

      const token = localStorage.getItem("token");
      const res   = await fetch(uploadUrl, {
        method:  "POST",
        body:    formData,
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server responded ${res.status}: ${text}`);
      }

      const data = await res.json().catch(() => ({}));
      setSubmitResult(data);
      setStage("done");
    } catch (err) {
      setErrorMsg("Upload failed: " + (err?.message ?? String(err)));
      setStage("error");
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────────
  const reset = () => {
    setStage("idle");
    setRows([]);
    setOcrProgress(0);
    setOcrLog("");
    setRawOcrText("");
    setShowRaw(false);
    setImagePreviewUrl(null);
    setSubmitResult(null);
    setErrorMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={s.wrapper}>

      {/* Global defaults — always visible until done */}
      {stage !== "done" && (
        <div style={s.globalsRow}>
          <label style={s.label}>
            Subject
            <input
              style={s.input}
              placeholder="e.g. Mathematics"
              value={globalSubject}
              onChange={(e) => setGlobalSubject(e.target.value)}
            />
          </label>
          <label style={s.label}>
            Date
            <input
              type="date"
              style={s.input}
              value={globalDate}
              onChange={(e) => setGlobalDate(e.target.value)}
            />
          </label>
          {stage === "parsed" && (
            <button style={s.btnSecondary} onClick={applyGlobals}>
              Apply to all rows
            </button>
          )}
        </div>
      )}

      {/* Tips banner */}
      {stage === "idle" && (
        <div style={s.tipsBanner}>
          <strong>📸 Tips for best results:</strong> Good lighting · Camera directly above · Register flat · Text horizontal · No shadows
        </div>
      )}

      {/* Dropzone */}
      {stage === "idle" && (
        <div style={s.dropzone} onClick={() => fileInputRef.current?.click()}>
          <span style={{ fontSize: 36 }}>📷</span>
          <span style={{ fontWeight: 500 }}>Click to upload register photo</span>
          <span style={{ fontSize: 12, opacity: 0.6 }}>JPEG / PNG — handwritten or printed</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleImageSelect}
          />
        </div>
      )}

      {/* OCR progress */}
      {stage === "ocr" && (
        <div style={s.ocrBox}>
          {imagePreviewUrl && (
            <img src={imagePreviewUrl} alt="preview" style={s.thumbImg} />
          )}
          <div style={s.progressLabel}>{ocrLog} — {ocrProgress}%</div>
          <div style={s.progressTrack}>
            <div style={{ ...s.progressBar, width: `${ocrProgress}%` }} />
          </div>
        </div>
      )}

      {/* Preview table */}
      {stage === "parsed" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            {imagePreviewUrl && (
              <img src={imagePreviewUrl} alt="preview" style={s.thumbSmall} />
            )}
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {rows.filter(r => r.status === "Present").length} Present &nbsp;·&nbsp;
                {rows.filter(r => r.status === "Absent").length} Absent &nbsp;·&nbsp;
                <span style={{ color: "var(--warning, #f59e0b)" }}>
                  {rows.filter(r => r.status === "UNKNOWN").length} needs review
                </span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>
                Review and correct below before submitting
              </div>
            </div>
          </div>

          <div style={s.tableWrapper}>
            <table style={s.table}>
              <thead>
                <tr>
                  {["#", "SID", "Date", "Status", "Subject", ""].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={idx}
                    style={!row.sid || row.status === "UNKNOWN" ? s.rowError : s.rowNormal}
                  >
                    <td style={{ ...s.td, color: "var(--muted, #888)", fontSize: 11, width: 28 }}>
                      {idx + 1}
                    </td>
                    <td style={s.td}>
                      <input
                        style={s.cellInput}
                        value={row.sid}
                        onChange={(e) => updateRow(idx, "sid", e.target.value)}
                        placeholder="SID"
                      />
                    </td>
                    <td style={s.td}>
                      <input
                        type="date"
                        style={s.cellInput}
                        value={row.date}
                        onChange={(e) => updateRow(idx, "date", e.target.value)}
                      />
                    </td>
                    <td style={s.td}>
                      <select
                        style={{
                          ...s.cellInput,
                          color: row.status === "Present"
                            ? "var(--success, #4ade80)"
                            : row.status === "Absent"
                            ? "var(--danger, #f87171)"
                            : "var(--warning, #fbbf24)",
                          fontWeight: 600,
                        }}
                        value={row.status}
                        onChange={(e) => updateRow(idx, "status", e.target.value)}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td style={s.td}>
                      <input
                        style={s.cellInput}
                        value={row.subject}
                        onChange={(e) => updateRow(idx, "subject", e.target.value)}
                        placeholder="Subject"
                      />
                    </td>
                    <td style={s.td}>
                      <button style={s.btnDanger} onClick={() => removeRow(idx)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={s.actionBar}>
            <button style={s.btnSecondary} onClick={addRow}>+ Add row</button>
            <button style={s.btnSecondary} onClick={downloadExcel}>⬇ Download Excel</button>
            <button style={s.btnPrimary} onClick={handleSubmit}>
              Submit {rows.length} rows
            </button>
            <button style={s.btnGhost} onClick={reset}>Start over</button>
          </div>

          {/* Show raw OCR text for debugging */}
          <div style={{ marginTop: 8 }}>
            <button
              style={s.btnGhost}
              onClick={() => setShowRaw((v) => !v)}
            >
              {showRaw ? "Hide" : "Show"} raw OCR text
            </button>
            {showRaw && (
              <pre style={s.rawBox}>{rawOcrText}</pre>
            )}
          </div>

          {errorMsg && <div style={s.errorBanner}>{errorMsg}</div>}
        </>
      )}

      {/* Submitting */}
      {stage === "submitting" && (
        <div style={s.centred}>
          <div style={s.spinner} />
          <p>Uploading attendance…</p>
        </div>
      )}

      {/* Done */}
      {stage === "done" && (
        <div style={s.successBox}>
          <div style={{ fontSize: 36, color: "#16a34a" }}>✓</div>
          <p style={{ fontSize: 16, color: "#166534", margin: "8px 0 4px" }}>
            Attendance uploaded successfully!
          </p>
          {submitResult && (
            <p style={{ fontSize: 13, color: "#166534", margin: "0 0 16px" }}>
              {submitResult.inserted} inserted · {submitResult.updated} updated · {submitResult.skipped} skipped
            </p>
          )}
          {submitResult?.errors?.length > 0 && (
            <div style={s.errorBanner}>
              <strong>Skipped rows:</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                {submitResult.errors.map((e, i) => (
                  <li key={i} style={{ fontSize: 12 }}>Row {e.row} — {e.reason}</li>
                ))}
              </ul>
            </div>
          )}
          <button style={s.btnPrimary} onClick={reset}>Scan another register</button>
        </div>
      )}

      {/* Error */}
      {stage === "error" && (
        <div style={s.errorBox}>
          <p style={{ margin: "0 0 10px" }}>{errorMsg}</p>
          {rawOcrText && (
            <div style={{ marginBottom: 10 }}>
              <button style={s.btnGhost} onClick={() => setShowRaw((v) => !v)}>
                {showRaw ? "Hide" : "Show"} raw OCR text
              </button>
              {showRaw && <pre style={s.rawBox}>{rawOcrText}</pre>}
            </div>
          )}
          <button style={s.btnSecondary} onClick={reset}>Try again</button>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  wrapper: { fontFamily: "inherit", padding: "16px 0" },

  globalsRow: {
    display: "flex", gap: 12, alignItems: "flex-end",
    flexWrap: "wrap", marginBottom: 14,
  },
  label: { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 500 },
  input: {
    padding: "6px 10px",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 6, fontSize: 14,
    background: "var(--card-bg, #1e1e2e)",
    color: "var(--text, #fff)",
    outline: "none", minWidth: 160,
  },

  tipsBanner: {
    background: "rgba(99,102,241,0.1)",
    border: "1px solid rgba(99,102,241,0.25)",
    borderRadius: 8, padding: "10px 14px",
    fontSize: 13, marginBottom: 14,
    color: "var(--text, #fff)",
  },

  dropzone: {
    border: "2px dashed rgba(255,255,255,0.2)",
    borderRadius: 10, padding: "36px 20px",
    textAlign: "center", cursor: "pointer",
    color: "var(--text, #fff)",
    display: "flex", flexDirection: "column",
    alignItems: "center", gap: 8,
    transition: "border-color 0.2s",
  },

  ocrBox: { textAlign: "center", padding: "20px 0" },
  thumbImg: { maxHeight: 200, maxWidth: "100%", borderRadius: 8, marginBottom: 14 },
  thumbSmall: { maxHeight: 64, borderRadius: 6 },
  progressLabel: { fontSize: 13, opacity: 0.7, marginBottom: 8 },
  progressTrack: { height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" },
  progressBar: { height: "100%", background: "#6366f1", borderRadius: 3, transition: "width 0.3s" },

  tableWrapper: { overflowX: "auto", marginBottom: 12 },
  table: { width: "100%", minWidth: "560px", borderCollapse: "collapse", fontSize: 13 },
  th: {
    textAlign: "left", padding: "8px 8px",
    background: "rgba(255,255,255,0.05)",
    borderBottom: "2px solid rgba(255,255,255,0.1)",
    fontWeight: 600, whiteSpace: "nowrap", color: "inherit",
  },
  td: { padding: "3px 4px", borderBottom: "1px solid rgba(255,255,255,0.05)", verticalAlign: "middle" },
  rowNormal: {},
  rowError: { background: "rgba(251,146,60,0.12)" },

  cellInput: {
    width: "100%", padding: "5px 7px",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 4, fontSize: 13,
    background: "var(--card-bg, #1e1e2e)",
    color: "var(--text, #fff)",
    boxSizing: "border-box",
  },

  actionBar: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 8 },

  btnPrimary: {
    padding: "8px 18px", background: "#6366f1", color: "#fff",
    border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 500,
  },
  btnSecondary: {
    padding: "8px 14px", background: "rgba(255,255,255,0.08)",
    color: "var(--text, #fff)", border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 6, cursor: "pointer", fontSize: 13,
  },
  btnGhost: {
    padding: "6px 10px", background: "transparent",
    color: "var(--muted, #888)", border: "none", cursor: "pointer", fontSize: 12,
  },
  btnDanger: {
    padding: "2px 8px", background: "transparent",
    color: "#ef4444", border: "none", cursor: "pointer", fontSize: 15,
  },

  rawBox: {
    marginTop: 8, padding: 12,
    background: "rgba(0,0,0,0.3)", borderRadius: 6,
    fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-all",
    maxHeight: 200, overflowY: "auto",
    color: "var(--muted, #aaa)",
  },

  errorBanner: {
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
    color: "var(--danger, #f87171)", borderRadius: 6,
    padding: "10px 14px", fontSize: 13, marginTop: 8,
  },
  errorBox: {
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 8, padding: 20, color: "var(--danger, #f87171)", fontSize: 14,
  },
  successBox: {
    textAlign: "center", padding: "28px 20px",
    background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
    borderRadius: 10,
  },
  centred: { textAlign: "center", padding: "32px 0", color: "var(--text, #fff)" },
  spinner: {
    width: 34, height: 34,
    border: "3px solid rgba(255,255,255,0.1)",
    borderTop: "3px solid #6366f1",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    margin: "0 auto 12px",
  },
};