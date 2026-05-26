const User = require('../models/User');
const { generateTokens, verifyRefreshToken } = require('../config/jwt');
const bcrypt = require('bcrypt');

/**
 * POST /api/auth/login
 * Authenticate user with email + password, return tokens and user profile.
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase(), isActive: true })
      .select('+password +refreshToken');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        message: 'Invalid email or password',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        message: 'Invalid email or password',
      });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        fullName: `${user.firstName} ${user.lastName}`,
        department: user.department,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login',
    });
  }
};

/**
 * POST /api/auth/logout
 * Clear user's refresh token to invalidate sessions.
 */
const logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { refreshToken: null });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during logout',
    });
  }
};

/**
 * POST /api/auth/refresh
 * Exchange a valid refresh token for new access + refresh tokens.
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
      });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }

    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    if (user.refreshToken !== token) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token does not match. Please log in again.',
      });
    }

    const tokens = generateTokens(user);

    user.refreshToken = tokens.refreshToken;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while refreshing token',
    });
  }
};

/**
 * GET /api/auth/me
 * Return the currently authenticated user's profile.
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching profile',
    });
  }
};

module.exports = {
  login,
  logout,
  refreshToken,
  getMe,
};
