import { useState, useEffect, useRef } from 'react';

const FOCUS_DURATION = 25 * 60;

const DIFFICULTY_CONFIG = {
  Easy:   { icon: '🟢', count: 2, desc: 'Revise concepts'         },
  Medium: { icon: '🟡', count: 3, desc: 'Improve problem-solving' },
  Hard:   { icon: '🔴', count: 5, desc: 'Improve speed'           },
};

export default function FocusMode({ focusTopic }) {
  const [active,     setActive]     = useState(false);
  const [timeLeft,   setTimeLeft]   = useState(FOCUS_DURATION);
  const [completed,  setCompleted]  = useState(false);
  const [difficulty, setDifficulty] = useState('Medium');
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
  const diff = DIFFICULTY_CONFIG[difficulty];

  if (!focusTopic) return null;

  // Dynamic task sentence
  const taskText = `Solve ${diff.count} ${difficulty} ${focusTopic.name} problems to ${diff.desc.toLowerCase()}`;

  return (
    <div className="card">
      <div className="card-title">⚡ Focus Mode</div>

      {/* Topic pill */}
      <div style={{
        background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.25)',
        borderRadius: 10, padding: '10px 14px', marginBottom: 14,
        fontSize: 13, color: 'var(--text)',
      }}>
        🎯 <strong style={{ color: 'var(--primary)' }}>{focusTopic.name}</strong>
        <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>
          {focusTopic.done}/{focusTopic.target} done
        </span>
      </div>

      {/* Difficulty selector — only show when not active */}
      {!active && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Difficulty</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {Object.entries(DIFFICULTY_CONFIG).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setDifficulty(key)}
                className={`btn btn-sm ${difficulty === key ? 'btn-primary' : 'btn-outline'}`}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {val.icon} {key}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dynamic task text */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '8px 12px', marginBottom: 16,
        fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5,
      }}>
        📝 {taskText}
      </div>

      {/* Timer ring */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <svg width="110" height="110" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="55" cy="55" r="48"
              fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
            <circle cx="55" cy="55" r="48"
              fill="none"
              stroke={completed ? '#34d399' : active ? '#818cf8' : 'rgba(129,140,248,0.3)'}
              strokeWidth="7"
              strokeDasharray={`${2 * Math.PI * 48}`}
              strokeDashoffset={`${2 * Math.PI * 48 * (1 - pct / 100)}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: 20, fontWeight: 700,
              color: completed ? '#34d399' : 'var(--text)',
            }}>
              {completed ? '✓' : `${mins}:${secs}`}
            </span>
            {active && (
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{pct}%</span>
            )}
          </div>
        </div>
      </div>

      {/* Completed */}
      {completed && (
        <div style={{
          background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)',
          borderRadius: 8, padding: '8px 14px', marginBottom: 12,
          fontSize: 13, color: '#34d399', textAlign: 'center',
        }}>
          🎉 Session complete! Great work.
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {!active ? (
          <button className="btn btn-primary" onClick={start} style={{ minWidth: 150 }}>
            {completed ? '🔄 New Session' : '▶ Start Focus Session'}
          </button>
        ) : (
          <button className="btn btn-outline" onClick={stop} style={{ minWidth: 150 }}>
            ⏹ Stop
          </button>
        )}
      </div>
    </div>
  );
}