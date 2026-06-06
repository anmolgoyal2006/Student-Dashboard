import React, { createContext, useContext, useState, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext(null);

let toastListener = null;

export const toast = (message, options = {}) => {
  toastListener?.(message, options.type || 'info', options);
};

toast.success = (message, options = {}) => toastListener?.(message, 'success', options);
toast.error = (message, options = {}) => toastListener?.(message, 'error', options);
toast.info = (message, options = {}) => toastListener?.(message, 'info', options);
toast.warning = (message, options = {}) => toastListener?.(message, 'warning', options);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    toastListener = (message, type, options = {}) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => {
        const next = [...prev, { id, message, type, icon: options.icon }];
        if (next.length > 3) {
          return next.slice(next.length - 3);
        }
        return next;
      });

      // auto dismiss after 4s
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, options.duration || 4000);
    };

    return () => {
      toastListener = null;
    };
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 16,
      right: 16,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} removeToast={removeToast} />
      ))}
    </div>
  );
};

const ToastItem = ({ toast, removeToast }) => {
  const { id, message, type } = toast;

  let icon = <Info size={16} />;
  let borderColor = 'var(--border)';
  let accentColor = 'var(--color-accent)';

  if (toast.icon) {
    icon = toast.icon;
  } else if (type === 'success') {
    icon = <CheckCircle size={16} color="var(--color-success)" />;
    borderColor = 'rgba(34, 197, 94, 0.2)';
    accentColor = 'var(--color-success)';
  } else if (type === 'error') {
    icon = <AlertCircle size={16} color="var(--color-danger)" />;
    borderColor = 'rgba(239, 68, 68, 0.2)';
    accentColor = 'var(--color-danger)';
  } else if (type === 'warning') {
    icon = <AlertTriangle size={16} color="var(--color-warning)" />;
    borderColor = 'rgba(245, 158, 11, 0.2)';
    accentColor = 'var(--color-warning)';
  } else if (type === 'info') {
    icon = <Info size={16} color="#3b82f6" />;
    borderColor = 'rgba(59, 130, 246, 0.2)';
    accentColor = '#3b82f6';
  }

  return (
    <div style={{
      pointerEvents: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      borderRadius: 'var(--radius-md)',
      background: 'var(--color-surface-2)',
      border: `1px solid ${borderColor}`,
      borderLeft: `4px solid ${accentColor}`,
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
      minWidth: 280,
      maxWidth: 360,
      animation: 'toastSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
    }}>
      <style>{`
        @keyframes toastSlideIn {
          from { transform: translateX(100%) translateY(-10px); opacity: 0; }
          to { transform: translateX(0) translateY(0); opacity: 1; }
        }
      `}</style>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{icon}</div>
      <div style={{
        flex: 1,
        fontSize: 13.5,
        fontWeight: 500,
        color: 'var(--color-text-primary)',
        lineHeight: 1.4,
      }}>{message}</div>
      <button
        onClick={() => removeToast(id)}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 2,
          opacity: 0.7,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default toast;
