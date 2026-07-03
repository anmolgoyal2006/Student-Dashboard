import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  // If already logged in, skip landing and go straight to dashboard
  useEffect(() => {
    if (isLoggedIn) navigate('/dashboard', { replace: true });
  }, [isLoggedIn, navigate]);

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
