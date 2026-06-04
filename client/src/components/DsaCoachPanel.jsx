import { useState, useEffect, useCallback, useRef } from 'react';
import { careerService } from '../services/apiServices';
import toast from 'react-hot-toast';

const PRIORITY_STYLE = {
  high:   { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', label: '🔥 High' },
  medium: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', label: '⚡ Medium' },
  low:    { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', label: '✅ Low' },
};

const DIFF_COLOR = {
  Easy: '#34d399', Medium: '#fbbf24', Hard: '#f87171',
};

export default function DsaCoachPanel({ career, onCareerUpdate, plan }) {
  const [coach, setCoach]           = useState(career?.dsaCoach || null);
  const [loading, setLoading]       = useState(false);
  const [logText, setLogText]         = useState('');
  const [logging, setLogging]       = useState(false);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [guide, setGuide]           = useState(null);
  const [guideLoad, setGuideLoad]   = useState(false);
  const [hintTopic, setHintTopic]   = useState('');
  const [hintTitle, setHintTitle]   = useState('');
  const [hintAttempt, setHintAttempt] = useState('');
  const [hint, setHint]             = useState(null);
  const [hintLoad, setHintLoad]     = useState(false);

  const loadCoach = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const { data } = await careerService.getDsaCoach(refresh);
      setCoach(data.coach);
      if (data.career) onCareerUpdate?.(data.career);
      if (refresh) toast.success('AI coach plan refreshed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load AI coach');
    } finally {
      setLoading(false);
    }
  }, [onCareerUpdate]);

  const coachBootstrapped = useRef(false);

  useEffect(() => {
    if (!career) return;
    if (career.dsaCoach?.dailyMission?.length) {
      setCoach(career.dsaCoach);
      coachBootstrapped.current = true;
      return;
    }
    if (!coachBootstrapped.current) {
      coachBootstrapped.current = true;
      loadCoach(false);
    }
  }, [career, loadCoach]);

  const loadTopicGuide = async (topic) => {
    setSelectedTopic(topic);
    setGuide(null);
    setGuideLoad(true);
    try {
      const { data } = await careerService.getDsaTopicGuide(topic);
      setGuide(data.guide);
    } catch {
      toast.error('Failed to load topic guide');
    } finally {
      setGuideLoad(false);
    }
  };

  const handleLogPractice = async () => {
    if (!logText.trim()) return;
    setLogging(true);
    try {
      const { data } = await careerService.logDsaPractice(logText.trim());
      toast.success(data.message || 'Practice logged!');
      setLogText('');
      if (data.career) onCareerUpdate?.(data.career);
      if (data.result?.suggestedNext) toast(data.result.suggestedNext, { icon: '💡' });
      loadCoach(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to log practice');
    } finally {
      setLogging(false);
    }
  };

  const fetchHint = async () => {
    if (!hintTopic || !hintTitle.trim()) return;
    setHintLoad(true);
    setHint(null);
    try {
      const { data } = await careerService.getDsaHint(hintTopic, hintTitle, hintAttempt);
      setHint(data.hint);
    } catch {
      toast.error('Could not get hint');
    } finally {
      setHintLoad(false);
    }
  };

  const placementScore = coach?.placementScore ?? 0;
  const scoreColor = placementScore >= 70 ? '#34d399' : placementScore >= 40 ? '#fbbf24' : '#f87171';

  return (
    <div style={{ marginBottom: 20 }}>
      {/* ── AI Coach header ── */}
      <div className="card mb-4" style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(129,140,248,0.06) 100%)',
        border: '1px solid rgba(129,140,248,0.35)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 4 }}>🤖 AI DSA Coach</div>
            <p className="text-muted" style={{ fontSize: 13, maxWidth: 520 }}>
              Personalized for {career?.targetCompany || 'your target'} · powered by Groq.
              Log practice in plain English — AI updates your tracker.
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => loadCoach(true)} disabled={loading}>
            {loading ? '⏳ Thinking…' : '🔄 Refresh plan'}
          </button>
        </div>

        {loading && !coach ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div className="spinner" />
            <p className="text-muted" style={{ marginTop: 10 }}>Building your placement plan…</p>
          </div>
        ) : coach ? (
          <>
            <div className="grid-2" style={{ marginTop: 16, gap: 12 }}>
              <div style={{
                padding: 14, borderRadius: 10,
                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Placement readiness</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 36, fontWeight: 700, color: scoreColor }}>{placementScore}</span>
                  <span style={{ color: 'var(--muted)' }}>/ 100</span>
                </div>
                <div className="progress" style={{ marginTop: 10 }}>
                  <div className="progress-bar" style={{ width: `${placementScore}%`, background: scoreColor }} />
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>{coach.readinessInsight}</p>
              </div>
              <div style={{
                padding: 14, borderRadius: 10,
                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
                  {career?.targetCompany} focus
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.5 }}>{coach.companyFocus}</p>
                <div style={{ marginTop: 12, padding: '8px 10px', borderRadius: 8, background: 'rgba(129,140,248,0.1)' }}>
                  <span style={{ fontSize: 11, color: '#a5b4fc' }}>Next milestone</span>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{coach.nextMilestone}</div>
                </div>
                <p style={{ fontSize: 12, color: '#818cf8', marginTop: 10, fontStyle: 'italic' }}>💡 {coach.studyTip}</p>
              </div>
            </div>

            {/* Daily mission */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>🎯 Today&apos;s mission</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(coach.dailyMission || []).map((m, i) => {
                  const ps = PRIORITY_STYLE[m.priority] || PRIORITY_STYLE.medium;
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 10,
                      background: ps.bg, border: `1px solid ${ps.border}`,
                    }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(255,255,255,0.08)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12,
                      }}>{i + 1}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{m.task}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                          {m.topic} · ~{m.minutes || 45} min
                        </div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600 }}>{ps.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recommended problems */}
            {(coach.recommendedProblems?.length > 0) && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📌 AI problem picks</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                  {coach.recommendedProblems.map((p, i) => (
                    <div key={i} style={{
                      padding: 12, borderRadius: 10,
                      border: '1px solid var(--border)',
                      background: 'rgba(255,255,255,0.02)',
                      cursor: 'pointer',
                    }}
                      onClick={() => {
                        setHintTopic(p.topic);
                        setHintTitle(p.title);
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{p.title}</div>
                      <div style={{ fontSize: 11, color: DIFF_COLOR[p.difficulty] || 'var(--muted)', marginTop: 4 }}>
                        {p.difficulty} · {p.pattern}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{p.why}</div>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ marginTop: 8, fontSize: 10 }}
                        onClick={(e) => { e.stopPropagation(); loadTopicGuide(p.topic); }}
                      >
                        Study {p.topic}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* ── Log practice ── */}
      <div className="card mb-4">
        <div className="card-title">✍️ Log today&apos;s practice</div>
        <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Example: &quot;Solved Two Sum and Best Time to Buy Stock on LeetCode — Arrays&quot;
        </p>
        <textarea
          className="form-input"
          rows={3}
          placeholder="What did you solve today? AI will update your topic counts…"
          value={logText}
          onChange={(e) => setLogText(e.target.value)}
          style={{ resize: 'vertical', marginBottom: 10 }}
        />
        <button className="btn btn-primary" onClick={handleLogPractice} disabled={logging || !logText.trim()}>
          {logging ? '⏳ Logging…' : '✅ Log practice with AI'}
        </button>
        {career?.dsaSessions?.length > 0 && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Recent sessions</div>
            {career.dsaSessions.slice(0, 3).map((s, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                <strong style={{ color: 'var(--text)' }}>+{s.problemsAdded}</strong> — {s.note?.slice(0, 80)}
                {s.aiFeedback && <span style={{ color: '#818cf8' }}> · {s.aiFeedback}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Topic guide + hint ── */}
      <div className="grid-2 mb-4">
        <div className="card">
          <div className="card-title">📚 AI topic guide</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {(career?.dsaTopics || []).map((t) => (
              <button
                key={t.name}
                type="button"
                className={`btn btn-sm ${selectedTopic === t.name ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => loadTopicGuide(t.name)}
              >
                {t.name}
              </button>
            ))}
          </div>
          {guideLoad && <div className="spinner" style={{ margin: '12px auto' }} />}
          {guide && !guideLoad && (
            <div style={{ fontSize: 13 }}>
              <p style={{ marginBottom: 10 }}>{guide.summary}</p>
              <div style={{ marginBottom: 10 }}>
                <strong>Patterns:</strong>{' '}
                {(guide.keyPatterns || []).join(' · ')}
              </div>
              <div style={{ marginBottom: 12 }}>
                <strong>Study order:</strong>
                <ol style={{ margin: '6px 0 0 18px', padding: 0 }}>
                  {(guide.studyOrder || []).map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </div>
              {(guide.problems || []).map((p, i) => (
                <div key={i} style={{
                  padding: 10, marginBottom: 8, borderRadius: 8,
                  background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.15)',
                }}>
                  <div style={{ fontWeight: 600 }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: DIFF_COLOR[p.difficulty] }}>{p.difficulty} · {p.pattern}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{p.approach}</div>
                </div>
              ))}
              <p className="text-muted" style={{ fontSize: 11 }}>{guide.weekPlan}</p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">💡 AI hint (no spoilers)</div>
          <div className="form-group">
            <label className="form-label">Topic</label>
            <select className="form-select" value={hintTopic} onChange={(e) => setHintTopic(e.target.value)}>
              <option value="">Select topic</option>
              {(career?.dsaTopics || []).map((t) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Problem</label>
            <input className="form-input" value={hintTitle} onChange={(e) => setHintTitle(e.target.value)}
              placeholder="e.g. Two Sum, LRU Cache" />
          </div>
          <div className="form-group">
            <label className="form-label">Your attempt (optional)</label>
            <textarea className="form-input" rows={2} value={hintAttempt}
              onChange={(e) => setHintAttempt(e.target.value)} placeholder="What you tried so far…" />
          </div>
          <button className="btn btn-primary btn-sm" onClick={fetchHint} disabled={hintLoad}>
            {hintLoad ? '⏳…' : 'Get hint'}
          </button>
          {hint && (
            <div style={{
              marginTop: 12, padding: 12, borderRadius: 8,
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
            }}>
              <div style={{ fontSize: 13 }}>{hint.hint}</div>
              {hint.nextStep && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                  Next: {hint.nextStep}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI weekly overlay if coach has weeklyFocus */}
      {coach?.weeklyFocus?.length > 0 && (
        <div className="card mb-4">
          <div className="card-title">📅 AI weekly schedule</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {coach.weeklyFocus.map((d, i) => (
              <div key={i} style={{
                padding: 10, borderRadius: 8, textAlign: 'center',
                background: plan?.weeklyPlan?.[i]?.day === d.day ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#818cf8' }}>{d.day}</div>
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{d.topic}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{d.goal}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
