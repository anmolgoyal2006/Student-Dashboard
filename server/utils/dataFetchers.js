const { TTLCache } = require('./ttlCache');
const Attendance = require('../models/Attendance');
const Marks = require('../models/Marks');

const rawCache = new TTLCache({ ttlMs: 5 * 60 * 1000, maxEntries: 500 });

exports.getRawAttendance = async (userId) =>
  rawCache.wrap(`att:${userId}`, () =>
    Attendance.find({ userId })
      .populate('subjectId', 'name code credits')
      .sort({ date: 1 })
      .lean()
  );

exports.getRawMarks = async (userId) =>
  rawCache.wrap(`marks:${userId}`, () =>
    Marks.find({ userId })
      .populate('subjectId', 'name')
      .lean()
  );

exports.invalidateRawAttendance = (userId) => { rawCache.del(`att:${userId}`); };
exports.invalidateRawMarks = (userId) => { rawCache.del(`marks:${userId}`); };
