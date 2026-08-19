import { initializeApp } from 'firebase/app';
import { getMessaging, getToken } from 'firebase/messaging';

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

// ΓöÇΓöÇΓöÇ Get FCM token ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
export async function getFCMToken() {
  try {
    console.log('[FCM CLIENT] Registering service worker explicitly...');
    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('[FCM CLIENT] Service worker registered successfully:', swRegistration.scope);

    console.log('[FCM CLIENT] Requesting FCM token. VAPID Key exists:', !!process.env.REACT_APP_VAPID_KEY);
    const token = await getToken(messaging, {
      vapidKey             : process.env.REACT_APP_VAPID_KEY,  // must be set in .env
      serviceWorkerRegistration: swRegistration,
    });

    if (token) {
      console.log('[FCM CLIENT] FCM token:', token);
      return token;
    } else {
      console.warn('[FCM] No token received ΓÇö check VAPID key and SW registration.');
      return null;
    }
  } catch (err) {
    // Declining notifications is a normal user choice, not a fault ΓÇö logging it
    // as an error buries real failures in the console.
    if (
      err?.code === 'messaging/permission-blocked' ||
      err?.code === 'messaging/permission-default' ||
      err?.code === 'messaging/notifications-blocked'
    ) {
      console.info('[FCM] Notifications not permitted ΓÇö push disabled.');
      return null;
    }
    console.error('[FCM] getToken error:', err);
    return null;
  }
}

// ΓöÇΓöÇΓöÇ Foreground message listener ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// NOTE: Foreground handling is done entirely in useFirebaseNotifications.jsx.
// This export is kept for backward-compat but should not be called ΓÇö calling it
// creates a second parallel listener that shows a duplicate notification.
export function onMessageListener() {
  return new Promise(() => {}); // no-op: never resolves, never registers a handler
}
