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

// ─── Get FCM token ────────────────────────────────────────────────────────────
export async function getFCMToken() {
  try {
    // Register the service worker
    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    // Wait for the SW to become active before calling getToken.
    // After unregister+re-register (or first visit) the SW is in 'installing'
    // state — getToken's internal pushManager.subscribe() fails if there is
    // no active worker yet.
    await waitForActiveServiceWorker(swRegistration);

    const token = await getToken(messaging, {
      vapidKey                 : process.env.REACT_APP_VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (token) {
      console.log('[FCM] Token obtained');
      return token;
    } else {
      console.warn('[FCM] No token received — check VAPID key and SW registration.');
      return null;
    }
  } catch (err) {
    if (
      err?.code === 'messaging/permission-blocked' ||
      err?.code === 'messaging/permission-default' ||
      err?.code === 'messaging/notifications-blocked'
    ) {
      console.info('[FCM] Notifications not permitted — push disabled.');
      return null;
    }
    console.error('[FCM] getToken error:', err);
    return null;
  }
}

/**
 * Wait until a service worker registration has an active worker.
 * Handles three cases:
 *  1. Already active   → resolves immediately
 *  2. Installing/waiting → waits for statechange to 'activated'
 *  3. Timeout (10s)    → resolves anyway so the caller can still try
 */
function waitForActiveServiceWorker(registration) {
  return new Promise((resolve) => {
    if (registration.active) {
      resolve();
      return;
    }

    const timeout = setTimeout(resolve, 10000); // give up after 10s

    const worker = registration.installing || registration.waiting;
    if (!worker) {
      clearTimeout(timeout);
      resolve();
      return;
    }

    worker.addEventListener('statechange', function onStateChange() {
      if (worker.state === 'activated') {
        clearTimeout(timeout);
        worker.removeEventListener('statechange', onStateChange);
        resolve();
      }
    });
  });
}

// ─── Foreground message listener ─────────────────────────────────────────────
// NOTE: Foreground handling is done entirely in useFirebaseNotifications.jsx.
// This export is kept for backward-compat but should not be called — calling it
// creates a second parallel listener that shows a duplicate notification.
export function onMessageListener() {
  return new Promise(() => {}); // no-op: never resolves, never registers a handler
}