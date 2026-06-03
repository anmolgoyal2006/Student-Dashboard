import { useState, useRef, useEffect, useCallback } from "react";
import { aiChatService, aiCommandService } from '../services/apiServices';
import { useGlobalData } from '../context/GlobalDataContext';
import toast from 'react-hot-toast';

// ─── Icons ────────────────────────────────────────────────────────────────────
const BookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);
const BotIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
  </svg>
);
const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const UploadIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
);
const SummarizeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/>
  </svg>
);
const QuizIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const ClipIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const CalendarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const BarChartIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
const TaskIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
);
const SubjectIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function cleanTextForSpeech(text) {
  return text
    .replace(/\*+/g, '').replace(/#/g, '').replace(/•/g, '')
    .replace(/-{2,}/g, '').replace(/\n+/g, '. ').replace(/\s{2,}/g, ' ')
    .trim();
}

// ─── API calls ────────────────────────────────────────────────────────────────
async function callNotesAI(action, payload) {
  if (action === 'summarize') {
    const { data } = await aiChatService.chat('Summarize all my uploaded notes', 'summarize');
    return { text: data.answer, sources: data.sources };
  }
  if (action === 'quiz') {
    const { data } = await aiChatService.chat('Generate a quiz from my notes', 'quiz');
    return { text: data.answer, sources: data.sources };
  }
  const { data } = await aiChatService.chat(payload.message, 'chat');
  return { text: data.answer, sources: data.sources };
}

async function callSmartAssistant(message) {
  const { data } = await aiCommandService.send(message);
  return data;
}

// ─── Code block & parsing components ─────────────────────────────────────────
function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Code copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '8px',
      margin: '12px 0',
      overflow: 'hidden',
      fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.03)',
        padding: '6px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        fontSize: '11px',
        color: '#8b949e',
        textTransform: 'uppercase',
        userSelect: 'none'
      }}>
        <span>{language || 'code'}</span>
        <button
          onClick={handleCopy}
          style={{
            background: 'transparent',
            border: 'none',
            color: copied ? '#34d399' : '#8b949e',
            cursor: 'pointer',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 6px',
            borderRadius: '4px',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#c9d1d9'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = copied ? '#34d399' : '#8b949e'; e.currentTarget.style.background = 'transparent'; }}
        >
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
      </div>
      {/* Pre/Code content */}
      <pre style={{
        margin: 0,
        padding: '12px',
        overflowX: 'auto',
        fontSize: '13px',
        lineHeight: '1.5',
        color: '#c9d1d9',
        textAlign: 'left'
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderMessageText(text) {
  if (!text) return null;

  // Split by fenced code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);
  
  return parts.map((part, index) => {
    // If it's an odd index, it's a code block
    if (index % 2 === 1) {
      const match = part.match(/^```(\w*)\r?\n?([\s\S]*?)```$/);
      if (match) {
        const language = match[1] || 'code';
        const code = match[2];
        return <CodeBlock key={index} code={code} language={language} />;
      }
      return <pre key={index} style={{ whiteSpace: 'pre-wrap', margin: '4px 0' }}>{part}</pre>;
    } else {
      // It's normal text, split by inline code blocks
      const inlineParts = part.split(/(`[^`\n]+`)/g);
      return inlineParts.map((subPart, subIndex) => {
        if (subIndex % 2 === 1) {
          const cleanCode = subPart.slice(1, -1);
          return (
            <code
              key={subIndex}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '0.85em',
                color: '#fb7185', // nice rose color for contrast in dark mode
                wordBreak: 'break-all'
              }}
            >
              {cleanCode}
            </code>
          );
        }
        return subPart;
      });
    }
  });
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, mode }) {
  const isUser = msg.role === 'user';
  const accent = mode === 'notes' ? '#10b981' : 'var(--primary)';
  const [copied, setCopied] = useState(false);

  const handleBubbleCopy = () => {
    navigator.clipboard.writeText(msg.text);
    setCopied(true);
    toast.success('Message copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-end', gap: 10, marginBottom: 16,
      animation: 'aiBubbleIn 0.25s cubic-bezier(.34,1.56,.64,1) both',
    }}>
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: mode === 'notes'
            ? 'linear-gradient(135deg,#064e3b,#10b981)'
            : 'linear-gradient(135deg,var(--primary-dark),var(--primary))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
        }}>
          {mode === 'notes' ? <BookIcon /> : <BotIcon />}
        </div>
      )}
      <div style={{
        position: 'relative',
        maxWidth: '75%', padding: '11px 15px',
        paddingRight: isUser ? '15px' : '40px',
        borderRadius: isUser ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
        background: isUser
          ? (mode === 'notes'
              ? 'linear-gradient(135deg,#064e3b,#10b981)'
              : 'linear-gradient(135deg,var(--primary-dark),var(--primary))')
          : 'var(--bg-3)',
        border: isUser ? 'none' : '1px solid var(--card-border)',
        color: 'var(--text)', fontSize: 14, lineHeight: 1.6,
        wordBreak: 'break-word',
      }}>
        {!isUser && (
          <button
            onClick={handleBubbleCopy}
            title="Copy message to clipboard"
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              color: copied ? '#34d399' : 'var(--muted)',
              opacity: 0.6,
              transition: 'opacity 0.2s, color 0.2s',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.background = 'transparent'; }}
          >
            {copied ? '✓' : '📋'}
          </button>
        )}

        {renderMessageText(msg.text)}

        {msg.sources?.length > 0 && (
          <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            {msg.sources.map((s, i) => (
              <div key={i} style={{
                fontSize: 11.5, color: 'var(--muted)', marginTop: 4,
                background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 8px',
              }}>
                📄 <span style={{ color: 'var(--primary)' }}>{s.filename}</span> — {s.preview}
              </div>
            ))}
          </div>
        )}

        {/* Show "dashboard updated" only for real data mutations */}
       {msg.entity && msg.entity !== 'none' && ['add', 'update', 'delete'].includes(msg.action) && (
          <div style={{
            marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)',
            fontSize: 11, color: accent, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <CheckIcon /> Dashboard updated · {msg.entity}
          </div>
        )}

        {/* For analytical answers, show a subtle info tag */}
        {msg.action === 'answer' && (
          <div style={{
            marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)',
            fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            🧠 Calculated from your data
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Command chip ─────────────────────────────────────────────────────────────
function CommandChip({ icon, label, example, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => onClick(example)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'rgba(129,140,248,0.1)' : 'var(--bg-3)',
        border: '1px solid var(--card-border)', borderRadius: 10,
        padding: '10px 13px', cursor: 'pointer', textAlign: 'left',
        transition: 'all 0.18s ease', color: 'var(--text)',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ color: 'var(--primary)' }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', fontStyle: 'italic' }}>"{example}"</div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AIAssistant() {
  const [mode, setMode]               = useState('notes');
  const [listening, setListening]     = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const recognitionRef                = useRef(null);
  const [messages, setMessages]       = useState({ notes: [], assistant: [] });
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [switchAnim, setSwitchAnim]   = useState(false);
  const [notes, setNotes]             = useState([]);
  const [showNotes, setShowNotes]     = useState(false);

  const fileInputRef = useRef();
  const chatEndRef   = useRef();
  const inputRef     = useRef();
  const { refreshByEntity } = useGlobalData();

  const currentMessages = messages[mode];

  useEffect(() => { loadNotes(); }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, loading]);

  const loadNotes = async () => {
    try {
      const { data } = await aiChatService.getNotes();
      setNotes(data.notes || []);
    } catch (err) {
      console.error('loadNotes error:', err.message);
    }
  };

  const handleDeleteNote = async (filename) => {
    try {
      await aiChatService.deleteNote(filename);
      toast.success('Note deleted');
      await loadNotes();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const switchMode = useCallback((newMode) => {
    if (newMode === mode) return;
    setSwitchAnim(true);
    setTimeout(() => { setMode(newMode); setSwitchAnim(false); }, 180);
  }, [mode]);

  const addMessage = (modeKey, msg) => {
    setMessages(prev => ({ ...prev, [modeKey]: [...prev[modeKey], msg] }));
  };

  // ─── Speech ───────────────────────────────────────────────────────────────
  const speak = (text) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter    = new SpeechSynthesisUtterance(cleanTextForSpeech(text));
    utter.lang     = 'en-IN';
    utter.rate     = 1.05;
    window.speechSynthesis.speak(utter);
  };

  const stopSpeaking = () => window.speechSynthesis?.cancel();

  // ─── Send ─────────────────────────────────────────────────────────────────
  const handleSend = async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    setInput('');
    addMessage(mode, { role: 'user', text, id: Date.now() });
    setLoading(true);

    try {
      if (mode === 'notes') {
        // Notes mode — always goes to RAG/chat AI
        const res = await callNotesAI('chat', { message: text });
        addMessage('notes', { role: 'ai', text: res.text, sources: res.sources, id: Date.now() + 1 });
        speak(res.text);

      } else {
        // Assistant mode — Groq decides if it's a command, query, or analytical answer
        // No frontend pattern matching — let the backend handle routing entirely
        const res = await callSmartAssistant(text);

        addMessage('assistant', {
          role  : 'ai',
          text  : res.message,
          entity: res.entity,
          action: res.action,
          id    : Date.now() + 1,
        });
        speak(res.message);

        // Refresh dashboard data only for real mutations (not answers or gets)
        if (res.success && res.entity && res.entity !== 'none' && ['add', 'update', 'delete'].includes(res.action)) {
          refreshByEntity(res.entity);
        }
      }

    } catch (err) {
      const errText = err.response?.data?.message || 'Something went wrong. Please try again.';
      addMessage(mode, { role: 'ai', text: `❌ ${errText}`, id: Date.now() + 1 });
    } finally {
      setLoading(false);
    }
  };

  // ─── Voice ───────────────────────────────────────────────────────────────
  const handleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { toast.error('Voice not supported. Use Chrome.'); return; }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition          = new SpeechRecognition();
    recognitionRef.current     = recognition;
    recognition.lang           = 'en-US';
    recognition.interimResults = false;
    recognition.continuous     = false;

    recognition.onstart  = () => setListening(true);
    recognition.onend    = () => setListening(false);
    recognition.onerror  = () => { setListening(false); toast.error('Voice error'); };
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      handleSend(transcript);
    };

    // [CHANGED] 300ms warmup delay — prevents microphone cutting the first syllable
    // Show mic is warming up, then start
toast('🎤 Listening in 1 second…', { duration: 900, icon: '🎙️' });
setTimeout(() => recognition.start(), 900);
  };

  const handleAction = async (action) => {
    if (loading) return;
    const label = action === 'summarize' ? 'Summarize my notes' : 'Generate a quiz from my notes';
    addMessage('notes', { role: 'user', text: label, id: Date.now() });
    setLoading(true);
    try {
      const res = await callNotesAI(action, {});
      addMessage('notes', { role: 'ai', text: res.text, sources: res.sources, id: Date.now() + 1 });
    } catch {
      addMessage('notes', { role: 'ai', text: 'Sorry, something went wrong.', id: Date.now() + 1 });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const { data } = await aiChatService.uploadNotes(file);
      setUploadedFile(file);
      addMessage('notes', {
        role: 'ai',
        text: `📎 **${data.filename}** uploaded! Created ${data.chunks} knowledge chunks. Ask me anything about it!`,
        id  : Date.now(),
      });
      toast.success(data.message);
      await loadNotes();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleChipClick = (example) => {
    setInput(example);
    inputRef.current?.focus();
  };

  // ─── Intro messages ───────────────────────────────────────────────────────
  const notesIntro = [{
    role: 'ai',
    text: "Hi! I'm your Notes AI. Upload your study material and I'll help you:\n\n- Summarize key concepts\n- Quiz you on the content\n- Answer questions about your notes\n\nStart by uploading a file or just ask me anything!",
    id  : 0,
  }];

  const assistantIntro = [{
    role: 'ai',
    text: "Hey! I'm your Dashboard Assistant powered by Groq AI.\n\nI understand natural language — just tell me what you want:\n- Add subjects, attendance, marks, tasks\n- Ask questions about your data\n- Add multiple subjects at once\n- Query today's schedule, CGPA predictions, attendance status\n\nNo rigid commands needed — just talk naturally!",
    id  : 0,
  }];

  const displayMessages = currentMessages.length === 0
    ? (mode === 'notes' ? notesIntro : assistantIntro)
    : currentMessages;

  // Example commands — these are illustrative, not hardcoded routing
  const ASSISTANT_COMMANDS = [
    { icon: <CalendarIcon />, label: 'Attendance', example: 'I attended Data Structures today'              },
    { icon: <BarChartIcon />, label: 'Marks',      example: 'I scored 42 out of 50 in Physics midterm'     },
    { icon: <TaskIcon />,     label: 'Task',       example: 'Add high priority task to submit project by Friday' },
    { icon: <SubjectIcon />,  label: 'Subject',    example: 'Add Maths and Physics on Monday and Tuesday'  },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>

      <style>{`
        @keyframes aiBubbleIn {
          from { opacity: 0; transform: translateY(10px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes aiFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes aiPulse {
          0%   { box-shadow: 0 0 0 0 rgba(129,140,248,0.5); }
          70%  { box-shadow: 0 0 0 6px rgba(129,140,248,0); }
          100% { box-shadow: 0 0 0 0 rgba(129,140,248,0); }
        }
        @keyframes aiDotBounce {
          0%, 80%, 100% { transform: translateY(0); }
          40%           { transform: translateY(-6px); }
        }
        .ai-dot-loader span {
          display: inline-block; width: 6px; height: 6px; border-radius: 50%;
          background: var(--muted); margin: 0 2px;
          animation: aiDotBounce 1.2s ease-in-out infinite;
        }
        .ai-dot-loader span:nth-child(2) { animation-delay: 0.2s; }
        .ai-dot-loader span:nth-child(3) { animation-delay: 0.4s; }
        .ai-fade-in { animation: aiFadeIn 0.22s ease both; }
        .ai-pulse   { animation: aiPulse 2s ease-in-out infinite; }
      `}</style>

      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🤖 AI Study Assistant</h1>
          <p className="page-subtitle">
            {mode === 'notes'
              ? 'Ask questions, summarize notes, generate quizzes'
              : 'Natural language dashboard control — powered by Groq'}
          </p>
        </div>
      </div>

      {/* ── Main card ── */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>

        {/* ── Tabs ── */}
        <div style={{
          display: 'flex', background: 'var(--bg-2)',
          borderBottom: '1px solid var(--border)', padding: '6px 6px 0', gap: 4,
        }}>
          {[
            { key: 'notes',     label: 'Notes AI',     icon: <BookIcon />, color: '#10b981'        },
            { key: 'assistant', label: 'Dashboard AI', icon: <BotIcon />,  color: 'var(--primary)' },
          ].map(tab => {
            const active = mode === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => switchMode(tab.key)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: '9px 16px',
                  background: active ? 'var(--bg-3)' : 'transparent',
                  color: active ? tab.color : 'var(--muted)',
                  borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 13.5, fontWeight: active ? 600 : 400,
                  transition: 'all 0.2s ease',
                  borderBottom: active ? `2px solid ${tab.color}` : '2px solid transparent',
                  position: 'relative',
                }}
              >
                {tab.icon}
                {tab.label}
                {tab.key === 'assistant' && (
                  <span className="ai-pulse" style={{
                    width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)',
                    position: 'absolute', top: 8, right: 10, display: 'inline-block',
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Notes toolbar ── */}
        {mode === 'notes' && (
          <div className="ai-fade-in" style={{
            display: 'flex', gap: 8, padding: '10px 16px',
            borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center',
          }}>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              style={{ color: '#10b981', borderColor: 'rgba(16,185,129,0.35)', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <UploadIcon /> Upload Notes
            </button>
            <input
              ref={fileInputRef} type="file"
              accept=".pdf,.txt,.md,.docx,.jpg,.jpeg,.png,.webp"
              hidden onChange={handleFileUpload}
            />
            <button
              className="btn btn-sm btn-outline"
              onClick={() => { setShowNotes(n => !n); loadNotes(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              📚 Notes ({notes.length})
            </button>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => handleAction('summarize')}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <SummarizeIcon /> Summarize
            </button>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => handleAction('quiz')}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <QuizIcon /> Quiz Me
            </button>
            {uploadedFile && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                borderRadius: 8, padding: '4px 10px', fontSize: 12, color: '#10b981',
              }}>
                <ClipIcon />
                {uploadedFile.name.slice(0, 22)}{uploadedFile.name.length > 22 ? '…' : ''}
              </div>
            )}
          </div>
        )}

        {/* ── Notes panel ── */}
        {mode === 'notes' && showNotes && (
          <div className="ai-fade-in" style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)',
          }}>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
              Uploaded Notes ({notes.length})
            </p>
            {notes.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>No notes uploaded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {notes.map(n => (
                  <div key={n._id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--bg-3)', border: '1px solid var(--card-border)',
                    borderRadius: 8, padding: '6px 12px', fontSize: 13, color: 'var(--text-2)',
                  }}>
                    <span>📄 {n._id}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 11 }}>({n.chunks} chunks)</span>
                    <button
                      onClick={() => handleDeleteNote(n._id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 14, padding: '0 2px' }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Assistant example chips — illustrative only, not routing logic ── */}
        {mode === 'assistant' && currentMessages.length === 0 && (
          <div className="ai-fade-in" style={{
            padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)',
          }}>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
              Example Commands — or type anything naturally
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {ASSISTANT_COMMANDS.map(cmd => (
                <CommandChip key={cmd.label} {...cmd} onClick={handleChipClick} />
              ))}
            </div>
          </div>
        )}

        {/* ── Chat messages ── */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '20px 16px',
          display: 'flex', flexDirection: 'column',
          opacity: switchAnim ? 0 : 1,
          transform: switchAnim ? 'translateY(8px)' : 'none',
          transition: 'opacity 0.18s ease, transform 0.18s ease',
          scrollbarWidth: 'thin',
        }}>
          {displayMessages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} mode={mode} />
          ))}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: mode === 'notes'
                  ? 'linear-gradient(135deg,#064e3b,#10b981)'
                  : 'linear-gradient(135deg,var(--primary-dark),var(--primary))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              }}>
                {mode === 'notes' ? <BookIcon /> : <BotIcon />}
              </div>
              <div style={{
                padding: '12px 16px', background: 'var(--bg-3)',
                border: '1px solid var(--card-border)', borderRadius: '4px 18px 18px 18px',
              }}>
                <div className="ai-dot-loader"><span /><span /><span /></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* ── Input ── */}
        <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 8,
            background: 'var(--bg-2)',
            border: `1.5px solid ${input
              ? (mode === 'notes' ? 'rgba(16,185,129,0.4)' : 'rgba(129,140,248,0.4)')
              : 'var(--border)'}`,
            borderRadius: 12, padding: '8px 10px 8px 14px',
            transition: 'border-color 0.2s ease',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder={
                listening ? '🎤 Listening…'
                : mode === 'notes' ? 'Ask anything about your notes…'
                : 'Say anything — add subject, mark attendance, ask about CGPA…'
              }
              rows={1}
              style={{
                flex: 1, background: 'transparent', color: 'var(--text)',
                fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6,
                border: 'none', outline: 'none', resize: 'none', maxHeight: 120,
              }}
              onInput={e => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
            />

            {/* Voice output toggle */}
            <button
              onClick={() => setVoiceEnabled(v => !v)}
              title={voiceEnabled ? 'Voice output on' : 'Voice output off'}
              style={{
                minWidth: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: voiceEnabled ? '#22c55e' : 'var(--bg-3)',
                color: voiceEnabled ? '#fff' : 'var(--text)',
              }}
            >
              {voiceEnabled ? '🔊' : '🔇'}
            </button>

            {/* Stop speaking */}
            <button
              onClick={stopSpeaking}
              title="Stop speaking"
              style={{
                minWidth: 36, height: 36, borderRadius: 8, border: 'none',
                cursor: 'pointer', background: 'var(--bg-3)', color: 'var(--text)',
              }}
            >
              ⛔
            </button>

            {/* Mic — 300ms warmup prevents word cutoff */}
            <button
              onClick={handleVoice}
              disabled={loading}
              style={{
                minWidth: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: listening
                  ? '#ef4444'
                  : mode === 'notes' ? 'rgba(16,185,129,0.2)' : 'rgba(129,140,248,0.2)',
                color: listening ? '#fff' : 'var(--text)',
              }}
            >
              {listening ? '🔴' : '🎤'}
            </button>

            {/* Send */}
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              style={{
                minWidth: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: !input.trim() || loading
                  ? 'var(--bg-3)'
                  : mode === 'notes'
                    ? 'linear-gradient(135deg,#064e3b,#10b981)'
                    : 'linear-gradient(135deg,var(--primary-dark),var(--primary))',
                color: !input.trim() || loading ? 'var(--muted)' : '#fff',
                transition: 'all 0.2s ease',
              }}
            >
              <SendIcon />
            </button>
          </div>

          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, textAlign: 'center' }}>
            {mode === 'notes'
              ? 'Notes AI · Shift+Enter for new line'
              : 'Groq AI · Understands natural language · Updates dashboard in real-time'}
          </p>
        </div>
      </div>
    </div>
  );
}