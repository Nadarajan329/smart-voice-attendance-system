const AttendanceLog = require('../models/AttendanceLog');
const Session = require('../models/Session');
const User = require('../models/User');

/**
 * Check if a user has already been marked for a session.
 * @param {string} userId - The user's ObjectId.
 * @param {string} sessionId - The session's ObjectId.
 * @returns {Promise<boolean>} True if already marked.
 */
async function isAlreadyMarked(userId, sessionId) {
  const existing = await AttendanceLog.findOne({ userId, sessionId });
  return !!existing;
}

/**
 * Mark a user as present (or late if past the threshold) for a session.
 * @param {string} userId - The user's ObjectId.
 * @param {string} sessionId - The session's ObjectId.
 * @param {Object} verificationData - Verification details.
 * @param {string} verificationData.verificationMethod - 'voice', 'manual_override', or 'system_auto'.
 * @param {Object} [verificationData.voiceVerification] - Voice verification details.
 * @param {string} [verificationData.markedBy] - Who marked the attendance.
 * @param {Object} [verificationData.deviceInfo] - Device metadata.
 * @returns {Promise<Object>} The created AttendanceLog document.
 */
async function markPresent(userId, sessionId, verificationData) {
  const session = await Session.findById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  if (session.status === 'cancelled') {
    throw new Error('Cannot mark attendance for a cancelled session');
  }

  if (session.status === 'closed') {
    throw new Error('Cannot mark attendance for a closed session');
  }

  const alreadyMarked = await isAlreadyMarked(userId, sessionId);
  if (alreadyMarked) {
    throw new Error('Attendance already marked for this user in this session');
  }

  // Determine if present or late
  const now = new Date();
  const lateThreshold = session.settings.lateThresholdMinutes || 15;
  const sessionStart = session.actualStartTime || session.startTime;
  const thresholdTime = new Date(sessionStart.getTime() + lateThreshold * 60 * 1000);

  const status = now > thresholdTime ? 'late' : 'present';

  const logData = {
    userId,
    sessionId,
    status,
    verificationMethod: verificationData.verificationMethod,
    markedAt: now,
  };

  if (verificationData.voiceVerification) {
    logData.voiceVerification = verificationData.voiceVerification;
  }

  if (verificationData.markedBy) {
    logData.markedBy = verificationData.markedBy;
  }

  if (verificationData.deviceInfo) {
    logData.deviceInfo = verificationData.deviceInfo;
  }

  const attendanceLog = await AttendanceLog.create(logData);

  // Update session stats
  const updateField = status === 'late' ? 'stats.totalLate' : 'stats.totalPresent';
  await Session.findByIdAndUpdate(sessionId, {
    $inc: { [updateField]: 1 },
  });

  return attendanceLog;
}

/**
 * Mark all eligible users who haven't been recorded as absent for a session.
 * @param {string} sessionId - The session's ObjectId.
 * @returns {Promise<{count: number, logs: Array}>} Number and details of absent records created.
 */
async function markAbsentBulk(sessionId) {
  const session = await Session.findById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  // Find users who already have attendance records for this session
  const existingLogs = await AttendanceLog.find({ sessionId }).select('userId');
  const markedUserIds = new Set(existingLogs.map((log) => log.userId.toString()));

  // Filter eligible users who haven't been marked
  const absentUserIds = session.eligibleUsers.filter(
    (uid) => !markedUserIds.has(uid.toString())
  );

  if (absentUserIds.length === 0) {
    return { count: 0, logs: [] };
  }

  const absentRecords = absentUserIds.map((userId) => ({
    userId,
    sessionId,
    status: 'absent',
    verificationMethod: 'system_auto',
    markedAt: new Date(),
  }));

  const logs = await AttendanceLog.insertMany(absentRecords);

  // Update session stats
  await Session.findByIdAndUpdate(sessionId, {
    $set: { 'stats.totalAbsent': absentUserIds.length },
  });

  return { count: logs.length, logs };
}

/**
 * Calculate attendance percentage for a user within a date range.
 * @param {string} userId - The user's ObjectId.
 * @param {Object} dateRange - Date range filter.
 * @param {Date} dateRange.start - Start of the range.
 * @param {Date} dateRange.end - End of the range.
 * @returns {Promise<{percentage: number, present: number, total: number}>} Attendance stats.
 */
async function getAttendancePercentage(userId, dateRange) {
  const query = { userId };

  if (dateRange && dateRange.start && dateRange.end) {
    query.markedAt = {
      $gte: new Date(dateRange.start),
      $lte: new Date(dateRange.end),
    };
  }

  const totalRecords = await AttendanceLog.countDocuments(query);

  if (totalRecords === 0) {
    return { percentage: 0, present: 0, total: 0 };
  }

  const presentOrLate = await AttendanceLog.countDocuments({
    ...query,
    status: { $in: ['present', 'late'] },
  });

  const percentage = Math.round((presentOrLate / totalRecords) * 10000) / 100;

  return {
    percentage,
    present: presentOrLate,
    total: totalRecords,
  };
}

/**
 * Get all attendance logs for a session, populated with user info.
 * @param {string} sessionId - The session's ObjectId.
 * @returns {Promise<Array>} Array of populated AttendanceLog documents.
 */
async function getSessionAttendance(sessionId) {
  const logs = await AttendanceLog.find({ sessionId })
    .populate('userId', 'employeeId firstName lastName email department role')
    .populate('markedBy', 'employeeId firstName lastName')
    .sort({ markedAt: 1 });

  return logs;
}

module.exports = {
  isAlreadyMarked,
  markPresent,
  markAbsentBulk,
  getAttendancePercentage,
  getSessionAttendance,
};
