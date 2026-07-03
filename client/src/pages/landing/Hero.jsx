import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, ArrowRight, GitBranch, Play } from 'lucide-react';

const techChips = [
  'React', 'Node.js', 'MongoDB', 'Gemini AI',
  'Firebase', 'Google Classroom', 'Chart.js', 'JWT', 'Google OAuth',
  'React', 'Node.js', 'MongoDB', 'Gemini AI',
  'Firebase', 'Google Classroom', 'Chart.js', 'JWT', 'Google OAuth',
];

const barHeights = [40, 65, 50, 80, 60, 75, 45, 70, 55, 85];

function DashboardMockup() {
  return (
    <div className="mockup-frame">
      <div className="mockup-titlebar">
        <div className="mockup-dot mockup-dot-r" />
        <div className="mockup-dot mockup-dot-y" />
        <div className="mockup-dot mockup-dot-g" />
      </div>
      <div className="mockup-inner">
        <div className="mockup-sidebar">
          {[true, false, false, false, false].map((active, i) => (
            <div key={i} className={`mockup-sidebar-item ${active ? 'active' : ''}`} />
          ))}
        </div>
        <div className="mockup-main">
          <div className="mockup-row">
            <div className="mockup-card mockup-card-accent mockup-card-accent-indigo">
              <div className="mockup-label">CGPA</div>
              <div className="mockup-value">8.7</div>
              <div className="mockup-bar-row">
                {[40,65,50,80,60].map((h, i) => (
                  <div key={i} className="mockup-bar" style={{ height: h + '%' }} />
                ))}
              </div>
            </div>
            <div className="mockup-card mockup-card-accent mockup-card-accent-purple">
              <div className="mockup-label">Attendance</div>
              <div className="mockup-value">87%</div>
              <div className="mockup-bar-row">
                {[70,85,75,90,80].map((h, i) => (
                  <div key={i} className="mockup-bar" style={{ height: h + '%', background: 'linear-gradient(135deg,#a855f7,#ec4899)' }} />
                ))}
              </div>
            </div>
          </div>
          <div className="mockup-row">
            <div className="mockup-card mockup-card-accent mockup-card-accent-cyan">
              <div className="mockup-label">Readiness</div>
              <div className="mockup-value" style={{ fontSize: 16 }}>72 / 100</div>
              <div className="mockup-line w-full" style={{ marginTop: 'auto' }} />
              <div className="mockup-line w-3-4" />
              <div className="mockup-line w-half" />
            </div>
            <div className="mockup-chart-placeholder">
              {barHeights.map((h, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    borderRadius: '3px 3px 0 0',
                    height: h + '%',
                    background: i % 2 === 0
                      ? 'linear-gradient(135deg,#6366f1,#a855f7)'
                      : 'rgba(99,102,241,0.25)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="hero-section">
      {/* Ambient orbs */}
      <div className="landing-orb landing-orb-1" />
      <div className="landing-orb landing-orb-2" />
      <div className="landing-orb landing-orb-3" />
      <div className="landing-orb landing-orb-4" />
      <div className="landing-grid" />

      {/* Navbar */}
      <nav className="landing-navbar">
        <div className="navbar-inner">
          <a href="#" className="navbar-logo">
            <div className="navbar-logo-icon">
              <GraduationCap size={20} color="#fff" />
            </div>
            <span className="navbar-wordmark">StudentAI</span>
          </a>
          <ul className="navbar-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#how-it-works">How it works</a></li>
            <li><a href="#modules">Modules</a></li>
            <li><a href="#tech-stack">Tech Stack</a></li>
          </ul>
          <Link to="/login" className="navbar-signin">Sign In</Link>
        </div>
        <div className="navbar-divider" />
      </nav>

      {/* Hero content */}
      <div className="hero-content">
        <div className="landing-container" style={{ width: '100%' }}>
          <div className="hero-grid">
            <motion.div
              className="hero-left"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="hero-eyebrow">
                <span className="hero-eyebrow-dot" />
                AI-Powered Platform
              </div>
              <h1 className="hero-headline">
                AI-Powered{' '}
                <span className="gradient-text">Academic Success</span>{' '}
                Platform
              </h1>
              <p className="hero-subtitle">
                One platform to unify grades, attendance, notes, placements, and opportunities.
                Powered by Gemini AI and Google Classroom.
              </p>
              <div className="hero-ctas">
                <Link to="/login" className="btn-primary">
                  Get Started <ArrowRight size={16} />
                </Link>
                <a href="#modules" className="btn-outline">
                  <Play size={15} /> View Demo
                </a>
                <a
                  href="https://github.com/anmolgoyal2006/Student-Dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline"
                >
                  <GitBranch size={15} /> GitHub
                </a>
              </div>
            </motion.div>

            <motion.div
              className="hero-right"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <DashboardMockup />
            </motion.div>
          </div>
        </div>
      </div>

      {/* Marquee */}
      <div className="marquee-section">
        <div className="marquee-label">Powered by</div>
        <div className="marquee-track">
          <div className="marquee-inner">
            {techChips.map((name, i) => (
              <span key={i} className="marquee-chip liquid-glass">{name}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
