import { useState, useEffect, useRef } from 'react';
import { getFCMToken, onMessageListener } from '../firebase';
import axios from 'axios';
import toast from 'react-hot-toast';

// ── helper ────────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'Just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

const API = process.env.REACT_APP_API_URL;
const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

// ─────────────────────────────────────────────────────────────────────────────
export default function NotificationBell() {
  const [permissionGranted, setPermissionGranted] = useState(
    () => Notification.permission === 'granted'
  );
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [loading,       setLoading]       = useState(false);
  const dropdownRef = useRef(null);

  // ── close on outside click (unchanged) ──────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── fetch persisted notifications from backend ───────────────────────────
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/notifications`, {
        headers: authHeader(),
      });
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      console.error('[Notifications] fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount so badge count is correct immediately
  useEffect(() => {
    if (permissionGranted) fetchNotifications();
  }, [permissionGranted]);

  // ── foreground FCM messages (unchanged logic, now also bumps unreadCount) ─
  useEffect(() => {
    if (!permissionGranted) return;

    onMessageListener()
      .then((payload) => {
        // Prepend the live foreground message to the list
        setNotifications((prev) => [
          {
            _id:       Date.now(),          // temporary id
            title:     payload?.notification?.title || 'New Notification',
            body:      payload?.notification?.body  || '',
            read:      false,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        setUnreadCount((prev) => prev + 1);
      })
      .catch(console.error);
  }, [permissionGranted]);

  // ── enable notifications (unchanged) ────────────────────────────────────
  const enableNotifications = async () => {
    const permission = await Notification.requestPermission();

    if (permission === 'denied') {
      toast.error('Notifications blocked. Please allow them in browser settings.');
      return;
    }
    if (permission !== 'granted') return;

    try {
      const token = await getFCMToken();
      if (!token) {
        toast.error('Could not get notification token. Try again.');
        return;
      }

      await axios.post(
        `${API}/user/save-token`,
        { token },
        { headers: authHeader(), withCredentials: true }
      );

      setPermissionGranted(true);
      setDropdownOpen(true);
      toast.success('Notifications enabled! 🔔');
    } catch (err) {
      console.error('[FCM]', err.message);
      toast.error('Failed to enable notifications.');
    }
  };

  // ── mark single as read ──────────────────────────────────────────────────
  const markAsRead = async (id) => {
    try {
      await axios.patch(`${API}/api/notifications/${id}/read`, {}, {
        headers: authHeader(),
      });
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('[Notifications] mark read error:', err.message);
    }
  };

  // ── mark all as read ─────────────────────────────────────────────────────
  const markAllAsRead = async () => {
    try {
      await axios.patch(`${API}/api/notifications/read-all`, {}, {
        headers: authHeader(),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('[Notifications] mark all read error:', err.message);
    }
  };

  // ── bell click ───────────────────────────────────────────────────────────
  const handleClick = async () => {
    if (!permissionGranted) {
      await enableNotifications();
    } else {
      if (!dropdownOpen) fetchNotifications(); // refresh on every open
      setDropdownOpen((prev) => !prev);
    }
  };

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>

      {/* Bell button — your original style, untouched */}
      <button
        onClick={handleClick}
        title={permissionGranted ? 'Notifications' : 'Enable Notifications'}
        style={{
          position:   'relative',
          background: 'none',
          border:     'none',
          cursor:     'pointer',
          fontSize:   '1.3rem',
          padding:    '4px',
          lineHeight: 1,
          color:      permissionGranted ? '#818cf8' : '#94a3b8',
        }}
      >
        {permissionGranted ? '🔔' : '🔕'}

        {unreadCount > 0 && (
          <span style={{
            position:       'absolute',
            top:            '-4px',
            right:          '-4px',
            background:     '#ef4444',
            color:          '#fff',
            borderRadius:   '999px',
            fontSize:       '10px',
            fontWeight:     700,
            minWidth:       '16px',
            height:         '16px',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            padding:        '0 4px',
            lineHeight:     1,
            pointerEvents:  'none',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown — your original shell, updated body */}
      {dropdownOpen && (
        <div style={{
          position:     'absolute',
          right:        0,
          top:          'calc(100% + 8px)',
          width:        '300px',
          background:   'var(--bg-2)',
          border:       '1px solid var(--card-border)',
          borderRadius: '12px',
          boxShadow:    '0 8px 32px rgba(0,0,0,0.4)',
          zIndex:       1000,
          overflow:     'hidden',
        }}>

          {/* Header — "Clear all" replaced with "Mark all read" */}
          <div style={{
            padding:        '12px 16px',
            borderBottom:   '1px solid var(--border)',
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'center',
          }}>
            <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'none',
                  border:     'none',
                  cursor:     'pointer',
                  fontSize:   '12px',
                  color:      'var(--muted)',
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  onClick={() => !n.read && markAsRead(n._id)}
                  style={{
                    padding:        '12px 16px',
                    borderBottom:   '1px solid var(--border)',
                    display:        'flex',
                    gap:            '10px',
                    alignItems:     'flex-start',
                    cursor:         n.read ? 'default' : 'pointer',
                    background:     n.read ? 'transparent' : 'rgba(99,102,241,0.07)',
                    transition:     'background 0.15s',
                  }}
                >
                  {/* Unread dot */}
                  <span style={{
                    width:        '7px',
                    height:       '7px',
                    borderRadius: '50%',
                    background:   n.read ? 'transparent' : '#818cf8',
                    flexShrink:   0,
                    marginTop:    '4px',
                  }} />

                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{
                      fontWeight:   n.read ? 400 : 600,
                      fontSize:     '13px',
                      color:        'var(--text)',
                      whiteSpace:   'nowrap',
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {n.title}
                    </span>
                    {n.body && (
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        {n.body}
                      </span>
                    )}
                    <span style={{ fontSize: '11px', color: 'var(--muted)', opacity: 0.7 }}>
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}
    </div>
  );
}