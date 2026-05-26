const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const userController = require('../controllers/userController');

// All routes require authentication
router.use(authenticate);

// GET /api/users - Admin, Instructor - List users with pagination & filters
router.get('/', authorize('admin', 'instructor'), userController.getUsers);

// POST /api/users - Admin - Create a new user
router.post('/', authorize('admin'), userController.createUser);

// GET /api/users/:id - Admin or self - Get user details
router.get('/:id', userController.getUserById);

// PUT /api/users/:id - Admin or self - Update user
router.put('/:id', userController.updateUser);

// DELETE /api/users/:id - Admin - Soft delete user
router.delete('/:id', authorize('admin'), userController.deleteUser);

module.exports = router;
