const admin = require('firebase-admin');
const path  = require('path');

// Place your Firebase service account JSON at: server/config/serviceAccountKey.json
// Download it from: Firebase Console → Project Settings → Service Accounts → Generate new private key
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;