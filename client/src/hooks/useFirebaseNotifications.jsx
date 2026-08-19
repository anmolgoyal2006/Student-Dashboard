import { useEffect } from 'react';
import axios from 'axios';
import { getFCMToken, getMessagingInstance } from '../firebase';
import { onMessage } from 'firebase/messaging';
import { toast } from '../context/ToastContext';

const AUTH_TOKEN_KEY = 'token';

async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return 'default';
  if (Notification.permission === 'default') {
    try {
      return await Notification.requestPermission();
    } catch (error) {
      console.warn('[FCM Hook] Notification permission request failed:', error);
      return Notification.permission;
    }
  }
  return Notification.permission;
}

async function registerFcmToken() {
  const token = await getFCMToken();
  if (!token) return null;

  const jwt = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!jwt) return null;

  await axios.post(
    `${process.env.REACT_APP_API_URL}/user/save-token`,
    { token },
    { headers: { Authorization: `Bearer ${jwt}` } }
  );

  return token;
}

async function showNotification(payload) {
  const title = payload?.notification?.title || payload?.data?.title || 'StudentAI';
  const body  = payload?.notification?.body  || payload?.data?.body  || '';
  const data  = payload?.data || {};

  // ΓöÇΓöÇ Always show an in-app toast immediately ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  // Chrome blocks registration.showNotification() when the page tab is focused.
  // The toast is the reliable foreground notification; the SW notification is a
  // bonus that fires when the tab is in the background.
  toast.info(`${title}${body ? `: ${body}` : ''}`);

  // ΓöÇΓöÇ Also try a SW notification (works when tab is in background) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  try {
    const registration = await navigator.serviceWorker.ready;
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
            { action: 'attended',     title: 'Γ£à Attended'    },
            { action: 'not_attended', title: 'Γ¥î Not Attended' },
            { action: 'not_held',     title: 'ΓÅ╕ Not Held'     },
          ]
        : [],
    });
  } catch (_) {
    // Silently ignore ΓÇö toast above already handled the foreground case.
  }
}

function registerForegroundHandler() {
  const messaging = getMessagingInstance();
  return onMessage(messaging, async (payload) => {
    // showNotification always fires a toast (foreground) and attempts a
    // SW notification (background/minimized). No permission re-check needed
    // here ΓÇö getFCMToken already required permission to produce a token.
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
