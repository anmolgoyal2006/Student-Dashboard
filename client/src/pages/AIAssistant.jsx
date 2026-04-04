import { useState, useRef, useEffect } from 'react';
import { aiChatService } from '../services/apiServices';
import toast from 'react-hot-toast';

const MODE_LABELS = {
  chat:      { icon: '💬', label: 'Chat'     },
  summarize: { icon: '📝', label: 'Summarize'},
  quiz:      { icon: '🧠', label: 'Quiz'     },
};

const MODE_PLACEHOLDERS = {
  chat:      'Ask anything about your notes…',
  summarize: 'Type "summarize my notes" or ask for a specific topic…',
  quiz:      'Type "generate quiz" or specify a topic…',
};

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display:       'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom:  16,
      gap:           10,
      alignItems:    'flex-start',
    }}>
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #6366f1, #818cf8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
        }}>🤖</div>
      )}

      <div style={{ maxWidth: '75%' }}>
        <div style={{
          background:   isUser ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'rgba(255,255,255,0.05)',
          border:       isUser ? 'none' : '1px solid rgba(255,255,255,0.08)',
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          padding:      '12px 16px',
          color:        'var(--text)',
          fontSize:     13.5,
          lineHeight:   1.6,
          whiteSpace:   'pre-wrap',
          wordBreak:    'break-word',
        }}>
          {msg.content}
        </div>

        {/* Sources */}
        {msg.sources?.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {msg.sources.map((s, i) => (
              <div key={i} style={{
                background:   'rgba(129,140,248,0.08)',
                border:       '1px solid rgba(129,140,248,0.2)',
                borderRadius: 8,
                padding:      '6px 10px',
                marginBottom: 4,
                fontSize:     11.5,
                color:        'var(--muted)',
              }}>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                  📄 {s.filename}
                </span>
                <br />
                {s.preview}
              </div>
            ))}
          </div>
        )}

        {msg.error && (
          <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
            ⚠️ {msg.error}
          </div>
        )}
      </div>

      {isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #334155, #475569)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, color: '#fff',
        }}>👤</div>
      )}
    </div>
  );
}

export default function AIAssistant() {
  const [messages,   setMessages]   = useState([
    {
      role:    'assistant',
      content: "Hi! I'm your AI Study Assistant 🎓\n\nUpload your notes (PDF or text) and I can:\n• Answer questions from your notes\n• Summarize topics\n• Generate practice quizzes\n\nUpload a file to get started, or just ask me anything!",
    }
  ]);
  const [input,      setInput]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [mode,       setMode]       = useState('chat');
  const [notes,      setNotes]      = useState([]);
  const [uploading,  setUploading]  = useState(false);
  const [showNotes,  setShowNotes]  = useState(false);

  const bottomRef  = useRef(null);
  const fileRef    = useRef(null);
  const inputRef   = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      const { data } = await aiChatService.getNotes();
      setNotes(data.notes || []);
    } catch { /* silent */ }
  };

  const handleUpload = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data } = await aiChatService.uploadNotes(file);
      toast.success(data.message);
      setMessages(p => [...p, {
        role:    'assistant',
        content: `✅ **${data.filename}** uploaded successfully!\nCreated ${data.chunks} knowledge chunks. You can now ask questions about this file.`,
      }]);
      loadNotes();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteNote = async filename => {
    try {
      await aiChatService.deleteNote(filename);
      toast.success('Note deleted');
      loadNotes();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleSend = async (overrideMessage) => {
    const text = (overrideMessage || input).trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    setMessages(p => [...p, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await aiChatService.chat(text, mode);
      setMessages(p => [...p, {
        role:    'assistant',
        content: data.answer,
        sources: data.sources,
      }]);
    } catch (err) {
      setMessages(p => [...p, {
        role:  'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        error: err.response?.data?.message || err.message,
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = [
    { label: '📝 Summarize my notes', mode: 'summarize', msg: 'Summarize all my uploaded notes'      },
    { label: '🧠 Generate quiz',       mode: 'quiz',      msg: 'Generate a quiz from my notes'        },
    { label: '🔑 Key concepts',        mode: 'chat',      msg: 'What are the key concepts in my notes?'},
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', gap: 16 }}>

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🤖 AI Study Assistant</h1>
          <p className="page-subtitle">Ask questions, summarize notes, generate quizzes</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setShowNotes(n => !n)}
          >
            📚 Notes ({notes.length})
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? '⏳ Uploading…' : '📤 Upload Notes'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.md"
            style={{ display: 'none' }}
            onChange={handleUpload}
          />
        </div>
      </div>

      {/* ── Uploaded notes panel ── */}
      {showNotes && (
        <div className="card" style={{ padding: 16 }}>
          <div className="card-title">📚 Uploaded Notes</div>
          {notes.length === 0 ? (
            <p className="text-muted">No notes uploaded yet.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {notes.map(n => (
                <div key={n._id} style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          8,
                  background:   'rgba(129,140,248,0.08)',
                  border:       '1px solid rgba(129,140,248,0.2)',
                  borderRadius: 8,
                  padding:      '6px 12px',
                  fontSize:     13,
                }}>
                  <span>📄 {n._id}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 11 }}>({n.chunks} chunks)</span>
                  <button
                    onClick={() => handleDeleteNote(n._id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--danger)', fontSize: 14, padding: '0 2px',
                    }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Mode selector ── */}
      <div style={{ display: 'flex', gap: 8 }}>
        {Object.entries(MODE_LABELS).map(([key, val]) => (
          <button
            key={key}
            className={`btn btn-sm ${mode === key ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setMode(key)}
          >
            {val.icon} {val.label}
          </button>
        ))}
      </div>

      {/* ── Chat window ── */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>

        {/* Messages */}
        <div style={{
          flex:       1,
          overflowY:  'auto',
          padding:    '20px 16px',
          scrollbarWidth: 'thin',
        }}>
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}

          {/* Loading indicator */}
          {loading && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              }}>🤖</div>
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '18px 18px 18px 4px',
                padding: '12px 18px',
                display: 'flex', gap: 5, alignItems: 'center',
              }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: 'var(--primary)',
                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick actions */}
        {messages.length <= 1 && (
          <div style={{ padding: '0 16px 12px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {quickActions.map((a, i) => (
              <button
                key={i}
                className="btn btn-outline btn-sm"
                onClick={() => { setMode(a.mode); handleSend(a.msg); }}
                disabled={loading}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{
          padding:    '12px 16px',
          borderTop:  '1px solid var(--border)',
          display:    'flex',
          gap:        10,
          alignItems: 'flex-end',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={MODE_PLACEHOLDERS[mode]}
            disabled={loading}
            rows={1}
            style={{
              flex:        1,
              background:  'rgba(255,255,255,0.04)',
              border:      '1px solid var(--border)',
              borderRadius: 10,
              padding:     '10px 14px',
              color:       'var(--text)',
              fontSize:    14,
              resize:      'none',
              fontFamily:  'inherit',
              lineHeight:  1.5,
              maxHeight:   120,
              overflowY:   'auto',
              outline:     'none',
            }}
            onFocus={e  => e.target.style.borderColor = 'var(--primary)'}
            onBlur={e   => e.target.style.borderColor = 'var(--border)'}
            onInput={e  => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
          />
          <button
            className="btn btn-primary"
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            style={{ minWidth: 44, minHeight: 44, borderRadius: 10 }}
          >
            {loading ? '⏳' : '➤'}
          </button>
        </div>
      </div>

      {/* Bounce animation */}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30%            { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}