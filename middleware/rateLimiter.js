const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV !== 'production';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 1000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes.',
    retryAfter: '15 minutes',
  },
  keyGenerator: (req) => {
    return req.ip;
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
    retryAfter: '15 minutes',
  },
  keyGenerator: (req) => {
    return req.ip;
  },
});

module.exports = { apiLimiter, authLimiter };
