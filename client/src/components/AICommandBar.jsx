import { useState, useRef } from 'react';
import { subjectService } from '../services/apiServices';
import { apiRequest }     from '../api/axios';
import toast from 'react-hot-toast';

// ── Voice support detection ───────────────────────────────────────────────
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

export default function AICommandBar({ onRefresh }) {
  const [input,      setInput]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [listening,  setListening]  = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const recogRef = useRef(null);

  // ── Voice handler ─────────────────────────────────────────────────────
  const startVoice = () => {
    if (!SpeechRecognition) {
      toast.error('Voice not supported in this browser. Try Chrome.');
      return;
    }
    const recog          = new SpeechRecognition();
    recog.lang           = 'en-US';
    recog.interimResults = true;
    recog.continuous     = false;
    recogRef.current     = recog;

    let currentText = '';

    recog.onstart  = () => setListening(true);
    recog.onend    = () => {
      setListening(false);
      const cmd = currentText.trim();
      if (cmd) {
        handleCommand(cmd);
      }
    };
    recog.onerror  = (e) => {
      setListening(false);
      if (e.error !== 'aborted') {
        toast.error('Voice error: ' + e.error);
      }
    };
    recog.onresult = (e) => {
      let resultText = '';
      for (let i = 0; i < e.results.length; ++i) {
        resultText += e.results[i][0].transcript;
      }
      currentText = resultText;
      setInput(resultText);
    };

    recog.start();
  };

  const stopVoice = () => {
    recogRef.current?.stop();
    setListening(false);
  };

  // ── Command handler ───────────────────────────────────────────────────
  const handleCommand = async (text) => {
    const cmd = (text || input).trim();
    if (!cmd) return;

    setLoading(true);
    setLastResult(null);

    try {
      const { data } = await apiRequest('post', '/ai-command', { command: cmd });

      setLastResult({ success: true, message: data.message, action: data.action });
      toast.success(data.message);
       if (data.explainTopic) {
  // Trigger your existing notes/explain panel
  toast(`Opening explanation for ${data.explainTopic}…`, { icon: '📖' });
  // Call your existing AI explain function here
}
      setInput('');
      // Refresh subject list in parent
      if (onRefresh) onRefresh();

    } catch (err) {
      const msg = err.response?.data?.message || 'Command failed';
      setLastResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCommand();
    }
  };

  // ── Example commands ──────────────────────────────────────────────────
  const examples = [
    'Add DSA with 4 credits',
    'Update OS credits to 3',
    'Delete DBMS',
  ];

  return (
    <div className="card mb-4">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>
          🧠 AI Command
        </div>
        <span style={{
          fontSize: 11, color: 'var(--muted)',
          background: 'rgba(129,140,248,0.1)',
          border: '1px solid rgba(129,140,248,0.2)',
          borderRadius: 99, padding: '2px 10px',
        }}>
          Text or Voice
        </span>
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          className="form-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Try: "Add DSA with 4 credits" or "Delete DBMS"'
          disabled={loading || listening}
          style={{ flex: 1 }}
        />

        {/* Voice button */}
        <button
          onClick={listening ? stopVoice : startVoice}
          disabled={loading}
          title={listening ? 'Stop listening' : 'Start voice command'}
          style={{
            width:        42,
            height:       42,
            borderRadius: '50%',
            border:       `2px solid ${listening ? '#f87171' : 'rgba(129,140,248,0.4)'}`,
            background:   listening ? 'rgba(248,113,113,0.15)' : 'rgba(129,140,248,0.1)',
            cursor:       'pointer',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            fontSize:     18,
            transition:   'all 0.2s',
            flexShrink:   0,
            animation:    listening ? 'pulse 1s ease infinite' : 'none',
          }}
        >
          {listening ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#f87171" style={{ display: 'block' }}>
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          )}
        </button>

        {/* Send button */}
        <button
          className="btn btn-primary"
          onClick={() => handleCommand()}
          disabled={loading || !input.trim() || listening}
          style={{ minWidth: 80 }}
        >
          {loading ? <span className="btn-spinner" /> : '➤ Send'}
        </button>
      </div>

      {/* Listening indicator */}
      {listening && (
        <div style={{
          marginTop:  10,
          fontSize:   13,
          color:      '#f87171',
          display:    'flex',
          alignItems: 'center',
          gap:        8,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#f87171',
            display: 'inline-block',
            animation: 'pulse 1s ease infinite',
          }} />
          Listening… speak your command
        </div>
      )}

      {/* Result feedback */}
      {lastResult && (
        <div style={{
          marginTop:    10,
          padding:      '8px 12px',
          borderRadius: 8,
          fontSize:     13,
          background:   lastResult.success
            ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
          border:       `1px solid ${lastResult.success
            ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
          color:        lastResult.success ? '#34d399' : '#f87171',
        }}>
          {lastResult.success ? '✅' : '❌'} {lastResult.message}
        </div>
      )}

      {/* Example pills */}
      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 4, alignSelf: 'center' }}>
          Try:
        </span>
        {examples.map(ex => (
          <button
            key={ex}
            onClick={() => setInput(ex)}
            disabled={loading || listening}
            style={{
              background:   'rgba(255,255,255,0.04)',
              border:       '1px solid var(--border)',
              borderRadius: 99,
              padding:      '3px 10px',
              fontSize:     11.5,
              color:        'var(--muted)',
              cursor:       'pointer',
              transition:   'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            {ex}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(0.95); }
        }
      `}</style>
    </div>
  );
}