
import { useState } from 'react';
import { Calendar, Trophy, Save, BookmarkCheck, Zap, X, ExternalLink } from 'lucide-react';

const difficultyColors = {
  beginner: { bg: 'rgba(16,185,129,0.12)', color: 'var(--color-success)' },
  intermediate: { bg: 'rgba(251,191,36,0.12)', color: 'var(--color-warning)' },
  advanced: { bg: 'rgba(248,113,113,0.12)', color: 'var(--color-danger)' }
};

export default function OpportunityCard({
  opportunity,
  matchScore,
  matchReasons,
  isSaved,
  onSave,
  onUnsave,
  showMatchScore = true
}) {
  const [loading, setLoading] = useState(false);
  const [showDescription, setShowDescription] = useState(false);

  const handleSaveToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      if (isSaved) {
        await onUnsave(opportunity._id);
      } else {
        await onSave(opportunity._id);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = () => {
    if (opportunity.registrationUrl) {
      window.open(opportunity.registrationUrl, '_blank');
    }
  };

  const handleDescriptionClick = (e) => {
    e.stopPropagation();
    setShowDescription(true);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'TBD';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const stripHtml = (html) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const getBannerImage = () => {
    if (opportunity.banner) {
      // For banners, if it's a URL, use as background image, otherwise use as color
      if (opportunity.banner.startsWith('http')) {
        return `url(${opportunity.banner})`;
      } else {
        return opportunity.banner;
      }
    }
    // Fallbacks
    if (opportunity.source === 'unstop') {
      return `linear-gradient(135deg, #6366f155, #8b5cf655)`;
    }
    if (opportunity.source === 'devfolio') {
      return `linear-gradient(135deg, #00d9ff55, #7c3aed55)`;
    }
    return `linear-gradient(135deg, 
      ${opportunity.source === 'devfolio' ? '#00d9ff' : '#6366f1'}33, 
      ${opportunity.source === 'devfolio' ? '#7c3aed' : '#8b5cf6'}22)`;
  };

  const diffStyle = difficultyColors[opportunity.difficulty] || difficultyColors.intermediate;

  return (
    <>
      <div
        onClick={handleCardClick}
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'var(--color-surface-1)',
          overflow: 'hidden',
          transition: 'all 0.2s ease',
          textDecoration: 'none',
          color: 'inherit',
          cursor: 'pointer',
          maxWidth: '100%',
          width: '100%'
        }}
        className="card"
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'var(--shadow)';
        }}
      >
        {/* Banner */}
        <div style={{
          height: 130,
          background: getBannerImage(),
          backgroundSize: 'contain',
          backgroundPosition: '50% 50%',
          backgroundRepeat: 'no-repeat',
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {opportunity.banner && opportunity.banner.startsWith('http') && !opportunity.banner.endsWith('_') && (
            <img
              src={opportunity.banner}
              onError={e => { e.target.style.display = 'none' }}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                pointerEvents: 'none'
              }}
            />
          )}
        {showMatchScore && matchScore !== undefined && (
            <div style={{
              position: 'absolute',
              top: 10,
              right: 10,
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(8px)',
              padding: '6px 12px',
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 700
            }}>
              <Zap size={12} style={{ color: matchScore >= 80 ? 'var(--color-success)' : matchScore >= 60 ? 'var(--color-warning)' : 'var(--color-text-secondary)' }} />
              <span style={{ color: matchScore >= 80 ? 'var(--color-success)' : matchScore >= 60 ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>
                {matchScore}% Match
              </span>
            </div>
          )}

          <div style={{
            position: 'absolute',
            bottom: 10,
            left: 10,
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap'
          }}>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(6px)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em'
            }}>
              {opportunity.source}
            </span>
            {opportunity.category && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(99,102,241,0.25)',
                backdropFilter: 'blur(6px)',
                color: 'var(--color-accent)'
              }}>
                {opportunity.category}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '14px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
            <h3 style={{
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.3,
              margin: 0,
              color: 'var(--text)',
              flex: 1
            }}>
              {opportunity.title}
            </h3>

            <button
              onClick={handleSaveToggle}
              disabled={loading}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 6,
                borderRadius: 8,
                cursor: 'pointer',
                color: isSaved ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                opacity: loading ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isSaved ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {isSaved ? <BookmarkCheck size={18} /> : <Save size={18} />}
            </button>
          </div>

          <p
          onClick={handleDescriptionClick}
          style={{
            fontSize: 12,
            color: 'var(--color-text-secondary)',
            margin: '0 0 12px',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            flex: 1,
            cursor: 'pointer',
            minHeight: '2.5em'
          }}
        >
          {stripHtml(opportunity.description) || 'No description available'}
          {opportunity.description && (
            <span style={{ color: 'var(--color-accent)', marginLeft: 4, fontSize: 11 }}>View more</span>
          )}
        </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              padding: '4px 8px',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 8
            }}>
              <Calendar size={13} />
              {formatDate(opportunity.registrationDeadline)}
            </div>

            {opportunity.prizePool > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: 'var(--color-text-secondary)',
                padding: '4px 8px',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 8
              }}>
                <Trophy size={13} />
                {opportunity.currency === 'USD' ? '$' : '₹'}{opportunity.prizePool.toLocaleString()}
              </div>
            )}

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 8px',
              background: diffStyle.bg,
              color: diffStyle.color,
              borderRadius: 8,
              textTransform: 'capitalize'
            }}>
              {opportunity.difficulty}
            </div>
          </div>

          {showMatchScore && matchReasons && matchReasons.length > 0 && (
            <div style={{
              fontSize: 11,
              color: 'var(--color-text-tertiary)',
              paddingTop: 10,
              borderTop: '1px solid rgba(255,255,255,0.05)'
            }}>
              {matchReasons.slice(0, 2).map((reason, i) => (
                <span key={i} style={{ display: 'block' }}>• {reason}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Description Modal */}
      {showDescription && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          zIndex: 9999
        }} onClick={() => setShowDescription(false)}>
          <div className="card" style={{
            maxWidth: 600,
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{opportunity.title}</h2>
              <button
                onClick={() => setShowDescription(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: 'var(--color-text-primary)',
              whiteSpace: 'pre-wrap'
            }}>
              {stripHtml(opportunity.description)}
            </div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  if (opportunity.registrationUrl) {
                    window.open(opportunity.registrationUrl, '_blank');
                  }
                }}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <ExternalLink size={16} />
                Register Now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
