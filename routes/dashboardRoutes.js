const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const dashboardController = require('../controllers/dashboardController');

// All routes require authentication
router.use(authenticate);

// GET /api/dashboard/summary - Admin - Overall system summary
router.get('/summary', authorize('admin'), dashboardController.getSummary);

// GET /api/dashboard/trends - Admin, Instructor - Weekly attendance trends
router.get('/trends', authorize('admin', 'instructor'), dashboardController.getTrends);

// GET /api/dashboard/active-sessions - Admin, Instructor - Currently active sessions
router.get('/active-sessions', authorize('admin', 'instructor'), dashboardController.getActiveSessions);

// GET /api/dashboard/departments - Admin - Department-wise breakdown
router.get('/departments', authorize('admin'), dashboardController.getDepartments);

module.exports = router;
