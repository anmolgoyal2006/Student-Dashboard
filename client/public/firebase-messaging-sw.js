// public/firebase-messaging-sw.js
console.log('[FCM SW] Service worker loaded');

importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js');

// 🔗 Your backend URL
const BACKEND_URL = self.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : 'https://student-dashboard-irm9.onrender.com';

// 🔥 Firebase config (must be here)
firebase.initializeApp({
  apiKey: "AIzaSyAdWBjiEgbAZxAaIdDwcSioQW1zo4ztZzA",
  authDomain: "student-dashboard-1aab5.firebaseapp.com",
  projectId: "student-dashboard-1aab5",
  storageBucket: "student-dashboard-1aab5.firebasestorage.app",
  messagingSenderId: "623897490761",
  appId: "1:623897490761:web:e8674ee0dafefa08b79698",
});
console.log('[FCM SW] Firebase initialized');

const messaging = firebase.messaging();
console.log('[FCM SW] Messaging initialized');


// ─────────────────────────────────────────────────────────────
// 🔔 BACKGROUND MESSAGE (SHOW NOTIFICATION WITH BUTTONS)
// ─────────────────────────────────────────────────────────────
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM SW] Background message received:', payload);

  // If the payload has a notification field, FCM client displays it automatically.
  // We only manually show it if it is a data-only message (e.g. attendance mark prompt).
  if (payload.notification) {
    console.log('[FCM SW] Message contains notification payload, letting browser display it automatically');
    return;
  }

  const data = payload.data || {};
  const isAttendance = !!data.subjectId;

  // For data-only messages, we must display them manually
  const title = data.title || 'StudentAI';
  const body = data.body || (isAttendance ? 'Mark your attendance' : '');
  const icon = data.icon || '/logo192.png';

  console.log('[FCM SW] Displaying manual notification for data-only message');

  self.registration.showNotification(title, {
    body,
    icon,
    badge: '/logo192.png',

    data: {
      subjectId: data.subjectId || '',
      date: data.date || new Date().toISOString().split('T')[0],
      url: isAttendance ? `/?markAttendance=1&subjectId=${data.subjectId}&date=${data.date}` : '/',
    },

    actions: isAttendance ? [
      { action: 'attended',     title: '✅ Attended' },
      { action: 'not_attended', title: '❌ Not Attended' },
      { action: 'not_held',     title: '⏸ Not Held' },
    ] : [],
  });
  console.log('[FCM SW] Notification displayed');
});


// ─────────────────────────────────────────────────────────────
// 🖱 HANDLE NOTIFICATION CLICK (BUTTON ACTIONS)
// ─────────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.waitUntil((async () => {
    event.notification.close();
  const action = event.action;
  const data = event.notification.data || {};

  const subjectId = data.subjectId;
  const date = data.date;
// 👉 No action = plain tap → open in-app prompt
  if (!action) {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });

    // iOS PWA: send postMessage if app is already open
    for (const client of allClients) {
      client.postMessage({ type: 'MARK_ATTENDANCE', subjectId, date });
      await client.focus();
      return;
    }

    // App not open — open it with URL params
    const url = data.url
      || (subjectId ? `/?markAttendance=1&subjectId=${subjectId}&date=${date}` : '/');
    await clients.openWindow(url);
    return;
  }

  // 🔥 Action button clicked — mark attendance directly from SW
  try {
    const token = await getJWTToken();
    if (!token) {
      console.error('[SW] No JWT token found');
      await self.registration.showNotification('Please log in again', {
        body: 'Open the app and sign in to mark attendance from notifications.',
        icon: '/logo192.png',
        badge: '/logo192.png',
        data: { url: '/login' },
      });
      return;
    }

    const res = await fetch(`${BACKEND_URL}/api/attendance/mark-from-notification`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ subjectId, status: action, date }),
    });

    if (res.ok) {
      console.log(`[SW] Attendance marked: ${subjectId} → ${action}`);
      await self.registration.showNotification('✅ Attendance Marked', {
        body: `Marked as "${action.replace(/_/g, ' ')}"`,
        icon: '/logo192.png',
        badge: '/logo192.png',
      });
    } else if (res.status === 401) {
      console.error('[SW] Failed: 401 — token expired or invalid');
      await self.registration.showNotification('Please log in again', {
        body: 'Your session has ended. Open the app and sign in to mark attendance from notifications.',
        icon: '/logo192.png',
        badge: '/logo192.png',
        data: { url: '/login' },
      });
    } else {
      console.error('[SW] Failed:', res.status);
    }
  } catch (err) {
    console.error('[SW ERROR]', err.message);
  }

  })()); // closes event.waitUntil async IIFE
});


// ─────────────────────────────────────────────────────────────
// 💾 GET JWT TOKEN FROM INDEXEDDB
// ────────────
// ─────────────────────────────────────────────────
async function getTokenFromCache() {
  try {
    const cache = await caches.open('auth-cache');
    const response = await cache.match('auth-token');
    if (!response) return null;
    const data = await response.json();
    return data.token || null;
  } catch (err) {
    console.error('[FCM SW] Cache read error:', err);
    return null;
  }
}
function getTokenFromIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('authDB', 1);

    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('auth', { keyPath: 'key' });
    };

    request.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction('auth', 'readonly');
      const store = tx.objectStore('auth');

      const getReq = store.get('token');

      getReq.onsuccess = () => {
        resolve(getReq.result?.value || null);
      };

      getReq.onerror = () => reject(getReq.error);
    };

    request.onerror = () => reject(request.error);
  });
}
async function getJWTToken() {
  console.log('[FCM SW] Attempting to retrieve JWT token...');
  let token = await getTokenFromCache();
  if (token) {
    console.log('[FCM SW] JWT token retrieved from Cache Storage');
    return token;
  }
  try {
    token = await getTokenFromIDB();
    if (token) {
      console.log('[FCM SW] JWT token retrieved from IndexedDB');
      return token;
    }
  } catch (err) {
    console.error('[FCM SW] IndexedDB read error:', err);
  }
  console.log('[FCM SW] No JWT token found in Cache Storage or IndexedDB');
  return null;
}