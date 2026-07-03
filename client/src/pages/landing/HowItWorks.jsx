import { motion } from 'framer-motion';

const steps = [
  {
    n: '01',
    title: 'Upload notes or marksheet',
    desc: 'Drag-and-drop a text-based PDF marksheet or class notes. Gemini AI handles the extraction.',
  },
  {
    n: '02',
    title: 'AI extracts and analyzes',
    desc: 'Grades are parsed, subjects mapped, and a structured academic profile is built automatically.',
  },
  {
    n: '03',
    title: 'Get personalized recommendations',
    desc: 'The AI highlights at-risk subjects, attendance gaps, and improvement areas just for you.',
  },
  {
    n: '04',
    title: 'Track academics automatically',
    desc: 'Google Classroom syncs assignments and grades. Your dashboard updates in real-time.',
  },
  {
    n: '05',
    title: 'Prepare for placements',
    desc: 'Readiness scoring, DSA coaching, mock interviews, and company-wise question sets — all in-app.',
  },
  {
    n: '06',
    title: 'Discover hackathons',
    desc: 'Curated opportunities matched to your tech stack surface right in your dashboard.',
  },
];

export default function HowItWorks() {
  return (
    <section className="landing-section" id="how-it-works" style={{ background: 'rgba(99,102,241,0.02)' }}>
      <div className="landing-container">
        <h2 className="section-title">
          How <span className="gradient-text">StudentAI</span> Works
        </h2>
        <p className="section-subtitle">
          Six steps from raw data to actionable insight — all automated, all AI-powered.
        </p>

        <div className="hiw-steps">
          {steps.map((step, i) => (
            <motion.div
              key={step.n}
              className="hiw-step-card"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="hiw-step-number">{step.n}</div>
              <h3 className="hiw-step-title">{step.title}</h3>
              <p className="hiw-step-desc">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
