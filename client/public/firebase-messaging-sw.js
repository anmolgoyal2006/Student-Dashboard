// public/firebase-messaging-sw.js

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

const messaging = firebase.messaging();


// ─────────────────────────────────────────────────────────────
// 🔔 BACKGROUND MESSAGE (SHOW NOTIFICATION WITH BUTTONS)
// ─────────────────────────────────────────────────────────────
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const { title, body, icon } = payload.notification || {};
  const data = payload.data || {};

  self.registration.showNotification(title || 'StudentAI', {
    body: body || 'Mark your attendance',
    icon: icon || '/logo192.png',
    badge: '/logo192.png',

    // 👇 IMPORTANT: pass data for click handling
    data: {
      subjectId: data.subjectId,
      date: data.date
    },

    // 🔥 ACTION BUTTONS
    actions: [
      { action: 'attended',     title: '✅ Attended' },
      { action: 'not_attended', title: '❌ Not Attended' },
      { action: 'not_held',     title: '⏸ Not Held' }
    ]
  });
});


// ─────────────────────────────────────────────────────────────
// 🖱 HANDLE NOTIFICATION CLICK (BUTTON ACTIONS)
// ─────────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  const subjectId = data.subjectId;
  const date = data.date;

  // 👉 If user just clicks notification (not button)
// 👉 No action = plain tap (mobile) → open in-app attendance page
  if (!action) {
    const url = subjectId
      ? `/?markAttendance=1&subjectId=${subjectId}&date=${date}`
      : '/';
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
        for (const c of list) {
          if (c.url.includes(self.location.origin)) {
            c.focus();
            c.navigate(url);
            return;
          }
        }
        return clients.openWindow(url);
      })
    );
    return;
  }

  // 🔥 Handle attendance marking
  event.waitUntil(
    (async () => {
      try {
       // Get token from SW's own cache instead of IDB
const token = await getTokenFromCache();

if (!token) {
  console.error('[SW] No JWT token found');
  return;
}

        const res = await fetch(`${BACKEND_URL}/api/attendance/mark-from-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            subjectId,
            status: action,
            date
          })
        });

        if (res.ok) {
          console.log(`[SW] Attendance marked: ${subjectId} → ${action}`);

          // ✅ Show confirmation
          self.registration.showNotification('✅ Attendance Marked', {
            body: `Marked as "${action.replace('_', ' ')}"`,
            icon: '/logo192.png',
            badge: '/logo192.png'
          });

        } else {
          console.error('[SW] Failed:', res.status);
        }

      } catch (err) {
        console.error('[SW ERROR]', err.message);
      }
    })()
  );
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
    console.error('[SW] Cache read error:', err);
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