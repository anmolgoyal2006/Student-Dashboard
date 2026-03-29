import axios from 'axios';

// ─── Retry helper ───────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function withRetry(fn, retries = 3, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isNetworkError = !err.response;           // no response = cold start / network drop
      const isServerError  = err.response?.status >= 500;
      const shouldRetry    = (isNetworkError || isServerError) && attempt < retries;

      if (!shouldRetry) throw err;

      console.warn(`[API] Attempt ${attempt} failed. Retrying in ${delayMs}ms…`);
      await sleep(delayMs * attempt); // exponential-ish back-off: 2s, 4s
    }
  }
}

// ─── Axios instance ─────────────────────────────────────────────────────────
const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 60000,          // 60 s — enough for a cold start
  withCredentials: false,  // set true only if you use httpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Attach JWT on every request ────────────────────────────────────────────
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Global response error handler ──────────────────────────────────────────
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.code === 'ECONNABORTED') {
      err.message = 'Request timed out. The server may be waking up — please try again.';
    } else if (!err.response) {
      err.message = 'Cannot reach the server. Check your connection or try again shortly.';
    }
    return Promise.reject(err);
  }
);

// ─── Wrapped request with retry ─────────────────────────────────────────────
export const apiRequest = (method, url, data, config = {}) =>
  withRetry(() => API({ method, url, data, ...config }));

export default API;