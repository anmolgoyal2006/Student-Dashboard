import { useEffect } from 'react';
import axios from 'axios';
import { getFCMToken, getMessagingInstance } from '../firebase';
import { onMessage } from 'firebase/messaging';
import { toast } from '../context/ToastContext';

const AUTH_TOKEN_KEY = 'token';

async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') {
    console.log('[FCM CLIENT] Notification permission: not supported by browser');
    return 'default';
  }
  console.log('[FCM CLIENT] Notification permission:', Notification.permission);
  if (Notification.permission === 'default') {
    try {
      const result = await Notification.requestPermission();
      console.log('[FCM CLIENT] Notification permission requested. Result:', result);
      return result;
    } catch (error) {
      console.warn('[FCM Hook] Notification permission request failed:', error);
      return Notification.permission;
    }
  }
  return Notification.permission;
}

async function registerFcmToken() {
  const token = await getFCMToken();
  if (!token) {
    console.log('[FCM CLIENT] Saving token aborted: FCM token is empty');
    return null;
  }

  const jwt = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!jwt) {
    console.log('[FCM CLIENT] Saving token aborted: user is not logged in (no JWT)');
    return null;
  }

  console.log('[FCM CLIENT] API URL:', process.env.REACT_APP_API_URL);
  console.log('[FCM CLIENT] Saving token: true');
  try {
    const res = await axios.post(
      `${process.env.REACT_APP_API_URL}/user/save-token`,
      { token },
      { headers: { Authorization: `Bearer ${jwt}` } }
    );
    console.log('[FCM CLIENT] Token save response:', res.data);
  } catch (error) {
    console.error('[FCM CLIENT] Token save error:', error?.response?.data || error.message);
  }

  return token;
}

async function showNotification(payload) {
  const title = payload?.notification?.title || payload?.data?.title || 'StudentAI';
  const body  = payload?.notification?.body  || payload?.data?.body  || '';
  const data  = payload?.data || {};

  // ── Always show an in-app toast immediately ──────────────────────────────
  // Chrome blocks registration.showNotification() when the page tab is focused.
  // The toast is the reliable foreground notification; the SW notification is a
  // bonus that fires when the tab is in the background.
  toast.info(`${title}${body ? `: ${body}` : ''}`);

  // ── Also try a SW notification (works when tab is in background) ──────────
  try {
    const registration = await navigator.serviceWorker.ready;
    console.log('[FCM CLIENT] Service worker:', registration ? 'ready' : 'null');
    await registration.showNotification(title, {
      body,
      icon : '/logo192.png',
      badge: '/logo192.png',
      data : {
        subjectId: data.subjectId || '',
        date      : data.date      || '',
        url       : data.url       || '/',
      },
      actions: data.subjectId
        ? [
            { action: 'attended',     title: '✅ Attended'    },
            { action: 'not_attended', title: '❌ Not Attended' },
            { action: 'not_held',     title: '⏸️ Not Held'     },
          ]
        : [],
    });
  } catch (err) {
    console.warn('[FCM CLIENT] SW showNotification failed:', err.message);
  }
}

function registerForegroundHandler() {
  const messaging = getMessagingInstance();
  console.log('[FCM CLIENT] Messaging instance:', messaging ? 'initialized' : 'null');
  console.log('[FCM CLIENT] Foreground handler registered: true');
  return onMessage(messaging, async (payload) => {
    console.log('[FCM CLIENT] Foreground message received:', payload);
    await showNotification(payload);
  });
}

export default function useFirebaseNotifications(isLoggedIn) {
  useEffect(() => {
    if (!isLoggedIn) return undefined;

    let unsubscribe = null;
    let active = true;

    const init = async () => {
      try {
        const permission = await requestNotificationPermission();
        if (!active || permission === 'denied') return;

        await registerFcmToken();
        if (!active) return;

        unsubscribe = registerForegroundHandler();
      } catch (err) {
        console.error('[FCM Hook] Initialization failed:', err?.message || err);
      }
    };

    init();

    return () => {
      active = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [isLoggedIn]);
}
