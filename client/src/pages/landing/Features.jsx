import { motion } from 'framer-motion';
import {
  FileText, BookOpen, Brain, Mic, Target,
  RefreshCw, BarChart2, Trophy, Command, Briefcase,
} from 'lucide-react';

const features = [
  { icon: FileText,   title: 'PDF Grade Extractor',         desc: 'Upload text-based PDF marksheets and extract grades instantly — no manual entry',  color: '#6366f1' },
  { icon: BookOpen,   title: 'AI Notes Assistant (RAG)',     desc: 'Ask questions grounded in your own notes and course material',                       color: '#a855f7' },
  { icon: Brain,      title: 'Quiz Generation',              desc: 'Auto-generated practice quizzes from your syllabus',                                  color: '#ec4899' },
  { icon: Mic,        title: 'AI Mock Interviews',           desc: 'Practice placement interviews with an AI interviewer',                                color: '#0ea5e9' },
  { icon: Target,     title: 'Placement Readiness',          desc: 'See exactly where you stand for campus hiring',                                       color: '#34d399' },
  { icon: RefreshCw,  title: 'Google Classroom Sync',        desc: 'Assignments and grades, always up to date',                                           color: '#f59e0b' },
  { icon: BarChart2,  title: 'Attendance Analytics',         desc: 'Track attendance trends before they become a problem',                                color: '#6366f1' },
  { icon: Trophy,     title: 'Hackathon Discovery',          desc: 'Surfaced opportunities matched to your skills',                                       color: '#a855f7' },
  { icon: Command,    title: 'AI Command Bar',               desc: 'Control the whole dashboard from one search bar',                                     color: '#0ea5e9' },
  { icon: Briefcase,  title: 'Career Dashboard',             desc: 'One place for resume, applications, and outcomes',                                    color: '#34d399' },
];

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  }),
};

export default function Features() {
  return (
    <section className="landing-section" id="features">
      <div className="landing-container">
        <h2 className="section-title">
          Everything a student <span className="gradient-text">needs</span>
        </h2>
        <p className="section-subtitle">
          From PDF grade extraction to AI-powered mock interviews — all in one cohesive platform.
        </p>

        <div className="features-grid">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                className="feature-card"
                custom={i}
                variants={cardVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
              >
                <div
                  className="feature-icon-wrap"
                  style={{ background: `${f.color}1a` }}
                >
                  <Icon size={20} color={f.color} />
                </div>
                <h3 className="feature-card-title">{f.title}</h3>
                <p className="feature-card-desc">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
