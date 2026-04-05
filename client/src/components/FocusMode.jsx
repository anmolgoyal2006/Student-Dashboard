import { useState, useEffect, useRef } from 'react';

const FOCUS_DURATION = 25 * 60; // 25 minutes in seconds

export default function FocusMode({ focusTopic }) {
  const [active,    setActive]    = useState(false);
  const [timeLeft,  setTimeLeft]  = useState(FOCUS_DURATION);
  const [completed, setCompleted] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (active && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(intervalRef.current);
            setActive(false);
            setCompleted(true);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [active]);

  const start = () => {
    setTimeLeft(FOCUS_DURATION);
    setCompleted(false);
    setActive(true);
  };

  const stop = () => {
    clearInterval(intervalRef.current);
    setActive(false);
    setTimeLeft(FOCUS_DURATION);
  };

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');
  const pct  = Math.round(((FOCUS_DURATION - timeLeft) / FOCUS_DURATION) * 100);

  if (!focusTopic) return null;

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div className="card-title" style={{ textAlign: 'left' }}>⚡ Focus Mode</div>

      {/* Topic */}
      <div style={{
        background:   'rgba(129,140,248,0.1)',
        border:       '1px solid rgba(129,140,248,0.25)',
        borderRadius: 10,
        padding:      '10px 16px',
        marginBottom: 20,
        fontSize:     14,
        color:        'var(--text)',
      }}>
        🎯 Focus on: <strong style={{ color: 'var(--primary)' }}>{focusTopic.name}</strong>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
          Solve {focusTopic.gap >= 10 ? 3 : 2} problems · {focusTopic.done}/{focusTopic.target} done
        </div>
      </div>

      {/* Timer ring */}
      <div style={{ position: 'relative', display: 'inline-block', marginBottom: 20 }}>
        <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="52"
            fill="none"
            stroke={completed ? '#34d399' : active ? '#818cf8' : 'rgba(129,140,248,0.3)'}
            strokeWidth="8"
            strokeDasharray={`${2 * Math.PI * 52}`}
            strokeDashoffset={`${2 * Math.PI * 52 * (1 - pct / 100)}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div style={{
          position:  'absolute',
          inset:     0,
          display:   'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize:   22,
            fontWeight: 700,
            color:      completed ? '#34d399' : 'var(--text)',
          }}>
            {completed ? '✓' : `${mins}:${secs}`}
          </span>
          {active && (
            <span style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
              {pct}%
            </span>
          )}
        </div>
      </div>

      {/* Completed message */}
      {completed && (
        <div style={{
          background:   'rgba(52,211,153,0.1)',
          border:       '1px solid rgba(52,211,153,0.3)',
          borderRadius: 8,
          padding:      '8px 16px',
          marginBottom: 16,
          fontSize:     13,
          color:        '#34d399',
        }}>
          🎉 Session complete! Great work.
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {!active ? (
          <button className="btn btn-primary" onClick={start} style={{ minWidth: 140 }}>
            {completed ? '🔄 New Session' : '▶ Start Focus Session'}
          </button>
        ) : (
          <button className="btn btn-outline" onClick={stop} style={{ minWidth: 140 }}>
            ⏹ Stop
          </button>
        )}
      </div>
    </div>
  );
}