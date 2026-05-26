const User = require('../models/User');
const Session = require('../models/Session');
const AttendanceLog = require('../models/AttendanceLog');
const Notification = require('../models/Notification');

/**
 * GET /api/dashboard/summary
 * Overall system summary with counts and today's attendance rate.
 */
const getSummary = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      totalUsers,
      totalStudents,
      totalInstructors,
      totalSessions,
      activeSessions,
      pendingAlerts,
      todayLogs,
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: true, role: 'student' }),
      User.countDocuments({ isActive: true, role: 'instructor' }),
      Session.countDocuments(),
      Session.countDocuments({ status: 'active' }),
      Notification.countDocuments({ deliveryStatus: 'pending' }),
      AttendanceLog.find({
        markedAt: { $gte: todayStart, $lte: todayEnd },
      }),
    ]);

    const todayTotal = todayLogs.length;
    const todayPresent = todayLogs.filter(
      (l) => l.status === 'present' || l.status === 'late'
    ).length;
    const todayAttendanceRate =
      todayTotal > 0
        ? Math.round((todayPresent / todayTotal) * 100 * 100) / 100
        : 0;

    res.status(200).json({
      success: true,
      summary: {
        totalUsers,
        totalStudents,
        totalInstructors,
        totalSessions,
        activeSessions,
        todayAttendanceRate,
        pendingAlerts,
      },
    });
  } catch (error) {
    console.error('getSummary error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching dashboard summary',
    });
  }
};

/**
 * GET /api/dashboard/trends
 * Attendance trends for the last 7 days.
 */
const getTrends = async (req, res) => {
  try {
    const days = 7;
    const trends = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const logs = await AttendanceLog.find({
        markedAt: { $gte: dayStart, $lte: dayEnd },
      });

      const total = logs.length;
      const present = logs.filter((l) => l.status === 'present').length;
      const absent = logs.filter((l) => l.status === 'absent').length;
      const late = logs.filter((l) => l.status === 'late').length;

      trends.push({
        date: dayStart.toISOString().split('T')[0],
        total,
        present,
        absent,
        late,
        rate: total > 0
          ? Math.round(((present + late) / total) * 100 * 100) / 100
          : 0,
      });
    }

    res.status(200).json({
      success: true,
      trends,
    });
  } catch (error) {
    console.error('getTrends error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching attendance trends',
    });
  }
};

/**
 * GET /api/dashboard/active-sessions
 * List currently active sessions with instructor info and attendance stats.
 */
const getActiveSessions = async (req, res) => {
  try {
    const sessions = await Session.find({ status: 'active' })
      .populate('instructorId', 'firstName lastName email')
      .sort({ actualStartTime: -1 });

    const sessionsWithStats = await Promise.all(
      sessions.map(async (session) => {
        const totalLogs = await AttendanceLog.countDocuments({
          sessionId: session._id,
        });
        const presentCount = await AttendanceLog.countDocuments({
          sessionId: session._id,
          status: { $in: ['present', 'late'] },
        });

        return {
          ...session.toObject(),
          stats: {
            totalMarked: totalLogs,
            presentCount,
            eligibleCount: session.eligibleUsers ? session.eligibleUsers.length : 0,
          },
        };
      })
    );

    res.status(200).json({
      success: true,
      sessions: sessionsWithStats,
    });
  } catch (error) {
    console.error('getActiveSessions error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching active sessions',
    });
  }
};

/**
 * GET /api/dashboard/departments
 * Department-wise breakdown of students and average attendance.
 */
const getDepartments = async (req, res) => {
  try {
    const departmentUsers = await User.aggregate([
      { $match: { isActive: true, role: 'student' } },
      {
        $group: {
          _id: '$department',
          totalStudents: { $sum: 1 },
        },
      },
    ]);

    const departmentAttendance = await AttendanceLog.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      { $match: { 'user.role': 'student' } },
      {
        $group: {
          _id: '$user.department',
          total: { $sum: 1 },
          present: {
            $sum: {
              $cond: [
                { $in: ['$status', ['present', 'late']] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const attendanceMap = {};
    departmentAttendance.forEach((d) => {
      attendanceMap[d._id] = {
        total: d.total,
        present: d.present,
      };
    });

    const departments = departmentUsers.map((dept) => {
      const att = attendanceMap[dept._id] || { total: 0, present: 0 };
      return {
        department: dept._id,
        totalStudents: dept.totalStudents,
        averageAttendance:
          att.total > 0
            ? Math.round((att.present / att.total) * 100 * 100) / 100
            : 0,
      };
    });

    departments.sort((a, b) => (a.department || '').localeCompare(b.department || ''));

    res.status(200).json({
      success: true,
      departments,
    });
  } catch (error) {
    console.error('getDepartments error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching department stats',
    });
  }
};

module.exports = {
  getSummary,
  getTrends,
  getActiveSessions,
  getDepartments,
};
