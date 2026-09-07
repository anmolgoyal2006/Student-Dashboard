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

// Wraps a promise in a hard timeout so a hung job cannot block the event loop
// indefinitely. Rejects after `ms` milliseconds with a descriptive error.
function withTimeout(name, promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[CRON] ${name} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

// safeJob + cross-process DB lock: only one server process may run the job at
// a time, even while deploys/restarts briefly keep two processes alive.
//
// jobTimeoutMs (optional): hard kill the job if it runs longer than this.
// Default 50 s — safely under the 60 s cron interval so a slow run can never
// bleed into the next tick and cause "missed execution" cascades.
function lockedJob(name, fn, ttlSeconds, jobTimeoutMs = 50_000) {
  return (...args) => {
    // Defer the entire job body off the current event-loop tick with
    // setImmediate so that node-cron's internal scheduler (and any pending
    // HTTP request handlers) can run first. This eliminates the "missed
    // execution" warnings caused by a heavy job blocking the event loop.
    setImmediate(async () => {
      let locked = false;
      try {
        locked = await acquireLock(name, ttlSeconds);
        if (!locked) {
          console.log(`[CRON] ${name} skipped — lock held by another process`);
          return;
        }
        await withTimeout(name, fn(...args), jobTimeoutMs);
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
    });
  };
}

module.exports = { safeJob, lockedJob };
