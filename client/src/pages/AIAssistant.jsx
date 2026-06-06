import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from 'react-router-dom';
import { aiChatService, aiCommandService } from '../services/apiServices';
import { useGlobalData } from '../context/GlobalDataContext';
import toast from '../context/ToastContext';
import { Bot, BookOpen, Send, Upload, FileText, HelpCircle, Paperclip, Check, Calendar, BarChart2, CheckSquare, Layers, ChevronRight, Mic, Trash2, Copy, Brain, Paperclip as Attachment } from 'lucide-react';

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

async function callSmartAssistant(payload) {
  const { data } = await aiCommandService.send(payload);
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
      background: 'var(--color-surface-0)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      margin: '12px 0',
      overflow: 'hidden',
      fontFamily: 'SFMono-Regular, Consolas, monospace',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.02)',
        padding: '6px 12px',
        borderBottom: '1px solid var(--border)',
        fontSize: '11px',
        color: 'var(--color-text-secondary)',
        textTransform: 'uppercase',
        userSelect: 'none'
      }}>
        <span>{language || 'code'}</span>
        <button
          onClick={handleCopy}
          style={{
            background: 'transparent',
            border: 'none',
            color: copied ? 'var(--color-success)' : 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            transition: 'all 0.15s ease'
          }}
        >
          {copied ? '✓ Copied' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Copy size={13} /> Copy</span>}
        </button>
      </div>
      {/* Pre/Code content */}
      <pre style={{
        margin: 0,
        padding: '12px',
        overflowX: 'auto',
        fontSize: '13px',
        lineHeight: '1.5',
        color: 'var(--color-text-primary)',
        textAlign: 'left'
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderMessageText(text) {
  if (!text) return null;

  const parts = text.split(/(```[\s\S]*?```)/g);
  
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      const match = part.match(/^```(\w*)\r?\n?([\s\S]*?)```$/);
      if (match) {
        const language = match[1] || 'code';
        const code = match[2];
        return <CodeBlock key={index} code={code} language={language} />;
      }
      return <pre key={index} style={{ whiteSpace: 'pre-wrap', margin: '4px 0' }}>{part}</pre>;
    } else {
      const inlineParts = part.split(/(`[^`\n]+`)/g);
      return inlineParts.map((subPart, subIndex) => {
        if (subIndex % 2 === 1) {
          const cleanCode = subPart.slice(1, -1);
          return (
            <code
              key={subIndex}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border)',
                fontFamily: 'SFMono-Regular, Consolas, monospace',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '0.85em',
                color: 'var(--color-danger)',
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
  const accent = 'var(--color-accent)';
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
          width: 28, height: 28, 
          borderRadius: 'var(--radius-sm)',
          flexShrink: 0,
          background: 'var(--color-accent-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          color: 'var(--color-accent)',
        }}>
          <Bot size={16} />
        </div>
      )}
      <div style={{
        position: 'relative',
        maxWidth: '75%', padding: '11px 15px',
        paddingRight: isUser ? '15px' : '40px',
        borderRadius: isUser ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
        background: isUser ? 'var(--color-accent)' : 'var(--color-surface-2)',
        border: isUser ? 'none' : '1px solid var(--border)',
        color: isUser ? 'var(--color-text-primary)' : 'var(--color-text-primary)', 
        fontSize: 14, lineHeight: 1.5,
        wordBreak: 'break-word',
      }}>
        {!isUser && (
          <button
            onClick={handleBubbleCopy}
            title="Copy message"
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              color: copied ? 'var(--color-success)' : 'var(--color-text-secondary)',
              opacity: 0.6,
              transition: 'opacity 0.2s, color 0.2s',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
            }}
          >
            {copied ? '✓' : <Copy size={13} />}
          </button>
        )}

        {renderMessageText(msg.text)}

        {msg.sources?.length > 0 && (
          <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            {msg.sources.map((s, i) => (
              <div key={i} style={{
                fontSize: 11.5, color: 'var(--color-text-secondary)', marginTop: 4,
                background: 'rgba(255,255,255,0.02)', borderRadius: 6, padding: '4px 8px',
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FileText size={14} /> <span style={{ color: 'var(--color-accent)' }}>{s.filename}</span></span> — {s.preview}
              </div>
            ))}
          </div>
        )}

        {msg.entity && msg.entity !== 'none' && ['add', 'update', 'delete'].includes(msg.action) && (
          <div style={{
            marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)',
            fontSize: 11, color: accent, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Check size={12} /> Dashboard updated · {msg.entity}
          </div>
        )}

        {msg.action === 'answer' && (
          <div style={{
            marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)',
            fontSize: 11, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-text-secondary)' }}><Brain size={14} /> Calculated from your data</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AIAssistant() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'notes' ? 'notes' : 'assistant';
  const [mode, setMode]               = useState(initialMode);
  const [listening, setListening]     = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const recognitionRef                = useRef(null);
  const [messages, setMessages]       = useState(() => {
    let savedNotes = [];
    let savedAssistant = [];
    try {
      const n = localStorage.getItem("ai_assistant_chat_history_notes");
      if (n) savedNotes = JSON.parse(n);
      const a = localStorage.getItem("ai_assistant_chat_history_assistant");
      if (a) savedAssistant = JSON.parse(a);
    } catch (e) {
      console.error(e);
    }
    return { notes: savedNotes, assistant: savedAssistant };
  });
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

  useEffect(() => {
    const qMode = searchParams.get('mode') || 'assistant';
    if (qMode === 'assistant' || qMode === 'notes') {
      setMode(qMode);
    }
  }, [searchParams]);

  useEffect(() => {
    try {
      localStorage.setItem("ai_assistant_chat_history_notes", JSON.stringify(messages.notes));
      localStorage.setItem("ai_assistant_chat_history_assistant", JSON.stringify(messages.assistant));
    } catch (e) {
      console.error(e);
    }
  }, [messages]);

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
    setTimeout(() => {
      setMode(newMode);
      setSearchParams({ mode: newMode });
      setSwitchAnim(false);
    }, 180);
  }, [mode, setSearchParams]);

  const addMessage = (modeKey, msg) => {
    setMessages(prev => ({ ...prev, [modeKey]: [...prev[modeKey], msg] }));
  };

  const speak = (text) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter    = new SpeechSynthesisUtterance(cleanTextForSpeech(text));
    utter.lang     = 'en-IN';
    utter.rate     = 1.05;
    window.speechSynthesis.speak(utter);
  };

  const handleSend = async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    setInput('');
    addMessage(mode, { role: 'user', text, id: Date.now() });
    setLoading(true);

    try {
      if (mode === 'notes') {
        const res = await callNotesAI('chat', { 
          message: text,
          history: messages.notes.map(m => ({ role: m.role, text: m.text }))
        });
        addMessage('notes', { role: 'ai', text: res.text, sources: res.sources, id: Date.now() + 1 });
        speak(res.text);
      } else {
        let res = await callSmartAssistant({ 
          message: text,
          history: messages.assistant.map(m => ({ role: m.role, text: m.text }))
        });

        if (res.success && res.action === 'confirm') {
          const confirmed = window.confirm(res.message);
          if (confirmed) {
            res = await callSmartAssistant({ 
              message: text, 
              confirmed: true,
              history: messages.assistant.map(m => ({ role: m.role, text: m.text }))
            });
          } else {
            addMessage('assistant', {
              role: 'ai',
              text: '❌ Deletion cancelled.',
              id: Date.now() + 2
            });
            setLoading(false);
            return;
          }
        }

        addMessage('assistant', {
          role  : 'ai',
          text  : res.message,
          entity: res.entity,
          action: res.action,
          id    : Date.now() + 1,
        });
        speak(res.message);

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
    recognition.interimResults = true;
    recognition.continuous     = false;

    let currentText = '';

    recognition.onstart  = () => setListening(true);
    recognition.onend    = () => {
      setListening(false);
      if (currentText.trim()) {
        handleSend(currentText.trim());
      }
    };
    recognition.onerror  = () => { setListening(false); toast.error('Voice error'); };
    recognition.onresult = (e) => {
      let resultText = '';
      for (let i = 0; i < e.results.length; ++i) {
        resultText += e.results[i][0].transcript;
      }
      currentText = resultText;
      setInput(resultText);
    };

    toast('Listening... Speak now.', { duration: 2000, icon: <Mic size={16} /> });
    recognition.start();
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
        text: `**${data.filename}** uploaded! Created ${data.chunks} knowledge chunks. Ask me anything about it!`,
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

  const ASSISTANT_COMMANDS = [
    { icon: Calendar, label: 'Attendance', example: 'I attended Data Structures today' },
    { icon: BarChart2, label: 'Marks',      example: 'I scored 42 out of 50 in Physics midterm' },
    { icon: CheckSquare, label: 'Task',       example: 'Add high priority task to submit project by Friday' },
    { icon: Layers,  label: 'Subject',    example: 'Add Maths and Physics on Monday and Tuesday' },
  ];

  return (
    <div className="page-container-fixed">
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
          background: var(--color-text-tertiary); margin: 0 2px;
          animation: aiDotBounce 1.2s ease-in-out infinite;
        }
        .ai-dot-loader span:nth-child(2) { animation-delay: 0.2s; }
        .ai-dot-loader span:nth-child(3) { animation-delay: 0.4s; }
        .ai-fade-in { animation: aiFadeIn 0.22s ease both; }
        .ai-pulse   { animation: aiPulse 2s ease-in-out infinite; }
      `}</style>

      {/* ── Page header ── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Bot size={20} color="var(--color-accent)" />
            AI Study Assistant
          </h1>
          <p className="page-subtitle">
            {mode === 'notes'
              ? 'Ask questions, summarize notes, generate quizzes'
              : 'Natural language dashboard control — powered by Groq'}
          </p>
        </div>
        <button
          className="btn btn-outline"
          onClick={() => {
            if (window.confirm(`Clear all chat history for ${mode === 'notes' ? 'Notes AI' : 'Dashboard AI'}?`)) {
              setMessages(prev => ({ ...prev, [mode]: [] }));
              toast.success('Chat history cleared');
            }
          }}
          style={{ padding: '6px 12px', fontSize: 13, borderColor: 'var(--border)', color: 'var(--color-text-tertiary)', background: 'transparent' }}
        >
          Clear Chat
        </button>
      </div>

      {/* ── Main card ── */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
        
        {/* ── Tabs ── */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          padding: '0 16px',
          gap: 24,
          background: 'var(--color-surface-1)'
        }}>
          {[
            { key: 'assistant', label: 'Dashboard AI', icon: Bot },
            { key: 'notes',     label: 'Notes AI',     icon: BookOpen, isBeta: true },
          ].map(tab => {
            const active = mode === tab.key;
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => switchMode(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 4px',
                  background: 'transparent',
                  color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13.5,
                  fontWeight: active ? 500 : 400,
                  borderBottom: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <IconComponent size={16} />
                <span>{tab.label}</span>
                {tab.isBeta && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    color: 'var(--color-warning)',
                    background: 'rgba(251, 191, 36, 0.12)',
                    border: '1px solid rgba(251, 191, 36, 0.2)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '1px 6px',
                    marginLeft: '4px'
                  }}>
                    Beta
                  </span>
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
              style={{ color: 'var(--color-success)', borderColor: 'rgba(16,185,129,0.35)', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Upload size={14} /> Upload Notes
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
              <BookOpen size={14} /> Notes ({notes.length})
            </button>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => handleAction('summarize')}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <FileText size={14} /> Summarize
            </button>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => handleAction('quiz')}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <HelpCircle size={14} /> Quiz Me
            </button>
            {uploadedFile && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                borderRadius: 8, padding: '4px 10px', fontSize: 12, color: 'var(--color-success)',
              }}>
                <Paperclip size={14} />
                {uploadedFile.name.slice(0, 22)}{uploadedFile.name.length > 22 ? '…' : ''}
              </div>
            )}
          </div>
        )}

        {/* ── Notes panel ── */}
        {mode === 'notes' && showNotes && (
          <div className="ai-fade-in" style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--color-surface-1)',
          }}>
            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500 }}>
              Uploaded Notes ({notes.length})
            </p>
            {notes.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>No notes uploaded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {notes.map(n => (
                  <div key={n._id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--color-surface-2)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '6px 12px', fontSize: 13, color: 'var(--color-text-secondary)',
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FileText size={14} /> {n._id}</span>
                    <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>({n.chunks} chunks)</span>
                    <button
                      onClick={() => handleDeleteNote(n._id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 14, padding: '0 2px' }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Horizontal Suggestions pills/chips ── */}
        {mode === 'assistant' && currentMessages.length === 0 && (
          <div className="ai-fade-in" style={{
            padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--color-surface-1)',
          }}>
            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500 }}>
              Quick Suggestions
            </p>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              {ASSISTANT_COMMANDS.map(cmd => {
                const IconComponent = cmd.icon;
                return (
                  <button
                    key={cmd.label}
                    onClick={() => handleChipClick(cmd.example)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      background: 'var(--color-surface-3)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-pill)',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      fontSize: 13,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-accent)';
                      e.currentTarget.style.background = 'var(--color-accent-muted)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.background = 'var(--color-surface-3)';
                    }}
                  >
                    <IconComponent size={14} color="var(--color-accent)" />
                    <span>{cmd.example}</span>
                  </button>
                );
              })}
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
        }}>
          {displayMessages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} mode={mode} />
          ))}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                background: 'var(--color-accent-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)',
              }}>
                <Bot size={16} />
              </div>
              <div style={{
                padding: '12px 16px', background: 'var(--color-surface-2)',
                border: '1px solid var(--border)', borderRadius: '4px 18px 18px 18px',
              }}>
                <div className="ai-dot-loader"><span /><span /><span /></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* ── Input ── */}
        <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            
            {/* Input Wrapper */}
            <div style={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              background: 'var(--color-surface-1)',
              border: `1.5px solid ${input ? 'rgba(99, 102, 241, 0.4)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '4px 44px 4px 12px',
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
                  listening ? 'Listening…'
                  : mode === 'notes' ? 'Ask anything about your notes…'
                  : 'Say anything — add subject, mark attendance, ask about CGPA…'
                }
                rows={1}
                style={{
                  flex: 1, background: 'transparent', color: 'var(--color-text-primary)',
                  fontSize: 14, fontFamily: 'inherit', lineHeight: 1.5,
                  border: 'none', outline: 'none', resize: 'none', maxHeight: 80,
                  height: '24px',
                  padding: '4px 0',
                }}
                onInput={e => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
                }}
              />

              {/* Mic Icon / Stop Recording inside the input area */}
              <button
                onClick={handleVoice}
                disabled={loading}
                title={listening ? 'Stop listening' : 'Start voice input'}
                style={{
                  position: 'absolute',
                  right: '8px',
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: listening ? 'var(--color-danger)' : 'transparent',
                  color: listening ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  transition: 'all 0.2s',
                }}
              >
                {listening ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="4" y="4" width="16" height="16" />
                  </svg>
                ) : (
                  <Mic size={16} />
                )}
              </button>
            </div>

            {/* Send */}
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: !input.trim() || loading
                  ? 'var(--color-surface-3)'
                  : 'var(--color-accent)',
                color: !input.trim() || loading ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
            >
              <Send size={16} />
            </button>
          </div>

          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 8, textAlign: 'center' }}>
            {mode === 'notes'
              ? 'Notes AI · Shift+Enter for new line'
              : 'Groq AI · Understands natural language · Updates dashboard in real-time'}
          </p>
        </div>
      </div>
    </div>
  );
}