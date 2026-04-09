import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey            : process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain        : process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId         : process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket     : process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId : process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId             : process.env.REACT_APP_FIREBASE_APP_ID,
};

const app       = initializeApp(firebaseConfig);
const messaging = getMessaging(app);
export const getMessagingInstance = () => messaging;

// ─── Get FCM token ────────────────────────────────────────────────────────────
export async function getFCMToken() {
  try {
    // Register service worker explicitly — required for getToken to work
    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const token = await getToken(messaging, {
      vapidKey             : process.env.REACT_APP_VAPID_KEY,  // must be set in .env
      serviceWorkerRegistration: swRegistration,
    });

    if (token) {
      console.log('[FCM] Token:', token);
      return token;
    } else {
      console.warn('[FCM] No token received — check VAPID key and SW registration.');
      return null;
    }
  } catch (err) {
    console.error('[FCM] getToken error:', err);
    return null;
  }
}

// ─── Foreground message listener ─────────────────────────────────────────────
export function onMessageListener() {
  return new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      console.log("[FCM] Foreground message:", payload);

      // 🔥 SHOW notification (THIS FIXES YOUR ISSUE)
      if (Notification.permission === "granted") {
        new Notification(payload.notification?.title || "Notification", {
          body: payload.notification?.body || "",
          icon: "/logo192.png",
        });
      }

      resolve(payload);
    });
  });
}