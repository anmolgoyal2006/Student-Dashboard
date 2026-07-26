
const Reminder = require('../models/Reminder');
const Notification = require('../models/Notification');
const NotificationToken = require('../models/NotificationToken');
const admin = require('../config/firebaseAdmin');

const MAX_SEND_ATTEMPTS = 3;

/**
 * Schedule reminders for an event when a user saves it
 */
async function scheduleReminders(userId, event) {
  const deadline = new Date(event.registrationDeadline);
  
  // If deadline is in past, don't schedule
  if (deadline < new Date()) {
    console.log('Deadline already passed, skipping reminders');
    return;
  }

  const reminderTypes = [
    { type: '7_DAYS', days: 7 },
    { type: '3_DAYS', days: 3 },
    { type: '1_DAY', days: 1 },
    { type: '6_HOURS', hours: 6 }
  ];

  for (const reminder of reminderTypes) {
    let sendAt = new Date(deadline);
    
    if (reminder.days) {
      sendAt.setDate(sendAt.getDate() - reminder.days);
    } else if (reminder.hours) {
      sendAt.setHours(sendAt.getHours() - reminder.hours);
    }

    // Only schedule if sendAt is in future
    if (sendAt > new Date()) {
      // Check if reminder already exists
      const exists = await Reminder.findOne({
        userId,
        eventId: event._id,
        reminderType: reminder.type
      });

      if (!exists) {
        await Reminder.create({
          userId,
          eventId: event._id,
          eventTitle: event.title,
          reminderType: reminder.type,
          deadline,
          sendAt
        });
        console.log(`Scheduled ${reminder.type} reminder for event ${event.title}`);
      }
    }
  }
}

/**
 * Send a single reminder
 */
async function sendReminder(reminder) {
  try {
    const User = require('../models/User');
    const userId = reminder.userId;
    
    // Create notification in DB first
    await Notification.create({
      userId: reminder.userId,
      title: `Reminder: ${reminder.eventTitle}`,
      body: `Registration deadline is approaching! Don't miss out!`,
      type: 'EVENT_REMINDER'
    });

    // Get tokens
    let tokens = await NotificationToken.find({ userId }).lean();
    
    // Fallback to user.fcmToken if no NotificationToken docs exist
    if (!tokens.length) {
      const user = await User.findById(userId).select('fcmToken email');
      if (user && user.fcmToken) {
        tokens.push({ token: user.fcmToken, platform: 'web', userId, isLegacyToken: true });
      }
    }

    const message = {
      notification: {
        title: `Reminder: ${reminder.eventTitle}`,
        body: `Registration deadline is approaching! Don't miss out!`
      }
    };

    for (const t of tokens) {
      try {
        await admin.messaging().send({ ...message, token: t.token });
        console.log(`FCM reminder sent to token ${t.token.substring(0, 10)}... for event ${reminder.eventTitle}`);
      } catch (err) {
        if (err.code === 'messaging/invalid-registration-token' ||
            err.code === 'messaging/registration-token-not-registered') {
          if (t.isLegacyToken) {
            // Clear legacy fcmToken from User doc
            await User.findByIdAndUpdate(userId, { fcmToken: null });
          } else {
            // Delete from NotificationToken collection
            await NotificationToken.deleteOne({ userId: t.userId, token: t.token });
          }
          console.log(`Removed invalid token ${t.token.substring(0, 10)}...`);
        } else {
          console.error(`Error sending reminder to token ${t.token.substring(0, 10)}...:`, err);
        }
      }
    }

    // Mark reminder as sent regardless of FCM success (we still created the Notification doc)
    reminder.sent = true;
    reminder.sentAt = new Date();
    await reminder.save();
    
    return true;
  } catch (error) {
    console.error(`Error sending reminder ${reminder._id}:`, error);
    // Record the failure so a permanently broken reminder eventually stops
    // being retried by the hourly job.
    try {
      await Reminder.updateOne(
        { _id: reminder._id },
        { $inc: { attempts: 1 }, $set: { lastError: error.message } }
      );
    } catch (bookkeepingErr) {
      console.error(`Could not record failure for reminder ${reminder._id}:`, bookkeepingErr.message);
    }
    return false;
  }
}

/**
 * Check and send due reminders (to be called by cron job)
 */
async function sendDueReminders() {
  console.log('Checking for due reminders...');

  const now = new Date();
  // Get reminders that are due, not sent yet, and not exhausted by repeated failures.
  // `attempts` is absent on rows created before this field existed, and $lt does
  // not match a missing field — so those must be matched explicitly.
  const dueReminders = await Reminder.find({
    sendAt: { $lte: now },
    sent: false,
    $or: [
      { attempts: { $exists: false } },
      { attempts: { $lt: MAX_SEND_ATTEMPTS } }
    ]
  });

  console.log(`Found ${dueReminders.length} due reminders`);

  let failed = 0;
  for (const reminder of dueReminders) {
    const ok = await sendReminder(reminder);
    if (!ok) failed++;
  }

  console.log(`Reminder check complete (${dueReminders.length - failed} sent, ${failed} failed)`);
}

/**
 * Cancel reminders when user unsaves an event
 */
async function cancelReminders(userId, eventId) {
  await Reminder.deleteMany({
    userId,
    eventId,
    sent: false
  });
  console.log('Cancelled unsent reminders for event');
}

module.exports = {
  scheduleReminders,
  sendDueReminders,
  cancelReminders
};
