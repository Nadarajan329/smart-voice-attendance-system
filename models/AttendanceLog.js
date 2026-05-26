const mongoose = require('mongoose');

const attendanceLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: [true, 'Session ID is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['present', 'absent', 'late', 'excused'],
        message: '{VALUE} is not a valid attendance status',
      },
      required: [true, 'Attendance status is required'],
    },
    verificationMethod: {
      type: String,
      enum: {
        values: ['voice', 'manual_override', 'system_auto'],
        message: '{VALUE} is not a valid verification method',
      },
      required: [true, 'Verification method is required'],
    },
    voiceVerification: {
      transcript: {
        type: String,
        trim: true,
      },
      confidenceScore: {
        type: Number,
        min: [0, 'Confidence score must be between 0 and 1'],
        max: [1, 'Confidence score must be between 0 and 1'],
      },
      matchScore: {
        type: Number,
        min: [0, 'Match score must be between 0 and 100'],
        max: [100, 'Match score must be between 0 and 100'],
      },
      matchedTemplateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'VoiceTemplate',
      },
      processingTimeMs: {
        type: Number,
      },
      apiUsed: {
        type: String,
        enum: {
          values: ['web_speech_api', 'google_cloud_stt', 'manual'],
          message: '{VALUE} is not a supported speech API',
        },
        default: 'web_speech_api',
      },
      attempts: {
        type: Number,
        default: 1,
      },
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    overrideReason: {
      type: String,
      trim: true,
      default: null,
    },
    deviceInfo: {
      userAgent: {
        type: String,
      },
      ipAddress: {
        type: String,
      },
    },
  },
  {
    timestamps: true,
  }
);

attendanceLogSchema.index({ userId: 1, sessionId: 1 }, { unique: true });
attendanceLogSchema.index({ sessionId: 1, status: 1 });
attendanceLogSchema.index({ userId: 1, markedAt: -1 });

module.exports = mongoose.model('AttendanceLog', attendanceLogSchema);
