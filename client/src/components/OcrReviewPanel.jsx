import { useState, useMemo } from 'react';
import { Search, Bot, EyeOff, Eye, FileText, Save } from 'lucide-react';
import { marksService } from '../services/apiServices';

const VALID_GRADES = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'];

function getConfidenceStyle(level) {
  if (level === 'high') return { color: 'var(--color-success)', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' };
  if (level === 'medium') return { color: 'var(--color-warning)', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' };
  return { color: 'var(--color-danger)', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)' };
}

export default function OcrReviewPanel({ sources, onProceed }) {
  const [localSources, setLocalSources] = useState(() =>
    sources.map((src) => ({
      ...src,
      students: (src.studentRows || []).map((s) => ({
        ...s,
        correctedGrade: s.grade || '',
        corrected: false,
      })),
    }))
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

  const totalStudents = useMemo(
    () => localSources.reduce((sum, s) => sum + s.students.length, 0),
    [localSources]
  );
  const correctedCount = useMemo(
    () => localSources.reduce((sum, s) => sum + s.students.filter((st) => st.corrected).length, 0),
    [localSources]
  );
  const lowConfCount = useMemo(
    () => localSources.reduce((sum, s) => sum + s.students.filter((st) => st.ocrConfidenceLevel === 'low').length, 0),
    [localSources]
  );

  const updateGrade = (srcIdx, studentIdx, grade) => {
    setLocalSources((prev) => {
      const updated = [...prev];
      const st = updated[srcIdx].students[studentIdx];
      st.correctedGrade = grade;
      st.corrected = grade !== st.grade;
      return updated;
    });
  };

  const handleAiCorrect = async () => {
    setAiLoading(true);
    try {
      const allStudents = localSources.flatMap((src) =>
        src.students.filter((st) => st.ocrConfidenceLevel === 'low' || !st.grade).map((st) => ({
          name: st.name,
          roll: st.roll,
          ocrGradeRaw: st.ocrGradeRaw || '',
          grade: st.grade || '',
          ocrConfidence: st.ocrConfidence || 0,
        }))
      );

      if (!allStudents.length) {
        setAiLoading(false);
        return;
      }

      const res = await marksService.ocrAiCorrect({ students: allStudents });
      const corrections = res.data.corrections || [];

      setLocalSources((prev) => {
        const updated = [...prev];
        let studentIdx = 0;
        for (const src of updated) {
          for (const st of src.students) {
            if (st.ocrConfidenceLevel === 'low' || !st.grade) {
              const corr = corrections.find((c) => c.index === studentIdx);
              if (corr && corr.correctedGrade) {
                st.correctedGrade = corr.correctedGrade;
                st.corrected = true;
              }
              studentIdx++;
            } else {
              studentIdx++;
            }
          }
        }
        return updated;
      });
    } catch (err) {
      console.error('AI correction failed:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleProceed = () => {
    const correctedGrades = [];
    for (const src of localSources) {
      for (const st of src.students) {
        if (st.corrected) {
          correctedGrades.push({ roll: st.roll, grade: st.correctedGrade });
        }
      }
    }
    onProceed(correctedGrades);
  };

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-title" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Search size={16} /> OCR Grade Review</div>
      <p className="text-muted" style={{ marginBottom: 12 }}>
        Review and correct OCR-extracted handwritten grades before generating the SGPA leaderboard.
      </p>

      {/* Stats bar */}
      <div style={{
        display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16,
        padding: 12, borderRadius: 10,
        background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 12 }}>
          <strong>{totalStudents}</strong> total students
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-success)' }}>
          <strong>{correctedCount}</strong> corrected
        </div>
        {lowConfCount > 0 && (
          <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>
            <strong>{lowConfCount}</strong> low confidence
          </div>
        )}
      </div>

      {/* AI Correction button */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          className="btn btn-primary"
          onClick={handleAiCorrect}
          disabled={aiLoading}
        >
          {aiLoading ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Bot size={14} /> AI Correcting...</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Bot size={14} /> AI Auto-Correct Low Confidence</span>}
        </button>
        <button
          className={`btn ${reviewMode ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setReviewMode(!reviewMode)}
        >
          {reviewMode ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><EyeOff size={14} /> Hide Cell Images</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Eye size={14} /> Show Cell Images</span>}
        </button>
      </div>

      {/* Students per source */}
      {localSources.map((src, srcIdx) => (
        <div key={src.id || srcIdx} style={{ marginBottom: 20 }}>
          <div style={{
            fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#a5b4fc',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FileText size={14} /> {src.label || src.fileName}</span> ({src.students.length} students)
          </div>

          <div className="table-wrap">
            <table style={{ minWidth: '640px', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px 10px', textAlign: 'left' }}>SID / Roll</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left' }}>Name</th>
                  {reviewMode && (
                    <th style={{ padding: '6px 10px', textAlign: 'center' }}>Grade Cell</th>
                  )}
                  <th style={{ padding: '6px 10px', textAlign: 'center' }}>OCR Raw</th>
                  <th style={{ padding: '6px 10px', textAlign: 'center' }}>Detected</th>
                  <th style={{ padding: '6px 10px', textAlign: 'center' }}>Confidence</th>
                  <th style={{ padding: '6px 10px', textAlign: 'center' }}>Corrected</th>
                </tr>
              </thead>
              <tbody>
                {src.students.map((st, stIdx) => {
                  const cs = getConfidenceStyle(st.ocrConfidenceLevel || 'low');
                  return (
                    <tr
                      key={st.roll || stIdx}
                      style={{
                        background: st.corrected ? 'rgba(16,185,129,0.04)' : 'transparent',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      <td style={{ padding: '6px 10px', color: 'var(--muted)' }}>
                        {st.roll || '—'}
                      </td>
                      <td style={{ padding: '6px 10px', fontWeight: 500 }}>
                        {st.name}
                      </td>
                      {reviewMode && (
                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                          {st.gradeImage ? (
                            <img
                              src={st.gradeImage}
                              alt="grade cell"
                              style={{
                                height: 32,
                                borderRadius: 4,
                                border: '1px solid var(--border)',
                                background: 'var(--color-text-primary)',
                                imageRendering: 'pixelated',
                              }}
                            />
                          ) : (
                            <span style={{ color: 'var(--muted)', fontSize: 10 }}>No image</span>
                          )}
                        </td>
                      )}
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace', fontSize: 11 }}>
                        {st.ocrGradeRaw || '—'}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 8,
                          fontWeight: 700, fontSize: 11,
                          background: 'rgba(99,102,241,0.1)', color: 'var(--color-accent)',
                          border: '1px solid rgba(99,102,241,0.2)',
                        }}>
                          {st.grade || '?'}
                        </span>
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 8,
                          fontSize: 11, fontWeight: 600,
                          background: cs.bg, color: cs.color, border: `1px solid ${cs.border}`,
                        }}>
                          {st.ocrConfidence || 0}%
                        </span>
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <select
                          className="form-select"
                          value={st.correctedGrade || ''}
                          onChange={(e) => updateGrade(srcIdx, stIdx, e.target.value)}
                          style={{
                            width: 80, fontSize: 11, padding: '3px 6px', height: 'auto',
                            background: st.corrected ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.02)',
                            border: st.corrected
                              ? '1px solid rgba(16,185,129,0.3)'
                              : '1px solid var(--border)',
                          }}
                        >
                          <option value="">—</option>
                          {VALID_GRADES.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Save & close button */}
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button className="btn btn-primary" onClick={handleProceed}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Save size={14} /> Save Corrections & Close</span> ({correctedCount} corrected)
        </button>
      </div>
    </div>
  );
}