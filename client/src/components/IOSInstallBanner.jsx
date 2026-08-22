/**
 * IOSInstallBanner.jsx
 *
 * Shown only when ALL of these are true:
 *   1. The user is on an iOS device (iPhone / iPad / iPod)
 *   2. The browser is Safari (or a Safari-based in-app browser)
 *   3. The app is NOT already running as an installed PWA (standalone mode)
 *
 * Apple only allows Web Push in an installed PWA on iOS 16.4+. There is no
 * API workaround — the only fix is prompting the user to install the app.
 *
 * The banner is dismissible per-session (stored in sessionStorage so it
 * re-appears on the next visit, giving the user another chance to install).
 */
import { useState, useEffect } from 'react';
import { X, Share, Plus } from 'lucide-react';
import './IOSInstallBanner.css';

// ── Detection helpers ──────────────────────────────────────────────────────

function isIOS() {
  // navigator.platform is deprecated but still the most reliable cross-iOS
  // signal; the UA fallback catches iPads on iOS 13+ (desktop UA mode).
  return (
    /iphone|ipad|ipod/i.test(navigator.platform) ||
    (/macintosh/i.test(navigator.platform) && navigator.maxTouchPoints > 1)
  );
}

function isInStandaloneMode() {
  // window.navigator.standalone is set by Apple on installed PWAs
  if (window.navigator.standalone === true) return true;
  // Standard W3C display-mode media query (also works on iOS 16.4+)
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  return false;
}

function shouldShowBanner() {
  if (!isIOS()) return false;
  if (isInStandaloneMode()) return false;
  // Don't show if the user already dismissed it this session
  if (sessionStorage.getItem('ios-install-banner-dismissed') === '1') return false;
  return true;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function IOSInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Run after mount so SSR / test environments don't crash on missing APIs
    setVisible(shouldShowBanner());
  }, []);

  const dismiss = () => {
    sessionStorage.setItem('ios-install-banner-dismissed', '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="ios-banner" role="banner" aria-live="polite">
      <div className="ios-banner__icon" aria-hidden="true">
        {/* App icon — matches the PWA manifest icon */}
        <img src="/logo192.png" alt="" width={40} height={40} />
      </div>

      <div className="ios-banner__body">
        <p className="ios-banner__title">Install for notifications</p>
        <p className="ios-banner__text">
          To receive attendance and assignment notifications, add this app to
          your Home Screen:
        </p>
        <ol className="ios-banner__steps">
          <li>
            Tap the{' '}
            <Share size={14} className="ios-banner__inline-icon" aria-label="Share" />
            {' '}button in the Safari toolbar
          </li>
          <li>
            Scroll down and tap{' '}
            <strong>
              <Plus size={12} className="ios-banner__inline-icon" aria-hidden="true" />
              {' '}Add to Home Screen
            </strong>
          </li>
          <li>Tap <strong>Add</strong> in the top-right corner</li>
          <li>Open the app from your Home Screen</li>
        </ol>
        <p className="ios-banner__note">
          Requires iOS 16.4+ — notifications are a Safari/Apple limitation and
          cannot be enabled in a browser tab on iOS.
        </p>
      </div>

      <button
        className="ios-banner__close"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        type="button"
      >
        <X size={18} />
      </button>
    </div>
  );
}
