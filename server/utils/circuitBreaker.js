// Lightweight in-process circuit breaker + timeout wrapper.
//
// Why not a library (e.g. opossum): the surface area here is tiny (Gemini and
// LeetCode are the only user-facing external deps that can cascade), and the
// real risk is an upstream brownout where slow/failing calls pile up on the
// request path and exhaust the connection/socket pool while everyone waits.
// This ~1-file helper gives us the two things that actually stop that:
//   1. a hard per-call timeout so no single call hangs indefinitely, and
//   2. a breaker that trips after repeated failures and fast-fails for a
//      cooldown, so a degraded dependency stops dragging down the whole app.
//
// States: CLOSED (normal) -> OPEN (fast-fail) after `failureThreshold`
// consecutive failures -> HALF_OPEN after `cooldownMs` (one trial call
// allowed); success closes it, failure re-opens it.

class CircuitOpenError extends Error {
  constructor(name) {
    super(`Circuit "${name}" is open — dependency is unavailable, failing fast`);
    this.name = 'CircuitOpenError';
    this.code = 'CIRCUIT_OPEN';
    this.circuit = name;
  }
}

class TimeoutError extends Error {
  constructor(name, ms) {
    super(`"${name}" timed out after ${ms}ms`);
    this.name = 'TimeoutError';
    this.code = 'ETIMEDOUT';
    this.circuit = name;
  }
}

function withTimeout(promise, ms, name) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(name, ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

class CircuitBreaker {
  constructor(name, {
    failureThreshold = 5,   // consecutive failures before opening
    cooldownMs = 30000,     // how long to stay open before a trial call
    timeoutMs = 30000,      // per-call hard timeout
  } = {}) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.timeoutMs = timeoutMs;

    this.state = 'CLOSED';
    this.failures = 0;
    this.openedAt = 0;
  }

  // now is injectable so this stays testable without a real clock.
  _now() { return Date.now(); }

  _onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  _onFailure() {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = this._now();
    }
  }

  // Wrap an async thunk. Applies the breaker gate + a per-call timeout.
  async exec(fn, { timeoutMs = this.timeoutMs } = {}) {
    if (this.state === 'OPEN') {
      if (this._now() - this.openedAt >= this.cooldownMs) {
        this.state = 'HALF_OPEN'; // allow a single trial call through
      } else {
        throw new CircuitOpenError(this.name);
      }
    }

    try {
      const result = await withTimeout(Promise.resolve().then(fn), timeoutMs, this.name);
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }
}

// Registry so callers share one breaker per named dependency across requests.
const registry = new Map();

function getBreaker(name, opts) {
  if (!registry.has(name)) registry.set(name, new CircuitBreaker(name, opts));
  return registry.get(name);
}

module.exports = { CircuitBreaker, getBreaker, withTimeout, CircuitOpenError, TimeoutError };
