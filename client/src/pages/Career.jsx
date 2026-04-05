import { useEffect, useState } from 'react';
import { careerService }   from '../services/apiServices';
import FocusMode           from '../components/FocusMode';
import CareerProgressBar   from '../components/CareerProgressBar';
import toast from 'react-hot-toast';

const COMPANIES = ['Amazon', 'Microsoft', 'Google', 'Flipkart', 'Adobe', 'Infosys', 'TCS', 'Other'];

const READINESS_CONFIG = {
  Beginner:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: '🌱 Beginner',     desc: 'Focus on DSA fundamentals and build projects.' },
  Intermediate: { color: '#6366f1', bg: 'rgba(99,102,241,0.1)',  label: '🔥 Intermediate', desc: 'Start mock interviews and system design prep.'  },
  Ready:        { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   label: '🏆 Ready',        desc: 'You are placement ready! Polish HR round prep.' },
};

export default function Career() {
  const [career,    setCareer]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [plan,      setPlan]      = useState(null);
  const [planLoad,  setPlanLoad]  = useState(true);
  const [activeDay, setActiveDay] = useState(0);
  const [todayProgress, setTodayProgress] = useState({ done: 0, remaining: 0 });

  const load = async () => {
    try {
      const { data } = await careerService.get();
      setCareer(data.career);
    } finally { setLoading(false); }
  };

  const loadPlan = async () => {
    try {
      const { data } = await careerService.getPlan();
      setPlan(data);
    } catch { /* silent */ }
    finally { setPlanLoad(false); }
  };

  useEffect(() => { load(); loadPlan(); }, []);

  useEffect(() => {
  if (!plan) return;

  const done = plan.dailyTasks.filter(t => t.done >= t.count).length;
  const remaining = plan.dailyTasks.length - done;

  setTodayProgress({ done, remaining });
}, [plan]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await careerService.update({
        targetCompany:  career.targetCompany,
        targetRole:     career.targetRole,
        problemsSolved: career.problemsSolved,
        skills:         career.skills,
        dsaTopics:      career.dsaTopics,
      });
      toast.success('Career progress saved!');
      load();
      loadPlan(); // refresh plan after save
    } catch {
      toast.error('Failed to save');
    } finally { setSaving(false); }
  };

  const toggleTopic = (topicName, completed) => {
    setCareer(p => ({
      ...p,
      dsaTopics: p.dsaTopics.map(t => t.name === topicName ? { ...t, completed } : t),
    }));
  };

  const updateProblems = (topicName, problems) => {
    setCareer(p => ({
      ...p,
      dsaTopics: p.dsaTopics.map(t => t.name === topicName ? { ...t, problems: parseInt(problems) || 0 } : t),
    }));
  };

  if (loading) return <div className="spinner" />;
  if (!career) return <p className="text-muted">Failed to load career data.</p>;

  const completedTopics = career.dsaTopics.filter(t => t.completed).length;
  const totalTopics     = career.dsaTopics.length;
  const progressPct     = totalTopics ? Math.round((completedTopics / totalTopics) * 100) : 0;
  const rc              = READINESS_CONFIG[career.readiness] || READINESS_CONFIG.Beginner;

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🚀 Career Preparation</h1>
          <p className="page-subtitle">Track your DSA progress and placement readiness</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : '💾 Save Progress'}
        </button>
      </div>

      {/* ── Readiness banner ── */}
      {/* ── Readiness + Overall Goal ── */}
<div className="grid-2 mb-4">
  <div className="card" style={{
    background:   rc.bg,
    borderColor:  rc.color,
  }}>
    <div className="flex justify-between items-center">
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: rc.color }}>{rc.label}</div>
        <div className="text-muted" style={{ marginTop: 4 }}>{rc.desc}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: rc.color }}>{career.problemsSolved}</div>
        <div className="text-muted" style={{ fontSize: 13 }}>problems solved</div>
      </div>
    </div>
  </div>

  {/* Overall Goal Tracker */}
  {plan && (
    <div className="card">
      <div className="card-title">🏁 Overall Goal</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Goal: {plan.progressStats.totalTarget} problems</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
          {plan.progressStats.problemsSolved}/{plan.progressStats.totalTarget}
        </span>
      </div>
      <CareerProgressBar
        label=""
        done={plan.progressStats.problemsSolved}
        target={plan.progressStats.totalTarget}
        showCount={false}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {plan.progressStats.pct}% complete
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {plan.progressStats.totalTarget - plan.progressStats.problemsSolved} remaining
        </span>
      </div>

      {/* Today's Progress — improvement 4 */}
      <div style={{
        marginTop: 14, paddingTop: 12,
        borderTop: '1px solid var(--border)',
        display: 'flex', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>✅</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#34d399' }}>
              {todayProgress.done}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>done today</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>⏳</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fbbf24' }}>
              {todayProgress.remaining}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>remaining</div>
          </div>
        </div>
      </div>
    </div>
  )}
</div>

      {/* ── Target settings + DSA overview ── */}
      <div className="grid-2 mb-4">
        <div className="card">
          <div className="card-title">🎯 Target Settings</div>
          <div className="form-group">
            <label className="form-label">Target Company</label>
            <select className="form-select" value={career.targetCompany} onChange={e => setCareer(p => ({ ...p, targetCompany: e.target.value }))}>
              {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Target Role</label>
            <input className="form-input" value={career.targetRole} onChange={e => setCareer(p => ({ ...p, targetRole: e.target.value }))} placeholder="Software Engineer" />
          </div>
          <div className="form-group">
            <label className="form-label">Total Problems Solved</label>
            <input className="form-input" type="number" min="0" value={career.problemsSolved} onChange={e => setCareer(p => ({ ...p, problemsSolved: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Skills (comma-separated)</label>
            <input className="form-input" value={(career.skills || []).join(', ')} onChange={e => setCareer(p => ({ ...p, skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} placeholder="React, Node.js, MongoDB" />
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(career.skills || []).map(s => <span key={s} className="badge badge-primary">{s}</span>)}
          </div>
        </div>

        <div className="card">
          <div className="card-title">📊 DSA Progress Overview</div>
          <div style={{ marginBottom: 16 }}>
            <div className="flex justify-between" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 14 }}>{completedTopics} / {totalTopics} topics completed</span>
              <strong>{progressPct}%</strong>
            </div>
            <div className="progress">
              <div className={`progress-bar ${progressPct >= 75 ? 'success' : progressPct >= 40 ? 'warning' : 'danger'}`} style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          {[
            { label: 'Beginner',        threshold: 50,  reached: career.problemsSolved >= 50  },
            { label: 'Intermediate',    threshold: 100, reached: career.problemsSolved >= 100 },
            { label: 'Placement Ready', threshold: 200, reached: career.problemsSolved >= 200 },
          ].map(m => (
            <div key={m.label} className="flex items-center gap-2" style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>{m.reached ? '✅' : '⬜'}</span>
              <div>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{m.label}</span>
                <span className="text-muted" style={{ marginLeft: 8 }}>{m.threshold}+ problems</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── DSA Topic Tracker ── */}
      <div className="card mb-4">
        <div className="card-title">📋 DSA Topic Tracker</div>
        <div className="grid-2">
          {career.dsaTopics.map(topic => (
            <div key={topic.name} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 8, marginBottom: 8,
              background: topic.completed ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${topic.completed ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
            }}>
              <input type="checkbox" checked={topic.completed} onChange={e => toggleTopic(topic.name, e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }} />
              <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{topic.name}</div>
              <input type="number" min="0" value={topic.problems} onChange={e => updateProblems(topic.name, e.target.value)}
                style={{ width: 60, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'center', background: 'rgba(255,255,255,0.04)', color: 'var(--text)' }} />
              <span className="text-muted" style={{ fontSize: 12 }}>probs</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          STEP 5 — NEW SECTIONS BELOW
      ══════════════════════════════════════════════════════════ */}

      {/* ── Daily Action Plan ── */}
      {plan && (
        <div className="card mb-4">
          <div className="card-title">📅 Today's Action Plan</div>
          {plan.dailyTasks.length === 0 ? (
            <p className="text-muted">🎉 All topics on track! Keep solving.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {plan.dailyTasks.map((task, i) => (
                <div key={i} style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          12,
                  background:   'rgba(129,140,248,0.07)',
                  border:       '1px solid rgba(129,140,248,0.18)',
                  borderRadius: 10,
                  padding:      '12px 14px',
                }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: 'rgba(129,140,248,0.2)', color: 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                      {task.task}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>
                      {task.done}/{task.target} done · {task.gap} remaining
                    </div>
                  </div>
                  <span className={`badge ${task.gap >= 20 ? 'badge-danger' : task.gap >= 10 ? 'badge-warning' : 'badge-success'}`}>
                    {task.gap >= 20 ? '🔥 Urgent' : task.gap >= 10 ? '⚡ Active' : '✅ Near'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Level Progression + Focus Mode ── */}
      {plan && (
        <div className="grid-2 mb-4">
          <div className="card">
            <div className="card-title">🏆 Level Progression</div>
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--primary)', fontFamily: 'Space Grotesk, sans-serif' }}>
                {plan.progressStats.currentLevel}
              </div>
              {plan.progressStats.nextLevel && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  Next: {plan.progressStats.nextLevel} at {plan.progressStats.nextLevelAt} problems
                </div>
              )}
            </div>
            <CareerProgressBar
              label={`Progress to ${plan.progressStats.nextLevel || 'Max'}`}
              done={plan.progressStats.problemsSolved - (
                plan.progressStats.currentLevel === 'Beginner'     ? 0   :
                plan.progressStats.currentLevel === 'Intermediate' ? 50  :
                plan.progressStats.currentLevel === 'Advanced'     ? 100 : 200
              )}
              target={plan.progressStats.nextLevelAt
                ? plan.progressStats.nextLevelAt - (
                    plan.progressStats.currentLevel === 'Beginner'     ? 0   :
                    plan.progressStats.currentLevel === 'Intermediate' ? 50  :
                    plan.progressStats.currentLevel === 'Advanced'     ? 100 : 200
                  )
                : 1}
            />
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                {plan.progressStats.toNextLevel > 0
                  ? `${plan.progressStats.toNextLevel} more problems to next level`
                  : '🎉 Max level reached!'}
              </span>
            </div>
          </div>

          <FocusMode focusTopic={plan.focusTopic} />
        </div>
      )}

      {/* ── Topic Targets ── */}
      {plan && (
        <div className="card mb-4">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>🎯 Topic Targets</div>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              DSA: {plan.progressStats.problemsSolved} / {plan.progressStats.totalTarget} problems
            </span>
          </div>
          <div className="grid-2">
            {plan.topicProgress.map(t => (
              <CareerProgressBar key={t.name} label={t.name} done={t.done} target={t.target} />
            ))}
          </div>
        </div>
      )}

     {/* ── Weekly Plan ── */}
{plan && (
  <div className="card mb-4">
    <div className="card-title">📆 Weekly Plan</div>
    <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
      {plan.weeklyPlan.map((d, i) => (
        <button
          key={i}
          onClick={() => setActiveDay(i)}
          className={`btn btn-sm ${activeDay === i ? 'btn-primary' : 'btn-outline'}`}
        >
          {d.day}
        </button>
      ))}
    </div>
    {plan.weeklyPlan[activeDay] && (() => {
      const day    = plan.weeklyPlan[activeDay];
      const target = day.count || 5;
      const done   = Math.min(day.done, target);
      const pct    = Math.min(100, Math.round((done / target) * 100));
      return (
        <div style={{
          background: 'rgba(129,140,248,0.07)',
          border: '1px solid rgba(129,140,248,0.2)',
          borderRadius: 10, padding: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              {day.day} — {day.topic}
            </div>
            <span className={`badge ${pct >= 100 ? 'badge-success' : pct >= 50 ? 'badge-warning' : 'badge-danger'}`}>
              {pct >= 100 ? '✔ Done' : `${pct}%`}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
            📝 {day.task}
          </div>
          {/* Progress */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Progress</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{day.done}/{day.target} solved</span>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.07)',
            borderRadius: 99, height: 6, overflow: 'hidden',
          }}>
            <div style={{
              width:      `${pct}%`,
              height:     '100%',
              borderRadius: 99,
              background: pct >= 100
                ? 'linear-gradient(90deg,#34d399,#10b981)'
                : pct >= 50
                  ? 'linear-gradient(90deg,#fbbf24,#f59e0b)'
                  : 'linear-gradient(90deg,#f87171,#ef4444)',
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      );
    })()}
  </div>
)}

    </div>
  );
}