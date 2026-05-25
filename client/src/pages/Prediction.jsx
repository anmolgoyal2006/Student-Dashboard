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
    } catch {
      setError('Failed to fetch prediction.');
    } finally {
      setLoading(false);
    }
  };

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
