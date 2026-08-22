// node-cron does not await the callback it is given, so any rejection from an
// async job becomes an unhandled rejection — which, under Node's default
// --unhandled-rejections=throw, kills the entire server over one failed job.
// Wrap every scheduled callback so a failure is contained to that run.
const Sentry = require('../instrument');
const { acquireLock, releaseLock } = require('./cronLock');

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

// safeJob + cross-process DB lock: only one server process may run the job at
// a time, even while deploys/restarts briefly keep two processes alive.
function lockedJob(name, fn, ttlSeconds) {
  return async (...args) => {
    let locked = false;
    try {
      locked = await acquireLock(name, ttlSeconds);
      if (!locked) {
        console.log(`[CRON] ${name} skipped — lock held by another process`);
        return;
      }
      await fn(...args);
    } catch (err) {
      console.error(`[CRON] ${name} failed:`, err.message);
      Sentry.captureException(err, { tags: { job: name } });
    } finally {
      if (locked) {
        try {
          await releaseLock(name);
        } catch (_) {}
      }
    }
  };
}

module.exports = { safeJob, lockedJob };
