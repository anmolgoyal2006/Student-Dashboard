// src/utils/authIDB.js
// Service workers cannot read localStorage.
// Call saveTokenToIDB() after login so the SW can read the JWT for attendance marking.

const DB_NAME    = 'authDB';
const DB_VERSION = 1;
const STORE_NAME = 'auth';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror   = (e) => reject(e.target.error);
  });
}

/**
 * Save JWT token to IndexedDB so service worker can access it.
 * Call this right after login / whenever token changes.
 */
export async function saveTokenToIDB(token) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put({ key: 'token', value: token });
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}

/**
 * Clear JWT from IndexedDB on logout.
 */
export async function clearTokenFromIDB() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete('token');
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}