const Notification = require('../models/Notification');
const notificationService = require('../services/notificationService');

/**
 * GET /api/notifications
 * Get notifications for the current user, sorted newest first, with pagination.
 */
const getNotifications = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = { recipientId: req.user.id };

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('getNotifications error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching notifications',
    });
  }
};

/**
 * POST /api/notifications/dispatch
 * Manually trigger absence notifications for a given session.
 */
const dispatchNotifications = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'sessionId is required',
      });
    }

    const result = await notificationService.dispatchAbsenceAlerts(sessionId);

    res.status(200).json({
      success: true,
      message: 'Absence notifications dispatched',
      count: result ? result.count || 0 : 0,
    });
  } catch (error) {
    console.error('dispatchNotifications error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while dispatching notifications',
    });
  }
};

/**
 * GET /api/notifications/escalations
 * Get all escalated notifications, populated with related fields.
 */
const getEscalations = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = { 'escalation.isEscalated': true };

    const [escalations, total] = await Promise.all([
      Notification.find(query)
        .populate('recipientId', 'firstName lastName email')
        .populate('sessionId', 'title scheduledDate')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      escalations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('getEscalations error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching escalations',
    });
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read. Only the recipient can mark it.
 */
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    if (notification.recipientId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only mark your own notifications as read.',
      });
    }

    notification.deliveryStatus = 'read';
    notification.readAt = new Date();
    await notification.save();

    res.status(200).json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error('markAsRead error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while marking notification as read',
    });
  }
};

/**
 * GET /api/notifications/unread-count
 * Get the count of unread notifications for the current user.
 */
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipientId: req.user.id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      unreadCount: count,
    });
  } catch (error) {
    console.error('getUnreadCount error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching unread count',
    });
  }
};

module.exports = {
  getNotifications,
  dispatchNotifications,
  getEscalations,
  markAsRead,
  getUnreadCount,
};
