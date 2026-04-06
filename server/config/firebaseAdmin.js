const admin = require('firebase-admin');

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // ✅ Production (Render)
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  // ✅ Local fallback (optional)
  serviceAccount = require('./serviceAccountKey.json');
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      ...serviceAccount,
      private_key: serviceAccount.private_key.replace(/\\n/g, '\n'),
    }),
  });
}

module.exports = admin;