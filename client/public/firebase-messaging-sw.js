// firebase-messaging-sw.js
// Uses compat version — required for service workers

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Config must be duplicated here — service workers have no access to env vars
// Replace these values with your actual Firebase config
firebase.initializeApp({
  apiKey: "AIzaSyAdWBjiEgbAZxAaIdDwcSioQW1zo4ztZzA",
  authDomain: "student-dashboard-1aab5.firebaseapp.com",
  projectId: "student-dashboard-1aab5",
  storageBucket: "student-dashboard-1aab5.firebasestorage.app",
  messagingSenderId: "623897490761",
  appId: "1:623897490761:web:e8674ee0dafefa08b79698",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const { title, body, icon } = payload.notification || {};

  self.registration.showNotification(title || 'StudentAI', {
    body : body  || 'You have a new notification.',
    icon : icon  || '/logo192.png',
    badge: '/logo192.png',
    data : payload.data || {},
  });
});