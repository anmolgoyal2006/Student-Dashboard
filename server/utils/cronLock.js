// Cross-process cron lock backed by MongoDB.
// Prevents duplicate job execution when two server processes briefly overlap
// (Render deploys, free-tier spin-up/down, crash-restart races). The in-memory
// isRunning flags in the job modules only guard within one process; this lock
// spans processes.
//
// Lock model: one document per job name (`_id: <jobName>`) carrying a lease
// (`expiresAt`). A TTL index auto-cleans expired locks; a stale lock can also
// be stolen immediately by the next contender.
const mongoose = require('mongoose');

const DEFAULT_TTL_SECONDS = 90;

let indexReady = null;

function ensureIndex() {
  if (!indexReady) {
    indexReady = mongoose.connection.db
      .collection('cronLocks')
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
      .catch((err) => {
        indexReady = null;
        throw err;
      });
  }
  return indexReady;
}

// Returns true if THIS process now owns the lock, false if another holder does.
async function acquireLock(name, ttlSeconds = DEFAULT_TTL_SECONDS) {
  await ensureIndex();
  const col = mongoose.connection.db.collection('cronLocks');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  try {
    await col.insertOne({ _id: name, expiresAt });
    return true;
  } catch (err) {
    if (err.code !== 11000) throw err;
    // Lock exists — steal it only if the previous holder's lease has expired
    // (crashed process never released it). Delete-then-insert keeps the steal
    // race-safe: only one contender can delete the stale doc.
    const removed = await col.deleteOne({ _id: name, expiresAt: { $lt: now } });
    if (removed.deletedCount !== 1) return false;
    try {
      await col.insertOne({ _id: name, expiresAt });
      return true;
    } catch (err2) {
      if (err2.code !== 11000) throw err2;
      return false; // lost the race to another stealer
    }
  }
}

async function releaseLock(name) {
  await mongoose.connection.db.collection('cronLocks').deleteOne({ _id: name });
}

module.exports = { acquireLock, releaseLock };