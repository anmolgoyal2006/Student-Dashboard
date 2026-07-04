import './landing.css';
import Hero from './Hero';
import Features from './Features';
import HowItWorks from './HowItWorks';
import Modules from './Modules';
import TechStack from './TechStack';
import WhyStudentAI from './WhyStudentAI';
import Demo from './Demo';
import Footer from './Footer';

export default function LandingPage() {
  return (
    <div className="landing-page">
      <Hero />
      <Features />
      <HowItWorks />
      <Modules />
      <TechStack />
      <WhyStudentAI />
      <Demo />
      <Footer />
    </div>
  );
}
