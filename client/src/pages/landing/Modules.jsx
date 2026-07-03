import { motion } from 'framer-motion';
import { Brain, ScanLine, BookOpen, Target, Mic, Trophy } from 'lucide-react';

const modules = [
  {
    icon: Brain,
    title: 'Academic Intelligence',
    desc: 'Unifies grades, attendance, and schedule into one live picture of your semester.',
    color: '#6366f1',
  },
  {
    icon: ScanLine,
    title: 'PDF Grade Extractor',
    desc: 'Parses text-based PDF marksheets and structured documents into queryable grade data.',
    color: '#a855f7',
  },
  {
    icon: BookOpen,
    title: 'AI Study Assistant',
    desc: 'RAG-based Q&A grounded in your own course material — not generic internet answers.',
    color: '#0ea5e9',
  },
  {
    icon: Target,
    title: 'Placement Readiness',
    desc: 'Scores you against real hiring bars and surfaces the exact gaps you need to close.',
    color: '#34d399',
  },
  {
    icon: Mic,
    title: 'Mock Interview Agent',
    desc: 'Simulates technical and HR rounds with real-time AI feedback on every answer.',
    color: '#f59e0b',
  },
  {
    icon: Trophy,
    title: 'Hackathon Discovery',
    desc: 'Matches you to competitions worth your time based on your stack and schedule.',
    color: '#ec4899',
  },
];

export default function Modules() {
  return (
    <section className="landing-section" id="modules">
      <div className="landing-container">
        <h2 className="section-title">
          AI <span className="gradient-text">Modules</span>
        </h2>
        <p className="section-subtitle">
          Six deep modules, each purpose-built for a specific part of student life.
        </p>

        <div className="modules-grid">
          {modules.map((mod, i) => {
            const Icon = mod.icon;
            return (
              <motion.div
                key={mod.title}
                className="module-card"
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ delay: i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
              >
                <div
                  className="module-icon-wrap"
                  style={{
                    background: `linear-gradient(135deg, ${mod.color}22, ${mod.color}11)`,
                    border: `1px solid ${mod.color}33`,
                  }}
                >
                  <Icon size={22} color={mod.color} />
                </div>
                <h3 className="module-title">{mod.title}</h3>
                <p className="module-desc">{mod.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
