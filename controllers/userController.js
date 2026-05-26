const User = require('../models/User');

/**
 * GET /api/users
 * List users with pagination and optional filters: role, department, search.
 */
const getUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = { isActive: true };

    if (req.query.role) {
      query.role = req.query.role;
    }

    if (req.query.department) {
      query.department = req.query.department;
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { studentId: searchRegex },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('getUsers error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching users',
    });
  }
};

/**
 * POST /api/users
 * Create a new user with enrollmentStatus set to 'pending'.
 */
const createUser = async (req, res) => {
  try {
    const existingUser = await User.findOne({ email: req.body.email?.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists',
      });
    }

    const userData = {
      ...req.body,
      enrollmentStatus: 'pending',
    };

    const user = await User.create(userData);

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshToken;

    res.status(201).json({
      success: true,
      user: userResponse,
    });
  } catch (error) {
    console.error('createUser error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages,
      });
    }
    res.status(500).json({
      success: false,
      message: 'An error occurred while creating user',
    });
  }
};

/**
 * GET /api/users/:id
 * Get a single user by ID. Admins can access any user; others can only access themselves.
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own profile.',
      });
    }

    const user = await User.findById(id);

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
    console.error('getUserById error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching user',
    });
  }
};

/**
 * PUT /api/users/:id
 * Update a user. Non-admins can only update limited fields on their own profile.
 * Admins can update any field except password.
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own profile.',
      });
    }

    let updateData;

    if (req.user.role !== 'admin') {
      const { firstName, lastName, phone, parentEmail, parentPhone } = req.body;
      updateData = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (phone !== undefined) updateData.phone = phone;
      if (parentEmail !== undefined) updateData.parentEmail = parentEmail;
      if (parentPhone !== undefined) updateData.parentPhone = parentPhone;
    } else {
      updateData = { ...req.body };
      delete updateData.password;
    }

    const user = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

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
    console.error('updateUser error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages,
      });
    }
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating user',
    });
  }
};

/**
 * DELETE /api/users/:id
 * Soft-delete a user by setting isActive to false.
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'User deactivated successfully',
    });
  } catch (error) {
    console.error('deleteUser error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while deleting user',
    });
  }
};

module.exports = {
  getUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
};
