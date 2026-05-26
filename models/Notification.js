const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: {
        values: [
          'absence_alert',
          'session_reminder',
          'escalation',
          'weekly_report',
          'enrollment_complete',
          'system_alert',
        ],
        message: '{VALUE} is not a valid notification type',
      },
      required: [true, 'Notification type is required'],
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient is required'],
    },
    recipientEmail: {
      type: String,
      trim: true,
    },
    recipientPhone: {
      type: String,
      trim: true,
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
    },
    channel: {
      type: String,
      enum: {
        values: ['email', 'sms', 'in_app', 'push'],
        message: '{VALUE} is not a valid notification channel',
      },
      required: [true, 'Notification channel is required'],
    },
    relatedSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
    },
    relatedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deliveryStatus: {
      type: String,
      enum: {
        values: ['pending', 'sent', 'delivered', 'failed', 'read'],
        message: '{VALUE} is not a valid delivery status',
      },
      default: 'pending',
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
      max: [3, 'Maximum retry count is 3'],
    },
    errorMessage: {
      type: String,
      default: null,
    },
    escalation: {
      isEscalated: {
        type: Boolean,
        default: false,
      },
      escalatedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      escalatedAt: {
        type: Date,
        default: null,
      },
      consecutiveAbsences: {
        type: Number,
        default: 0,
      },
      threshold: {
        type: Number,
        default: 3,
      },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipientId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ deliveryStatus: 1, createdAt: 1 });
notificationSchema.index({ relatedSessionId: 1, type: 1 });
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

module.exports = mongoose.model('Notification', notificationSchema);
