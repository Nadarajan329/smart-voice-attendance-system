const Session = require('../models/Session');
const AttendanceLog = require('../models/AttendanceLog');
const attendanceService = require('../services/attendanceService');
const notificationService = require('../services/notificationService');
const escalationService = require('../services/escalationService');

/**
 * GET /api/sessions
 * List sessions with role-based filtering, pagination, and optional status/date filters.
 */
const getSessions = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};

    if (req.user.role === 'instructor') {
      query.$or = [
        { instructorId: req.user.id },
        { department: req.user.department },
      ];
    } else if (req.user.role === 'student') {
      query.eligibleUsers = req.user.id;
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.date) {
      const date = new Date(req.query.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      query.scheduledDate = { $gte: date, $lt: nextDay };
    }

    const [sessions, total] = await Promise.all([
      Session.find(query)
        .populate('instructorId', 'firstName lastName')
        .skip(skip)
        .limit(limit)
        .sort({ scheduledDate: -1 }),
      Session.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      sessions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('getSessions error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching sessions',
    });
  }
};

/**
 * POST /api/sessions
 * Create a new session. Instructors are auto-assigned; admins may specify instructorId.
 */
const createSession = async (req, res) => {
  try {
    const sessionData = { ...req.body };

    if (req.user.role !== 'admin' || !sessionData.instructorId) {
      sessionData.instructorId = req.user.id;
    }

    const session = await Session.create(sessionData);

    res.status(201).json({
      success: true,
      session,
    });
  } catch (error) {
    console.error('createSession error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages,
      });
    }
    res.status(500).json({
      success: false,
      message: 'An error occurred while creating session',
    });
  }
};

/**
 * GET /api/sessions/:id
 * Get a single session by ID with populated instructor and eligible users.
 */
const getSessionById = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('instructorId', 'firstName lastName email')
      .populate('eligibleUsers', 'firstName lastName email studentId');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    res.status(200).json({
      success: true,
      session,
    });
  } catch (error) {
    console.error('getSessionById error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching session',
    });
  }
};

/**
 * PUT /api/sessions/:id
 * Update a session. Only allowed when session is in 'scheduled' status.
 */
const updateSession = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    if (session.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: `Cannot update a session with status '${session.status}'. Only 'scheduled' sessions can be updated.`,
      });
    }

    const updated = await Session.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      session: updated,
    });
  } catch (error) {
    console.error('updateSession error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages,
      });
    }
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating session',
    });
  }
};

/**
 * PATCH /api/sessions/:id/activate
 * Activate a session, setting its actual start time.
 */
const activateSession = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    if (session.status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'Session is already active',
      });
    }

    session.status = 'active';
    session.actualStartTime = new Date();
    await session.save();

    res.status(200).json({
      success: true,
      session,
    });
  } catch (error) {
    console.error('activateSession error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while activating session',
    });
  }
};

/**
 * PATCH /api/sessions/:id/close
 * Close a session, mark absentees, send notifications, and trigger escalations.
 */
const closeSession = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('eligibleUsers', 'firstName lastName email');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    if (session.status === 'closed') {
      return res.status(400).json({
        success: false,
        message: 'Session is already closed',
      });
    }

    session.status = 'closed';
    session.actualEndTime = new Date();
    await session.save();

    const absentResults = await attendanceService.markAbsentBulk(session._id);
    await notificationService.dispatchAbsenceAlerts(session._id);

    const absentLogs = await AttendanceLog.find({
      sessionId: session._id,
      status: 'absent',
    });

    for (const log of absentLogs) {
      try {
        await escalationService.escalate(log.userId, session._id);
      } catch (escErr) {
        console.error(`Escalation failed for user ${log.userId}:`, escErr.message);
      }
    }

    const totalLogs = await AttendanceLog.countDocuments({ sessionId: session._id });
    const presentCount = await AttendanceLog.countDocuments({
      sessionId: session._id,
      status: { $in: ['present', 'late'] },
    });
    const absentCount = await AttendanceLog.countDocuments({
      sessionId: session._id,
      status: 'absent',
    });

    res.status(200).json({
      success: true,
      session,
      stats: {
        total: totalLogs,
        present: presentCount,
        absent: absentCount,
        attendanceRate: totalLogs > 0
          ? Math.round((presentCount / totalLogs) * 100 * 100) / 100
          : 0,
      },
    });
  } catch (error) {
    console.error('closeSession error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while closing session',
    });
  }
};

/**
 * DELETE /api/sessions/:id
 * Cancel a session by setting its status to 'cancelled'.
 */
const cancelSession = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    session.status = 'cancelled';
    await session.save();

    res.status(200).json({
      success: true,
      message: 'Session cancelled successfully',
    });
  } catch (error) {
    console.error('cancelSession error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while cancelling session',
    });
  }
};

module.exports = {
  getSessions,
  createSession,
  getSessionById,
  updateSession,
  activateSession,
  closeSession,
  cancelSession,
};
