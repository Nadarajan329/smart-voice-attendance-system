const VoiceTemplate = require('../models/VoiceTemplate');
const User = require('../models/User');
const voiceMatchingService = require('../services/voiceMatchingService');
const attendanceService = require('../services/attendanceService');
const { generateAllEncodings } = require('../utils/phoneticEncoder');
const { tokenize } = require('../utils/textNormalizer');

/**
 * POST /api/voice/enroll
 * Submit an enrollment phrase. Accumulates phrases and activates template after 3 successful enrollments.
 */
const enroll = async (req, res) => {
  try {
    const { transcript, confidence } = req.body;

    if (!transcript) {
      return res.status(400).json({
        success: false,
        message: 'Transcript is required',
      });
    }

    let template = await VoiceTemplate.findOne({ userId: req.user.id });

    if (!template) {
      template = new VoiceTemplate({
        userId: req.user.id,
        enrollmentPhrase: transcript.toLowerCase().trim(),
        phrases: [],
        phoneticRepresentations: [],
        normalizedTokens: [],
        enrollmentAttempts: 0,
        successfulEnrollments: 0,
        status: 'pending',
      });
    }

    template.enrollmentAttempts += 1;

    // Add phrase with correct schema fields
    template.phrases.push({
      text: transcript,
      confidence: confidence || 0,
      capturedAt: new Date(),
      metadata: {
        wordCount: transcript.trim().split(/\s+/).length,
        avgWordConfidence: confidence || 0,
        language: 'en-US',
      },
    });

    // Generate phonetic representations matching the model schema { algorithm, value }
    const encodings = generateAllEncodings(transcript);
    for (const enc of encodings) {
      // Avoid duplicates
      const exists = template.phoneticRepresentations.some(
        (p) => p.algorithm === enc.algorithm && p.value === enc.value
      );
      if (!exists) {
        template.phoneticRepresentations.push(enc);
      }
    }

    // Merge normalized tokens (deduped)
    const tokens = tokenize(transcript);
    for (const token of tokens) {
      if (!template.normalizedTokens.includes(token)) {
        template.normalizedTokens.push(token);
      }
    }

    template.successfulEnrollments += 1;

    if (template.successfulEnrollments >= 3 && template.status !== 'active') {
      template.status = 'active';
      await User.findByIdAndUpdate(req.user.id, {
        enrollmentStatus: 'enrolled',
      });
    }

    await template.save();

    res.status(200).json({
      success: true,
      message:
        template.status === 'active'
          ? 'Voice enrollment complete. Template is now active.'
          : `Enrollment phrase recorded. ${3 - template.successfulEnrollments} more needed.`,
      template: {
        status: template.status,
        enrollmentAttempts: template.enrollmentAttempts,
        successfulEnrollments: template.successfulEnrollments,
        phrasesCount: template.phrases.length,
      },
    });
  } catch (error) {
    console.error('Enroll error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during enrollment',
    });
  }
};

/**
 * GET /api/voice/template/:userId
 * Get voice template for a user. Admin or self-access only.
 */
const getTemplate = async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const template = await VoiceTemplate.findOne({ userId });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Voice template not found',
      });
    }

    res.status(200).json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('getTemplate error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching voice template',
    });
  }
};

/**
 * POST /api/voice/verify
 * Submit voice transcript for matching against all active templates.
 */
const verify = async (req, res) => {
  try {
    const { transcript, sessionId } = req.body;

    if (!transcript || !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Transcript and sessionId are required',
      });
    }

    const startTime = Date.now();

    const activeTemplates = await VoiceTemplate.find({ status: 'active' });

    if (activeTemplates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active voice templates found',
      });
    }

    const matchResult = await voiceMatchingService.findBestMatch(
      transcript,
      activeTemplates
    );

    const processingTimeMs = Date.now() - startTime;

    if (matchResult && matchResult.matched) {
      const matchedUser = await User.findById(matchResult.userId);

      await attendanceService.markPresent(matchResult.userId, sessionId, {
        verificationMethod: 'voice',
        voiceVerification: {
          transcript,
          confidenceScore: matchResult.score / 100,
          matchScore: matchResult.score,
          matchedTemplateId: matchResult.templateId,
          processingTimeMs,
          apiUsed: 'web_speech_api',
          attempts: 1,
        },
      });

      await VoiceTemplate.findOneAndUpdate(
        { userId: matchResult.userId },
        {
          lastVerifiedAt: new Date(),
          $inc: { verificationCount: 1 },
        }
      );

      return res.status(200).json({
        success: true,
        matched: true,
        userId: matchResult.userId,
        userName: matchedUser
          ? `${matchedUser.firstName} ${matchedUser.lastName}`
          : 'Unknown',
        score: matchResult.score,
        processingTimeMs,
      });
    }

    res.status(200).json({
      success: true,
      matched: false,
      score: matchResult ? matchResult.score : 0,
      processingTimeMs,
      message: 'No matching voice template found',
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during voice verification',
    });
  }
};

/**
 * DELETE /api/voice/template/:userId
 * Delete/reset a user's voice template and reset their enrollment status.
 */
const resetTemplate = async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const deleted = await VoiceTemplate.findOneAndDelete({ userId });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Voice template not found',
      });
    }

    await User.findByIdAndUpdate(userId, {
      enrollmentStatus: 'voice_pending',
    });

    res.status(200).json({
      success: true,
      message: 'Voice template deleted and enrollment status reset',
    });
  } catch (error) {
    console.error('resetTemplate error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while resetting voice template',
    });
  }
};

/**
 * GET /api/voice/status
 * Get the voice enrollment status for the currently authenticated user.
 */
const getStatus = async (req, res) => {
  try {
    const template = await VoiceTemplate.findOne({ userId: req.user.id });
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      enrollmentStatus: user?.enrollmentStatus || 'pending',
      hasTemplate: !!template,
      templateStatus: template?.status || null,
      successfulEnrollments: template?.successfulEnrollments || 0,
      requiredEnrollments: 3,
    });
  } catch (error) {
    console.error('getStatus error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching voice status',
    });
  }
};

module.exports = {
  enroll,
  getTemplate,
  getStatus,
  verify,
  resetTemplate,
};
