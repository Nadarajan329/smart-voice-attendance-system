const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const authController = require('../controllers/authController');

// POST /api/auth/login - Public - Authenticate with email + password
router.post('/login', authLimiter, authController.login);

// POST /api/auth/logout - Authenticated - Invalidate refresh token
router.post('/logout', authenticate, authController.logout);

// POST /api/auth/refresh - Public - Refresh access token using refresh token
router.post('/refresh', authController.refreshToken);

// GET /api/auth/me - Authenticated - Get current user profile
router.get('/me', authenticate, authController.getMe);

module.exports = router;
