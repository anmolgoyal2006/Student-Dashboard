
const Reminder = require('../models/Reminder');
const Notification = require('../models/Notification');
const admin = require('../config/firebaseAdmin');

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
    // Get user's FCM token (we'll need to add fcmToken to User schema)
    const User = require('../models/User');
    const user = await User.findById(reminder.userId);
    
    // Create notification in DB
    await Notification.create({
      userId: reminder.userId,
      title: `Reminder: ${reminder.eventTitle}`,
      body: `Registration deadline is approaching! Don't miss out!`,
      type: 'EVENT_REMINDER'
    });

    // Send FCM notification if token exists
    if (user && user.fcmToken) {
      const message = {
        notification: {
          title: `Reminder: ${reminder.eventTitle}`,
          body: `Registration deadline is approaching! Don't miss out!`
        },
        token: user.fcmToken
      };

      await admin.messaging().send(message);
      console.log(`FCM reminder sent to ${user.email} for event ${reminder.eventTitle}`);
    }

    // Mark reminder as sent
    reminder.sent = true;
    reminder.sentAt = new Date();
    await reminder.save();
    
    return true;
  } catch (error) {
    console.error(`Error sending reminder ${reminder._id}:`, error);
    return false;
  }
}

/**
 * Check and send due reminders (to be called by cron job)
 */
async function sendDueReminders() {
  console.log('Checking for due reminders...');
  
  const now = new Date();
  // Get reminders that are due and not sent yet
  const dueReminders = await Reminder.find({
    sendAt: { $lte: now },
    sent: false
  });

  console.log(`Found ${dueReminders.length} due reminders`);

  for (const reminder of dueReminders) {
    await sendReminder(reminder);
  }

  console.log('Reminder check complete');
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
