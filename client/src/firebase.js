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

// ─── Get FCM token ────────────────────────────────────────────────────────────
export async function getFCMToken() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission denied.');
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY,
    });

    if (token) {
      console.log('[FCM] Token:', token);
      return token;
    } else {
      console.warn('[FCM] No token received.');
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
      resolve(payload);
    });
  });
}