import { useState, useEffect } from 'react';
import { careerService } from '../services/apiServices';
import toast from '../context/ToastContext';
import EmptyState from './EmptyState';
import { CardSkeleton } from './Skeleton';
import { Briefcase, Bookmark, Star, Target, ExternalLink, Search, X } from 'lucide-react';

const DIFF_COLOR = {
  Easy: 'var(--color-success)',
  Medium: 'var(--color-warning)',
  Hard: 'var(--color-danger)',
};

const FREQ_STYLE = {
  high: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', label: 'High' },
  medium: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', label: 'Medium' },
  low: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', label: 'Low' },
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
  const [searchQuery, setSearchQuery] = useState('');
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

  const filteredQuestions = questions.filter(problem =>
    problem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    problem.topic.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const clearFilters = () => {
    setSelectedTopic('');
    setSelectedDifficulty('');
    setSelectedFrequency('');
    setSearchQuery('');
  };

  const hasActiveFilters = selectedTopic || selectedDifficulty || selectedFrequency || searchQuery;

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
          <div className="card-title" style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Briefcase size={18} style={{ color: 'var(--color-accent)' }} />
            Company-Focused Questions
          </div>
          <p className="text-muted" style={{ fontSize: 13 }}>
            Real LeetCode problems frequently asked at your target company for interview preparation.
          </p>
        </div>

        {/* Stats Card */}
        {stats && (
          <div style={{
            padding: 16, borderRadius: 10, marginBottom: 16,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(129,140,248,0.05) 100%)',
            border: '1px solid rgba(99,102,241,0.25)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Questions
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {stats.total}
                </div>
              </div>
              {stats.easy !== undefined && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Easy
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-success)' }}>
                    {stats.easy}
                  </div>
                </div>
              )}
              {stats.medium !== undefined && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Medium
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-warning)' }}>
                    {stats.medium}
                  </div>
                </div>
              )}
              {stats.hard !== undefined && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Hard
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-danger)' }}>
                    {stats.hard}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
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
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
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
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
              <input
                type="text"
                placeholder="Search problems by title or topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  fontSize: 13,
                  background: 'var(--color-surface-3)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-accent)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              />
            </div>
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
              style={{ minWidth: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Bookmark size={14} />
              Bookmarks ({bookmarkedQuestions.length})
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={clearFilters}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <X size={14} />
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Questions Grid */}
        {loading ? (
          <CardSkeleton count={4} />
        ) : filteredQuestions.length === 0 ? (
          <EmptyState
            title="No questions found"
            subtitle={searchQuery ? "No problems match your search. Try different keywords." : "Try adjusting filters or sync your LeetCode account."}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {filteredQuestions.map((problem, index) => {
              const freqStyle = FREQ_STYLE[problem.frequency] || FREQ_STYLE.medium;
              return (
                <div
                  key={index}
                  style={{
                    padding: 16, borderRadius: 12,
                    border: `1px solid ${problem.isCompanySpecific ? 'rgba(99,102,241,0.35)' : 'var(--border)'}`,
                    background: problem.isCompanySpecific ? 'rgba(99,102,241,0.05)' : 'var(--color-surface-2)',
                    transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
                    e.currentTarget.style.borderColor = problem.isCompanySpecific ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = problem.isCompanySpecific ? 'rgba(99,102,241,0.35)' : 'var(--border)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, flex: 1, paddingRight: 12, lineHeight: 1.4 }}>
                      {problem.title}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      padding: '3px 8px', borderRadius: 6,
                      background: freqStyle.bg, border: `1px solid ${freqStyle.border}`,
                      whiteSpace: 'nowrap',
                    }}>
                      {freqStyle.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{
                      color: problem.difficulty === 'Easy' ? '#10b981' : problem.difficulty === 'Medium' ? '#f59e0b' : problem.difficulty === 'Hard' ? '#ef4444' : 'var(--color-text-tertiary)',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: 'transparent',
                    }}>
                      {problem.difficulty}
                    </span>
                    <span style={{ color: 'var(--color-text-tertiary)' }}>•</span>
                    <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{problem.topic}</span>
                  </div>

                  {problem.isCompanySpecific && (
                    <div style={{
                      fontSize: 11, color: 'var(--color-accent)', marginBottom: 10,
                      padding: '6px 10px', borderRadius: 6,
                      background: 'rgba(99,102,241,0.1)',
                      display: 'flex', alignItems: 'center', gap: '6px',
                      fontWeight: 500,
                    }}>
                      <Target size={12} />
                      {problem.company} specific
                    </div>
                  )}

                  <div style={{ marginTop: 'auto', display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    <a
                      href={problem.leetcodeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1, fontSize: 12, textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 12px' }}
                    >
                      Solve <ExternalLink size={12} />
                    </a>
                    <button
                      type="button"
                      className={`btn btn-sm ${isBookmarked(problem.slug) ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => toggleBookmark(problem)}
                      style={{ fontSize: 12, minWidth: '44px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title={isBookmarked(problem.slug) ? 'Remove bookmark' : 'Bookmark this problem'}
                    >
                      {isBookmarked(problem.slug) ? (
                        <Star size={14} fill="currentColor" />
                      ) : (
                        <Star size={14} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Info */}
        {!loading && filteredQuestions.length > 0 && (
          <div style={{ marginTop: 16, fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
            {searchQuery ? (
              <>Showing {filteredQuestions.length} of {questions.length} questions matching "{searchQuery}"</>
            ) : (
              <>Showing {filteredQuestions.length} questions from {selectedCompany}
              {selectedTopic && ` in ${selectedTopic}`}
              {selectedDifficulty && ` (${selectedDifficulty})`}
              {selectedFrequency && ` with ${selectedFrequency} frequency`}</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
