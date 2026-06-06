import { useState, useEffect, useCallback, useRef } from 'react';
import { careerService } from '../services/apiServices';
import toast from '../context/ToastContext';
import { 
  RefreshCw, CheckCircle, AlertCircle, ExternalLink, Target, Loader2, 
  BookOpen, Star, HelpCircle, Award, Sparkles, TrendingUp, Calendar
} from 'lucide-react';

const PRIORITY_STYLE = {
  high:   { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', label: 'High', color: '#ef4444' },
  medium: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', label: 'Medium', color: '#f59e0b' },
  low:    { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', label: 'Low', color: '#22c55e' },
};

const DIFF_COLOR = {
  Easy: '#22c55e', Medium: '#f59e0b', Hard: '#ef4444',
};

export default function DsaCoachPanel({ career, onCareerUpdate, plan }) {
  const [coach, setCoach] = useState(career?.dsaCoach || null);
  const [loading, setLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [guide, setGuide] = useState(null);
  const [guideLoad, setGuideLoad] = useState(false);
  const [hintTopic, setHintTopic] = useState('');
  const [hintTitle, setHintTitle] = useState('');
  const [hintAttempt, setHintAttempt] = useState('');
  const [hint, setHint] = useState(null);
  const [hintLoad, setHintLoad] = useState(false);
  const [lcUsername, setLcUsername] = useState(career?.leetcodeUsername || '');
  const [lcSyncing, setLcSyncing] = useState(false);
  const [lcLinking, setLcLinking] = useState(false);
  const lcAutoSynced = useRef(false);

  useEffect(() => {
    setLcUsername(career?.leetcodeUsername || '');
  }, [career?.leetcodeUsername]);

  const loadCoach = useCallback(async (refresh = false, silent = false) => {
    setLoading(true);
    try {
      const { data } = await careerService.getDsaCoach(refresh);
      setCoach(data.coach);
      if (data.career) onCareerUpdate?.(data.career);
      if (refresh && !silent) toast.success('AI coach plan refreshed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load AI coach');
    } finally {
      setLoading(false);
    }
  }, [onCareerUpdate]);

  const handleSyncLeetcode = useCallback(async (silent = false) => {
    const user = (lcUsername || career?.leetcodeUsername || '').trim();
    if (!user) {
      if (!silent) toast.error('Enter your LeetCode username first');
      return;
    }
    setLcSyncing(true);
    try {
      const { data } = await careerService.syncLeetcode(user);
      if (data.career) onCareerUpdate?.(data.career);
      if (!silent || (data.sync?.newCount > 0)) {
        toast.success(data.message || 'Synced with LeetCode');
      }
      if (data.career?.leetcodeUsername) {
        await loadCoach(true, silent);
      }
    } catch (err) {
      if (!silent) toast.error(err.response?.data?.message || 'LeetCode sync failed');
    } finally {
      setLcSyncing(false);
    }
  }, [lcUsername, career?.leetcodeUsername, onCareerUpdate, loadCoach]);

  const handleLinkLeetcode = async () => {
    const user = lcUsername.trim();
    if (!user) return toast.error('Enter your LeetCode username');
    setLcLinking(true);
    try {
      const { data } = await careerService.linkLeetcode(user);
      if (data.career) onCareerUpdate?.(data.career);
      toast.success('LeetCode account linked');
      await handleSyncLeetcode(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not link LeetCode');
    } finally {
      setLcLinking(false);
    }
  };

  const handleUnlinkLeetcode = async () => {
    try {
      const { data } = await careerService.unlinkLeetcode();
      setLcUsername('');
      if (data.career) onCareerUpdate?.(data.career);
      toast.success('LeetCode disconnected');
    } catch {
      toast.error('Could not disconnect');
    }
  };

  useEffect(() => {
    if (!career?.leetcodeUsername || lcAutoSynced.current) return;
    const last = career.leetcodeSync?.lastSyncAt;
    const stale = !last || Date.now() - new Date(last).getTime() > 30 * 60 * 1000;
    if (stale) {
      lcAutoSynced.current = true;
      handleSyncLeetcode(true);
    }
  }, [career?.leetcodeUsername, career?.leetcodeSync?.lastSyncAt, handleSyncLeetcode]);

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
  const scoreColor = placementScore >= 70 ? '#22c55e' : placementScore >= 40 ? '#f59e0b' : '#ef4444';
  const lcSync = career?.leetcodeSync;
  const lcLinked = Boolean(career?.leetcodeUsername);
  const lastSyncLabel = lcSync?.lastSyncAt
    ? new Date(lcSync.lastSyncAt).toLocaleString()
    : 'Never';

  // Metrics details
  const easyCount = lcSync?.easy ?? 0;
  const medCount = lcSync?.medium ?? 0;
  const hardCount = lcSync?.hard ?? 0;
  const totalCount = lcSync?.totalOnLeetcode ?? 0;

  return (
    <div style={{ marginBottom: 20 }}>
      {/* LeetCode Sync Section */}
      <div className="card mb-4" style={{
        position: 'relative',
        border: '1.5px solid rgba(99, 102, 241, 0.2)',
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                <RefreshCw size={16} color="var(--color-accent)" />
                LeetCode sync
              </span>
              {lcLinked ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                  fontSize: 11, fontWeight: 500,
                  background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e',
                  border: '1px solid rgba(34, 197, 94, 0.15)'
                }}>
                  <CheckCircle size={12} /> Connected
                </span>
              ) : (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                  fontSize: 11, fontWeight: 500,
                  background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b',
                  border: '1px solid rgba(245, 158, 11, 0.15)'
                }}>
                  <AlertCircle size={12} /> Not synced
                </span>
              )}
            </div>
            <p className="text-muted" style={{ fontSize: 13, maxWidth: 520, margin: 0 }}>
              Auto-sync from LeetCode — progress, AI plan, and problem picks (unsolved only). No manual logging.
            </p>
          </div>
          {lcLinked && (
            <a
              href={`https://leetcode.com/u/${career.leetcodeUsername}/`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline"
              style={{
                padding: '6px 12px',
                fontSize: 12,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'transparent',
                borderColor: 'var(--border)',
                color: 'var(--color-text-secondary)',
                textDecoration: 'none'
              }}
            >
              <ExternalLink size={14} />
              Open profile
            </a>
          )}
        </div>

        {/* Input layout */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', flexWrap: 'wrap' }}>
            <input
              className="form-input"
              style={{ flex: 1, minWidth: 200 }}
              placeholder="LeetCode username"
              value={lcUsername}
              onChange={(e) => setLcUsername(e.target.value.replace(/\s/g, ''))}
              disabled={lcSyncing || lcLinking}
            />
            {!lcLinked ? (
              <button
                type="button"
                className="btn btn-primary"
                style={{ height: 38, padding: '0 18px', fontSize: 13, flexShrink: 0 }}
                onClick={handleLinkLeetcode}
                disabled={lcLinking || lcSyncing || !lcUsername.trim()}
              >
                {lcLinking ? 'Linking...' : 'Link account'}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                style={{ height: 38, padding: '0 18px', fontSize: 13, flexShrink: 0 }}
                onClick={() => handleSyncLeetcode(false)}
                disabled={lcSyncing}
              >
                {lcSyncing ? 'Syncing...' : 'Sync now'}
              </button>
            )}
          </div>
          
          {lcLinked && (
            <button
              type="button"
              onClick={handleUnlinkLeetcode}
              disabled={lcSyncing}
              style={{
                alignSelf: 'flex-start',
                background: 'transparent',
                border: 'none',
                color: 'var(--color-danger, #ef4444)',
                fontSize: '12.5px',
                cursor: 'pointer',
                padding: '4px 0',
                textDecoration: 'underline',
              }}
            >
              Disconnect
            </button>
          )}
        </div>

        {/* Stats Metric Chips */}
        {lcLinked && lcSync?.totalOnLeetcode != null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 100, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Total solved</span>
                <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)' }}>{totalCount}</span>
              </div>
              <div style={{ flex: 1, minWidth: 100, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)', border: '1px solid rgba(34, 197, 94, 0.25)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Easy solves</span>
                <span style={{ fontSize: 18, fontWeight: 600, color: '#22c55e' }}>{easyCount}</span>
              </div>
              <div style={{ flex: 1, minWidth: 100, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)', border: '1px solid rgba(245, 158, 11, 0.25)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Medium solves</span>
                <span style={{ fontSize: 18, fontWeight: 600, color: '#f59e0b' }}>{medCount}</span>
              </div>
              <div style={{ flex: 1, minWidth: 100, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)', border: '1px solid rgba(239, 68, 68, 0.25)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Hard solves</span>
                <span style={{ fontSize: 18, fontWeight: 600, color: '#ef4444' }}>{hardCount}</span>
              </div>
            </div>

            {/* Mini ratio bar */}
            {totalCount > 0 && (
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: 'var(--color-surface-3)', width: '100%' }}>
                  <div style={{ width: `${(easyCount / totalCount) * 100}%`, background: '#22c55e' }} />
                  <div style={{ width: `${(medCount / totalCount) * 100}%`, background: '#f59e0b' }} />
                  <div style={{ width: `${(hardCount / totalCount) * 100}%`, background: '#ef4444' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 6 }}>
                  <span>Ratio composition</span>
                  <span>Last sync: {lastSyncLabel}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Coach Card */}
      <div className="card mb-4" style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(129,140,248,0.06) 100%)',
        border: '1px solid rgba(129,140,248,0.35)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={18} color="var(--color-accent)" />
              AI DSA Coach
            </div>
            <p className="text-muted" style={{ fontSize: 13, maxWidth: 520, margin: 0 }}>
              {coach?.leetcodeLinked
                ? `Plan based on your LeetCode (@${career?.leetcodeUsername}) — gaps, Easy-first topics, and problem counts.`
                : `Personalized for ${career?.targetCompany || 'your target'}. Link LeetCode above for topic-aware picks.`}
            </p>
          </div>
          
          <button 
            type="button"
            className="btn btn-outline" 
            onClick={() => loadCoach(true)} 
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', height: 32, padding: '0 12px', fontSize: 12 }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
            Refresh plan
          </button>
        </div>

        {loading && !coach ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div className="spinner" />
            <p className="text-muted" style={{ marginTop: 10 }}>Building your placement plan…</p>
          </div>
        ) : coach ? (
          <>
            {/* Plan Card */}
            {coach.leetcodeInsight && (
              <div style={{
                marginTop: 14, padding: 14, borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-2)', border: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', gap: 8
              }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-accent)' }}>Your AI plan</span>
                <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
                  {coach.leetcodeInsight}
                </span>
                {coach.dailyProblemTarget > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                    <Target size={14} color="var(--color-accent)" />
                    <span>Daily goal: solve <strong>{coach.dailyProblemTarget}</strong> problems/day on LeetCode</span>
                  </div>
                )}
              </div>
            )}

            {coach.uncoveredTopics?.length > 0 && (
              <div style={{ marginTop: 12, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={14} color="#ef4444" />
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  <strong style={{ color: '#ef4444' }}>Gaps on LeetCode (&lt;5 solves): </strong>
                  {coach.uncoveredTopics.join(', ')}
                </span>
              </div>
            )}

            {/* Horizontal Scroll Topic Roadmap */}
            {coach.topicRoadmap?.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10, color: 'var(--color-text-secondary)' }}>Topic roadmap</div>
                <div style={{ 
                  display: 'flex', 
                  gap: 12, 
                  overflowX: 'auto', 
                  paddingBottom: 8, 
                  scrollbarWidth: 'thin',
                  alignItems: 'stretch'
                }}>
                  {coach.topicRoadmap
                    .filter((r) => r.status === 'weak' || r.status === 'not_covered')
                    .sort((a, b) => (b.lcCount ?? 0) - (a.lcCount ?? 0))
                    .slice(0, 6)
                    .map((r) => {
                      const percentage = r.target > 0 ? Math.round((r.solved / r.target) * 100) : 0;
                      return (
                        <div key={r.topic} style={{
                          minWidth: 180,
                          flexShrink: 0,
                          padding: 12,
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--color-surface-2)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: 10
                        }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4 }}>{r.topic}</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                              <span style={{
                                fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                                background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-accent)',
                                border: '1px solid rgba(99, 102, 241, 0.15)'
                              }}>
                                {r.toSolveThisWeek}/wk
                              </span>
                              <span style={{
                                fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                                background: r.startWith === 'Easy' ? 'rgba(34, 197, 94, 0.1)' : r.startWith === 'Hard' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                color: r.startWith === 'Easy' ? '#22c55e' : r.startWith === 'Hard' ? '#ef4444' : '#f59e0b',
                                border: `1px solid ${r.startWith === 'Easy' ? 'rgba(34, 197, 94, 0.15)' : r.startWith === 'Hard' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'}`
                              }}>
                                {r.startWith || 'Easy'}
                              </span>
                            </div>
                          </div>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                              <span>Progress</span>
                              <span>{r.solved}/{r.target}</span>
                            </div>
                            <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--color-surface-3)', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(100, percentage)}%`, height: '100%', background: 'var(--color-accent)' }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  
                  <div style={{
                    minWidth: 120,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <button
                      type="button"
                      onClick={() => {
                        const manualTrackerBtn = document.querySelector('[data-manual-tracker-btn]');
                        if (manualTrackerBtn) {
                          manualTrackerBtn.click();
                          manualTrackerBtn.scrollIntoView({ behavior: 'smooth' });
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-accent)',
                        fontSize: 13.5,
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      View all topics →
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid-2" style={{ marginTop: 20, gap: 12 }}>
              <div style={{
                padding: 14, borderRadius: 10,
                background: 'var(--color-surface-2)', border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6, fontWeight: 500 }}>Placement readiness</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 32, fontWeight: 600, color: scoreColor }}>{placementScore}</span>
                  <span style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>/ 100</span>
                </div>
                <div className="progress" style={{ marginTop: 10, height: 6 }}>
                  <div className="progress-bar" style={{ width: `${placementScore}%`, background: scoreColor }} />
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginTop: 10, lineHeight: 1.45 }}>{coach.readinessInsight}</p>
              </div>
              <div style={{
                padding: 14, borderRadius: 10,
                background: 'var(--color-surface-2)', border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6, fontWeight: 500 }}>
                  {career?.targetCompany} focus
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--color-text-primary)' }}>{coach.companyFocus}</p>
                <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--color-accent-muted)', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                  <span style={{ fontSize: 11, color: 'var(--color-accent)', fontWeight: 500 }}>Next milestone</span>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{coach.nextMilestone}</div>
                </div>
                <p style={{ fontSize: 12.5, color: '#818cf8', marginTop: 10, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>💡 {coach.studyTip}</p>
              </div>
            </div>

            {/* Daily mission */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Target size={15} color="var(--color-accent)" />
                Today's mission
              </div>
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
                        background: 'rgba(255,255,255,0.04)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12,
                        color: 'var(--color-text-primary)'
                      }}>{i + 1}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--color-text-primary)' }}>{m.task}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                          {m.topic} · ~{m.minutes || 45} min
                          {m.problemsCount ? ` · ${m.problemsCount} problem(s)` : ''}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: ps.color }}>{ps.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recommended problems */}
            {coach.recommendedProblems?.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Award size={15} color="var(--color-accent)" />
                  Next problems (unsolved on LeetCode)
                  {career?.leetcodeSync?.solvedCount > 0 && (
                    <span className="text-muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: 11 }}>
                      filtered from {career.leetcodeSync.solvedCount} AC
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                  {coach.recommendedProblems.map((p, i) => (
                    <div key={i} style={{
                      padding: 14, borderRadius: 10,
                      border: '1px solid var(--border)',
                      background: 'var(--color-surface-2)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 10
                    }}
                      onClick={() => {
                        setHintTopic(p.topic);
                        setHintTitle(p.title);
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--color-text-primary)' }}>{p.title}</div>
                        <div style={{ fontSize: 11.5, color: DIFF_COLOR[p.difficulty] || 'var(--color-text-secondary)', marginTop: 4, fontWeight: 500 }}>
                          {p.difficulty} · {p.pattern}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 6, lineHeight: 1.4 }}>{p.why}</div>
                      </div>

                      <div>
                        {p.problemsToSolve > 0 && (
                          <div style={{ fontSize: 11.5, color: 'var(--color-accent)', marginTop: 6, fontWeight: 500 }}>
                            Solve <strong>{p.problemsToSolve}</strong> this week
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                          {p.leetcodeUrl && (
                            <a
                              href={p.leetcodeUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-primary"
                              style={{ fontSize: 11.5, padding: '4px 8px', height: 26, minHeight: 'auto', textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Solve
                            </a>
                          )}
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ fontSize: 11.5, padding: '4px 8px', height: 26, minHeight: 'auto', background: 'transparent' }}
                            onClick={(e) => { e.stopPropagation(); loadTopicGuide(p.topic); }}
                          >
                            Study guide
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>

      {lcLinked && career?.dsaSessions?.length > 0 && (
        <div className="card mb-4">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <TrendingUp size={18} color="var(--color-accent)" />
            Auto-synced from LeetCode
          </div>
          <p className="text-muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
            New solves update your tracker automatically when you sync.
          </p>
          {career.dsaSessions
            .filter((s) => s.aiFeedback === 'Synced from LeetCode' || s.note?.includes('LeetCode'))
            .slice(0, 5)
            .map((s, i) => (
              <div key={i} style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                <strong style={{ color: '#22c55e' }}>+{s.problemsAdded}</strong> — {s.note?.slice(0, 100)}
              </div>
            ))}
        </div>
      )}

      {/* Topic guide + hint */}
      <div className="grid-2 mb-4">
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <BookOpen size={18} color="var(--color-accent)" />
            AI topic guide
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, marginTop: 12 }}>
            {(career?.dsaTopics || []).map((t) => (
              <button
                key={t.name}
                type="button"
                className={`btn btn-sm ${selectedTopic === t.name ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '4px 10px', fontSize: 12, background: selectedTopic === t.name ? 'var(--color-accent)' : 'transparent' }}
                onClick={() => loadTopicGuide(t.name)}
              >
                {t.name}
              </button>
            ))}
          </div>
          {guideLoad && <div className="spinner" style={{ margin: '12px auto' }} />}
          {guide && !guideLoad && (
            <div style={{ fontSize: 13, marginTop: 12 }}>
              <p style={{ marginBottom: 10, lineHeight: 1.45, color: 'var(--color-text-primary)' }}>{guide.summary}</p>
              <div style={{ marginBottom: 10, color: 'var(--color-text-secondary)' }}>
                <strong>Key patterns:</strong>{' '}
                {(guide.keyPatterns || []).join(' · ')}
              </div>
              <div style={{ marginBottom: 12, color: 'var(--color-text-secondary)' }}>
                <strong>Study order:</strong>
                <ol style={{ margin: '6px 0 0 18px', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(guide.studyOrder || []).map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </div>
              {(guide.problems || []).map((p, i) => (
                <div key={i} style={{
                  padding: 12, marginBottom: 10, borderRadius: 8,
                  background: 'var(--color-surface-2)', border: '1px solid var(--border)',
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: DIFF_COLOR[p.difficulty], fontWeight: 500, marginTop: 2 }}>{p.difficulty} · {p.pattern}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', marginTop: 6, lineHeight: 1.4 }}>{p.approach}</div>
                  {p.leetcodeUrl && (
                    <a href={p.leetcodeUrl} target="_blank" rel="noreferrer" className="btn btn-outline"
                      style={{ marginTop: 8, fontSize: 11, padding: '4px 10px', height: 26, minHeight: 'auto', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', background: 'transparent' }}>
                      Open LeetCode
                    </a>
                  )}
                </div>
              ))}
              <p className="text-muted" style={{ fontSize: 11.5 }}>{guide.weekPlan}</p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <HelpCircle size={18} color="var(--color-accent)" />
            AI hint (no spoilers)
          </div>
          
          <div style={{ marginTop: 12 }}>
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
              <textarea className="form-input" rows={3} value={hintAttempt}
                onChange={(e) => setHintAttempt(e.target.value)} placeholder="What you tried so far…" />
            </div>
            <button className="btn btn-primary" onClick={fetchHint} disabled={hintLoad} style={{ height: 38, fontSize: 13 }}>
              {hintLoad ? 'Thinking...' : 'Get hint'}
            </button>
            {hint && (
              <div style={{
                marginTop: 14, padding: 12, borderRadius: 8,
                background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
                color: 'var(--color-text-primary)', fontSize: 13, lineHeight: 1.45
              }}>
                <div>{hint.hint}</div>
                {hint.nextStep && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 8, fontWeight: 500 }}>
                    Recommended next step: {hint.nextStep}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI weekly schedule */}
      {coach?.weeklyFocus?.length > 0 && (
        <div className="card mb-4">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Calendar size={18} color="var(--color-accent)" />
            AI weekly schedule
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {coach.weeklyFocus.map((d, i) => (
              <div key={i} style={{
                padding: 12, borderRadius: 'var(--radius-md)', textAlign: 'center',
                background: plan?.weeklyPlan?.[i]?.day === d.day ? 'var(--color-accent-muted)' : 'var(--color-surface-2)',
                border: plan?.weeklyPlan?.[i]?.day === d.day ? '1.5px solid var(--color-accent)' : '1.5px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--color-accent)' }}>{d.day}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 2, color: 'var(--color-text-primary)' }}>{d.topic}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{d.goal}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
