const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const attendanceController = require('../controllers/attendanceController');

// All routes require authentication
router.use(authenticate);

// POST /api/attendance/mark - Any authenticated - Mark attendance via voice
router.post('/mark', attendanceController.markAttendance);

// GET /api/attendance - Admin, Instructor - List recent logs
router.get('/', authorize('admin', 'instructor'), attendanceController.getRecentLogs);

// POST /api/attendance/override - Admin, Instructor - Manual override
router.post('/override', authorize('admin', 'instructor'), attendanceController.overrideAttendance);

// GET /api/attendance/stats - Admin, Instructor - Aggregate stats
router.get('/stats', authorize('admin', 'instructor'), attendanceController.getAttendanceStats);

// GET /api/attendance/session/:sessionId - Admin, Instructor - Session attendance
router.get('/session/:sessionId', authorize('admin', 'instructor'), attendanceController.getSessionAttendance);

// GET /api/attendance/user/:userId - Admin or self - User attendance history
router.get('/user/:userId', attendanceController.getUserAttendance);

module.exports = router;
