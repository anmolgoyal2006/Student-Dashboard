import http from 'k6/http';
import { sleep, check } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m',  target: 50 },
    { duration: '20s', target: 0 },
  ],
};

export default function () {
  // Frontend - Vercel
  let frontend = http.get('https://student-dashboard-ashy-rho.vercel.app');
  check(frontend, {
    'dashboard loaded': (r) => r.status === 200,
    'response fast':    (r) => r.timings.duration < 500,
  });

  // Backend API - Render
 let api = http.get('https://student-dashboard-irm9.onrender.com/api/auth/login');
check(api, {
  'API awake': (r) => r.status === 200 || r.status === 404 || r.status === 400,
});
  sleep(1);
}