import { useState, useEffect } from 'react';
import { careerService } from '../services/apiServices';
import toast from 'react-hot-toast';

const DIFF_COLOR = {
  Easy: '#34d399',
  Medium: '#fbbf24',
  Hard: '#f87171',
};

const FREQ_STYLE = {
  high: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', label: '🔥 High' },
  medium: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', label: '⚡ Medium' },
  low: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', label: '💡 Low' },
};

export default function CompanyQuestionsPanel({ career }) {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(career?.targetCompany || 'Amazon');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [selectedFrequency, setSelectedFrequency] = useState('');
  const [limit, setLimit] = useState(20);
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [availableTopics, setAvailableTopics] = useState([]);
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState(() => {
    const saved = localStorage.getItem('bookmarkedQuestions');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    if (career?.targetCompany) {
      setSelectedCompany(career.targetCompany);
    }
  }, [career?.targetCompany]);

  const toggleBookmark = (problem) => {
    const isBookmarked = bookmarkedQuestions.some(q => q.slug === problem.slug);
    let updated;
    if (isBookmarked) {
      updated = bookmarkedQuestions.filter(q => q.slug !== problem.slug);
      toast.success('Removed from bookmarks');
    } else {
      updated = [...bookmarkedQuestions, problem];
      toast.success('Added to bookmarks');
    }
    setBookmarkedQuestions(updated);
    localStorage.setItem('bookmarkedQuestions', JSON.stringify(updated));
  };

  const isBookmarked = (slug) => bookmarkedQuestions.some(q => q.slug === slug);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const params = {
        company: selectedCompany,
        limit,
      };
      if (selectedTopic) params.topic = selectedTopic;
      if (selectedDifficulty) params.difficulty = selectedDifficulty;
      if (selectedFrequency) params.frequency = selectedFrequency;

      const { data } = await careerService.getCompanyQuestions(params);
      setQuestions(data.problems || []);
      setStats(data.stats || null);
      setAvailableCompanies(data.availableCompanies || []);
      setAvailableTopics(data.availableTopics || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch company questions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [selectedCompany, selectedTopic, selectedDifficulty, selectedFrequency, limit]);

  return (
    <div style={{ marginBottom: 20 }}>
      <div className="card" style={{
        border: '1px solid rgba(99,102,241,0.35)',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(129,140,248,0.06) 100%)',
      }}>
        <div style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 4 }}>🏢 Company-Focused Questions</div>
          <p className="text-muted" style={{ fontSize: 13 }}>
            Real LeetCode problems frequently asked at your target company for interview preparation.
          </p>
        </div>

        {/* Stats Card */}
        {stats && (
          <div style={{
            padding: 14, borderRadius: 10, marginBottom: 16,
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                  {selectedCompany} Questions
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#818cf8' }}>
                  {stats.total}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>
                Company-specific LeetCode problems
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: '1 1 200px' }}>
            <label className="form-label" style={{ fontSize: 12 }}>Company</label>
            <select
              className="form-select"
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              disabled={loading}
            >
              {availableCompanies.map((company) => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label className="form-label" style={{ fontSize: 12 }}>Topic</label>
            <select
              className="form-select"
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              disabled={loading}
            >
              <option value="">All Topics</option>
              {availableTopics.map((topic) => (
                <option key={topic} value={topic}>{topic}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label className="form-label" style={{ fontSize: 12 }}>Difficulty</label>
            <select
              className="form-select"
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              disabled={loading}
            >
              <option value="">All</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label className="form-label" style={{ fontSize: 12 }}>Frequency</label>
            <select
              className="form-select"
              value={selectedFrequency}
              onChange={(e) => setSelectedFrequency(e.target.value)}
              disabled={loading}
            >
              <option value="">All</option>
              <option value="high">🔥 High</option>
              <option value="medium">⚡ Medium</option>
              <option value="low">💡 Low</option>
            </select>
          </div>
          <div style={{ flex: '1 1 100px' }}>
            <label className="form-label" style={{ fontSize: 12 }}>Limit</label>
            <select
              className="form-select"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              disabled={loading}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
          <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="button"
              className={`btn btn-sm ${bookmarkedQuestions.length > 0 ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => {
                if (bookmarkedQuestions.length > 0) {
                  setQuestions(bookmarkedQuestions);
                  setStats(null);
                }
              }}
              disabled={bookmarkedQuestions.length === 0}
              style={{ minWidth: '120px' }}
            >
              ★ Bookmarks ({bookmarkedQuestions.length})
            </button>
          </div>
        </div>

        {/* Questions Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div className="spinner" />
            <p className="text-muted" style={{ marginTop: 12 }}>Loading company questions...</p>
          </div>
        ) : questions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <p>No questions found with current filters.</p>
            <p style={{ fontSize: 12 }}>Try adjusting filters or sync your LeetCode account.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {questions.map((problem, index) => {
              const freqStyle = FREQ_STYLE[problem.frequency] || FREQ_STYLE.medium;
              return (
                <div
                  key={index}
                  style={{
                    padding: 14, borderRadius: 10,
                    border: `1px solid ${problem.isCompanySpecific ? 'rgba(99,102,241,0.35)' : 'var(--border)'}`,
                    background: problem.isCompanySpecific ? 'rgba(99,102,241,0.05)' : 'rgba(255,255,255,0.02)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, flex: 1, paddingRight: 8 }}>
                      {problem.title}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      padding: '2px 6px', borderRadius: 4,
                      background: freqStyle.bg, border: `1px solid ${freqStyle.border}`,
                      whiteSpace: 'nowrap',
                    }}>
                      {freqStyle.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 11, flexWrap: 'wrap' }}>
                    <span style={{ color: DIFF_COLOR[problem.difficulty] || 'var(--muted)', fontWeight: 600 }}>
                      {problem.difficulty}
                    </span>
                    <span style={{ color: 'var(--muted)' }}>•</span>
                    <span style={{ color: '#818cf8' }}>{problem.topic}</span>
                  </div>

                  {problem.isCompanySpecific && (
                    <div style={{
                      fontSize: 11, color: '#818cf8', marginBottom: 8,
                      padding: '4px 8px', borderRadius: 4,
                      background: 'rgba(99,102,241,0.1)',
                    }}>
                      🎯 {problem.company} specific
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <a
                      href={problem.leetcodeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1, fontSize: 11, textDecoration: 'none', textAlign: 'center' }}
                    >
                      Solve on LeetCode ↗
                    </a>
                    <button
                      type="button"
                      className={`btn btn-sm ${isBookmarked(problem.slug) ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => toggleBookmark(problem)}
                      style={{ fontSize: 11, minWidth: '40px' }}
                      title={isBookmarked(problem.slug) ? 'Remove bookmark' : 'Bookmark this problem'}
                    >
                      {isBookmarked(problem.slug) ? '★' : '☆'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Info */}
        {!loading && questions.length > 0 && (
          <div style={{ marginTop: 16, fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
            Showing {questions.length} questions from {selectedCompany}
            {selectedTopic && ` in ${selectedTopic}`}
            {selectedDifficulty && ` (${selectedDifficulty})`}
            {selectedFrequency && ` with ${selectedFrequency} frequency`}
          </div>
        )}
      </div>
    </div>
  );
}
