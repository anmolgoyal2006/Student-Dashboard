const admin = require('firebase-admin');

const hasProjectId = !!process.env.FIREBASE_PROJECT_ID;
const hasClientEmail = !!process.env.FIREBASE_CLIENT_EMAIL;
const hasPrivateKey = !!process.env.FIREBASE_PRIVATE_KEY;

console.log(`[FCM SERVER] Firebase project configured: ${hasProjectId}`);
console.log(`[FCM SERVER] Firebase client email configured: ${hasClientEmail}`);
console.log(`[FCM SERVER] Firebase private key configured: ${hasPrivateKey}`);

if (!admin.apps.length) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY 
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : '';
    
    if (hasProjectId && hasClientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
      console.log('[FCM SERVER] Firebase Admin initialized: true');
    } else {
      console.warn('Firebase credentials incomplete, skipping Firebase Admin initialization');
      console.log('[FCM SERVER] Firebase Admin initialized: false');
    }
  } catch (error) {
    console.warn('Error initializing Firebase Admin:', error.message);
    console.log('[FCM SERVER] Firebase Admin initialized: false');
  }
} else {
  console.log('[FCM SERVER] Firebase Admin initialized: true');
}

module.exports = admin;
