const Subject = require('../models/Subject');

/**
 * Creates a subject unless one with the same name already exists for the user.
 * Returns { skipped: true, name } instead of throwing when it collides, so
 * callers can decide whether to merge into the existing document.
 */
async function createSubject(data, userId) {
  if (!data.code && data.name) {
    data.code = data.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }
  const exists = await Subject.findOne({ userId, name: new RegExp(`^${data.name}$`, 'i') });
  if (exists) return { skipped: true, name: data.name };
  return Subject.create({ ...data, userId });
}

/**
 * Merges slots into an existing schedule by day: any day present in newSlots is
 * fully replaced, every other day is kept. Kept slots come first, new ones are
 * appended — callers and tests depend on that ordering.
 */
function mergeSchedule(existingSchedule, newSlots) {
  const newDays = newSlots.map(sc => sc.day);
  const keptSlots = (existingSchedule || []).filter(sc => !newDays.includes(sc.day));
  return [...keptSlots, ...newSlots];
}

module.exports = { createSubject, mergeSchedule };
