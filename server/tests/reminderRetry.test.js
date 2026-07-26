const mongoose = require('mongoose');
const Reminder = require('../models/Reminder');
const Notification = require('../models/Notification');
const { sendDueReminders } = require('../services/reminderService');

// A reminder that always throws must not be retried by the hourly cron forever.
describe('reminder send-attempt cap', () => {
  const base = () => ({
    userId: new mongoose.Types.ObjectId(),
    eventId: new mongoose.Types.ObjectId(),
    eventTitle: 'Hackathon 2026',
    reminderType: '1_DAY',
    deadline: new Date(Date.now() + 86400000),
    sendAt: new Date(Date.now() - 60000), // already due
    sent: false,
  });

  const breakSending = () =>
    jest.spyOn(Notification, 'create').mockRejectedValue(new Error('db exploded'));

  afterEach(() => jest.restoreAllMocks());

  test('a failing reminder records the attempt and the error', async () => {
    breakSending();
    const r = await Reminder.create(base());

    await sendDueReminders();

    const after = await Reminder.findById(r._id);
    expect(after.attempts).toBe(1);
    expect(after.lastError).toBe('db exploded');
    expect(after.sent).toBe(false);
  });

  test('attempts accumulate across runs and stop being picked up at the cap', async () => {
    breakSending();
    const r = await Reminder.create(base());

    await sendDueReminders();
    await sendDueReminders();
    await sendDueReminders();
    expect((await Reminder.findById(r._id)).attempts).toBe(3);

    // Fourth run must skip it entirely — the counter stays at 3.
    await sendDueReminders();
    expect((await Reminder.findById(r._id)).attempts).toBe(3);
  });

  test('a legacy reminder with no attempts field is still picked up', async () => {
    // Rows written before `attempts` existed have no such field, and $lt does
    // not match a missing field. This is the regression that guards that.
    const { insertedId } = await Reminder.collection.insertOne(base());
    expect(await Reminder.collection.findOne({ _id: insertedId })).not.toHaveProperty('attempts');

    breakSending();
    await sendDueReminders();

    expect((await Reminder.findById(insertedId)).attempts).toBe(1);
  });

  test('a healthy reminder is marked sent and not retried', async () => {
    const r = await Reminder.create(base());

    await sendDueReminders();

    const after = await Reminder.findById(r._id);
    expect(after.sent).toBe(true);
    expect(after.attempts).toBe(0);
  });

  test('one broken reminder does not stop the others in the batch', async () => {
    const good1 = await Reminder.create(base());
    const bad = await Reminder.create(base());
    const good2 = await Reminder.create(base());

    const real = Notification.create.bind(Notification);
    jest.spyOn(Notification, 'create').mockImplementation((doc) =>
      String(doc.userId) === String(bad.userId)
        ? Promise.reject(new Error('just this one'))
        : real(doc)
    );

    await sendDueReminders();

    expect((await Reminder.findById(good1._id)).sent).toBe(true);
    expect((await Reminder.findById(good2._id)).sent).toBe(true);
    expect((await Reminder.findById(bad._id)).sent).toBe(false);
  });
});
