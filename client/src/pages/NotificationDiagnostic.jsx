/**
 * NotificationDiagnostic.jsx
 *
 * In-app diagnostic page for push notification issues — primarily targeted at
 * Android Chrome users where OEM battery optimisation silently blocks pushes,
 * but also useful on desktop for general troubleshooting.
 *
 * Features:
 *  - Live Notification.permission state
 *  - Whether a valid FCM token is currently registered on this device
 *  - "Send test notification" button → POST /api/notifications/test-push
 *  - If the test fails / times out: links to battery-optimisation fix guides
 *    for Samsung (One UI), Xiaomi (MIUI), Oppo (ColorOS), and Vivo (FuntouchOS)
 */
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getFCMToken } from '../firebase';
import {
  Bell, BellOff, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, Send, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';
import './NotificationDiagnostic.css';

const API = process.env.REACT_APP_API_URL;
const TEST_TIMEOUT_MS = 12000; // 12 s — FCM usually delivers in <5 s

// ── Battery-optimisation guides per OEM ─────────────────────────────────────
const OEM_GUIDES = [
  {
    brand: 'Samsung (One UI)',
    steps: [
      'Open Settings → Apps → Chrome',
      'Tap Battery → select "Unrestricted"',
      'Also check Settings → Battery → Background usage limits → make sure Chrome is not listed',
    ],
    link: 'https://dontkillmyapp.com/samsung',
  },
  {
    brand: 'Xiaomi / MIUI',
    steps: [
      'Open Settings → Apps → Manage apps → Chrome',
      'Tap Battery saver → select "No restrictions"',
      'Also go to Settings → Battery & performance → App battery saver → Chrome → No restrictions',
    ],
    link: 'https://dontkillmyapp.com/xiaomi',
  },
  {
    brand: 'Oppo / ColorOS',
    steps: [
      'Open Settings → Battery → Battery optimisation',
      'Find Chrome → tap "Don\'t optimise"',
      'Also check Settings → Apps → App management → Chrome → Battery → Allow background activity',
    ],
    link: 'https://dontkillmyapp.com/oppo',
  },
  {
    brand: 'Vivo / FuntouchOS',
    steps: [
      'Open Settings → Battery → Background power consumption',
      'Find Chrome → set to "Infinite"',
      'Also open iManager → app management → Chrome → allow background running',
    ],
    link: 'https://dontkillmyapp.com/vivo',
  },
  {
    brand: 'Huawei (EMUI)',
    steps: [
      'Open Settings → Apps & notifications → Apps → Chrome',
      'Tap Battery → select "No restrictions"',
      'Also check Settings → Battery → Launch → Chrome → set to "Manage manually" and enable all toggles',
    ],
    link: 'https://dontkillmyapp.com/huawei',
  },
  {
    brand: 'OnePlus / OxygenOS',
    steps: [
      'Open Settings → Apps → Chrome → Battery optimization',
      'Select "Don\'t optimize"',
    ],
    link: 'https://dontkillmyapp.com/oneplus',
  },
];

// ── Status badge helper ──────────────────────────────────────────────────────
function StatusBadge({ state }) {
  const map = {
    granted:  { icon: CheckCircle2,  label: 'Granted',       cls: 'badge--success'  },
    denied:   { icon: XCircle,       label: 'Denied',        cls: 'badge--danger'   },
    default:  { icon: AlertTriangle, label: 'Not asked yet', cls: 'badge--warning'  },
    unknown:  { icon: AlertTriangle, label: 'Unknown',       cls: 'badge--warning'  },
  };
  const { icon: Icon, label, cls } = map[state] || map.unknown;
  return (
    <span className={`diag-badge ${cls}`}>
      <Icon size={13} />
      {label}
    </span>
  );
}

// ── Collapsible OEM guide card ───────────────────────────────────────────────
function OEMGuide({ guide }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="diag-oem-card">
      <button
        className="diag-oem-card__header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        type="button"
      >
        <span>{guide.brand}</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="diag-oem-card__body">
          <ol className="diag-oem-card__steps">
            {guide.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          <a
            href={guide.link}
            target="_blank"
            rel="noopener noreferrer"
            className="diag-oem-card__link"
          >
            Full guide on DontKillMyApp
            <ExternalLink size={12} style={{ marginLeft: 4 }} />
          </a>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function NotificationDiagnostic() {
  const [permission, setPermission]     = useState('unknown');
  const [fcmToken, setFcmToken]         = useState(null);   // null = not loaded yet
  const [tokenLoading, setTokenLoading] = useState(false);
  const [testState, setTestState]       = useState('idle'); // idle | sending | success | failed | timeout
  const [testDetail, setTestDetail]     = useState('');
  const [showOEM, setShowOEM]           = useState(false);

  // ── Read current permission on mount and whenever the user changes it ───
  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }
    // navigator.permissions lets us watch for changes without polling
    navigator.permissions?.query({ name: 'notifications' }).then((status) => {
      const update = () => setPermission(status.state === 'granted' ? 'granted'
                                        : status.state === 'denied'  ? 'denied'
                                        : 'default');
      update();
      status.addEventListener('change', update);
      return () => status.removeEventListener('change', update);
    }).catch(() => {});
  }, []);

  // ── Fetch the current FCM token for this device ─────────────────────────
  const refreshToken = useCallback(async () => {
    setTokenLoading(true);
    try {
      const t = await getFCMToken();
      setFcmToken(t || null);
    } catch {
      setFcmToken(null);
    } finally {
      setTokenLoading(false);
    }
  }, []);

  useEffect(() => {
    if (permission === 'granted') refreshToken();
    else setFcmToken(null);
  }, [permission, refreshToken]);

  // ── Request permission if not yet granted ───────────────────────────────
  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  // ── Send test push ───────────────────────────────────────────────────────
  const sendTestPush = async () => {
    setTestState('sending');
    setTestDetail('');
    setShowOEM(false);

    const jwt = localStorage.getItem('token');
    if (!jwt) {
      setTestState('failed');
      setTestDetail('Not logged in — no JWT found in localStorage.');
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      setTestState('timeout');
      setTestDetail(
        'The server sent the push but no OS notification appeared within 12 seconds. ' +
        'This is almost always caused by OEM battery optimisation blocking Chrome in the background.'
      );
      setShowOEM(true);
    }, TEST_TIMEOUT_MS);

    try {
      const { data } = await axios.post(
        `${API}/notifications/test-push`,
        {},
        {
          headers: { Authorization: `Bearer ${jwt}` },
          signal: controller.signal,
        }
      );
      clearTimeout(timer);

      if (data.success) {
        setTestState('success');
        setTestDetail(
          `Push delivered to ${data.results?.length ?? 1} token(s). ` +
          'If the OS notification did not appear, check that Chrome notifications are not muted ' +
          'in your device Settings, or see the battery optimisation guide below.'
        );
      } else {
        setTestState('failed');
        setTestDetail(data.message || `Reason: ${data.reason || 'unknown'}`);
        setShowOEM(true);
      }
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'CanceledError' || err.name === 'AbortError') return; // handled by timer
      setTestState('failed');
      setTestDetail(err?.response?.data?.message || err.message || 'Request failed.');
      setShowOEM(true);
    }
  };

  // ── Derived helpers ──────────────────────────────────────────────────────
  const tokenDisplay = tokenLoading
    ? 'Loading…'
    : fcmToken
      ? `…${fcmToken.slice(-20)}`
      : permission !== 'granted'
        ? 'N/A — notifications not granted'
        : 'None registered on this device';

  const tokenRegistered = !tokenLoading && !!fcmToken;

  return (
    <div className="diag-page">
      <div className="diag-header">
        <Bell size={22} className="diag-header__icon" />
        <div>
          <h1 className="diag-header__title">Notification Diagnostics</h1>
          <p className="diag-header__sub">
            Troubleshoot push notification delivery on this device
          </p>
        </div>
      </div>

      {/* ── Status cards ─────────────────────────────────────────────── */}
      <section className="diag-section">
        <h2 className="diag-section__title">Device Status</h2>

        <div className="diag-card">
          <div className="diag-card__row">
            <span className="diag-card__label">
              <BellOff size={15} style={{ marginRight: 6 }} />
              Notification permission
            </span>
            <StatusBadge state={permission} />
          </div>

          {permission !== 'granted' && (
            <div className="diag-card__action">
              {permission === 'denied' ? (
                <p className="diag-hint diag-hint--danger">
                  Permission is blocked. Open your browser site settings for this
                  page and set Notifications to "Allow", then reload.
                </p>
              ) : (
                <button className="diag-btn" onClick={requestPermission} type="button">
                  <Bell size={15} /> Enable notifications
                </button>
              )}
            </div>
          )}
        </div>

        <div className="diag-card">
          <div className="diag-card__row">
            <span className="diag-card__label">
              <CheckCircle2 size={15} style={{ marginRight: 6 }} />
              FCM token registered
            </span>
            <span className={`diag-badge ${tokenRegistered ? 'badge--success' : 'badge--warning'}`}>
              {tokenRegistered ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
              {tokenRegistered ? 'Yes' : 'No'}
            </span>
          </div>

          <div className="diag-card__row diag-card__row--sub">
            <span className="diag-card__label diag-card__label--muted">Token (last 20 chars)</span>
            <code className="diag-token">{tokenDisplay}</code>
          </div>

          <div className="diag-card__action">
            <button
              className="diag-btn diag-btn--secondary"
              onClick={refreshToken}
              disabled={tokenLoading}
              type="button"
            >
              <RefreshCw size={14} className={tokenLoading ? 'spin' : ''} />
              {tokenLoading ? 'Refreshing…' : 'Refresh token'}
            </button>
          </div>
        </div>
      </section>

      {/* ── Test push ────────────────────────────────────────────────── */}
      <section className="diag-section">
        <h2 className="diag-section__title">Test Push Notification</h2>
        <p className="diag-section__desc">
          Sends a real FCM push from the server to this device. Minimise this
          tab or move the app to the background first — foreground pushes appear
          as an in-app toast, not an OS notification.
        </p>

        <div className="diag-card">
          <button
            className={`diag-btn diag-btn--primary${testState === 'sending' ? ' diag-btn--loading' : ''}`}
            onClick={sendTestPush}
            disabled={testState === 'sending' || permission !== 'granted'}
            type="button"
          >
            {testState === 'sending'
              ? <><RefreshCw size={15} className="spin" /> Sending…</>
              : <><Send size={15} /> Send test notification</>
            }
          </button>

          {permission !== 'granted' && (
            <p className="diag-hint">Enable notifications above before testing.</p>
          )}

          {testState === 'success' && (
            <div className="diag-result diag-result--success">
              <CheckCircle2 size={16} />
              <span>Push sent successfully. {testDetail}</span>
            </div>
          )}
          {(testState === 'failed' || testState === 'timeout') && (
            <div className="diag-result diag-result--danger">
              <XCircle size={16} />
              <span>
                {testState === 'timeout' ? 'Timed out — ' : 'Failed — '}
                {testDetail}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ── Battery optimisation help ─────────────────────────────── */}
      {showOEM && (
        <section className="diag-section">
          <h2 className="diag-section__title">
            <AlertTriangle size={16} style={{ marginRight: 8, color: 'var(--color-warning)' }} />
            Battery Optimisation Fix
          </h2>
          <p className="diag-section__desc">
            Android OEMs (Samsung, Xiaomi, Oppo, Vivo, Huawei, OnePlus) restrict
            background apps by default to save battery. This silently blocks Chrome
            from receiving push notifications when the screen is off or Chrome is in
            the background. Find your device brand below and follow the steps.
          </p>
          <div className="diag-oem-list">
            {OEM_GUIDES.map((g) => <OEMGuide key={g.brand} guide={g} />)}
          </div>
          <a
            href="https://dontkillmyapp.com"
            target="_blank"
            rel="noopener noreferrer"
            className="diag-oem-all-link"
          >
            Full guide for all Android OEMs on DontKillMyApp.com
            <ExternalLink size={13} style={{ marginLeft: 5 }} />
          </a>
        </section>
      )}
    </div>
  );
}
