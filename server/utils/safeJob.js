// node-cron does not await the callback it is given, so any rejection from an
// async job becomes an unhandled rejection — which, under Node's default
// --unhandled-rejections=throw, kills the entire server over one failed job.
// Wrap every scheduled callback so a failure is contained to that run.
const Sentry = require('../instrument');

function safeJob(name, fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error(`[CRON] ${name} failed:`, err.message);
      Sentry.captureException(err, { tags: { job: name } });
    }
  };
}

module.exports = { safeJob };
