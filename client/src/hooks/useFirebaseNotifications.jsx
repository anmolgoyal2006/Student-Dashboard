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
  const title = payload?.notification?.title || 'StudentAI';
  const body = payload?.notification?.body || '';
  const data = payload?.data || {};

  const registration = await navigator.serviceWorker.ready;
  try {
    await registration.showNotification(title, {
      body,
      icon: '/logo192.png',
      badge: '/logo192.png',
      data: {
        subjectId: data.subjectId || '',
        date: data.date || '',
        url: data.url || '/',
      },
      actions: data.subjectId
        ? [
            { action: 'attended', title: '✅ Attended' },
            { action: 'not_attended', title: '❌ Not Attended' },
            { action: 'not_held', title: '⏸ Not Held' },
          ]
        : [],
    });
  } catch (error) {
    console.error('[FCM Hook] showNotification failed:', error);
    toast.info(`${title}: ${body}`);
  }
}

function registerForegroundHandler() {
  const messaging = getMessagingInstance();
  return onMessage(messaging, async (payload) => {
    const permission = await requestNotificationPermission();
    if (permission === 'granted') {
      await showNotification(payload);
      return;
    }
    const title = payload?.notification?.title || 'StudentAI';
    const body = payload?.notification?.body || '';
    toast.info(`${title}: ${body}`);
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
