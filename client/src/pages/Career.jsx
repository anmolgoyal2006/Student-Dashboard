import { useEffect, useState } from 'react';
import { careerService } from '../services/apiServices';
import toast from 'react-hot-toast';

const COMPANIES = ['Amazon', 'Microsoft', 'Google', 'Flipkart', 'Adobe', 'Infosys', 'TCS', 'Other'];

const READINESS_CONFIG = {
  Beginner:     { color: '#f59e0b', bg: '#fffbeb', label: '🌱 Beginner',     desc: 'Focus on DSA fundamentals and build projects.' },
  Intermediate: { color: '#6366f1', bg: '#eef2ff', label: '🔥 Intermediate', desc: 'Start mock interviews and system design prep.' },
  Ready:        { color: '#22c55e', bg: '#f0fdf4', label: '🏆 Ready',        desc: 'You are placement ready! Polish HR round prep.' },
};

export default function Career() {
  const [career,  setCareer]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  const load = async () => {
    try {
      const { data } = await careerService.get();
      setCareer(data.career);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

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
    } catch (err) {
      toast.error('Failed to save');
    } finally { setSaving(false); }
  };

  const toggleTopic = (topicName, completed) => {
    const updated = career.dsaTopics.map(t =>
      t.name === topicName ? { ...t, completed } : t
    );
    setCareer(p => ({ ...p, dsaTopics: updated }));
  };

  const updateProblems = (topicName, problems) => {
    const updated = career.dsaTopics.map(t =>
      t.name === topicName ? { ...t, problems: parseInt(problems) || 0 } : t
    );
    setCareer(p => ({ ...p, dsaTopics: updated }));
  };

  if (loading) return <div className="spinner" />;
  if (!career) return <p className="text-muted">Failed to load career data.</p>;

  const completedTopics = career.dsaTopics.filter(t => t.completed).length;
  const totalTopics     = career.dsaTopics.length;
  const progressPct     = totalTopics ? Math.round((completedTopics / totalTopics) * 100) : 0;
  const rc              = READINESS_CONFIG[career.readiness] || READINESS_CONFIG.Beginner;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🚀 Career Preparation</h1>
          <p className="page-subtitle">Track your DSA progress and placement readiness</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : '💾 Save Progress'}
        </button>
      </div>

      <div className="card mb-4" style={{ background: rc.bg, borderColor: rc.color }}>
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
            { label: 'Beginner',      threshold: 50,  reached: career.problemsSolved >= 50  },
            { label: 'Intermediate',  threshold: 100, reached: career.problemsSolved >= 100 },
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

      <div className="card">
        <div className="card-title">📋 DSA Topic Tracker</div>
        <div className="grid-2">
          {career.dsaTopics.map(topic => (
            <div key={topic.name} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 8, marginBottom: 8,
              background: topic.completed ? '#f0fdf4' : 'var(--bg)',
              border: `1px solid ${topic.completed ? '#bbf7d0' : 'var(--border)'}`,
            }}>
              <input type="checkbox" checked={topic.completed} onChange={e => toggleTopic(topic.name, e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }} />
              <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{topic.name}</div>
              <input type="number" min="0" value={topic.problems} onChange={e => updateProblems(topic.name, e.target.value)}
                style={{ width: 60, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'center' }} />
              <span className="text-muted" style={{ fontSize: 12 }}>probs</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
