const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const sessionController = require('../controllers/sessionController');

// All routes require authentication
router.use(authenticate);

// GET /api/sessions - Any authenticated - List sessions (filtered by role/dept)
router.get('/', sessionController.getSessions);

// POST /api/sessions - Admin, Instructor - Create a new session
router.post('/', authorize('admin', 'instructor'), sessionController.createSession);

// GET /api/sessions/:id - Any authenticated - Get session details
router.get('/:id', sessionController.getSessionById);

// PUT /api/sessions/:id - Admin, Instructor - Update session
router.put('/:id', authorize('admin', 'instructor'), sessionController.updateSession);

// PATCH /api/sessions/:id/activate - Admin, Instructor - Activate session
router.patch('/:id/activate', authorize('admin', 'instructor'), sessionController.activateSession);

// PATCH /api/sessions/:id/close - Admin, Instructor - Close session
router.patch('/:id/close', authorize('admin', 'instructor'), sessionController.closeSession);

// DELETE /api/sessions/:id - Admin - Cancel session
router.delete('/:id', authorize('admin'), sessionController.cancelSession);

module.exports = router;
