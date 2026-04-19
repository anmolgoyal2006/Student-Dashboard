import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 30,
  duration: '30s',
};

export default function () {
  let res = http.post(
    'https://student-dashboard-irm9.onrender.com/api/auth/login',
    JSON.stringify({
      email: 'anmolgoyal1974@gmail.com',  // 👈 your real test account
      password: 'Anmol@1974',      // 👈 replace this
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(res, {
    'login worked': (r) => r.status === 200,
    'got token':    (r) => r.json('token') !== undefined,
  });

  sleep(2);
}