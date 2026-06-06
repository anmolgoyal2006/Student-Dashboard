import { useEffect, useState } from 'react';
import { predictionService } from '../services/apiServices';
import { Line } from 'react-chartjs-2';
import { Target, ClipboardList, Brain, TrendingUp, AlertTriangle, Lightbulb, CheckCircle } from 'lucide-react';
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

  // ⌘ Enter keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        fetchPredict();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [targetCGPA, totalSemesters, manualCGPA, completedManual, semCredits]);

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
        ...(data.sgpaList || []).map((_, i)  => `S${i + 1}`),
        ...(data.futureSGPAs || []).map((_, i) => `S${data.completed + i + 1}`),
      ]
    : [];

  const strategyTitles = [
    'Set your target CGPA',
    'Prioritize high-credit subjects',
    'Maintain 75% attendance',
  ];

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Actual SGPA',
        data: data ? [...(data.sgpaList || []), ...Array((data.futureSGPAs || []).length).fill(null)] : [],
        borderColor: '#818cf8',
        backgroundColor: 'rgba(99,102,241,0.08)',
        pointBackgroundColor: '#818cf8',
        pointBorderColor: '#818cf8',
        fill: {
          target: 'origin',
          above: 'rgba(99,102,241,0.08)',
        },
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
        backgroundColor: 'rgba(52,211,153,0.05)',
        pointBackgroundColor: '#34d399',
        pointBorderColor: '#34d399',
        borderDash: [5, 5],
        fill: {
          target: 'origin',
          above: 'rgba(52,211,153,0.05)',
        },
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(19, 22, 31, 0.95)',
        borderColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
      },
    },
    scales: {
      y: {
        min: 0, max: 10,
        grid:  { color: 'rgba(255,255,255,0.04)', lineWidth: 1 },
        border: { color: 'rgba(255,255,255,0.08)' },
        ticks: { color: '#94a3b8', font: { size: 11 }, stepSize: 2 },
      },
      x: {
        grid:  { display: false },
        border: { color: 'rgba(255,255,255,0.08)' },
        ticks: { color: '#94a3b8', font: { size: 11 } },
      },
    },
  };

  const insightColor = (req) => {
    if (req === null) return 'var(--color-text-secondary)';
    if (req > 9.5)   return 'var(--color-danger)';
    if (req > 8.0)   return 'var(--color-warning)';
    return 'var(--color-success)';
  };

  return (
    <div>
      <style>{`
        .ai-trajectory-card {
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--color-surface-2);
          overflow: hidden;
          margin-bottom: 16px;
        }
        
        .ai-trajectory-header {
          padding: 20px 24px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }

        .ai-brain-container {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: var(--color-accent-muted);
          border: 1px solid rgba(99, 102, 241, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          color: var(--color-accent);
        }

        .feasibility-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          border-radius: 99px;
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .insight-banner {
          padding: 16px 20px;
          border-radius: 12px;
          background: var(--color-accent-muted);
          border: 1px solid rgba(99, 102, 241, 0.15);
          font-size: 13.5px;
          line-height: 1.6;
          color: var(--color-text-primary);
          margin-bottom: 24px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .section-label {
          margin: 0 0 12px;
          font-size: 12px;
          font-weight: 500;
          color: var(--color-accent);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .strategy-section-label {
          font-size: 13px;
          line-height: 1;
          font-weight: 500;
          color: var(--color-text-secondary);
          text-transform: none;
          letter-spacing: 0.05em;
        }

        .overview-text {
          margin: 0;
          font-size: 14px;
          color: var(--color-text-secondary);
          line-height: 1.6;
          background: rgba(255, 255, 255, 0.01);
          padding: 16px;
          border-radius: 12px;
          border: 1px solid var(--border);
        }

        .bottleneck-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 14px;
        }

        .bottleneck-card {
          padding: 16px;
          border-radius: 12px;
          background: rgba(239, 68, 68, 0.02);
          border: 1px solid rgba(239, 68, 68, 0.15);
          border-left: 4px solid var(--color-danger);
        }

        .success-card {
          padding: 20px;
          border-radius: 12px;
          background: rgba(16, 185, 129, 0.02);
          border: 1px solid rgba(16, 185, 129, 0.15);
          border-left: 4px solid var(--color-success);
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .success-check-circle {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: var(--color-success-muted);
          border: 1.5px solid rgba(16, 185, 129, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-success);
          flex-shrink: 0;
        }

        .roadmap-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 12px;
        }

        .roadmap-card {
          padding: 16px 12px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid var(--border);
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 6px;
          position: relative;
          overflow: hidden;
        }

        .roadmap-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 100%; height: 3px;
          background: var(--color-accent);
          opacity: 0.7;
        }

        .roadmap-value {
          font-size: 24px;
          font-weight: 500;
          color: var(--color-text-primary);
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
          position: relative;
          font-size: 13px;
          font-weight: 400;
          color: var(--color-text-secondary);
          line-height: 1.6;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid var(--border);
          border-left: 2px solid rgba(99, 102, 241, 0.15);
          border-radius: 10px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          cursor: default;
          transition: background 0.15s ease;
        }

        .strategy-item:hover {
          background: var(--color-surface-3);
        }

        .strategy-item::after {
          content: '';
          position: absolute;
          left: 27px;
          top: 38px;
          bottom: -11px;
          width: 2px;
          background: rgba(99, 102, 241, 0.15);
        }

        .strategy-item:last-child::after {
          display: none;
        }

        .strategy-bullet {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--color-accent-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-accent);
          font-size: 12px;
          line-height: 1;
          font-weight: 500;
          flex-shrink: 0;
          margin-top: 0;
          position: relative;
          z-index: 1;
        }

        .strategy-title {
          display: block;
          color: var(--color-text-primary);
          font-size: 14px;
          line-height: 1.35;
          font-weight: 500;
          margin-bottom: 2px;
        }

        .strategy-body {
          font-size: 13px;
          line-height: 1.55;
          font-weight: 400;
          color: var(--color-text-secondary);
        }

        .projection-chart-card {
          min-height: 280px;
          padding: 20px;
          background: var(--color-surface-2);
          border-radius: var(--radius-lg);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .projection-chart-title {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 16px;
          color: var(--color-text-primary);
          font-size: 16px;
          line-height: 1.25;
          font-weight: 500;
          letter-spacing: 0;
        }

        .projection-chart-canvas {
          min-height: 280px;
          height: 280px;
          position: relative;
        }

        .projection-chart-legend {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 18px;
          margin-top: 12px;
          color: var(--color-text-secondary);
          font-size: 12px;
          line-height: 1;
          font-weight: 400;
        }

        .projection-legend-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .projection-legend-line {
          width: 20px;
          height: 0;
          border-top: 2px solid #818cf8;
        }

        .projection-legend-line.predicted {
          border-top-color: #34d399;
          border-top-style: dashed;
        }

        .semester-credits-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 8px;
          margin-top: 12px;
        }

        @media (max-width: 768px) {
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
      `}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={22} color="var(--color-accent)" />
            CGPA Predictor
          </h1>
          <p className="page-subtitle">Set a target and see what SGPA you need each semester</p>
        </div>
      </div>

      {/* Controls Card with 2-Column Grid */}
      <div className="card mb-4" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ marginBottom: 4 }}>Current CGPA</label>
            <input
              className="form-input"
              type="number" min="0" max="10" step="0.01"
              style={{ height: 44 }}
              placeholder="e.g. 8.71"
              value={manualCGPA}
              onChange={e => setManualCGPA(e.target.value)}
            />
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
              Your current cumulative GPA score
            </span>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ marginBottom: 4 }}>Completed Semesters</label>
            <input
              className="form-input"
              type="number" min="1" max="16"
              style={{ height: 44 }}
              placeholder="e.g. 3"
              value={completedManual}
              onChange={e => setCompletedManual(e.target.value)}
            />
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
              Number of semesters finished so far
            </span>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ marginBottom: 4 }}>Target CGPA</label>
            <input
              className="form-input"
              type="number" min="0" max="10" step="0.1"
              style={{ height: 44 }}
              placeholder="e.g. 9.0"
              value={targetCGPA}
              onChange={e => setTargetCGPA(e.target.value)}
            />
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
              The grade point average you wish to reach
            </span>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ marginBottom: 4 }}>Total Semesters</label>
            <input
              className="form-input"
              type="number" min="1" max="16"
              style={{ height: 44 }}
              value={totalSemesters}
              onChange={e => handleTotalSemestersChange(e.target.value)}
            />
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
              Total semesters in your academic program
            </span>
          </div>
        </div>

        {/* Full-width Calculate button with shortcut label */}
        <button 
          className="btn btn-primary" 
          onClick={fetchPredict} 
          disabled={loading} 
          style={{ width: '100%', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <span>{loading ? 'Calculating…' : 'Calculate'}</span>
          <span style={{ fontSize: 10, opacity: 0.6, background: 'rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: '4px' }}>
            ⌘ Enter
          </span>
        </button>
      </div>

      {/* Per-semester credits toggle */}
      <div className="card mb-4">
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setShowCredits(!showCredits)}
        >
          <span style={{ fontWeight: 500, fontSize: 13 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ClipboardList size={14} /> Per-Semester Credits</span> — Total: <strong>{totalDegreeCredits}</strong>
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
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

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16 }}>{error}</p>}

      {data && data.sgpaList && data.sgpaList.length === 0 && !manualCGPA && (
        <div className="card">
          <p className="text-muted">No semester data found. Enter your Current CGPA manually above to get started.</p>
        </div>
      )}

      {data && data.currentCGPA != null && (
        <>
          {/* Result metric cards: 2x2 grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            
            <div className="card stat-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
              <div className="stat-value" style={{ color: 'var(--color-accent)', fontSize: '28px', fontWeight: 500 }}>
                {data.currentCGPA}
              </div>
              <div className="stat-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>
                Current CGPA
              </div>
            </div>

            <div className="card stat-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span className="stat-value" style={{ color: 'var(--color-success)', fontSize: '28px', fontWeight: 500 }}>
                  {data.predictedCGPA}
                </span>
                {data.predictedCGPA > data.currentCGPA && (
                  <span style={{ color: 'var(--color-success)', fontSize: '13px', fontWeight: 500 }}>
                    ↑ +{(data.predictedCGPA - data.currentCGPA).toFixed(2)}
                  </span>
                )}
              </div>
              <div className="stat-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>
                Predicted CGPA
              </div>
            </div>

            <div className="card stat-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
              <div className="stat-value" style={{ color: 'var(--color-warning)', fontSize: '22px', fontWeight: 500 }}>
                {data.completed}
              </div>
              <div className="stat-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>
                Completed Semesters
              </div>
            </div>

            <div className="card stat-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
              <div className="stat-value" style={{ color: 'var(--color-danger)', fontSize: '22px', fontWeight: 500 }}>
                {data.remaining}
              </div>
              <div className="stat-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>
                Remaining Semesters
              </div>
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
              <Target size={32} style={{ color: 'var(--color-accent)' }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Required SGPA — Each Remaining Semester
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 500, color: insightColor(data.requiredSGPA) }}>
                  {data.requiredSGPA > 10
                    ? 'Not achievable'
                    : data.requiredSGPA < 0
                    ? 'Already achieved!'
                    : data.requiredSGPA}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
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
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-secondary)' }}>Difficulty</p>
                  <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 500, color: insightColor(data.requiredSGPA) }}>
                    {data.requiredSGPA > 9.5 ? 'Very Hard'
                     : data.requiredSGPA > 8.5 ? 'Challenging'
                     : data.requiredSGPA > 7.0 ? 'Achievable'
                     : '✅ Easy'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Trend message */}
          <div className="card mb-4">
            <span style={{ fontSize: 13, color: 'var(--color-success)', fontWeight: 500 }}>
              At your current trend, your CGPA will be approximately {data.predictedCGPA} by semester {totalSemesters}.
            </span>
          </div>

          {/* AI-Powered Strategic Analysis section */}
          {aiLoading && (
            <div style={{
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--color-surface-1)',
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
              borderRadius: 12,
              border: '1px solid rgba(239, 68, 68, 0.2)',
              background: 'rgba(239, 68, 68, 0.05)',
              padding: '16px 20px',
              fontSize: 13,
              color: 'var(--color-danger)',
              marginBottom: 24
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> {aiError}</span>
            </div>
          )}

          {aiData && (() => {
            const feasibilityColors = {
              High: { bg: 'var(--color-success-muted)', text: 'var(--color-success)', border: 'rgba(16, 185, 129, 0.25)', dot: 'var(--color-success)' },
              Medium: { bg: 'var(--color-accent-muted)', text: 'var(--color-accent)', border: 'rgba(99, 102, 241, 0.25)', dot: 'var(--color-accent)' },
              Challenging: { bg: 'var(--color-warning-muted)', text: 'var(--color-warning)', border: 'rgba(245, 158, 11, 0.25)', dot: 'var(--color-warning)' },
              Low: { bg: 'var(--color-danger-muted)', text: 'var(--color-danger)', border: 'rgba(239, 68, 68, 0.25)', dot: 'var(--color-danger)' },
              Impossible: { bg: 'var(--color-danger-muted)', text: 'var(--color-danger)', border: 'rgba(239, 68, 68, 0.3)', dot: 'var(--color-danger)' }
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
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative', zIndex: 1 }}>
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                        <line x1="12" x2="12" y1="19" y2="22" />
                      </svg>
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                        StudentAI Trajectory Analysis
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-secondary)' }}>
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
                  {aiData.feasibilityReason && (
                    <div className="insight-banner">
                      <Lightbulb size={18} style={{ color: 'var(--color-warning)' }} />
                      <div>
                        <strong>Assessment:</strong> {aiData.feasibilityReason}
                      </div>
                    </div>
                  )}

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

                  {/* Bottlenecks */}
                  <div style={{ marginBottom: 24 }}>
                    <h4 className="section-label">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      Risk Areas & Bottlenecks
                    </h4>
                    {hasNoBottlenecks ? (
                      <div className="success-card">
                        <div className="success-check-circle">✓</div>
                        <div>
                          <strong style={{ display: 'block', color: 'var(--color-success)', fontSize: 14 }}>No High Risk Subjects</strong>
                          <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>You don't have any subjects in critical danger of pulling down your GPA trend. Keep up the consistent work!</span>
                        </div>
                      </div>
                    ) : (
                      <div className="bottleneck-grid">
                        {aiData.bottlenecks.map((b, i) => (
                          <div className="bottleneck-card" key={i}>
                            <strong style={{ display: 'block', fontSize: 14, color: 'var(--color-text-primary)' }}>{b.subject}</strong>
                            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{b.reason}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Future Milestones */}
                  {aiData.milestones?.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <h4 className="section-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><polygon points="12 6 12 12 16 14"/>
                        </svg>
                        SGPA Targets Roadmap
                      </h4>
                      <div className="roadmap-grid">
                        {aiData.milestones.map((m, i) => (
                          <div className="roadmap-card" key={i}>
                            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500 }}>{m.semester}</span>
                            <span className="roadmap-value">{m.targetSGPA}</span>
                            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>Target SGPA</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Strategies */}
                  {aiData.strategies?.length > 0 && (
                    <div>
                      <h4 className="section-label strategy-section-label">
                        <CheckCircle size={14} color="#22c55e" strokeWidth={2.4} />
                        Actionable improvement plan
                      </h4>
                      <ul className="strategy-list">
                        {aiData.strategies.map((s, i) => (
                          <li className="strategy-item" key={i}>
                            <div className="strategy-bullet">{i + 1}</div>
                            <div>
                              <strong className="strategy-title">{strategyTitles[i] || s.title || 'Study strategy'}</strong>
                              <span className="strategy-body">{s.details || s}</span>
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

          {/* Line Chart */}
          <div className="card projection-chart-card">
            <div className="projection-chart-title"><TrendingUp size={16} color="var(--color-accent)" /> CGPA projection trajectory</div>
            <div className="projection-chart-canvas">
              <Line data={chartData} options={chartOptions} />
            </div>
            <div className="projection-chart-legend" aria-label="CGPA projection legend">
              <span className="projection-legend-item">
                <span className="projection-legend-line" aria-hidden="true" />
                Actual SGPA
              </span>
              <span className="projection-legend-item">
                <span className="projection-legend-line predicted" aria-hidden="true" />
                Predicted SGPA
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
