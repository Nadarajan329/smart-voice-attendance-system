const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'default_dev_secret_change_me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Generate access and refresh tokens for a user
 */
function generateTokens(user) {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
}

/**
 * Verify an access token
 */
function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Verify a refresh token
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, JWT_REFRESH_SECRET);
}

module.exports = {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  JWT_SECRET,
  JWT_REFRESH_SECRET
};
