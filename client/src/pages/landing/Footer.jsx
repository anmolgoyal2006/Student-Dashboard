import { GraduationCap, Globe, Mail, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="landing-footer">
      <div className="landing-container">
        <div className="footer-inner">
          <Link to="/" className="footer-logo">
            <div className="navbar-logo-icon">
              <GraduationCap size={18} color="#fff" />
            </div>
            <span className="footer-wordmark">StudentAI</span>
          </Link>

          <div className="footer-links">
            <a
              href="https://github.com/anmolgoyal2006/Student-Dashboard"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={14} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/anmol-goyal-082788290/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Globe size={14} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
              LinkedIn
            </a>
            <Link to="/login">
              <ExternalLink size={14} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
              Live Demo
            </Link>
            <a href="mailto:anmolgoyal@gmail.com">
              <Mail size={14} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
              Email
            </a>
          </div>

          <p className="footer-credit">
            Built by Anmol Goyal &middot; PEC Chandigarh &middot; Computer Science
          </p>
        </div>
      </div>
    </footer>
  );
}
