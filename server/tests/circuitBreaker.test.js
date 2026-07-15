const { CircuitBreaker, CircuitOpenError, TimeoutError } = require('../utils/circuitBreaker');

// Deterministic clock so state transitions are testable without real time.
function breakerWithClock(opts) {
  const cb = new CircuitBreaker('test', opts);
  let clock = 0;
  cb._now = () => clock;
  return { cb, tick: (ms) => { clock += ms; } };
}

const ok = () => Promise.resolve('ok');
const fail = () => Promise.reject(new Error('boom'));

describe('CircuitBreaker', () => {
  test('passes through results while closed', async () => {
    const { cb } = breakerWithClock({ failureThreshold: 3 });
    await expect(cb.exec(ok)).resolves.toBe('ok');
    expect(cb.state).toBe('CLOSED');
  });

  test('opens after failureThreshold consecutive failures', async () => {
    const { cb } = breakerWithClock({ failureThreshold: 3 });
    for (let i = 0; i < 3; i++) {
      await expect(cb.exec(fail)).rejects.toThrow('boom');
    }
    expect(cb.state).toBe('OPEN');
  });

  test('fast-fails with CircuitOpenError while open (does not call fn)', async () => {
    const { cb } = breakerWithClock({ failureThreshold: 1, cooldownMs: 1000 });
    await expect(cb.exec(fail)).rejects.toThrow('boom'); // trips it
    let called = false;
    await expect(cb.exec(() => { called = true; return ok(); }))
      .rejects.toBeInstanceOf(CircuitOpenError);
    expect(called).toBe(false);
  });

  test('half-opens after cooldown and closes on a successful trial', async () => {
    const { cb, tick } = breakerWithClock({ failureThreshold: 1, cooldownMs: 1000 });
    await expect(cb.exec(fail)).rejects.toThrow('boom');
    expect(cb.state).toBe('OPEN');
    tick(1000); // cooldown elapsed
    await expect(cb.exec(ok)).resolves.toBe('ok');
    expect(cb.state).toBe('CLOSED');
    expect(cb.failures).toBe(0);
  });

  test('a successful call resets the consecutive-failure count', async () => {
    const { cb } = breakerWithClock({ failureThreshold: 3 });
    await expect(cb.exec(fail)).rejects.toThrow();
    await expect(cb.exec(fail)).rejects.toThrow();
    await expect(cb.exec(ok)).resolves.toBe('ok'); // resets
    expect(cb.failures).toBe(0);
    await expect(cb.exec(fail)).rejects.toThrow();
    expect(cb.state).toBe('CLOSED'); // only 1 failure since reset
  });

  test('enforces a per-call timeout', async () => {
    const { cb } = breakerWithClock({ failureThreshold: 5, timeoutMs: 20 });
    const slow = () => new Promise((res) => setTimeout(() => res('late'), 100));
    await expect(cb.exec(slow)).rejects.toBeInstanceOf(TimeoutError);
  });
});
