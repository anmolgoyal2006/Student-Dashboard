import { useState, useEffect, useRef } from 'react';
import { getFCMToken, onMessageListener } from '../firebase';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function NotificationBell() {
  const [permissionGranted, setPermissionGranted] = useState(
    () => Notification.permission === 'granted'
  );
  const [notifications, setNotifications] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Listen for foreground FCM messages
  useEffect(() => {
    if (!permissionGranted) return;

    onMessageListener()
      .then((payload) => {
        setNotifications((prev) => [
          {
            id: Date.now(),
            title: payload?.notification?.title || 'New Notification',
            body: payload?.notification?.body || '',
          },
          ...prev,
        ]);
      })
      .catch(console.error);
  }, [permissionGranted]);

  const enableNotifications = async () => {
    // 1. Request permission
    const permission = await Notification.requestPermission();

    if (permission === 'denied') {
      toast.error('Notifications blocked. Please allow them in browser settings.');
      return;
    }

    if (permission !== 'granted') return;

    try {
      // 2. Get FCM token
      const token = await getFCMToken();
      if (!token) {
        toast.error('Could not get notification token. Try again.');
        return;
      }

      // 3. Send token to backend with JWT Authorization header
      const jwt = localStorage.getItem('token'); // adjust key to match your app
      await axios.post(
        `${process.env.REACT_APP_API_URL}/user/save-token`,
        { token },
        {
          headers: { Authorization: `Bearer ${jwt}` },
          withCredentials: true,
        }
      );

      setPermissionGranted(true);
      setDropdownOpen(true);
      toast.success('Notifications enabled! 🔔');
    } catch (err) {
      console.error('[FCM]', err.message);
      toast.error('Failed to enable notifications.');
    }
  };

  const handleClick = async () => {
    if (!permissionGranted) {
      // First click: request permission + register token
      await enableNotifications();
    } else {
      // Already enabled: just toggle dropdown
      setDropdownOpen((prev) => !prev);
    }
  };

  const unreadCount = notifications.length;

   return (
  <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>

    {/* Bell Button */}
    <button
      onClick={handleClick}
      title={permissionGranted ? 'Notifications' : 'Enable Notifications'}
     style={{
  position: 'relative',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '1.3rem',
  padding: '4px',
  lineHeight: 1,
  color: permissionGranted ? '#818cf8' : '#94a3b8',
}}
    >
      {permissionGranted ? '🔔' : '🔕'}

      {unreadCount > 0 && (
        <span style={{
          position: 'absolute',
          top: '-4px', right: '-4px',
          background: '#ef4444',
          color: '#fff',
          borderRadius: '999px',
          fontSize: '10px',
          fontWeight: 700,
          minWidth: '16px',
          height: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 4px',
          lineHeight: 1,
          pointerEvents: 'none',
        }}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>

    {/* Dropdown panel */}
    {dropdownOpen && (
      <div style={{
        position: 'absolute',
        right: 0,
        top: 'calc(100% + 8px)',
        width: '300px',
        background: 'var(--bg-2)',
        border: '1px solid var(--card-border)',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        zIndex: 1000,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>
            Notifications
          </span>
          {unreadCount > 0 && (
            <button
              onClick={() => setNotifications([])}
              style={{
                background: 'none', border: 'none',
                cursor: 'pointer', fontSize: '12px',
                color: 'var(--muted)',
              }}
            >
              Clear all
            </button>
          )}
        </div>

        {/* List */}
        <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
          {notifications.length === 0 ? (
            <div style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--muted)',
              fontSize: '13px',
            }}>
              No notifications yet
            </div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}>
                <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>
                  {n.title}
                </span>
                {n.body && (
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{n.body}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    )}
  </div>
)};