const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../config/jwt');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required. Please provide a valid token.',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required. Please provide a valid token.',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        error: 'User associated with this token no longer exists.',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: 'User account has been deactivated.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired.' });
    }
    return res.status(401).json({ error: 'Authentication failed.' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    req.user = user && user.isActive ? user : null;
    next();
  } catch (err) {
    req.user = null;
    next();
  }
};

module.exports = { authenticate, optionalAuth };
