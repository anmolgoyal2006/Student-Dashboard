// instrument.js — MUST be required first, before any other module in the
// entry point (server.js), so Sentry can instrument everything that loads
// after it. See: https://docs.sentry.io/platforms/javascript/guides/express/

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const Sentry = require('@sentry/node');

if (!process.env.SENTRY_DSN) {
  console.warn('[Sentry] SENTRY_DSN is not set. Error tracking is disabled.');
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',

  // Send structured logs (Sentry.logger.*) to Sentry alongside errors.
  enableLogs: true,

  // This app handles JWTs (Authorization headers) and student PII (grades,
  // attendance, resumes, career data) in request bodies — don't forward
  // user identity or raw HTTP bodies to a third party by default. Flip
  // these to true / remove the override if you want fuller debugging
  // context and are comfortable with that data reaching Sentry.
  // https://docs.sentry.io/platforms/javascript/guides/node/configuration/options/#dataCollection
  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },
});

module.exports = Sentry;
