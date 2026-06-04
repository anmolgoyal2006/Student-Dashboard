import { useEffect, useState } from 'react';
import { predictionService, marksService } from '../services/apiServices';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, Legend, Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const DEFAULT_TOTAL = 8;
const DEFAULT_CREDITS = [22, 21, 22, 24, 20, 12, 19, 21];

export default function Prediction() {
  const [targetCGPA,         setTargetCGPA]        = useState('');
  const [totalSemesters,     setTotalSemesters]    = useState(DEFAULT_TOTAL);
  const [semCredits,         setSemCredits]        = useState(DEFAULT_CREDITS);
  const [showCredits,        setShowCredits]       = useState(false);
  const [manualCGPA,         setManualCGPA]        = useState('');
  const [completedManual,    setCompletedManual]   = useState('');
  const [data,               setData]              = useState(null);
  const [loading,            setLoading]           = useState(false);
  const [error,              setError]             = useState('');

  // AI analysis states
  const [aiData,             setAiData]            = useState(null);
  const [aiLoading,          setAiLoading]         = useState(false);
  const [aiError,            setAiError]           = useState('');

  const totalDegreeCredits = semCredits.reduce((a, b) => a + b, 0);

  const updateSemCredits = (idx, val) => {
    setSemCredits(prev => {
      const next = [...prev];
      next[idx] = Math.max(1, parseInt(val) || 1);
      return next;
    });
  };

  const handleTotalSemestersChange = (val) => {
    const n = Math.max(1, parseInt(val) || 1);
    setTotalSemesters(n);
    setSemCredits(prev => {
      if (n > prev.length) {
        const extra = Array(n - prev.length).fill(20);
        return [...prev, ...extra];
      }
      return prev.slice(0, n);
    });
  };

  const fetchAIAnalysis = async () => {
    setAiError('');
    setAiLoading(true);
    setAiData(null);
    try {
      const params = {
        targetCGPA:         targetCGPA || '',
        totalSemesters:     totalSemesters,
        totalDegreeCredits: totalDegreeCredits,
        semesterCredits:    semCredits.join(','),
      };
      if (manualCGPA) params.currentCGPA = manualCGPA;
      if (completedManual) params.completed = completedManual;
      const res = await predictionService.getAIAnalysis(params);
      setAiData(res.data);
    } catch (err) {
      console.error(err);
      setAiError('Failed to fetch AI analysis.');
    } finally {
      setAiLoading(false);
    }
  };

  const fetchPredict = async () => {
    setError('');
    if (targetCGPA && (targetCGPA < 0 || targetCGPA > 10))
      return setError('Target CGPA must be between 0 and 10.');
    setLoading(true);
    try {
      const params = {
        targetCGPA:         targetCGPA || '',
        totalSemesters:     totalSemesters,
        totalDegreeCredits: totalDegreeCredits,
        semesterCredits:    semCredits.join(','),
      };
      if (manualCGPA) params.currentCGPA = manualCGPA;
      if (completedManual) params.completed = completedManual;
      const res = await predictionService.getPredict(params);
      setData(res.data);
      // Trigger AI Analysis
      fetchAIAnalysis();
    } catch {
      setError('Failed to fetch prediction.');
    } finally {
      setLoading(false);
    }
  };

  // Inject styles for skeleton animations
  useEffect(() => {
    const id = 'ai-pred-styles';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes ai-pulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.4; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  useEffect(() => { fetchPredict(); }, []);

  const chartLabels = data
    ? [
        ...(data.sgpaList || []).map((_, i)  => `S${i + 1} (actual)`),
        ...(data.futureSGPAs || []).map((_, i) => `S${data.completed + i + 1} (predicted)`),
      ]
    : [];

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Actual SGPA',
        data: data ? [...(data.sgpaList || []), ...Array((data.futureSGPAs || []).length).fill(null)] : [],
        borderColor: '#818cf8',
        backgroundColor: 'rgba(129,140,248,0.15)',
        pointBackgroundColor: '#818cf8',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Predicted SGPA',
        data: data
          ? [...Array(Math.max(0, (data.sgpaList || []).length - 1)).fill(null),
             data.sgpaList?.[(data.sgpaList || []).length - 1],
             ...(data.futureSGPAs || [])]
          : [],
        borderColor: '#34d399',
        backgroundColor: 'rgba(52,211,153,0.08)',
        pointBackgroundColor: '#34d399',
        borderDash: [5, 5],
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { labels: { color: '#94a3b8', font: { size: 12 } } },
      tooltip: {
        backgroundColor: 'rgba(13,17,23,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        titleColor: '#e6edf3',
        bodyColor: '#6e7681',
      },
    },
    scales: {
      y: {
        min: 0, max: 10,
        grid:  { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#6e7681' },
      },
      x: {
        grid:  { display: false },
        ticks: { color: '#6e7681', font: { size: 10 } },
      },
    },
  };

  const insightColor = (req) => {
    if (req === null) return '#94a3b8';
    if (req > 9.5)   return '#f87171';
    if (req > 8.0)   return '#fbbf24';
    return '#34d399';
  };

  return (
    <div>
      <style>{`
        .ai-trajectory-card {
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: linear-gradient(135deg, rgba(30, 30, 46, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          overflow: hidden;
          box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.05);
          margin-bottom: 28px;
          animation: aiFadeIn 0.4s ease-out both;
        }
        
        .ai-trajectory-header {
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }

        .ai-brain-container {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(129, 140, 248, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%);
          border: 1px solid rgba(129, 140, 248, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }

        .ai-brain-pulse {
          position: absolute;
          width: 100%;
          height: 100%;
          background: rgba(129, 140, 248, 0.15);
          border-radius: 50%;
          animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }

        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }

        .feasibility-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          border-radius: 99px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          transition: all 0.3s ease;
        }

        .feasibility-pill:hover {
          transform: scale(1.05);
        }

        .insight-banner {
          padding: 16px 20px;
          border-radius: 14px;
          background: linear-gradient(90deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.04) 100%);
          border: 1px solid rgba(99, 102, 241, 0.15);
          font-size: 13.5px;
          line-height: 1.6;
          color: #e2e8f0;
          margin-bottom: 24px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .section-label {
          margin: 0 0 12px;
          font-size: 12px;
          font-weight: 700;
          color: #a5b4fc;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .overview-text {
          margin: 0;
          font-size: 14px;
          color: #cbd5e1;
          line-height: 1.7;
          background: rgba(255, 255, 255, 0.01);
          padding: 16px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.03);
        }

        .bottleneck-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 14px;
        }

        .bottleneck-card {
          padding: 16px;
          border-radius: 14px;
          background: rgba(244, 63, 94, 0.01);
          border: 1px solid rgba(244, 63, 94, 0.15);
          border-left: 4px solid #f43f5e;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .bottleneck-card:hover {
          transform: translateY(-2px);
          background: rgba(244, 63, 94, 0.03);
          border-color: rgba(244, 63, 94, 0.3);
          box-shadow: 0 6px 20px rgba(244, 63, 94, 0.1);
        }

        .success-card {
          padding: 20px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.02) 0%, rgba(52, 211, 153, 0.05) 100%);
          border: 1px solid rgba(16, 185, 129, 0.15);
          border-left: 4px solid #10b981;
          display: flex;
          align-items: center;
          gap: 16px;
          transition: all 0.3s ease;
        }

        .success-card:hover {
          transform: translateY(-2px);
          border-color: rgba(16, 185, 129, 0.3);
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.1);
        }

        .success-check-circle {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.15);
          border: 1.5px solid rgba(16, 185, 129, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #34d399;
          flex-shrink: 0;
        }

        .roadmap-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 12px;
        }

        .roadmap-card {
          padding: 16px 12px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 6px;
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .roadmap-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 100%; height: 3px;
          background: linear-gradient(90deg, #6366f1, #8b92f6);
          opacity: 0.7;
        }

        .roadmap-card:hover {
          transform: translateY(-5px);
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(99, 102, 241, 0.3);
          box-shadow: 0 8px 25px rgba(99, 102, 241, 0.15);
        }

        .roadmap-card:hover::before {
          opacity: 1;
          height: 4px;
        }

        .roadmap-value {
          font-size: 24px;
          font-weight: 800;
          background: linear-gradient(135deg, #a5b4fc 0%, #818cf8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-family: 'Space Grotesk', sans-serif;
          margin: 4px 0;
        }

        .strategy-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .strategy-item {
          font-size: 13.5px;
          color: #cbd5e1;
          line-height: 1.6;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 10px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          transition: all 0.2s ease;
        }

        .strategy-item:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(129, 140, 248, 0.2);
          transform: translateX(4px);
        }

        .strategy-bullet {
          width: 20px;
          height: 20px;
          border-radius: 6px;
          background: rgba(129, 140, 248, 0.12);
          border: 1px solid rgba(129, 140, 248, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #818cf8;
          font-size: 11px;
          font-weight: bold;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .prediction-controls {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 16px;
          align-items: flex-end;
        }

        .prediction-controls-btn {
          height: 42px;
          width: 100%;
        }

        .semester-credits-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 8px;
          margin-top: 12px;
        }

        @media (max-width: 768px) {
          .prediction-controls {
            grid-template-columns: repeat(2, 1fr);
          }
          .prediction-controls-btn {
            grid-column: span 2;
          }
          .semester-credits-grid {
            grid-template-columns: repeat(4, 1fr);
          }
          .ai-trajectory-header {
            padding: 16px;
          }
          .ai-trajectory-card > div:last-child {
            padding: 16px !important;
          }
        }

        @media (max-width: 480px) {
          .prediction-controls {
            grid-template-columns: 1fr;
          }
          .prediction-controls-btn {
            grid-column: span 1;
          }
          .semester-credits-grid {
            grid-template-columns: repeat(3, 1fr);
          }
          .bottleneck-grid {
            grid-template-columns: 1fr;
          }
          .roadmap-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        
        @media (max-width: 360px) {
          .roadmap-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <div className="page-header">
        <div>
          <h1 className="page-title">🎯 CGPA Predictor</h1>
          <p className="page-subtitle">Set a target and see what SGPA you need each semester</p>
        </div>
      </div>

      {/* Controls */}
      <div className="card mb-4 prediction-controls">
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Current CGPA (optional)</label>
          <input
            className="form-input"
            type="number" min="0" max="10" step="0.01"
            placeholder="e.g. 8.71"
            value={manualCGPA}
            onChange={e => setManualCGPA(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Completed Sems</label>
          <input
            className="form-input"
            type="number" min="1" max="16"
            placeholder="e.g. 3"
            value={completedManual}
            onChange={e => setCompletedManual(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Target CGPA</label>
          <input
            className="form-input"
            type="number" min="0" max="10" step="0.1"
            placeholder="e.g. 9.0"
            value={targetCGPA}
            onChange={e => setTargetCGPA(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Total Semesters</label>
          <input
            className="form-input"
            type="number" min="1" max="16"
            value={totalSemesters}
            onChange={e => handleTotalSemestersChange(e.target.value)}
          />
        </div>
        <button className="btn btn-primary prediction-controls-btn" onClick={fetchPredict} disabled={loading}>
          {loading ? 'Calculating…' : 'Calculate'}
        </button>
      </div>

      {/* Per-semester credits toggle */}
      <div className="card mb-4">
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setShowCredits(!showCredits)}
        >
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            📋 Per-Semester Credits — Total: <strong>{totalDegreeCredits}</strong>
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {showCredits ? '▲ Hide' : '▼ Edit (default: 22,21,22,24,20,12,19,21)'}
          </span>
        </div>
        {showCredits && (
          <div className="semester-credits-grid">
            {semCredits.map((c, i) => (
              <div key={i} className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 10 }}>S{i + 1}</label>
                <input
                  className="form-input"
                  type="number" min="1" step="1"
                  style={{ fontSize: 12, padding: '4px 8px', height: 'auto', textAlign: 'center' }}
                  value={c}
                  onChange={e => updateSemCredits(i, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p style={{ color: '#f87171', marginBottom: 16 }}>{error}</p>}

      {data && data.sgpaList && data.sgpaList.length === 0 && !manualCGPA && (
        <div className="card">
          <p className="text-muted">No semester data found. Enter your Current CGPA manually above to get started.</p>
        </div>
      )}

      {data && data.currentCGPA != null && (
        <>
          {/* Stat cards */}
          <div className="grid-4 mb-4">
            <div className="card stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-value" style={{ color: '#818cf8' }}>{data.currentCGPA}</div>
              <div className="stat-label">Current CGPA (credit-weighted)</div>
            </div>
            <div className="card stat-card">
              <div className="stat-icon">🔮</div>
              <div className="stat-value" style={{ color: '#34d399' }}>{data.predictedCGPA}</div>
              <div className="stat-label">Predicted CGPA</div>
            </div>
            <div className="card stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-value" style={{ color: '#fbbf24' }}>{data.completed}</div>
              <div className="stat-label">Completed</div>
            </div>
            <div className="card stat-card">
              <div className="stat-icon">⏳</div>
              <div className="stat-value" style={{ color: '#f87171' }}>{data.remaining}</div>
              <div className="stat-label">Remaining</div>
            </div>
          </div>

          {/* Required SGPA banner */}
          {data.requiredSGPA !== null && targetCGPA && (
            <div className="card mb-4" style={{
              display: 'flex', alignItems: 'center', gap: 20,
              padding: '16px 20px',
              borderLeft: `4px solid ${insightColor(data.requiredSGPA)}`,
              flexWrap: 'wrap',
            }}>
              <div style={{ fontSize: 32 }}>🎯</div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Required SGPA — Each Remaining Semester
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 800, color: insightColor(data.requiredSGPA) }}>
                  {data.requiredSGPA > 10
                    ? 'Not achievable'
                    : data.requiredSGPA < 0
                    ? 'Already achieved!'
                    : data.requiredSGPA}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                  {data.requiredSGPA > 10
                    ? `Target CGPA ${targetCGPA} cannot be reached in ${data.remaining} remaining semester(s).`
                    : data.requiredSGPA < 0
                    ? `You've already surpassed your target CGPA of ${targetCGPA}.`
                    : `Maintain this SGPA each semester to hit CGPA ${targetCGPA}.`
                  }
                </p>
              </div>
              {data.requiredSGPA >= 0 && data.requiredSGPA <= 10 && (
                <div style={{
                  padding: '10px 20px', borderRadius: 10,
                  background: `${insightColor(data.requiredSGPA)}20`,
                  border: `1px solid ${insightColor(data.requiredSGPA)}40`,
                  textAlign: 'center', flexShrink: 0,
                }}>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)' }}>Difficulty</p>
                  <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700, color: insightColor(data.requiredSGPA) }}>
                    {data.requiredSGPA > 9.5 ? '🔴 Very Hard'
                     : data.requiredSGPA > 8.5 ? '🟡 Challenging'
                     : data.requiredSGPA > 7.0 ? '🟢 Achievable'
                     : '✅ Easy'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Trend message */}
          <div className="card mb-4">
            <span style={{ fontSize: 13, color: '#34d399', fontWeight: 600 }}>
              📈 At your current trend, your CGPA will be approximately {data.predictedCGPA} by semester {totalSemesters}.
            </span>
          </div>

          {/* AI-Powered Strategic Analysis section */}
          {aiLoading && (
            <div style={{
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'var(--surface-1, #1e1e2e)',
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              marginBottom: 24
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.06)', animation: 'ai-pulse 1.4s infinite' }} />
                <div>
                  <div style={{ width: 180, height: 16, borderRadius: 6, background: 'rgba(255,255,255,0.06)', animation: 'ai-pulse 1.4s infinite', marginBottom: 6 }} />
                  <div style={{ width: 120, height: 11, borderRadius: 6, background: 'rgba(255,255,255,0.04)', animation: 'ai-pulse 1.4s infinite' }} />
                </div>
              </div>
              <div style={{ width: '100%', height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.04)', animation: 'ai-pulse 1.4s infinite' }} />
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, height: 80, minWidth: 200, borderRadius: 12, background: 'rgba(255,255,255,0.04)', animation: 'ai-pulse 1.4s infinite' }} />
                <div style={{ flex: 1, height: 80, minWidth: 200, borderRadius: 12, background: 'rgba(255,255,255,0.04)', animation: 'ai-pulse 1.4s infinite' }} />
              </div>
            </div>
          )}

          {aiError && (
            <div style={{
              borderRadius: 16,
              border: '1px solid rgba(244,63,94,0.2)',
              background: 'rgba(244,63,94,0.05)',
              padding: '16px 20px',
              fontSize: 13,
              color: '#f43f5e',
              marginBottom: 24
            }}>
              ⚠️ {aiError}
            </div>
          )}

          {aiData && (() => {
            const feasibilityColors = {
              High: { bg: 'rgba(16, 185, 129, 0.1)', text: '#34d399', border: 'rgba(16, 185, 129, 0.25)', dot: '#10b981' },
              Medium: { bg: 'rgba(99, 102, 241, 0.1)', text: '#818cf8', border: 'rgba(99, 102, 241, 0.25)', dot: '#6366f1' },
              Challenging: { bg: 'rgba(245, 158, 11, 0.1)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.25)', dot: '#f59e0b' },
              Low: { bg: 'rgba(244, 63, 94, 0.1)', text: '#f43f5e', border: 'rgba(244, 63, 94, 0.25)', dot: '#f43f5e' },
              Impossible: { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)', dot: '#ef4444' }
            };
            const fColor = feasibilityColors[aiData.feasibility] || feasibilityColors.Medium;
            const hasNoBottlenecks = !aiData.bottlenecks || aiData.bottlenecks.length === 0 || 
              (aiData.bottlenecks.length === 1 && (aiData.bottlenecks[0].subject === 'None' || aiData.bottlenecks[0].subject.toLowerCase() === 'none'));

            return (
              <div className="ai-trajectory-card">
                {/* Header */}
                <div className="ai-trajectory-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="ai-brain-container">
                      <div className="ai-brain-pulse" />
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative', zIndex: 1 }}>
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                        <line x1="12" x2="12" y1="19" y2="22" />
                      </svg>
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
                        StudentAI Trajectory Analysis
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>
                        Real-time academic projection & study roadmap
                      </p>
                    </div>
                  </div>
                  
                  {/* Feasibility Badge */}
                  {aiData.feasibility && (
                    <div className="feasibility-pill" style={{
                      background: fColor.bg,
                      border: `1px solid ${fColor.border}`,
                      color: fColor.text
                    }}>
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: fColor.dot,
                        boxShadow: `0 0 8px ${fColor.dot}`
                      }} />
                      Feasibility: {aiData.feasibility}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div style={{ padding: '20px 24px 24px' }}>
                  {/* Feasibility Reason banner */}
                  {aiData.feasibilityReason && (
                    <div className="insight-banner">
                      <span style={{ fontSize: 18, marginTop: -2 }}>💡</span>
                      <div>
                        <strong>Assessment:</strong> {aiData.feasibilityReason}
                      </div>
                    </div>
                  )}

                  {/* AI analysis narrative */}
                  {aiData.analysis && (
                    <div style={{ marginBottom: 24 }}>
                      <h4 className="section-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                        </svg>
                        Trajectory Overview
                      </h4>
                      <p className="overview-text">
                        {aiData.analysis}
                      </p>
                    </div>
                  )}

                  {/* Bottlenecks (Warning list) */}
                  <div style={{ marginBottom: 24 }}>
                    <h4 className="section-label">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12" y1="17" y2="17.01"/>
                      </svg>
                      Key Trajectory Bottlenecks
                    </h4>
                    
                    {hasNoBottlenecks ? (
                      <div className="success-card">
                        <div className="success-check-circle">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                        <div>
                          <h5 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: '#34d399' }}>
                            Academic Path Clear
                          </h5>
                          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>
                            No active bottlenecks detected. Attendance is above 75%, and grades are on track! Keep maintaining this momentum.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bottleneck-grid">
                        {aiData.bottlenecks.map((btn, idx) => (
                          <div key={idx} className="bottleneck-card">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#f43f5e' }}>
                                {btn.subject}
                              </span>
                              <span style={{
                                fontSize: 10,
                                background: 'rgba(244,63,94,0.1)',
                                padding: '2px 8px',
                                borderRadius: 99,
                                color: '#f43f5e',
                                fontWeight: 600,
                                border: '1px solid rgba(244,63,94,0.15)'
                              }}>
                                Risk Factor
                              </span>
                            </div>
                            <div style={{ fontSize: 12.5, color: '#e2e8f0', marginBottom: 4 }}>
                              <strong>Issue:</strong> {btn.issue}
                            </div>
                            <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.4 }}>
                              <strong>Impact:</strong> {btn.impact}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Roadmap Suggested SGPAs */}
                  {aiData.roadmap && aiData.roadmap.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <h4 className="section-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/>
                        </svg>
                        Suggested SGPA Targets By Semester
                      </h4>
                      <div className="roadmap-grid">
                        {aiData.roadmap.map((sem, idx) => (
                          <div key={idx} className="roadmap-card">
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Semester {sem.semester}
                            </div>
                            <div className="roadmap-value">
                              {sem.suggestedSGPA}
                            </div>
                            <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.3, marginTop: '2px', minHeight: '2.6em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {sem.focus}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actionable Strategies */}
                  {aiData.strategies && aiData.strategies.length > 0 && (
                    <div>
                      <h4 className="section-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                        AI-Powered Action Strategy
                      </h4>
                      <ul className="roadmap-grid" style={{ display: 'none' /* hidden standard layout */ }} />
                      <ul className="strategy-list">
                        {aiData.strategies.map((strat, idx) => (
                          <li key={idx} className="strategy-item">
                            <div className="strategy-bullet">
                              {idx + 1}
                            </div>
                            <div style={{ flex: 1 }}>
                              {strat}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Credit Breakdown */}
          {data.creditBreakdown && (
            <div className="card mb-4">
              <div className="card-title">📋 Credit Distribution</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {data.creditBreakdown.map((c, i) => (
                  <span key={i} style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 99,
                    background: i < data.completed ? 'rgba(129,140,248,0.12)' : 'rgba(52,211,153,0.12)',
                    border: `1px solid ${i < data.completed ? 'rgba(129,140,248,0.25)' : 'rgba(52,211,153,0.25)'}`,
                    color: i < data.completed ? '#a5b4fc' : '#34d399',
                  }}>
                    S{i + 1}: {c}cr {i < data.completed ? '(done)' : '(ahead)'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Chart */}
          {data.sgpaList && data.sgpaList.length > 0 && (
            <div className="card">
              <div className="card-title">📉 SGPA Trend + Prediction</div>
              <Line data={chartData} options={chartOptions} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
