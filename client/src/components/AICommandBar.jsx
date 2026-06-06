import { useState, useRef } from 'react';
import { aiChatService } from '../services/apiServices';
import { apiRequest }     from '../api/axios';
import toast from '../context/ToastContext';
import { Brain } from 'lucide-react';

// ── Voice support detection ───────────────────────────────────────────────
export default function AICommandBar({ onRefresh }) {
  const [input,      setInput]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [listening,  setListening]  = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioStreamRef = useRef(null);
  const voiceTimerRef = useRef(null);

  // ── Voice handler ─────────────────────────────────────────────────────
  const cleanupVoiceRecording = () => {
    if (voiceTimerRef.current) {
      clearTimeout(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    audioStreamRef.current?.getTracks().forEach(track => track.stop());
    audioStreamRef.current = null;
    mediaRecorderRef.current = null;
  };

  const transcribeAndRun = async (audioBlob) => {
    if (!audioBlob || audioBlob.size < 1000) {
      toast.info('No speech detected. Try again closer to the mic.');
      return;
    }

    try {
      const { data } = await aiChatService.transcribeAudio(audioBlob);
      const cmd = (data.text || '').trim();
      if (!cmd) {
        toast.info('No speech detected. Try again closer to the mic.');
        return;
      }
      setInput(cmd);
      handleCommand(cmd);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Voice transcription failed. Please try again.');
    }
  };

  const startVoice = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      toast.error('Voice recording is not supported in this browser. Try Chrome.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      audioChunksRef.current = [];
      audioStreamRef.current = stream;

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const chunks = audioChunksRef.current;
        const blobType = chunks[0]?.type || mimeType || 'audio/webm';
        const audioBlob = new Blob(chunks, { type: blobType });
        audioChunksRef.current = [];
        setListening(false);
        cleanupVoiceRecording();
        transcribeAndRun(audioBlob);
      };

      recorder.start();
      setListening(true);
      toast.info('Listening... click the mic again to stop.');
      voiceTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 8000);
    } catch (err) {
      cleanupVoiceRecording();
      setListening(false);
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
        toast.error('Microphone access is blocked. Allow mic access for localhost in the browser.');
      } else if (err.name === 'NotFoundError') {
        toast.error('No microphone was found. Check your input device.');
      } else {
        console.warn('Voice recording error:', err);
        toast.error('Voice recording could not start. Please try again.');
      }
    }
  };

  const stopVoice = () => {
    mediaRecorderRef.current?.stop();
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
  toast.info(`Opening explanation for ${data.explainTopic}…`);
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
        <div className="card-title" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Brain size={18} style={{ color: 'var(--color-accent)' }} />
          AI Command
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
            border:       `2px solid ${listening ? 'var(--color-danger)' : 'rgba(129,140,248,0.4)'}`,
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--color-danger)" style={{ display: 'block' }}>
              <rect x="4" y="4" width="16" height="16" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
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
          color:      'var(--color-danger)',
          display:    'flex',
          alignItems: 'center',
          gap:        8,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--color-danger)',
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
          color:        lastResult.success ? 'var(--color-success)' : 'var(--color-danger)',
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
