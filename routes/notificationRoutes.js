const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const notificationController = require('../controllers/notificationController');

// All routes require authentication
router.use(authenticate);

// GET /api/notifications/unread-count - Any authenticated - Get unread notification count
router.get('/unread-count', notificationController.getUnreadCount);

// GET /api/notifications - Any authenticated - Get own notifications
router.get('/', notificationController.getNotifications);

// POST /api/notifications/dispatch - Admin - Manually trigger absence notifications
router.post('/dispatch', authorize('admin'), notificationController.dispatchNotifications);

// GET /api/notifications/escalations - Admin - Get escalation reports
router.get('/escalations', authorize('admin'), notificationController.getEscalations);

// PATCH /api/notifications/:id/read - Any authenticated - Mark notification as read
router.patch('/:id/read', notificationController.markAsRead);

module.exports = router;
