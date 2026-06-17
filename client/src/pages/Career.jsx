import { useEffect, useState, useRef, useMemo } from 'react';
import { careerService, opportunityService } from '../services/apiServices';
import OpportunityCard from '../components/OpportunityCard';
import FocusMode           from '../components/FocusMode';
import CustomSelect        from '../components/CustomSelect';
import CareerProgressBar   from '../components/CareerProgressBar';
import DsaCoachPanel       from '../components/DsaCoachPanel';
import CompanyQuestionsPanel from '../components/CompanyQuestionsPanel';
import toast from '../context/ToastContext';
import { 
  Briefcase, CheckCircle, Brain, BarChart2, Sprout, Flame, Award, 
  Target, Settings, Calendar, FileText, ClipboardList, RefreshCw, 
  ChevronDown, ChevronRight, Activity, Lightbulb, Bot, Mic, Loader2,
  Gamepad, ExternalLink, Trash2, ShieldAlert, Clock, Upload, Trophy, Search, Filter
} from 'lucide-react';
import EmptyState from '../components/EmptyState';

const COMPANIES = ['Amazon', 'Microsoft', 'Google', 'Meta', 'Apple', 'Netflix', 'Flipkart', 'Adobe', 'Uber', 'LinkedIn', 'Salesforce', 'Oracle', 'Infosys', 'TCS', 'Wipro', 'HCL Technologies', 'Other'];

const READINESS_CONFIG = {
  Beginner:     { color: 'var(--color-warning)', bg: 'rgba(245,158,11,0.06)',  label: 'Beginner',     desc: 'Focus on DSA fundamentals and build projects.', icon: Sprout },
  Intermediate: { color: 'var(--color-accent)', bg: 'rgba(99,102,241,0.06)',  label: 'Intermediate', desc: 'Start mock interviews and system design prep.', icon: Flame },
  Ready:        { color: 'var(--color-success)', bg: 'rgba(34,197,94,0.06)',   label: 'Ready',        desc: 'You are placement ready! Polish HR round prep.', icon: Award },
};

export default function Career() {
  const [career,    setCareer]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [plan,      setPlan]      = useState(null);
  const [planLoad,  setPlanLoad]  = useState(true);
  const [activeDay, setActiveDay] = useState(0);
  const [todayProgress, setTodayProgress] = useState({ done: 0, remaining: 0 });
  const [manualDsaOpen, setManualDsaOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const isFirstRender = useRef(true);

  // Tab switching
  const [activeTab, setActiveTab] = useState('dsa');

  // Hackathons state
  const [hackathons, setHackathons] = useState([]);
  const [baseHackathons, setBaseHackathons] = useState([]); // unfiltered full list for filter options
  const [hackathonLoading, setHackathonLoading] = useState(true);
  const [savedEventIds, setSavedEventIds] = useState(new Set());
  const [hackathonView, setHackathonView] = useState('all'); // 'all' | 'recommended' | 'saved' | 'closing'
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState({
    source: '',
    category: '',
    difficulty: '',
    startDate: '',
    endDate: '',
    minPrize: '',
    maxPrize: ''
  });

  // Filter options always derived from the full unfiltered list so options never disappear
  const filterOptions = useMemo(() => {
    const sources = [...new Set(baseHackathons.map(e => e.source).filter(Boolean))];
    const categories = [...new Set(baseHackathons.map(e => e.category).filter(Boolean))];
    const difficulties = [...new Set(baseHackathons.map(e => e.difficulty).filter(Boolean))];
    return {
      sources: sources.map(v => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) })),
      categories: categories.map(v => ({ value: v, label: v })),
      difficulties: difficulties.map(v => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }))
    };
  }, [baseHackathons]);

  // Function to load saved event IDs
  const loadSavedEventIds = async () => {
    try {
      const { data } = await opportunityService.getSaved();
      const ids = new Set((data.data || []).map(e => e._id.toString()));
      setSavedEventIds(ids);
    } catch (err) {
      console.error('Failed to load saved events:', err);
    }
  };

  // Resume Scanner State
  const [scanMethod, setScanMethod] = useState('pdf'); // 'pdf' | 'text'
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeText, setResumeText] = useState('');
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeAnalysis, setResumeAnalysis] = useState(null);
  const [isDragging, setIsDragging] = useState(false); // Drag-and-drop state

  // Interview Prep State
  const [interviewTopic, setInterviewTopic] = useState('Arrays');
  const [questions, setQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null); // Selected past interview details
  const [isListening, setIsListening] = useState(false);
  const voiceRecogRef = useRef(null);

  const handleAnalyzeResume = async () => {
    if (!resumeText.trim()) return;
    setResumeLoading(true);
    try {
      const { data } = await careerService.analyzeResume(resumeText);
      setResumeAnalysis(data);
      toast.success('Resume analyzed successfully!');
      setCareer(prev => ({ ...prev, resumeScore: data.score, resumeFeedback: data.feedback, resumeKeywords: data.missingKeywords }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to analyze resume');
    } finally {
      setResumeLoading(false);
    }
  };

  const handleUploadResume = async () => {
    if (!resumeFile) return;
    setResumeLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', resumeFile);

      const { data } = await careerService.uploadResume(formData);
      setResumeAnalysis(data);
      toast.success('Resume file scanned and analyzed successfully!');
      setCareer(prev => ({ ...prev, resumeScore: data.score, resumeFeedback: data.feedback, resumeKeywords: data.missingKeywords }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to analyze resume file');
    } finally {
      setResumeLoading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = file.type.startsWith('image/') || /\.(png|jpe?g)$/i.test(file.name);
      if (!isPdf && !isImage) {
        toast.error('Only PDF and image formats (PNG, JPG, JPEG) are supported.');
        return;
      }
      setResumeFile(file);
      toast.success(`Selected file: ${file.name}`);
    }
  };

  const handleGenerateQuestions = async () => {
    setQuestionsLoading(true);
    setQuestions([]);
    setEvaluationResult(null);
    setUserAnswer('');
    setShowModelAnswer(false);
    try {
      const { data } = await careerService.getMockQuestions(interviewTopic);
      const activeInt = data.activeInterview;
      setQuestions(activeInt.questions || []);
      setActiveQuestionIndex(0);
      toast.success('Generated mock interview questions!');
      setCareer(prev => ({ ...prev, activeInterview: activeInt }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate questions');
    } finally {
      setQuestionsLoading(false);
    }
  };

  const handleEvaluateAnswer = async () => {
    if (!userAnswer.trim()) return;
    voiceRecogRef.current?.stop();
    setIsListening(false);
    setEvaluating(true);
    setEvaluationResult(null);
    setShowModelAnswer(false);
    try {
      const questionText = questions[activeQuestionIndex]?.question;
      const { data } = await careerService.evaluateAnswer(questionText, userAnswer, interviewTopic);
      setEvaluationResult(data);
      toast.success('Response evaluated!');
      if (data.career) {
        setCareer(data.career);
        setQuestions(data.career.activeInterview?.questions || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to evaluate response');
    } finally {
      setEvaluating(false);
    }
  };

  const handleVoiceAnswer = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice dictation not supported in this browser. Try Chrome.');
      return;
    }

    if (isListening) {
      voiceRecogRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    voiceRecogRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    const baseText = userAnswer ? userAnswer.trim() + ' ' : '';
    let currentText = '';

    recognition.onstart = () => {
      setIsListening(true);
      toast.info('Listening... Speak your answer.');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (e) => {
      setIsListening(false);
      if (e.error === 'aborted') return;

      if (e.error === 'network') {
        toast.error('Voice dictation needs an active browser speech connection. Try again in a moment.');
      } else {
        console.warn('Speech recognition error:', e.error);
        toast.error('Voice dictation error: ' + e.error);
      }
    };

    recognition.onresult = (event) => {
      let resultText = '';
      for (let i = 0; i < event.results.length; ++i) {
        resultText += event.results[i][0].transcript;
      }
      currentText = resultText;
      setUserAnswer(baseText + resultText);
    };

    recognition.start();
  };

  const handleNavQuestion = async (newIndex) => {
    voiceRecogRef.current?.stop();
    setIsListening(false);
    setActiveQuestionIndex(newIndex);
    try {
      await careerService.updateActiveIndex(newIndex);
    } catch (err) {
      console.error('Failed to sync active index:', err.message);
    }
  };

  const handleResetInterview = async () => {
    voiceRecogRef.current?.stop();
    setIsListening(false);
    if (!window.confirm('Are you sure you want to reset this interview session? This will clear the active questions and answers.')) return;
    try {
      const { data } = await careerService.resetActiveInterview();
      setCareer(data.career);
      setQuestions([]);
      setActiveQuestionIndex(0);
      setUserAnswer('');
      setEvaluationResult(null);
      toast.success('Interview session reset!');
    } catch (err) {
      toast.error('Failed to reset interview session');
    }
  };

  const handleResetScanner = () => {
    setResumeFile(null);
    setResumeText('');
    setResumeAnalysis(null);
    toast.success('Scanner reset!');
  };

  const load = async () => {
    try {
      const { data } = await careerService.get();
      setCareer(data.career);

      if (data.career.resumeScore > 0) {
        setResumeAnalysis({
          score: data.career.resumeScore,
          feedback: data.career.resumeFeedback || [],
          missingKeywords: data.career.resumeKeywords || []
        });
      }

      const activeInt = data.career.activeInterview;
      if (activeInt && activeInt.questions && activeInt.questions.length > 0) {
        setInterviewTopic(activeInt.topic || 'Arrays');
        setQuestions(activeInt.questions);
        setActiveQuestionIndex(activeInt.activeIndex || 0);
      }
    } finally { setLoading(false); }
  };

  const loadPlan = async () => {
    try {
      const { data } = await careerService.getPlan();
      setPlan(data);
    } catch { /* silent */ }
    finally { setPlanLoad(false); }
  };

  const loadHackathons = async (view, currentFilters) => {
    setHackathonLoading(true);
    try {
      let data;
      const activeFilters = currentFilters || filters;
      const hasActiveFilter = Object.values(activeFilters).some(v => v !== '');

      // If any filter is active, always use the 'all' endpoint with filter params
      if (hasActiveFilter) {
        const params = { limit: 100 };
        Object.entries(activeFilters).forEach(([key, value]) => {
          if (value) params[key] = value;
        });
        data = (await opportunityService.getAll(params)).data;
      } else {
        switch (view) {
          case 'recommended':
            data = (await opportunityService.getRecommended()).data;
            break;
          case 'saved':
            data = (await opportunityService.getSaved()).data;
            break;
          case 'closing':
            data = (await opportunityService.getClosingSoon()).data;
            break;
          default: {
            const params = { limit: 100 };
            data = (await opportunityService.getAll(params)).data;
          }
        }
        // On unfiltered 'all' fetch, update the base list so filter options stay complete
        if (view === 'all') {
          setBaseHackathons(data.data || data.events || []);
        }
      }
      setHackathons(data.data || data.events || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load hackathons');
    } finally {
      setHackathonLoading(false);
    }
  };

  const handleSaveEvent = async (eventId) => {
    try {
      await opportunityService.save(eventId);
      toast.success('Event saved!');
      // Update local state
      setSavedEventIds(prev => new Set([...prev, eventId.toString()]));
      // If on saved view, refresh
      if (hackathonView === 'saved') {
        const { data } = await opportunityService.getSaved();
        setHackathons(data.data || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save event');
    }
  };

  const handleUnsaveEvent = async (eventId) => {
    try {
      await opportunityService.unsave(eventId);
      toast.success('Event removed from saved!');
      // Update local state
      setSavedEventIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(eventId.toString());
        return newSet;
      });
      // If on saved view, refresh
      if (hackathonView === 'saved') {
        const { data } = await opportunityService.getSaved();
        setHackathons(data.data || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to unsave event');
    }
  };

  // Reload hackathons when view or filters change
  useEffect(() => {
    if (activeTab === 'hackathons') {
      loadHackathons(hackathonView, filters);
      loadSavedEventIds();
    }
  }, [activeTab, hackathonView, filters]);

  useEffect(() => { load(); loadPlan(); }, []);

  // Bind active question details reactively when navigating
  useEffect(() => {
    if (questions.length > 0 && questions[activeQuestionIndex]) {
      const q = questions[activeQuestionIndex];
      setUserAnswer(q.userAnswer || '');
      if (q.isEvaluated) {
        setEvaluationResult({
          score: q.score,
          feedback: q.feedback,
          modelAnswer: q.modelAnswer
        });
      } else {
        setEvaluationResult(null);
      }
      setShowModelAnswer(false);
    } else {
      setUserAnswer('');
      setEvaluationResult(null);
      setShowModelAnswer(false);
    }
  }, [activeQuestionIndex, questions]);

  useEffect(() => {
    if (!plan) return;
    const done = plan.dailyTasks.filter(t => t.done >= t.count).length;
    const remaining = plan.dailyTasks.length - done;
    setTodayProgress({ done, remaining });
  }, [plan]);

  // Debounced auto-save effect
  useEffect(() => {
    if (loading || !career) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await careerService.update({
          targetCompany:  career.targetCompany,
          targetRole:     career.targetRole,
          problemsSolved: career.problemsSolved,
          skills:         career.skills,
          dsaTopics:      career.dsaTopics,
        });
        setSaveStatus('saved');
        const { data } = await careerService.getPlan();
        setPlan(data);
      } catch (err) {
        setSaveStatus('error');
        toast.error('Auto-save failed');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    career?.targetCompany,
    career?.targetRole,
    career?.problemsSolved,
    JSON.stringify(career?.skills),
    JSON.stringify(career?.dsaTopics)
  ]);

  const toggleTopic = (topicName, completed) => {
    setCareer(p => ({
      ...p,
      dsaTopics: p.dsaTopics.map(t => t.name === topicName ? { ...t, completed } : t),
    }));
  };

  const updateProblems = (topicName, problems) => {
    setCareer(p => ({
      ...p,
      dsaTopics: p.dsaTopics.map(t => t.name === topicName ? { ...t, problems: parseInt(problems) || 0 } : t),
    }));
  };

  if (loading) return <div className="spinner" />;
  if (!career) return <p className="text-muted">Failed to load career data.</p>;

  const completedTopics = career.dsaTopics.filter(t => t.completed).length;
  const totalTopics     = career.dsaTopics.length;
  const progressPct     = totalTopics ? Math.round((completedTopics / totalTopics) * 100) : 0;
  
  const rc              = READINESS_CONFIG[career.readiness] || READINESS_CONFIG.Beginner;
  const ReadinessIcon   = rc.icon;

  const hasAiCoach      = Boolean(
    career.dsaCoach?.dailyMission?.length || career.dsaCoach?.weeklyFocus?.length
  );
  
  const TABS = [
    { id: 'dsa',    label: 'DSA tracker', icon: BarChart2 },
    { id: 'prep',   label: 'AI career prep', icon: Brain },
    { id: 'hackathons', label: 'Hackathons', icon: Trophy },
  ];

  const totalSolved = career.leetcodeUsername ? (career.leetcodeSync?.totalOnLeetcode ?? 0) : (career.problemsSolved ?? 0);
  const easySolved = career.leetcodeSync?.easy ?? 0;
  const medSolved = career.leetcodeSync?.medium ?? 0;
  const hardSolved = career.leetcodeSync?.hard ?? 0;

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '22px', fontWeight: 500 }}>
            <Briefcase size={20} color="var(--color-accent)" />
            Career preparation
          </h1>
          <p className="page-subtitle">Track your DSA progress and placement readiness</p>
          
          {/* Summary Stat pills */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, padding: '4px 10px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent)' }} />
              Total solved: <strong>{totalSolved}</strong>
            </span>
            <span style={{ fontSize: 12, padding: '4px 10px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)' }} />
              Easy: <strong>{easySolved}</strong>
            </span>
            <span style={{ fontSize: 12, padding: '4px 10px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-warning)' }} />
              Medium: <strong>{medSolved}</strong>
            </span>
            <span style={{ fontSize: 12, padding: '4px 10px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-danger)' }} />
              Hard: <strong>{hardSolved}</strong>
            </span>
          </div>
        </div>

        {/* Auto-save Status Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', height: 38 }}>
          {saveStatus === 'saving' && (
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={14} color="var(--color-success)" />
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span style={{ fontSize: 13, color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldAlert size={14} />
              Save error
            </span>
          )}
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        marginBottom: 24,
        gap: 24,
        marginTop: 12
      }}>
        {TABS.map(tab => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '12px 4px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: activeTab === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                borderBottom: activeTab === tab.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                fontSize: 13.5,
                fontWeight: activeTab === tab.id ? 500 : 400,
                transition: 'all 0.15s ease'
              }}
            >
              <TabIcon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'dsa' ? (
        <>
          <DsaCoachPanel
            career={career}
            plan={plan}
            onCareerUpdate={(updated) => {
              setCareer(updated);
              careerService.getPlan().then(({ data }) => setPlan(data)).catch(() => {});
            }}
          />

          <CompanyQuestionsPanel career={career} />

          {/* Readiness + Overall Goal */}
          <div className="grid-2 mb-4">
            
            {/* Readiness Card */}
            <div className="card" style={{
              background: rc.bg,
              borderColor: rc.color,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: 20
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: rc.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ReadinessIcon size={18} color={rc.color} />
                    {rc.label}
                  </div>
                  <div className="text-muted" style={{ marginTop: 4, fontSize: 13 }}>{rc.desc}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 26, fontWeight: 600, color: rc.color }}>{career.problemsSolved}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>problems solved</div>
                </div>
              </div>
            </div>

            {/* Overall Goal Tracker */}
            {plan && (
              <div className="card">
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={18} color="var(--color-accent)" />
                  Overall goal
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, marginTop: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Goal: {plan.progressStats.totalTarget} problems</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-accent)' }}>
                    {plan.progressStats.problemsSolved}/{plan.progressStats.totalTarget}
                  </span>
                </div>
                <CareerProgressBar
                  label=""
                  done={plan.progressStats.problemsSolved}
                  target={plan.progressStats.totalTarget}
                  showCount={false}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {plan.progressStats.pct}% complete
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {plan.progressStats.totalTarget - plan.progressStats.problemsSolved} remaining
                  </span>
                </div>

                {!hasAiCoach && (
                  <div style={{
                    marginTop: 14, paddingTop: 12,
                    borderTop: '1px solid var(--border)',
                    display: 'flex', gap: 16,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle size={16} color="var(--color-success)" />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-success)' }}>
                          {todayProgress.done}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>done today</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={16} color="var(--color-warning)" />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-warning)' }}>
                          {todayProgress.remaining}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>remaining</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Manual tracker trigger */}
          {!career.leetcodeUsername && (
            <div className="card mb-4" style={{ padding: 0, overflow: 'hidden' }}>
              <button
                type="button"
                data-manual-tracker-btn
                onClick={() => setManualDsaOpen(o => !o)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                  color: 'var(--color-text-primary)', textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Settings size={16} color="var(--color-accent)" />
                    Manual tracker & settings
                  </div>
                  <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {hasAiCoach
                      ? 'AI coach handles plans — expand to edit targets or topics'
                      : 'Target company, problem counts, and topic checklist'}
                  </div>
                </div>
                <span style={{ color: 'var(--color-text-secondary)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  {manualDsaOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </span>
              </button>
              {manualDsaOpen && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                  <div className="grid-2 mb-4" style={{ marginTop: 16 }}>
                    <div className="card" style={{ marginBottom: 0 }}>
                      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                        <Target size={15} color="var(--color-accent)" />
                        Target settings
                      </div>
                      <div className="form-group" style={{ marginTop: 12 }}>
                        <label className="form-label">Target Company</label>
                        <select className="form-select" value={career.targetCompany} onChange={e => setCareer(p => ({ ...p, targetCompany: e.target.value }))}>
                          {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Target Role</label>
                        <input className="form-input" value={career.targetRole} onChange={e => setCareer(p => ({ ...p, targetRole: e.target.value }))} placeholder="Software Engineer" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Total Problems Solved</label>
                        <input className="form-input" type="number" min="0" value={career.problemsSolved} onChange={e => setCareer(p => ({ ...p, problemsSolved: parseInt(e.target.value) || 0 }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Skills (comma-separated)</label>
                        <input className="form-input" value={(career.skills || []).join(', ')} onChange={e => setCareer(p => ({ ...p, skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} placeholder="React, Node.js, MongoDB" />
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(career.skills || []).map(s => <span key={s} className="badge badge-primary">{s}</span>)}
                      </div>
                    </div>

                    <div className="card" style={{ marginBottom: 0 }}>
                      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                        <BarChart2 size={15} color="var(--color-accent)" />
                        DSA progress overview
                      </div>
                      <div style={{ marginBottom: 16, marginTop: 12 }}>
                        <div className="flex justify-between" style={{ marginBottom: 6 }}>
                          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{completedTopics} / {totalTopics} topics completed</span>
                          <strong style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{progressPct}%</strong>
                        </div>
                        <div className="progress" style={{ height: 6 }}>
                          <div className={`progress-bar ${progressPct >= 75 ? 'success' : progressPct >= 40 ? 'warning' : 'danger'}`} style={{ width: `${progressPct}%` }} />
                        </div>
                      </div>
                      {[
                        { label: 'Beginner',        threshold: 50,  reached: career.problemsSolved >= 50  },
                        { label: 'Intermediate',    threshold: 100, reached: career.problemsSolved >= 100 },
                        { label: 'Placement Ready', threshold: 200, reached: career.problemsSolved >= 200 },
                      ].map(m => (
                        <div key={m.label} className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                          <span style={{ display: 'flex', alignItems: 'center' }}>
                            {m.reached ? <CheckCircle size={15} color="var(--color-success)" /> : <div style={{ width: 14, height: 14, border: '1px solid var(--border)', borderRadius: '50%' }} />}
                          </span>
                          <div style={{ marginLeft: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{m.label}</span>
                            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-text-secondary)' }}>{m.threshold}+ problems</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card" style={{ marginBottom: 0, marginTop: 16 }}>
                    <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, marginBottom: 12 }}>
                      <ClipboardList size={15} color="var(--color-accent)" />
                      DSA topic tracker
                    </div>
                    <div className="grid-2">
                      {career.dsaTopics.map(topic => (
                        <div key={topic.name} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 10px', borderRadius: 8, marginBottom: 6,
                          background: topic.completed ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.01)',
                          border: `1px solid ${topic.completed ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
                        }}>
                          <input type="checkbox" checked={topic.completed} onChange={e => toggleTopic(topic.name, e.target.checked)}
                            style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--color-accent)' }} />
                          <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{topic.name}</div>
                          <input type="number" min="0" value={topic.problems} onChange={e => updateProblems(topic.name, e.target.value)}
                            style={{ width: 56, padding: '4px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, textAlign: 'center', background: 'rgba(255,255,255,0.02)', color: 'var(--color-text-primary)' }} />
                          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>solved</span>
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 12, marginBottom: 0 }}>
                      Changes auto-save instantly in the background.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Today's Action Plan */}
          {plan && !hasAiCoach && (
            <div className="card mb-4">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={18} color="var(--color-accent)" />
                Today's action plan
              </div>
              {plan.dailyTasks.length === 0 ? (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, margin: '12px 0 0 0' }}>All topics on track! Keep solving.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {plan.dailyTasks.map((task, i) => (
                    <div key={i} style={{
                      display:      'flex',
                      alignItems:   'center',
                      gap:          12,
                      background:   'var(--color-accent-muted)',
                      border:       '1px solid rgba(99,102,241,0.18)',
                      borderRadius: 10,
                      padding:      '12px 14px',
                    }}>
                      <span style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: 'rgba(99,102,241,0.2)', color: 'var(--color-accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, flexShrink: 0,
                      }}>{i + 1}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {task.task}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                          {task.done}/{task.target} done · {task.gap} remaining
                        </div>
                      </div>
                      <span className={`badge ${task.gap >= 20 ? 'badge-danger' : task.gap >= 10 ? 'badge-warning' : 'badge-success'}`}>
                        {task.gap >= 20 ? 'Urgent' : task.gap >= 10 ? 'Active' : 'Near'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Level Progression + Focus Mode */}
          {plan && (
            <div className="grid-2 mb-4">
              <div className="card">
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Award size={18} color="var(--color-accent)" />
                  Level progression
                </div>
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--color-accent)' }}>
                    {plan.progressStats.currentLevel}
                  </div>
                  {plan.progressStats.nextLevel && (
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                      Next: {plan.progressStats.nextLevel} at {plan.progressStats.nextLevelAt} problems
                    </div>
                  )}
                </div>
                <CareerProgressBar
                  label={`Progress to ${plan.progressStats.nextLevel || 'Max'}`}
                  done={plan.progressStats.problemsSolved - (
                    plan.progressStats.currentLevel === 'Beginner'     ? 0   :
                    plan.progressStats.currentLevel === 'Intermediate' ? 50  :
                    plan.progressStats.currentLevel === 'Advanced'     ? 100 : 200
                  )}
                  target={plan.progressStats.nextLevelAt
                    ? plan.progressStats.nextLevelAt - (
                        plan.progressStats.currentLevel === 'Beginner'     ? 0   :
                        plan.progressStats.currentLevel === 'Intermediate' ? 50  :
                        plan.progressStats.currentLevel === 'Advanced'     ? 100 : 200
                      )
                    : 1}
                />
                <div style={{ textAlign: 'center', marginTop: 10 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
                    {plan.progressStats.toNextLevel > 0
                      ? `${plan.progressStats.toNextLevel} more problems to next level`
                      : 'Max level reached!'}
                  </span>
                </div>
              </div>

              <FocusMode focusTopic={plan.focusTopic} />
            </div>
          )}

          {/* Topic Targets */}
          {plan && (
            <div className="card mb-4">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div className="card-title" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Target size={18} color="var(--color-accent)" />
                  Topic targets
                </div>
                <span style={{
                  fontSize: 12,
                  lineHeight: 1,
                  color: 'var(--color-text-secondary)',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '7px 10px',
                  whiteSpace: 'nowrap',
                }}>
                  {plan.progressStats.problemsSolved} solved · {plan.progressStats.totalTarget} target
                </span>
              </div>
              <div className="grid-2" style={{ gap: '12px 20px' }}>
                {plan.topicProgress.map(t => (
                  <CareerProgressBar key={t.name} label={t.name} done={t.done} target={t.target} />
                ))}
              </div>
            </div>
          )}

          {/* Weekly Plan */}
          {plan && !hasAiCoach && (
            <div className="card mb-4">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={18} color="var(--color-accent)" />
                Weekly plan
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', marginTop: 12 }}>
                {plan.weeklyPlan.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveDay(i)}
                    className={`btn btn-sm ${activeDay === i ? 'btn-primary' : 'btn-outline'}`}
                    style={{ minHeight: 'auto', height: 28, fontSize: 12, padding: '0 10px', background: activeDay === i ? 'var(--color-accent)' : 'transparent' }}
                  >
                    {d.day}
                  </button>
                ))}
              </div>
              {plan.weeklyPlan[activeDay] && (() => {
                const day    = plan.weeklyPlan[activeDay];
                const target = day.count || 5;
                const done   = Math.min(day.done, target);
                const pct    = Math.min(100, Math.round((done / target) * 100));
                return (
                  <div style={{
                    background: 'var(--color-surface-2)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 10, padding: 14,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {day.day} — {day.topic}
                      </div>
                      <span className={`badge ${pct >= 100 ? 'badge-success' : pct >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                        {pct >= 100 ? 'Done' : `${pct}%`}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                      Task: {day.task}
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Progress</span>
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{day.done}/{day.target} solved</span>
                    </div>
                    <div style={{
                      background: 'rgba(255,255,255,0.04)',
                      borderRadius: 99, height: 6, overflow: 'hidden',
                    }}>
                      <div style={{
                        width:      `${pct}%`,
                        height:     '100%',
                        borderRadius: 99,
                        background: pct >= 100 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-warning)' : 'var(--color-danger)',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </>
      ) : activeTab === 'hackathons' ? (
        <>
          {/* Control Bar - Views + Search + Filters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
            {/* Top row: Views + Filter count badge */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {[
                  { id: 'all', label: 'All Events' },
                  { id: 'recommended', label: '✨ Recommended' },
                  { id: 'closing', label: '⏰ Closing Soon' },
                  { id: 'saved', label: '💾 Saved' }
                ].map(view => (
                  <button
                    key={view.id}
                    onClick={() => setHackathonView(view.id)}
                    className={`btn btn-sm ${hackathonView === view.id ? 'btn-primary' : 'btn-outline'}`}
                    style={{ 
                      minHeight: 'auto', 
                      height: 32, 
                      background: hackathonView === view.id ? 'var(--color-accent)' : 'transparent',
                      fontSize: 13,
                      fontWeight: hackathonView === view.id ? 600 : 500,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
              {Object.values(filters).some(v => v !== '') && (
                <span style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  background: 'rgba(99,102,241,0.15)',
                  color: 'var(--color-accent)',
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}>
                  {Object.values(filters).filter(v => v !== '').length} active filter(s)
                </span>
              )}
            </div>

            {/* Search & Filter controls */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ 
                flex: 1, 
                minWidth: 240,
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                padding: '10px 14px', 
                background: 'rgba(255,255,255,0.03)', 
                border: '1px solid var(--border)', 
                borderRadius: 10,
                transition: 'all 0.2s ease'
              }}>
                <Search size={16} color="var(--color-accent)" />
                <input
                  type="text"
                  placeholder="Search hackathons by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--color-text-primary)',
                    fontSize: 13.5
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text-secondary)',
                      fontSize: 18,
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="btn btn-sm"
                style={{ 
                  minHeight: 'auto', 
                  height: 40,
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6,
                  background: showFilters ? 'rgba(99,102,241,0.1)' : 'transparent',
                  borderColor: showFilters ? 'var(--color-accent)' : 'var(--border)',
                  color: showFilters ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  transition: 'all 0.2s ease',
                  fontWeight: 500,
                  fontSize: 13
                }}
              >
                <Filter size={15} />
                Filters
                {Object.values(filters).some(v => v !== '') && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: 'var(--color-accent)',
                    color: 'white',
                    fontSize: 10,
                    fontWeight: 700
                  }}>
                    {Object.values(filters).filter(v => v !== '').length}
                  </span>
                )}
              </button>
            </div>
          </div>
          
          {/* Filters Section - Grouped & Organized */}
          {showFilters && (
            <div style={{ 
              background: 'linear-gradient(135deg, var(--color-surface-2) 0%, rgba(99,102,241,0.02) 100%)',
              border: '1px solid rgba(99,102,241,0.2)', 
              borderRadius: 12, 
              padding: 20, 
              marginBottom: 20,
              animation: 'slideDown 0.25s ease'
            }}>
              <style>{`
                @keyframes slideDown {
                  from { 
                    opacity: 0; 
                    transform: translateY(-8px);
                  }
                  to { 
                    opacity: 1; 
                    transform: translateY(0);
                  }
                }
              `}</style>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                
                {/* Row 1: Category & Type */}
                <div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8, 
                    marginBottom: 10,
                    paddingBottom: 8,
                    borderBottom: '1px solid rgba(255,255,255,0.04)'
                  }}>
                    <div style={{ width: 2, height: 14, borderRadius: 2, background: 'var(--color-accent)' }} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Category & Difficulty
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                      <CustomSelect
                        value={filters.source}
                        onChange={(v) => setFilters(f => ({ ...f, source: v }))}
                        placeholder="All Sources"
                        options={filterOptions.sources}
                      />
                    </div>
                    <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                      <CustomSelect
                        value={filters.category}
                        onChange={(v) => setFilters(f => ({ ...f, category: v }))}
                        placeholder="All Categories"
                        options={filterOptions.categories}
                      />
                    </div>
                    <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                      <CustomSelect
                        value={filters.difficulty}
                        onChange={(v) => setFilters(f => ({ ...f, difficulty: v }))}
                        placeholder="All Difficulties"
                        options={filterOptions.difficulties}
                      />
                    </div>
                  </div>
                </div>

                {/* Row 2: Timeline */}
                <div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8, 
                    marginBottom: 10,
                    paddingBottom: 8,
                    borderBottom: '1px solid rgba(255,255,255,0.04)'
                  }}>
                    <div style={{ width: 2, height: 14, borderRadius: 2, background: 'var(--color-accent)' }} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Timeline
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 180px', minWidth: 0, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 1, fontSize: 11, color: 'var(--color-text-tertiary)', pointerEvents: 'none' }}>From</div>
                      <input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 42px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          color: 'var(--color-text-primary)',
                          fontSize: 13,
                          colorScheme: 'dark',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--color-accent)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      />
                    </div>
                    <div style={{ flex: '1 1 180px', minWidth: 0, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 1, fontSize: 11, color: 'var(--color-text-tertiary)', pointerEvents: 'none' }}>To</div>
                      <input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 42px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          color: 'var(--color-text-primary)',
                          fontSize: 13,
                          colorScheme: 'dark',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--color-accent)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      />
                    </div>
                  </div>
                </div>

                {/* Row 3: Prize Pool */}
                <div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8, 
                    marginBottom: 10,
                    paddingBottom: 8,
                    borderBottom: '1px solid rgba(255,255,255,0.04)'
                  }}>
                    <div style={{ width: 2, height: 14, borderRadius: 2, background: 'var(--color-accent)' }} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Prize Pool
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 180px', minWidth: 0, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 1, fontSize: 12, color: 'var(--color-text-tertiary)', pointerEvents: 'none', fontWeight: 500 }}>₹</div>
                      <input
                        type="number"
                        placeholder="Min"
                        value={filters.minPrize}
                        onChange={(e) => setFilters(f => ({ ...f, minPrize: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 28px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          color: 'var(--color-text-primary)',
                          fontSize: 13,
                          colorScheme: 'dark',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--color-accent)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      />
                    </div>
                    <div style={{ flex: '1 1 180px', minWidth: 0, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 1, fontSize: 12, color: 'var(--color-text-tertiary)', pointerEvents: 'none', fontWeight: 500 }}>₹</div>
                      <input
                        type="number"
                        placeholder="Max"
                        value={filters.maxPrize}
                        onChange={(e) => setFilters(f => ({ ...f, maxPrize: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 28px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          color: 'var(--color-text-primary)',
                          fontSize: 13,
                          colorScheme: 'dark',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--color-accent)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Reset Filters Button - Bottom */}
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: Object.values(filters).filter(v => v !== '').length > 0 ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                    fontSize: 11,
                    fontWeight: 700,
                    color: Object.values(filters).filter(v => v !== '').length > 0 ? 'var(--color-accent)' : 'var(--color-text-tertiary)'
                  }}>
                    {Object.values(filters).filter(v => v !== '').length}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                    {Object.values(filters).filter(v => v !== '').length === 1 ? 'filter active' : 
                     Object.values(filters).filter(v => v !== '').length > 1 ? 'filters active' : 'No filters'}
                  </span>
                </div>
                <button
                  onClick={() => setFilters({
                    source: '', category: '', difficulty: '',
                    startDate: '', endDate: '', minPrize: '', maxPrize: ''
                  })}
                  className="btn btn-outline btn-sm"
                  style={{ 
                    minHeight: 'auto', 
                    height: 28, 
                    padding: '4px 12px', 
                    background: 'transparent', 
                    fontSize: 12,
                    opacity: Object.values(filters).some(v => v !== '') ? 1 : 0.4,
                    pointerEvents: Object.values(filters).some(v => v !== '') ? 'auto' : 'none'
                  }}
                >
                  Reset All
                </button>
              </div>
            </div>
          )}

          {/* Hackathons Grid */}
          {hackathonLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <Loader2 size={32} className="animate-spin" style={{ animation: 'spin 1s linear infinite', color: 'var(--color-accent)' }} />
            </div>
          ) : (
            <>
              {hackathons.length === 0 ? (
                <EmptyState
                  illustration="marks"
                  title="No hackathons found"
                  subtitle={`No events in ${hackathonView === 'all' ? 'all events' : hackathonView} category.`}
                />
              ) : (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
                  gap: 18,
                  paddingBottom: 12
                }}>
                  {hackathons
                    .filter(event => 
                      !searchQuery || 
                      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      event.description?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map(event => (
                      <OpportunityCard
                        key={event._id}
                        opportunity={event}
                        showMatchScore={hackathonView === 'recommended'}
                        matchScore={event.matchScore}
                        matchReasons={event.matchReasons}
                        isSaved={savedEventIds.has(event._id.toString())}
                        onSave={() => handleSaveEvent(event._id)}
                        onUnsave={() => handleUnsaveEvent(event._id)}
                      />
                    ))}
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          {/* AI Career Prep View */}
          <div className="grid-2 mb-4">
            
            {/* Resume Scanner */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={18} color="var(--color-accent)" />
                  Resume scanner & keyword checker
                </div>
                {(resumeFile || resumeText.trim() || resumeAnalysis) && (
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ minHeight: 'auto', height: 26, padding: '4px 10px', fontSize: 11, background: 'transparent' }}
                    onClick={handleResetScanner}
                  >
                    Reset
                  </button>
                )}
              </div>
              <p className="text-muted" style={{ marginBottom: 16 }}>
                Submit your resume to evaluate keyword matching and get optimization tips for {career.targetCompany} and {career.targetRole || 'Software Engineer'}.
              </p>

              {/* Method Switcher */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${scanMethod === 'pdf' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ minHeight: 'auto', height: 30, background: scanMethod === 'pdf' ? 'var(--color-accent)' : 'transparent' }}
                  onClick={() => setScanMethod('pdf')}
                >
                  Upload file (PDF/Image)
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${scanMethod === 'text' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ minHeight: 'auto', height: 30, background: scanMethod === 'text' ? 'var(--color-accent)' : 'transparent' }}
                  onClick={() => setScanMethod('text')}
                >
                  Paste text
                </button>
              </div>

              {scanMethod === 'pdf' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div
                    style={{
                      border: isDragging ? '1.5px solid var(--color-accent)' : '1.5px dashed var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '28px 16px',
                      textAlign: 'center',
                      background: isDragging ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.01)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => document.getElementById('resume-pdf-input').click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <Upload size={24} color="var(--color-accent)" />
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      {resumeFile ? resumeFile.name : 'Select or drop your resume PDF/image'}
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>Supports PDF, PNG, JPG formats up to 5MB</span>
                    <input
                      id="resume-pdf-input"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files[0];
                        if (file) setResumeFile(file);
                      }}
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    disabled={resumeLoading || !resumeFile}
                    onClick={handleUploadResume}
                    style={{ height: 38, fontSize: 13 }}
                  >
                    {resumeLoading ? 'Scanning file...' : 'Scan resume'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <textarea
                      className="form-input"
                      style={{ minHeight: 140, resize: 'vertical', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5 }}
                      placeholder="Paste your plain text resume content here..."
                      value={resumeText}
                      onChange={e => setResumeText(e.target.value)}
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    disabled={resumeLoading || !resumeText.trim()}
                    onClick={handleAnalyzeResume}
                    style={{ height: 38, fontSize: 13 }}
                  >
                    {resumeLoading ? 'Scanning text...' : 'Scan plain text'}
                  </button>
                </div>
              )}
            </div>

            {/* Resume Score and Feedback */}
            <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={18} color="var(--color-accent)" />
                Analysis results
              </div>
              {resumeAnalysis ? (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                    <div style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background: 'var(--color-accent-muted)',
                      border: '2px solid var(--color-accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      fontWeight: 600,
                      color: 'var(--color-accent)'
                    }}>
                      {resumeAnalysis.score}
                    </div>
                    <div>
                      <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>Resume match score</div>
                      <div className="text-muted" style={{ marginTop: 2, fontSize: 12.5 }}>Targeting {career.targetCompany} · {career.targetRole}</div>
                    </div>
                  </div>

                  {/* Missing Keywords */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Target size={14} color="var(--color-accent)" />
                      Missing target keywords
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {resumeAnalysis.missingKeywords?.length > 0 ? (
                        resumeAnalysis.missingKeywords.map(kw => (
                          <span key={kw} className="badge badge-danger">{kw}</span>
                        ))
                      ) : (
                        <span className="badge badge-success">No major missing keywords!</span>
                      )}
                    </div>
                  </div>

                  {/* Feedback Points */}
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Lightbulb size={14} color="var(--color-accent)" />
                      Key feedback
                    </div>
                    <ul style={{ paddingLeft: 16, fontSize: 13, color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {resumeAnalysis.feedback?.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <EmptyState
                  illustration="marks"
                  title="No scan completed yet"
                  subtitle="Upload your resume file or paste plain text and click scan to calculate matching score."
                  actionLabel={career.resumeScore > 0 ? `Last Saved Score: ${career.resumeScore}/100` : null}
                  onAction={() => {}}
                />
              )}
            </div>
          </div>

          {/* AI Mock Interview Simulator */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Bot size={18} color="var(--color-accent)" />
                AI mock interview simulator
              </div>
              {questions.length > 0 && (
                <button
                  className="btn btn-outline btn-sm"
                  style={{ minHeight: 'auto', height: 26, padding: '4px 10px', fontSize: 11, background: 'transparent' }}
                  onClick={handleResetInterview}
                >
                  Reset session
                </button>
              )}
            </div>
            <p className="text-muted" style={{ marginBottom: 16 }}>
              Practice technical coding and behavioral interview questions generated specifically for your target role.
            </p>

            {/* Select Topic & Generate button */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 20 }}>
              <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 200 }}>
                <label className="form-label">Select Interview Topic</label>
                <select
                  className="form-select"
                  value={interviewTopic}
                  onChange={e => setInterviewTopic(e.target.value)}
                  disabled={questions.length > 0}
                >
                  <option value="Arrays">Arrays & Strings</option>
                  <option value="Trees">Trees & Graphs</option>
                  <option value="Dynamic Programming">Dynamic Programming & Recursion</option>
                  <option value="System Design">System Design & OOP</option>
                  <option value="Behavioral">Behavioral (STAR method)</option>
                </select>
              </div>
              {questions.length === 0 && (
                <button
                  className="btn btn-primary"
                  onClick={handleGenerateQuestions}
                  disabled={questionsLoading}
                  style={{ height: 38, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Brain size={14} />
                  {questionsLoading ? 'Generating...' : 'Generate 3 questions'}
                </button>
              )}
            </div>

            {/* Active Question Simulator */}
            {questions.length > 0 ? (
              <div style={{
                borderTop: '1px solid var(--border)',
                paddingTop: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-accent)' }}>
                    Question {activeQuestionIndex + 1} of {questions.length}
                  </span>
                  <span className={`badge ${questions[activeQuestionIndex].type === 'behavioral' ? 'badge-info' : 'badge-warning'}`}>
                    {questions[activeQuestionIndex].type}
                  </span>
                </div>

                {/* The Question Text */}
                <div style={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--color-text-primary)'
                }}>
                  {questions[activeQuestionIndex].question}
                </div>

                {/* Answer Area */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="form-label" style={{ margin: 0 }}>Your Response</label>
                    {!questions[activeQuestionIndex].isEvaluated && (
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{
                          padding: '4px 10px',
                          minHeight: 'auto',
                          height: 26,
                          fontSize: 12,
                          borderColor: isListening ? 'var(--color-danger)' : 'var(--border)',
                          background: isListening ? 'rgba(239,68,68,0.06)' : 'transparent',
                          color: isListening ? 'var(--color-danger)' : 'var(--color-text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                        onClick={handleVoiceAnswer}
                      >
                        <Mic size={13} />
                        {isListening ? 'Stop listening' : 'Speak answer'}
                      </button>
                    )}
                  </div>
                  <textarea
                    className="form-input"
                    style={{ minHeight: 140, resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
                    placeholder="Write your explanation or code solution here..."
                    value={userAnswer}
                    onChange={e => setUserAnswer(e.target.value)}
                    disabled={questions[activeQuestionIndex].isEvaluated}
                  />
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-outline"
                      style={{ padding: '0 12px', height: 32, fontSize: 12, background: 'transparent' }}
                      disabled={activeQuestionIndex === 0}
                      onClick={() => handleNavQuestion(activeQuestionIndex - 1)}
                    >
                      Prev
                    </button>
                    <button
                      className="btn btn-outline"
                      style={{ padding: '0 12px', height: 32, fontSize: 12, background: 'transparent' }}
                      disabled={activeQuestionIndex === questions.length - 1}
                      onClick={() => handleNavQuestion(activeQuestionIndex + 1)}
                    >
                      Next
                    </button>
                  </div>

                  {!questions[activeQuestionIndex].isEvaluated && (
                    <button
                      className="btn btn-primary"
                      disabled={evaluating || !userAnswer.trim()}
                      onClick={handleEvaluateAnswer}
                      style={{ height: 32, fontSize: 12.5 }}
                    >
                      {evaluating ? 'Evaluating...' : 'Submit answer for review'}
                    </button>
                  )}
                </div>

                {/* AI Evaluation feedback */}
                {evaluationResult && (
                  <div style={{
                    background: 'rgba(99, 102, 241, 0.04)',
                    border: '1.5px solid rgba(99, 102, 241, 0.15)',
                    borderRadius: 10,
                    padding: 16,
                    marginTop: 10
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Award size={15} />
                        AI evaluation & feedback
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Score:</span>
                        <span style={{
                          fontSize: 13,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-pill)',
                          background: evaluationResult.score >= 8 ? 'rgba(34,197,94,0.1)' : evaluationResult.score >= 5 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                          color: evaluationResult.score >= 8 ? 'var(--color-success)' : evaluationResult.score >= 5 ? 'var(--color-warning)' : 'var(--color-danger)',
                          border: `1px solid ${evaluationResult.score >= 8 ? 'rgba(34,197,94,0.15)' : evaluationResult.score >= 5 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'}`
                        }}>
                          {evaluationResult.score}/10
                        </span>
                      </div>
                    </div>

                    <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                      {evaluationResult.feedback}
                    </p>

                    {/* Model Answer Toggle */}
                    <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '4px 10px', minHeight: 'auto', height: 28, fontSize: 11, background: 'transparent' }}
                        onClick={() => setShowModelAnswer(!showModelAnswer)}
                      >
                        {showModelAnswer ? 'Hide reference answer' : 'Show reference answer'}
                      </button>
                      {showModelAnswer && (
                        <div style={{
                          background: 'var(--color-surface-3)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          padding: 12,
                          marginTop: 10,
                          fontSize: 12.5,
                          color: 'var(--color-text-secondary)',
                          lineHeight: 1.55,
                          fontFamily: 'monospace'
                        }}>
                          {evaluationResult.modelAnswer}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                illustration="default"
                title="Mock interview not generated"
                subtitle="Select an interview topic and click generate questions above to start practicing."
              />
            )}
          </div>

          {/* Past Mock Interviews Log */}
          {career.mockInterviews && career.mockInterviews.length > 0 && (
            <div className="card" style={{ marginTop: 24 }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <ClipboardList size={18} color="var(--color-accent)" />
                Mock interview logs
              </div>
              <p className="text-muted" style={{ marginBottom: 16 }}>
                Review feedback and reference model answers from your previous mock interviews.
              </p>
              <div className="table-wrap">
                <table className="table" style={{ width: '100%', minWidth: '560px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 8px', fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500 }}>Topic</th>
                      <th style={{ padding: '10px 8px', fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500 }}>Question</th>
                      <th style={{ padding: '10px 8px', fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500 }}>AI score</th>
                      <th style={{ padding: '10px 8px', fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500 }}>Date</th>
                      <th style={{ padding: '10px 8px', fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {career.mockInterviews.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '12px 8px', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{item.topic}</td>
                        <td style={{ padding: '12px 8px', fontSize: 13, color: 'var(--color-text-secondary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.question}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <span className="badge" style={{
                            background: item.score >= 8 ? 'rgba(34,197,94,0.1)' : item.score >= 5 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                            color: item.score >= 8 ? 'var(--color-success)' : item.score >= 5 ? 'var(--color-warning)' : 'var(--color-danger)',
                            border: `1px solid ${item.score >= 8 ? 'rgba(34,197,94,0.15)' : item.score >= 5 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'}`
                          }}>
                            {item.score}/10
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                          {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ minHeight: 'auto', height: 26, padding: '2px 8px', fontSize: 11, background: 'transparent' }}
                            onClick={() => setSelectedHistoryItem(item)}
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Details Modal overlay */}
          {selectedHistoryItem && (
            <div style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999,
              padding: 16
            }}
            onClick={() => setSelectedHistoryItem(null)}
            >
              <div style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: 24,
                maxWidth: 600,
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
                position: 'relative'
              }}
              onClick={e => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <span className="badge badge-primary" style={{ marginBottom: 6 }}>{selectedHistoryItem.topic}</span>
                    <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>Mock interview logs review</h3>
                  </div>
                  <button
                    className="btn btn-outline"
                    style={{ minWidth: 'auto', padding: '4px 8px', height: 28, background: 'transparent' }}
                    onClick={() => setSelectedHistoryItem(null)}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>QUESTION</div>
                    <div style={{ background: 'var(--color-surface-3)', padding: 12, borderRadius: 6, fontSize: 13, border: '1px solid var(--border)', color: 'var(--color-text-primary)' }}>
                      {selectedHistoryItem.question}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>YOUR RESPONSE</div>
                    <div style={{ background: 'rgba(255,255,255,0.01)', padding: 12, borderRadius: 6, fontSize: 13, border: '1px solid var(--border)', whiteSpace: 'pre-wrap', color: 'var(--color-text-secondary)' }}>
                      {selectedHistoryItem.userAnswer}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>AI RATING:</div>
                    <span className="badge" style={{
                      fontSize: 13,
                      fontWeight: 700,
                      background: selectedHistoryItem.score >= 8 ? 'rgba(34,197,94,0.1)' : selectedHistoryItem.score >= 5 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                      color: selectedHistoryItem.score >= 8 ? 'var(--color-success)' : selectedHistoryItem.score >= 5 ? 'var(--color-warning)' : 'var(--color-danger)',
                      border: `1px solid ${selectedHistoryItem.score >= 8 ? 'rgba(34,197,94,0.15)' : selectedHistoryItem.score >= 5 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'}`
                    }}>
                      {selectedHistoryItem.score}/10
                    </span>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>AI FEEDBACK</div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                      {selectedHistoryItem.feedback}
                    </p>
                  </div>

                  {selectedHistoryItem.modelAnswer && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>REFERENCE MODEL ANSWER</div>
                      <div style={{ background: 'var(--color-surface-3)', padding: 12, borderRadius: 6, fontSize: 12.5, color: 'var(--color-text-secondary)', border: '1px solid var(--border)', lineHeight: 1.5, fontFamily: 'monospace' }}>
                        {selectedHistoryItem.modelAnswer}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}
