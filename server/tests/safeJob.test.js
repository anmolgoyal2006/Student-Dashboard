const { safeJob } = require('../utils/safeJob');

// node-cron ignores the promise returned by an async callback, so an
// unwrapped rejection escapes to the process and kills the server.
describe('safeJob', () => {
  test('swallows a rejection instead of letting it escape', async () => {
    const boom = safeJob('boom', async () => {
      throw new Error('collector exploded');
    });

    await expect(boom()).resolves.toBeUndefined();
  });

  test('swallows a synchronous throw', async () => {
    const boom = safeJob('sync-boom', () => {
      throw new Error('threw immediately');
    });

    await expect(boom()).resolves.toBeUndefined();
  });

  test('passes through arguments and still runs the job', async () => {
    const seen = [];
    const job = safeJob('collect', async (a, b) => { seen.push(a, b); });

    await job(1, 2);
    expect(seen).toEqual([1, 2]);
  });

  test('a failing run does not prevent the next run', async () => {
    let calls = 0;
    const flaky = safeJob('flaky', async () => {
      calls++;
      if (calls === 1) throw new Error('first run fails');
    });

    await flaky();
    await flaky();
    expect(calls).toBe(2);
  });
});
