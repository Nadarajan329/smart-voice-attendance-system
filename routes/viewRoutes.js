const express = require('express');
const router = express.Router();
const { verifyAccessToken } = require('../config/jwt');
const User = require('../models/User');

/**
 * Page-level auth middleware for view routes.
 * Extracts and verifies JWT from cookie or Authorization header.
 * Does NOT return JSON errors — redirects to /login on failure.
 */
async function pageAuth(req, res, next) {
  try {
    let token = null;

    if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id);

    if (user && user.isActive) {
      req.user = user;
    } else {
      req.user = null;
    }

    next();
  } catch (err) {
    req.user = null;
    next();
  }
}

/**
 * Ensure user is authenticated for protected pages.
 * Redirects to /login if not authenticated.
 */
function requirePageAuth(req, res, next) {
  if (!req.user) {
    return res.redirect('/login');
  }
  next();
}

// Apply page-level auth to all view routes
router.use(pageAuth);

// GET / - Redirect based on auth status
router.get('/', (req, res) => {
  if (req.user) {
    return res.redirect('/dashboard');
  }
  return res.redirect('/login');
});

// GET /login - Login page (redirect to dashboard if already authenticated)
router.get('/login', (req, res) => {
  if (req.user) {
    return res.redirect('/dashboard');
  }
  res.render('auth/login', { title: 'Login' });
});

// GET /dashboard - Dashboard page (protected)
router.get('/dashboard', requirePageAuth, (req, res) => {
  res.render('dashboard/admin', { title: 'Dashboard', user: req.user });
});

// GET /attendance - Attendance station page (protected)
router.get('/attendance', requirePageAuth, (req, res) => {
  res.render('attendance/station', { title: 'Attendance Station', user: req.user });
});

// GET /enrollment - Voice enrollment page (protected)
router.get('/enrollment', requirePageAuth, (req, res) => {
  res.render('enrollment/enroll', { title: 'Voice Enrollment', user: req.user });
});

// GET /roster - Roster management page (protected)
router.get('/roster', requirePageAuth, (req, res) => {
  res.render('roster/manage', { title: 'Roster Management', user: req.user });
});

// GET /sessions - Sessions configuration page (protected)
router.get('/sessions', requirePageAuth, (req, res) => {
  res.render('sessions/configure', { title: 'Sessions', user: req.user });
});

// GET /profile - User profile page (protected)
router.get('/profile', requirePageAuth, (req, res) => {
  res.render('profile/self', { title: 'My Profile', user: req.user });
});

module.exports = router;
