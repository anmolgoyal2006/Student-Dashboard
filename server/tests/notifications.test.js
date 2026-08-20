/**
 * notifications.test.js
 *
 * End-to-end pipeline tests for the entire notification system.
 * Uses mongodb-memory-server (wired in tests/setup.js) and supertest.
 * Firebase Admin SDK is mocked so no real FCM calls are made.
 *
 * Coverage:
 *  1.  Engine — sendNotification (INFO, WARNING, DANGER, DIGEST)
 *  2.  Engine — atomic dedup (same notification twice → only one DB doc)
 *  3.  Engine — concurrent dedup (parallel calls → exactly one insert)
 *  4.  Engine — sendAssignmentNotification (OVERDUE, URGENT, DUE_SOON, NEW_ASSIGNMENT)
 *  5.  Engine — assignment dedup per assignment ID (different assignments don't collide)
 *  6.  Engine — completed/submitted assignments are skipped
 *  7.  Engine — sendSessionNotification (SESSION_SOON, SESSION_START)
 *  8.  Engine — sendDigestNotification (DIGEST)
 *  9.  Engine — RISK_ALERT via sendNotification
 * 10.  Engine — no FCM token → saved to DB only, success:false reason:'No tokens'
 * 11.  Engine — invalid FCM token deleted from NotificationToken
 * 12.  API   — GET /api/notifications (auth required, returns last 6)
 * 13.  API   — POST /api/notifications/test (creates INFO in DB)
 * 14.  API   — PATCH /api/notifications/:id/read
 * 15.  API   — PATCH /api/notifications/read-all
 * 16.  API   — POST /api/notifications/test-push (deduped on second call)
 * 17.  API   — POST /api/user/save-token  (registers FCM token)
 * 18.  API   — DELETE /api/user/remove-token (single device logout)
 * 19.  API   — DELETE /api/user/remove-token (no body → wipes all tokens)
 * 20.  API   — POST /api/auth/logout-all   (wipes all tokens server-side)
 * 21.  Service — sendTodayNotifications dedup (attendance, ATTENDANCE_MARK)
 * 22.  Service — sendEndOfClassNotifications dedup
 * 23.  Notification auto-delete > 7 days on GET
 */

// ─── Firebase mock MUST be declared before any require of app / services ─────
// jest.mock hoists this to the top of the file at compile time.
const mockSendFn = jest.fn().mockResolvedValue('mock-message-id');
jest.mock('../config/firebaseAdmin', () => ({
  messaging: () => ({ send: mockSendFn }),
  apps: ['mocked'],
}));

const request   = require('supertest');
const mongoose  = require('mongoose');
const jwt       = require('jsonwebtoken');
const app       = require('../app');

// ─── Models ──────────────────────────────────────────────────────────────────
const User              = require('../models/User');
const Notification      = require('../models/Notification');
const NotificationToken = require('../models/NotificationToken');
const Subject           = require('../models/Subject');

// ─── Reset mock call count between tests ─────────────────────────────────────
beforeEach(() => {
  mockSendFn.mockClear();
  mockSendFn.mockResolvedValue('mock-message-id');
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a user + signed JWT matching the real auth stack. */
async function createUserAndToken(overrides = {}) {
  const bcrypt = require('bcryptjs');
  const user = await User.create({
    name        : overrides.name     || 'Test User',
    email       : overrides.email    || `test-${Date.now()}-${Math.random()}@example.com`,
    password    : await bcrypt.hash('password123', 1),
    role        : overrides.role     || 'student',
    tokenVersion: 0,
  });

  const token = jwt.sign(
    { id: user._id, email: user.email, name: user.name,
      role: user.role, tokenVersion: 0 },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  return { user, token };
}

/** Register a fake FCM token for a user in NotificationToken. */
async function registerToken(userId, fcmToken = 'fake-fcm-token') {
  return NotificationToken.findOneAndUpdate(
    { userId, token: fcmToken },
    { userId, token: fcmToken, platform: 'web', lastSeen: new Date() },
    { upsert: true, new: true }
  );
}

/**
 * Insert notifications directly without triggering the dedup index.
 * Tests that create multiple raw docs must use unique dedupKeys or omit
 * dedupKey entirely via collection.insertOne (bypasses Mongoose defaults).
 */
async function insertRawNotification(userId, overrides = {}) {
  return Notification.collection.insertOne({
    userId,
    title     : overrides.title     || 'Raw Notification',
    body      : overrides.body      || 'body',
    type      : overrides.type      || 'INFO',
    read      : overrides.read      ?? false,
    dedupKey  : overrides.dedupKey  ?? undefined,   // undefined → sparse index ignores it
    createdAt : overrides.createdAt ?? new Date(),
    updatedAt : overrides.updatedAt ?? new Date(),
  });
}

// =============================================================================
//  1–11  ENGINE UNIT TESTS (direct service calls)
// =============================================================================

describe('notificationEngine — sendNotification', () => {
  let userId;

  beforeEach(async () => {
    const { user } = await createUserAndToken();
    userId = user._id;
    await registerToken(userId);
  });

  // ── 1. Basic types saved to DB and FCM called ──────────────────────────────
  test.each([
    ['INFO',    'ℹ️ Info',    'This is info'],
    ['WARNING', '⚠️ Warning', 'This is a warning'],
    ['DANGER',  '🚨 Danger',  'This is danger'],
    ['DIGEST',  '📅 Digest',  'Your daily summary'],
  ])('sends %s notification — saves to DB and calls FCM once', async (type, title, body) => {
    const { sendNotification } = require('../services/notificationEngine');

    const result = await sendNotification(userId, title, body, { type });

    expect(result.success).toBe(true);
    expect(mockSendFn).toHaveBeenCalledTimes(1);

    const doc = await Notification.findOne({ userId, type });
    expect(doc).not.toBeNull();
    expect(doc.title).toBe(title);
    expect(doc.body).toBe(body);
    expect(doc.read).toBe(false);
    expect(doc.dedupKey).toBeTruthy();
  });

  // ── 2. Dedup — second call same day returns duplicate reason ───────────────
  it('deduplicates: second call for same notification returns duplicate reason', async () => {
    const { sendNotification } = require('../services/notificationEngine');

    const r1 = await sendNotification(userId, '🔔 Test', 'Body', { type: 'INFO' });
    const r2 = await sendNotification(userId, '🔔 Test', 'Body', { type: 'INFO' });

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(false);
    expect(r2.reason).toBe('Duplicate within 24h');

    const count = await Notification.countDocuments({ userId, title: '🔔 Test' });
    expect(count).toBe(1);

    expect(mockSendFn).toHaveBeenCalledTimes(1);
  });

  // ── 3. Concurrent dedup — parallel calls produce exactly one insert ────────
  it('concurrent dedup: parallel calls result in exactly one DB document', async () => {
    const { sendNotification } = require('../services/notificationEngine');

    const title = '🔔 Concurrent';
    const results = await Promise.all([
      sendNotification(userId, title, 'body', { type: 'INFO' }),
      sendNotification(userId, title, 'body', { type: 'INFO' }),
      sendNotification(userId, title, 'body', { type: 'INFO' }),
    ]);

    const successes  = results.filter(r => r.success);
    const duplicates = results.filter(r => r.reason === 'Duplicate within 24h');

    expect(successes).toHaveLength(1);
    expect(duplicates).toHaveLength(2);

    const count = await Notification.countDocuments({ userId, title });
    expect(count).toBe(1);
  });

  // ── 10. No token — rolls back the DB doc so it can fire once a token is registered
  it('no FCM token: rolls back DB notification, returns No tokens', async () => {
    const { user: tokenlessUser } = await createUserAndToken();
    const { sendNotification } = require('../services/notificationEngine');

    const result = await sendNotification(
      tokenlessUser._id, '🔔 No Token', 'body', { type: 'INFO' }
    );

    expect(result.success).toBe(false);
    expect(result.reason).toBe('No tokens');

    const doc = await Notification.findOne({ userId: tokenlessUser._id });
    expect(doc).toBeNull();
    expect(mockSendFn).not.toHaveBeenCalled();
  });

  // ── 11. Invalid token deleted from NotificationToken ──────────────────────
  it('invalid FCM token is removed from NotificationToken collection', async () => {
    const { user: u } = await createUserAndToken();
    await registerToken(u._id, 'invalid-token');

    // Make the send fail with an invalid-token error
    mockSendFn.mockRejectedValueOnce(
      Object.assign(new Error('invalid token'), {
        code: 'messaging/invalid-registration-token',
      })
    );

    const { sendNotification } = require('../services/notificationEngine');
    await sendNotification(u._id, '🔔 BadToken', 'body', { type: 'INFO' });

    // Token should have been deleted
    const remaining = await NotificationToken.countDocuments({ userId: u._id });
    expect(remaining).toBe(0);
  });
});

// =============================================================================
//  4–6  ASSIGNMENT NOTIFICATIONS
// =============================================================================

describe('notificationEngine — sendAssignmentNotification', () => {
  let userId;

  beforeEach(async () => {
    const { user } = await createUserAndToken();
    userId = user._id;
    await registerToken(userId);
  });

  const makeAssignment = (overrides = {}) => ({
    _id           : new mongoose.Types.ObjectId(),
    title         : 'Math HW',
    courseName    : 'Mathematics',
    estimatedHours: 2,
    status        : 'assigned',
    ...overrides,
  });

  test.each([
    ['OVERDUE',        -2,  'OVERDUE'],
    ['URGENT',          3,  'URGENT'],
    ['DUE_SOON <24h',  12,  'DUE_SOON'],
    ['DUE_SOON <72h',  48,  'DUE_SOON'],
    ['NEW_ASSIGNMENT <7d', 120, 'NEW_ASSIGNMENT'],
    ['NEW_ASSIGNMENT >7d', 200, 'NEW_ASSIGNMENT'],
  ])('%s → correct notification type', async (_label, hoursFromNow, expectedType) => {
    const { sendAssignmentNotification } = require('../services/notificationEngine');

    const dueDate    = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    const assignment = makeAssignment({ dueDate });

    const result = await sendAssignmentNotification(assignment, userId);
    expect(result.success).toBe(true);

    const doc = await Notification.findOne({ userId, type: expectedType });
    expect(doc).not.toBeNull();
  });

  // ── 5. Different assignments with same urgency don't collide ───────────────
  it('two different overdue assignments each produce their own notification', async () => {
    const { sendAssignmentNotification } = require('../services/notificationEngine');

    const past = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const a1   = makeAssignment({ dueDate: past, title: 'HW 1' });
    const a2   = makeAssignment({ _id: new mongoose.Types.ObjectId(), dueDate: past, title: 'HW 2' });

    const [r1, r2] = await Promise.all([
      sendAssignmentNotification(a1, userId),
      sendAssignmentNotification(a2, userId),
    ]);

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);

    const count = await Notification.countDocuments({ userId, type: 'OVERDUE' });
    expect(count).toBe(2);
    expect(mockSendFn).toHaveBeenCalledTimes(2);
  });

  // ── 6. Submitted/completed assignments skipped ─────────────────────────────
  test.each(['submitted', 'returned', 'completed'])(
    'assignment with status "%s" is skipped', async (status) => {
      const { sendAssignmentNotification } = require('../services/notificationEngine');

      const past   = new Date(Date.now() - 1 * 60 * 60 * 1000);
      const result = await sendAssignmentNotification(
        makeAssignment({ dueDate: past, status }), userId
      );

      expect(result.skipped).toBe(true);
      expect(mockSendFn).not.toHaveBeenCalled();

      const count = await Notification.countDocuments({ userId });
      expect(count).toBe(0);
    }
  );
});

// =============================================================================
//  7  SESSION NOTIFICATIONS
// =============================================================================

describe('notificationEngine — sendSessionNotification', () => {
  let userId;

  beforeEach(async () => {
    const { user } = await createUserAndToken();
    userId = user._id;
    await registerToken(userId);
  });

  it('minutesBefore=15 → SESSION_SOON saved and FCM called', async () => {
    const { sendSessionNotification } = require('../services/notificationEngine');
    const task = { _id: new mongoose.Types.ObjectId(), title: 'Data Structures' };

    const result = await sendSessionNotification(task, userId, 15);

    expect(result.success).toBe(true);
    expect(mockSendFn).toHaveBeenCalledTimes(1);

    const doc = await Notification.findOne({ userId, type: 'SESSION_SOON' });
    expect(doc).not.toBeNull();
    expect(doc.title).toBe('📖 Starting Soon');
    expect(doc.body).toContain('Data Structures');
  });

  it('minutesBefore=0 → SESSION_START saved', async () => {
    const { sendSessionNotification } = require('../services/notificationEngine');
    const task = { _id: new mongoose.Types.ObjectId(), title: 'Algorithms' };

    const result = await sendSessionNotification(task, userId, 0);

    expect(result.success).toBe(true);
    const doc = await Notification.findOne({ userId, type: 'SESSION_START' });
    expect(doc).not.toBeNull();
    expect(doc.title).toBe('🚀 Time to Study');
    expect(doc.body).toContain('Algorithms');
  });

  it('same session notified twice → second call is deduped', async () => {
    const { sendSessionNotification } = require('../services/notificationEngine');
    const task = { _id: new mongoose.Types.ObjectId(), title: 'OS Lab' };

    const r1 = await sendSessionNotification(task, userId, 15);
    const r2 = await sendSessionNotification(task, userId, 15);

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(false);
    expect(r2.reason).toBe('Duplicate within 24h');
    expect(mockSendFn).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
//  8  DIGEST NOTIFICATION
// =============================================================================

describe('notificationEngine — sendDigestNotification', () => {
  it('sends DIGEST and saves to DB', async () => {
    const { user } = await createUserAndToken();
    await registerToken(user._id);

    const { sendDigestNotification } = require('../services/notificationEngine');
    const result = await sendDigestNotification(
      user._id,
      '📅 StudentAI Daily Summary',
      'Pending: 3 | Due Tomorrow: 1'
    );

    expect(result.success).toBe(true);
    const doc = await Notification.findOne({ userId: user._id, type: 'DIGEST' });
    expect(doc).not.toBeNull();
    expect(doc.title).toBe('📅 StudentAI Daily Summary');
  });
});

// =============================================================================
//  9  RISK_ALERT
// =============================================================================

describe('notificationEngine — RISK_ALERT', () => {
  it('RISK_ALERT saved with correct type', async () => {
    const { user } = await createUserAndToken();
    await registerToken(user._id);

    const { sendNotification } = require('../services/notificationEngine');
    const assignmentId = new mongoose.Types.ObjectId().toString();

    const result = await sendNotification(
      user._id,
      '⚠️ Academic Risk: Mathematics',
      'Attendance 60% — below threshold.',
      { type: 'RISK_ALERT', assignmentId, subject: 'Mathematics' }
    );

    expect(result.success).toBe(true);
    const doc = await Notification.findOne({ userId: user._id, type: 'RISK_ALERT' });
    expect(doc).not.toBeNull();
    expect(doc.title).toContain('Mathematics');
  });
});

// =============================================================================
//  12–16  API ROUTE TESTS
// =============================================================================

describe('GET /api/notifications', () => {
  it('401 without auth token', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('returns empty list for new user', async () => {
    const { token } = await createUserAndToken();

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toEqual([]);
    expect(res.body.unreadCount).toBe(0);
  });

  it('returns at most 6 notifications', async () => {
    const { user, token } = await createUserAndToken();

    // Insert 8 raw docs — use unique dedupKeys so the sparse unique index is happy
    for (let i = 0; i < 8; i++) {
      await insertRawNotification(user._id, {
        title   : `Notification ${i}`,
        dedupKey: `INFO:test-entity-${i}:2099-01-01`,
      });
    }

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(6);
  });

  it('unreadCount reflects only unread docs', async () => {
    const { user, token } = await createUserAndToken();

    await insertRawNotification(user._id, { title: 'A', read: false, dedupKey: 'k1' });
    await insertRawNotification(user._id, { title: 'B', read: true,  dedupKey: 'k2' });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(1);
  });

  // ── 23. Auto-delete > 7 days ───────────────────────────────────────────────
  it('auto-deletes notifications older than 7 days', async () => {
    const { user, token } = await createUserAndToken();

    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await insertRawNotification(user._id, {
      title    : 'Old Notification',
      createdAt: eightDaysAgo,
      updatedAt: eightDaysAgo,
      dedupKey : 'old-key',
    });

    await insertRawNotification(user._id, { title: 'Fresh', dedupKey: 'fresh-key' });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(1);
    expect(res.body.notifications[0].title).toBe('Fresh');
  });
});

describe('POST /api/notifications/test', () => {
  it('creates a test INFO notification in DB', async () => {
    const { user, token } = await createUserAndToken();

    const res = await request(app)
      .post('/api/notifications/test')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.notification.title).toBe('🔔 Test Notification');

    const doc = await Notification.findOne({ userId: user._id });
    expect(doc).not.toBeNull();
  });
});

describe('POST /api/notifications/test-push', () => {
  it('sends push and returns success when token is registered', async () => {
    const { token } = await createUserAndToken();

    // Register via the API so the token is in NotificationToken
    await request(app)
      .post('/api/user/save-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'push-test-fcm-token' });

    const res = await request(app)
      .post('/api/notifications/test-push')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSendFn).toHaveBeenCalledTimes(1);
  });

  it('returns No tokens when no FCM token registered', async () => {
    const { token } = await createUserAndToken();

    const res = await request(app)
      .post('/api/notifications/test-push')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.reason).toBe('No tokens');
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  it('marks a single notification as read', async () => {
    const { user, token } = await createUserAndToken();
    const notif = await Notification.create({
      userId: user._id, title: 'Unread', body: 'b', type: 'INFO', read: false,
    });

    const res = await request(app)
      .patch(`/api/notifications/${notif._id}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.read).toBe(true);

    const updated = await Notification.findById(notif._id);
    expect(updated.read).toBe(true);
  });

  it('404 for notification belonging to another user', async () => {
    const { token: hackerToken } = await createUserAndToken();
    const { user: owner }        = await createUserAndToken();

    const notif = await Notification.create({
      userId: owner._id, title: 'Private', body: 'b', type: 'INFO',
    });

    const res = await request(app)
      .patch(`/api/notifications/${notif._id}/read`)
      .set('Authorization', `Bearer ${hackerToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/notifications/read-all', () => {
  it('marks all unread notifications as read', async () => {
    const { user, token } = await createUserAndToken();

    await insertRawNotification(user._id, { title: 'A', read: false, dedupKey: 'ra1' });
    await insertRawNotification(user._id, { title: 'B', read: false, dedupKey: 'ra2' });
    await insertRawNotification(user._id, { title: 'C', read: true,  dedupKey: 'ra3' });

    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const unread = await Notification.countDocuments({ userId: user._id, read: false });
    expect(unread).toBe(0);
  });
});

// =============================================================================
//  17–20  TOKEN MANAGEMENT API
// =============================================================================

describe('POST /api/user/save-token', () => {
  it('registers a new FCM token in NotificationToken', async () => {
    const { user, token } = await createUserAndToken();

    const res = await request(app)
      .post('/api/user/save-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'my-fcm-token-abc' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const doc = await NotificationToken.findOne({ userId: user._id, token: 'my-fcm-token-abc' });
    expect(doc).not.toBeNull();
  });

  it('upserts — duplicate save-token calls do not create duplicate rows', async () => {
    const { token } = await createUserAndToken();

    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/user/save-token')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'dup-fcm-token' });
    }

    const count = await NotificationToken.countDocuments({ token: 'dup-fcm-token' });
    expect(count).toBe(1);
  });

  it('400 when token field is missing', async () => {
    const { token } = await createUserAndToken();

    const res = await request(app)
      .post('/api/user/save-token')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/user/remove-token', () => {
  it('removes a specific FCM token (single-device logout)', async () => {
    const { user, token } = await createUserAndToken();
    await registerToken(user._id, 'device-a-token');
    await registerToken(user._id, 'device-b-token');

    const res = await request(app)
      .delete('/api/user/remove-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'device-a-token' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const remaining = await NotificationToken.find({ userId: user._id });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].token).toBe('device-b-token');
  });

  it('removes ALL tokens when no body provided (logout-all path)', async () => {
    const { user, token } = await createUserAndToken();
    await registerToken(user._id, 'token-x');
    await registerToken(user._id, 'token-y');

    const res = await request(app)
      .delete('/api/user/remove-token')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const remaining = await NotificationToken.countDocuments({ userId: user._id });
    expect(remaining).toBe(0);
  });
});

describe('POST /api/auth/logout-all', () => {
  it('wipes all FCM tokens and bumps tokenVersion so old JWT is rejected', async () => {
    const { user, token } = await createUserAndToken();
    await registerToken(user._id, 'tok-1');
    await registerToken(user._id, 'tok-2');

    const res = await request(app)
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // All FCM tokens wiped
    const remaining = await NotificationToken.countDocuments({ userId: user._id });
    expect(remaining).toBe(0);

    // tokenVersion bumped
    const updated = await User.findById(user._id).select('tokenVersion');
    expect(updated.tokenVersion).toBe(1);

    // Old JWT now returns 401
    const stale = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(stale.status).toBe(401);
  });
});

// =============================================================================
//  21–22  ATTENDANCE SERVICE (notificationService.js)
// =============================================================================

describe('notificationService — sendTodayNotifications', () => {
  it('sends ATTENDANCE_MARK and deduplicates on second call', async () => {
    const { user } = await createUserAndToken();
    await registerToken(user._id, 'svc-today-token');

    const DAYS      = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const istDate   = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const todayShort = DAYS[istDate.getUTCDay()];

    // Skip on weekends — service returns early with no sends
    if (todayShort === 'Sat' || todayShort === 'Sun') {
      console.log('Skipping sendTodayNotifications test — weekend');
      return;
    }

    await Subject.create({
      userId  : user._id,
      name    : 'Test Subject',
      schedule: [{ day: todayShort, startTime: '09:00', endTime: '10:00' }],
    });

    const { sendTodayNotifications } = require('../services/notificationService');

    await sendTodayNotifications();  // first call — should send
    await sendTodayNotifications();  // second call — should dedup

    const count = await Notification.countDocuments({ userId: user._id, type: 'ATTENDANCE_MARK' });
    expect(count).toBe(1);
    expect(mockSendFn).toHaveBeenCalledTimes(1);
  });
});

describe('notificationService — sendEndOfClassNotifications', () => {
  it('sends end-of-class ATTENDANCE_MARK and deduplicates on second call', async () => {
    const { user } = await createUserAndToken();
    await registerToken(user._id, 'svc-eoc-token');

    const DAYS       = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const istDate    = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const todayShort = DAYS[istDate.getUTCDay()];

    if (todayShort === 'Sat' || todayShort === 'Sun') {
      console.log('Skipping sendEndOfClassNotifications test — weekend');
      return;
    }

    const hh          = String(istDate.getUTCHours()).padStart(2, '0');
    const mm          = String(istDate.getUTCMinutes()).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;

    await Subject.create({
      userId  : user._id,
      name    : 'Phys Lab',
      schedule: [{ day: todayShort, startTime: '08:00', endTime: currentTime }],
    });

    const { sendEndOfClassNotifications } = require('../services/notificationService');

    await sendEndOfClassNotifications();  // should send
    await sendEndOfClassNotifications();  // should dedup

    const count = await Notification.countDocuments({ userId: user._id, type: 'ATTENDANCE_MARK' });
    expect(count).toBe(1);
    expect(mockSendFn).toHaveBeenCalledTimes(1);
  });
});
