const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');
const Notification = require('../models/Notification');

const DEFAULT_THRESHOLD = 3;
const DEFAULT_LOG_COUNT = 20;

/**
 * Check if a user has chronic absences (consecutive absences from most recent records).
 * If consecutive absences >= threshold, create an escalation notification to the
 * user's supervisor or a department admin.
 * @param {string} userId - The user's ObjectId.
 * @param {number} [threshold=3] - Number of consecutive absences to trigger escalation.
 * @returns {Promise<{isEscalated: boolean, consecutiveAbsences: number}>}
 */
async function checkChronicAbsence(userId, threshold) {
  const absenceThreshold = threshold || DEFAULT_THRESHOLD;

  // Get the most recent attendance logs for the user
  const recentLogs = await AttendanceLog.find({ userId })
    .sort({ markedAt: -1 })
    .limit(DEFAULT_LOG_COUNT)
    .lean();

  if (recentLogs.length === 0) {
    return { isEscalated: false, consecutiveAbsences: 0 };
  }

  // Count consecutive absences from the most recent record
  let consecutiveAbsences = 0;
  for (const log of recentLogs) {
    if (log.status === 'absent') {
      consecutiveAbsences++;
    } else {
      break;
    }
  }

  if (consecutiveAbsences < absenceThreshold) {
    return { isEscalated: false, consecutiveAbsences };
  }

  // Escalation is needed - find supervisor or department admin
  const user = await User.findById(userId).lean();
  if (!user) {
    return { isEscalated: false, consecutiveAbsences };
  }

  let escalateToUser = null;

  // Try supervisor first
  if (user.supervisorId) {
    escalateToUser = await User.findById(user.supervisorId).lean();
  }

  // Fall back to department admin
  if (!escalateToUser && user.department) {
    escalateToUser = await User.findOne({
      department: user.department,
      role: 'admin',
      isActive: true,
    }).lean();
  }

  // Fall back to any admin
  if (!escalateToUser) {
    escalateToUser = await User.findOne({
      role: 'admin',
      isActive: true,
    }).lean();
  }

  if (!escalateToUser) {
    console.warn(
      `No supervisor or admin found for escalation. User: ${userId}, consecutive absences: ${consecutiveAbsences}`
    );
    return { isEscalated: false, consecutiveAbsences };
  }

  // Create escalation notification
  const subject = `Chronic Absence Alert: ${user.firstName} ${user.lastName}`;
  const message = `Student ${user.firstName} ${user.lastName} (${user.employeeId}) has been absent for ${consecutiveAbsences} consecutive sessions. This exceeds the threshold of ${absenceThreshold}. Please review and take appropriate action.`;

  await Notification.create({
    type: 'escalation',
    recipientId: escalateToUser._id,
    recipientEmail: escalateToUser.email,
    subject,
    message,
    channel: 'in_app',
    relatedUserId: user._id,
    deliveryStatus: 'delivered',
    deliveredAt: new Date(),
    escalation: {
      isEscalated: true,
      escalatedTo: escalateToUser._id,
      escalatedAt: new Date(),
      consecutiveAbsences,
      threshold: absenceThreshold,
    },
  });

  return { isEscalated: true, consecutiveAbsences };
}

/**
 * Generate an absence report for a department within a date range.
 * @param {string} department - The department name.
 * @param {Object} dateRange - Date range filter.
 * @param {Date} dateRange.start - Start of the range.
 * @param {Date} dateRange.end - End of the range.
 * @returns {Promise<{totalStudents: number, averageAttendance: number, chronicAbsentees: Array}>}
 */
async function generateAbsenceReport(department, dateRange) {
  // Get all students in the department
  const students = await User.find({
    department,
    role: 'student',
    isActive: true,
  })
    .select('_id employeeId firstName lastName')
    .lean();

  if (students.length === 0) {
    return {
      totalStudents: 0,
      averageAttendance: 0,
      chronicAbsentees: [],
    };
  }

  const studentIds = students.map((s) => s._id);

  const dateFilter = {};
  if (dateRange && dateRange.start && dateRange.end) {
    dateFilter.markedAt = {
      $gte: new Date(dateRange.start),
      $lte: new Date(dateRange.end),
    };
  }

  // Aggregate attendance data per student
  const attendanceStats = await AttendanceLog.aggregate([
    {
      $match: {
        userId: { $in: studentIds },
        ...dateFilter,
      },
    },
    {
      $group: {
        _id: '$userId',
        totalSessions: { $sum: 1 },
        presentCount: {
          $sum: {
            $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0],
          },
        },
        absentCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'absent'] }, 1, 0],
          },
        },
      },
    },
  ]);

  // Build stats map
  const statsMap = new Map();
  for (const stat of attendanceStats) {
    statsMap.set(stat._id.toString(), stat);
  }

  // Calculate average attendance and identify chronic absentees
  let totalAttendancePercent = 0;
  let studentsWithRecords = 0;
  const chronicAbsentees = [];

  for (const student of students) {
    const stat = statsMap.get(student._id.toString());

    if (!stat || stat.totalSessions === 0) {
      continue;
    }

    studentsWithRecords++;
    const attendancePercent = (stat.presentCount / stat.totalSessions) * 100;
    totalAttendancePercent += attendancePercent;

    // Chronic absentee: attendance below 70%
    if (attendancePercent < 70) {
      chronicAbsentees.push({
        userId: student._id,
        employeeId: student.employeeId,
        name: student.firstName + ' ' + student.lastName,
        totalSessions: stat.totalSessions,
        presentCount: stat.presentCount,
        absentCount: stat.absentCount,
        attendancePercent: Math.round(attendancePercent * 100) / 100,
      });
    }
  }

  const averageAttendance =
    studentsWithRecords > 0
      ? Math.round((totalAttendancePercent / studentsWithRecords) * 100) / 100
      : 0;

  return {
    totalStudents: students.length,
    averageAttendance,
    chronicAbsentees: chronicAbsentees.sort(
      (a, b) => a.attendancePercent - b.attendancePercent
    ),
  };
}

/**
 * Escalate a user's attendance for a given session.
 * Checks for chronic absence patterns and creates escalation notifications
 * when the threshold is exceeded.
 * @param {string} userId - The user's ObjectId.
 * @param {string} sessionId - The session's ObjectId (used for context/logging).
 * @returns {Promise<{isEscalated: boolean, consecutiveAbsences: number}>}
 */
async function escalate(userId, sessionId) {
  return checkChronicAbsence(userId);
}

module.exports = {
  checkChronicAbsence,
  generateAbsenceReport,
  escalate,
};
