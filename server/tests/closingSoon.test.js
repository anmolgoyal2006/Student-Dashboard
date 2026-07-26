const { TTLCache } = require('../utils/ttlCache');
const Event = require('../models/Event');
const { getClosingSoonEvents, listingCache } = require('../services/eventService');

// /api/opportunities/closing-soon returned 500 "Maximum call stack size
// exceeded" for every user with a state set on their profile: the query was
// built as `query.$and = [query, ...]`, making the object reference itself.
describe('getClosingSoonEvents with a user state', () => {
  beforeEach(async () => {
    // Results are cached in-process; setup.js only clears collections.
    listingCache.clear();

    const soon = new Date();
    soon.setDate(soon.getDate() + 3);

    const base = {
      description: 'Test event',
      registrationUrl: 'https://example.com/e',
      category: 'hackathon',
      source: 'unstop',
    };

    await Event.create([
      {
        ...base,
        title: 'Punjab Hackathon',
        state: 'Punjab',
        registrationDeadline: soon,
        sourceEventId: 'evt-punjab',
      },
      {
        ...base,
        title: 'Remote Open Contest',
        state: '',
        location: '',
        registrationDeadline: soon,
        sourceEventId: 'evt-remote',
      },
      {
        ...base,
        title: 'Kerala Meetup',
        state: 'Kerala',
        registrationDeadline: soon,
        sourceEventId: 'evt-kerala',
      },
    ]);
  });

  test('does not throw a circular-structure error', async () => {
    await expect(getClosingSoonEvents(7, 'Punjab')).resolves.toBeDefined();
  });

  test('the built query is serializable', async () => {
    const events = await getClosingSoonEvents(7, 'Punjab');
    expect(() => JSON.stringify(events)).not.toThrow();
  });

  test('returns state matches plus location-agnostic events', async () => {
    const titles = (await getClosingSoonEvents(7, 'Punjab')).map((e) => e.title);
    expect(titles).toContain('Punjab Hackathon');
    expect(titles).toContain('Remote Open Contest');
    expect(titles).not.toContain('Kerala Meetup');
  });

  test('still honours the deadline window', async () => {
    const far = new Date();
    far.setDate(far.getDate() + 60);
    await Event.create({
      title: 'Far Future Punjab Event',
      description: 'Test event',
      registrationUrl: 'https://example.com/e',
      category: 'hackathon',
      source: 'unstop',
      state: 'Punjab',
      registrationDeadline: far,
      sourceEventId: 'evt-far',
    });

    const titles = (await getClosingSoonEvents(7, 'Punjab')).map((e) => e.title);
    expect(titles).not.toContain('Far Future Punjab Event');
  });

  test('with no state set, returns everything in the window', async () => {
    const events = await getClosingSoonEvents(7, '');
    expect(events.length).toBe(3);
  });
});
