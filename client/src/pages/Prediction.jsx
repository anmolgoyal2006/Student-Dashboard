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
      <div className="page-header">
        <div>
          <h1 className="page-title">🎯 CGPA Predictor</h1>
          <p className="page-subtitle">Set a target and see what SGPA you need each semester</p>
        </div>
      </div>

      {/* Controls */}
      <div className="card mb-4" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 140 }}>
          <label className="form-label">Current CGPA (optional)</label>
          <input
            className="form-input"
            type="number" min="0" max="10" step="0.01"
            placeholder="e.g. 8.71"
            value={manualCGPA}
            onChange={e => setManualCGPA(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 120 }}>
          <label className="form-label">Completed Sems</label>
          <input
            className="form-input"
            type="number" min="1" max="16"
            placeholder="e.g. 3"
            value={completedManual}
            onChange={e => setCompletedManual(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 140 }}>
          <label className="form-label">Target CGPA</label>
          <input
            className="form-input"
            type="number" min="0" max="10" step="0.1"
            placeholder="e.g. 9.0"
            value={targetCGPA}
            onChange={e => setTargetCGPA(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 120 }}>
          <label className="form-label">Total Semesters</label>
          <input
            className="form-input"
            type="number" min="1" max="16"
            value={totalSemesters}
            onChange={e => handleTotalSemestersChange(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={fetchPredict} disabled={loading}>
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {semCredits.map((c, i) => (
              <div key={i} className="form-group" style={{ margin: 0, width: 80 }}>
                <label className="form-label" style={{ fontSize: 10 }}>S{i + 1}</label>
                <input
                  className="form-input"
                  type="number" min="1" step="1"
                  style={{ fontSize: 12, padding: '4px 8px', height: 'auto' }}
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

          {aiData && (
            <div style={{
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'linear-gradient(135deg, var(--surface-1, #1e1e2e) 0%, rgba(30, 30, 46, 0.95) 100%)',
              overflow: 'hidden',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
              marginBottom: 24
            }}>
              {/* Header */}
              <div style={{
                padding: '18px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: 'rgba(129,140,248,0.15)',
                    border: '1px solid rgba(129,140,248,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16
                  }}>
                    🧠
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #f1f5f9)' }}>
                      StudentAI Trajectory Analysis
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-secondary, #94a3b8)' }}>
                      Real-time academic projection & study roadmap
                    </p>
                  </div>
                </div>
                
                {/* Feasibility Badge */}
                {aiData.feasibility && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 12px',
                    borderRadius: 99,
                    background: 
                      aiData.feasibility === 'High' ? 'rgba(16,185,129,0.12)' :
                      aiData.feasibility === 'Medium' ? 'rgba(99,102,241,0.12)' :
                      aiData.feasibility === 'Challenging' ? 'rgba(245,158,11,0.12)' :
                      aiData.feasibility === 'Low' ? 'rgba(244,63,94,0.12)' : 'rgba(239,68,68,0.15)',
                    border: `1px solid ${
                      aiData.feasibility === 'High' ? 'rgba(16,185,129,0.35)' :
                      aiData.feasibility === 'Medium' ? 'rgba(99,102,241,0.35)' :
                      aiData.feasibility === 'Challenging' ? 'rgba(245,158,11,0.35)' :
                      aiData.feasibility === 'Low' ? 'rgba(244,63,94,0.35)' : 'rgba(239,68,68,0.45)'
                    }`,
                    color: 
                      aiData.feasibility === 'High' ? '#34d399' :
                      aiData.feasibility === 'Medium' ? '#818cf8' :
                      aiData.feasibility === 'Challenging' ? '#fbbf24' :
                      aiData.feasibility === 'Low' ? '#f43f5e' : '#ef4444',
                    fontSize: 11,
                    fontWeight: 700
                  }}>
                    <span style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: 
                        aiData.feasibility === 'High' ? '#10b981' :
                        aiData.feasibility === 'Medium' ? '#6366f1' :
                        aiData.feasibility === 'Challenging' ? '#f59e0b' :
                        aiData.feasibility === 'Low' ? '#f43f5e' : '#ef4444'
                    }} />
                    Feasibility: {aiData.feasibility}
                  </div>
                )}
              </div>

              {/* Body */}
              <div style={{ padding: '20px' }}>
                {/* Feasibility Reason banner */}
                {aiData.feasibilityReason && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: 'var(--text-secondary, #94a3b8)',
                    marginBottom: 20
                  }}>
                    💡 <strong>Assessment:</strong> {aiData.feasibilityReason}
                  </div>
                )}

                {/* AI analysis narrative */}
                {aiData.analysis && (
                  <div style={{ marginBottom: 20 }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #f1f5f9)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Trajectory Overview
                    </h4>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.6 }}>
                      {aiData.analysis}
                    </p>
                  </div>
                )}

                {/* Bottlenecks (Warning list) */}
                {aiData.bottlenecks && aiData.bottlenecks.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #f1f5f9)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      ⚠️ Key Trajectory Bottlenecks
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
                      {aiData.bottlenecks.map((btn, idx) => (
                        <div key={idx} style={{
                          padding: '12px',
                          borderRadius: 10,
                          background: 'rgba(244,63,94,0.02)',
                          border: '1px solid rgba(244,63,94,0.12)',
                          borderLeft: '3.5px solid #f43f5e',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4
                        }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#f43f5e' }}>
                            {btn.subject}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-primary, #f1f5f9)' }}>
                            <strong>Issue:</strong> {btn.issue}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)' }}>
                            <strong>Impact:</strong> {btn.impact}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Roadmap Suggested SGPAs */}
                {aiData.roadmap && aiData.roadmap.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #f1f5f9)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      🗺️ Suggested SGPA Targets By Semester
                    </h4>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                      gap: 10
                    }}>
                      {aiData.roadmap.map((sem, idx) => (
                        <div key={idx} style={{
                          padding: '12px',
                          borderRadius: 10,
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4
                        }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>
                            Semester {sem.semester}
                          </span>
                          <span style={{ fontSize: 20, fontWeight: 800, color: '#818cf8', fontFamily: "'Space Grotesk', sans-serif" }}>
                            {sem.suggestedSGPA}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--muted, #64748b)', lineHeight: 1.2 }}>
                            {sem.focus}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actionable Strategies */}
                {aiData.strategies && aiData.strategies.length > 0 && (
                  <div>
                    <h4 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #f1f5f9)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      ⚡ AI-Powered Action Strategy
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {aiData.strategies.map((strat, idx) => (
                        <li key={idx} style={{ fontSize: 12, color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.5 }}>
                          {strat}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

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
