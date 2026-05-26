const AttendanceLog = require('../models/AttendanceLog');
const Session = require('../models/Session');
const User = require('../models/User');
const VoiceTemplate = require('../models/VoiceTemplate');
const voiceMatchingService = require('../services/voiceMatchingService');
const attendanceService = require('../services/attendanceService');

/**
 * POST /api/attendance/mark
 * Mark attendance via voice transcript matching against active templates.
 */
const markAttendance = async (req, res) => {
  try {
    const { transcript, sessionId } = req.body;

    if (!transcript || !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Transcript and sessionId are required',
      });
    }

    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    if (session.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: `Session is not active. Current status: ${session.status}`,
      });
    }

    const startTime = Date.now();

    const activeTemplates = await VoiceTemplate.find({ status: 'active' });

    if (activeTemplates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active voice templates available for matching',
      });
    }

    const matchResult = await voiceMatchingService.findBestMatch(
      transcript,
      activeTemplates
    );

    const processingTimeMs = Date.now() - startTime;

    if (matchResult && matchResult.matched) {
      const matchedUser = await User.findById(matchResult.userId);

      const log = await attendanceService.markPresent(
        matchResult.userId,
        sessionId,
        {
          verificationMethod: 'voice',
          voiceVerification: {
            transcript,
            confidenceScore: matchResult.score / 100,
            matchScore: matchResult.score,
            matchedTemplateId: matchResult.templateId,
            processingTimeMs,
            apiUsed: 'web_speech_api',
            attempts: 1,
          },
        }
      );

      return res.status(200).json({
        success: true,
        matched: true,
        userId: matchResult.userId,
        userName: matchedUser
          ? `${matchedUser.firstName} ${matchedUser.lastName}`
          : 'Unknown',
        score: matchResult.score,
        processingTimeMs,
        log,
      });
    }

    res.status(200).json({
      success: true,
      matched: false,
      score: matchResult ? matchResult.score : 0,
      processingTimeMs,
      message: 'No matching voice template found',
    });
  } catch (error) {
    console.error('markAttendance error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while marking attendance',
    });
  }
};

/**
 * POST /api/attendance/override
 * Manually override attendance for a user in a session.
 */
const overrideAttendance = async (req, res) => {
  try {
    const { userId, sessionId, status, reason } = req.body;

    if (!userId || !sessionId || !status) {
      return res.status(400).json({
        success: false,
        message: 'userId, sessionId, and status are required',
      });
    }

    const validStatuses = ['present', 'absent', 'late', 'excused'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const log = await AttendanceLog.findOneAndUpdate(
      { userId, sessionId },
      {
        userId,
        sessionId,
        status,
        verificationMethod: 'manual_override',
        markedBy: req.user.id,
        overrideReason: reason || 'Manual override by administrator',
        markedAt: new Date(),
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      log,
    });
  } catch (error) {
    console.error('overrideAttendance error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while overriding attendance',
    });
  }
};

/**
 * GET /api/attendance/session/:sessionId
 * Get all attendance logs for a session, populated with user info.
 */
const getSessionAttendance = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    const logs = await attendanceService.getSessionAttendance(sessionId);

    res.status(200).json({
      success: true,
      sessionId,
      logs,
    });
  } catch (error) {
    console.error('getSessionAttendance error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching session attendance',
    });
  }
};

/**
 * GET /api/attendance/user/:userId
 * Get attendance history for a specific user with date range and pagination.
 */
const getUserAttendance = async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own attendance.',
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = { userId };

    if (req.query.startDate || req.query.endDate) {
      query.markedAt = {};
      if (req.query.startDate) {
        query.markedAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        query.markedAt.$lte = new Date(req.query.endDate);
      }
    }

    const [logs, total] = await Promise.all([
      AttendanceLog.find(query)
        .populate('sessionId', 'title scheduledDate')
        .skip(skip)
        .limit(limit)
        .sort({ markedAt: -1 }),
      AttendanceLog.countDocuments(query),
    ]);

    const statsQuery = { userId };
    if (query.markedAt) {
      statsQuery.markedAt = query.markedAt;
    }

    const [totalAll, presentCount, absentCount, lateCount] = await Promise.all([
      AttendanceLog.countDocuments(statsQuery),
      AttendanceLog.countDocuments({ ...statsQuery, status: 'present' }),
      AttendanceLog.countDocuments({ ...statsQuery, status: 'absent' }),
      AttendanceLog.countDocuments({ ...statsQuery, status: 'late' }),
    ]);

    res.status(200).json({
      success: true,
      logs,
      stats: {
        total: totalAll,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        percentage:
          totalAll > 0
            ? Math.round(((presentCount + lateCount) / totalAll) * 100 * 100) / 100
            : 0,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('getUserAttendance error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching user attendance',
    });
  }
};

/**
 * GET /api/attendance/stats
 * Aggregate attendance stats across all sessions or filtered by department.
 */
const getAttendanceStats = async (req, res) => {
  try {
    const { department } = req.query;

    const sessionQuery = {};
    if (department) {
      sessionQuery.department = department;
    }

    const totalSessions = await Session.countDocuments(sessionQuery);

    const matchStage = {};
    if (department) {
      const sessionIds = await Session.find(sessionQuery).distinct('_id');
      matchStage.sessionId = { $in: sessionIds };
    }

    const overallStats = await AttendanceLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          present: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] },
          },
          late: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] },
          },
          absent: {
            $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] },
          },
        },
      },
    ]);

    const stats = overallStats[0] || { total: 0, present: 0, late: 0, absent: 0 };
    const averageAttendance =
      stats.total > 0
        ? Math.round(((stats.present + stats.late) / stats.total) * 100 * 100) / 100
        : 0;

    const departmentBreakdown = await AttendanceLog.aggregate([
      {
        $lookup: {
          from: 'sessions',
          localField: 'sessionId',
          foreignField: '_id',
          as: 'session',
        },
      },
      { $unwind: '$session' },
      {
        $group: {
          _id: '$session.department',
          total: { $sum: 1 },
          present: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] },
          },
          late: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] },
          },
          absent: {
            $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          department: '$_id',
          total: 1,
          present: 1,
          late: 1,
          absent: 1,
          attendanceRate: {
            $cond: [
              { $gt: ['$total', 0] },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: [{ $add: ['$present', '$late'] }, '$total'] },
                      100,
                    ],
                  },
                  2,
                ],
              },
              0,
            ],
          },
          _id: 0,
        },
      },
      { $sort: { department: 1 } },
    ]);

    res.status(200).json({
      success: true,
      totalSessions,
      averageAttendance,
      departmentBreakdown,
    });
  } catch (error) {
    console.error('getAttendanceStats error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching attendance stats',
    });
  }
};

/**
 * GET /api/attendance
 * Get overall recent attendance logs populated with user and session details.
 */
const getRecentLogs = async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    
    const logs = await AttendanceLog.find({})
      .populate('userId', 'firstName lastName email department')
      .populate('sessionId', 'title scheduledDate')
      .sort({ markedAt: -1 })
      .limit(limit);

    res.status(200).json({
      success: true,
      logs,
    });
  } catch (error) {
    console.error('getRecentLogs error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching recent logs',
    });
  }
};

module.exports = {
  markAttendance,
  overrideAttendance,
  getSessionAttendance,
  getUserAttendance,
  getAttendanceStats,
  getRecentLogs,
};
