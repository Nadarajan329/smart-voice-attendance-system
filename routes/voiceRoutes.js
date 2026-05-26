const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const voiceController = require('../controllers/voiceController');

// All routes require authentication
router.use(authenticate);

// GET /api/voice/status - Any authenticated user - Get enrollment status
router.get('/status', voiceController.getStatus);

// POST /api/voice/enroll - Any authenticated user - Submit enrollment phrase
router.post('/enroll', voiceController.enroll);

// GET /api/voice/template - Self - Get own voice template
router.get('/template', (req, res) => {
  req.params.userId = req.user.id;
  voiceController.getTemplate(req, res);
});

// GET /api/voice/template/:userId - Admin or self - Get voice template
router.get('/template/:userId', voiceController.getTemplate);

// POST /api/voice/verify - Any authenticated user - Submit voice for matching
router.post('/verify', voiceController.verify);

// DELETE /api/voice/template/:userId - Admin or self - Delete/reset voice template
router.delete('/template/:userId', voiceController.resetTemplate);

module.exports = router;
