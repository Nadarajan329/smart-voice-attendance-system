const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Session title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    instructorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Instructor is required'],
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
    },
    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled date is required'],
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
    },
    endTime: {
      type: Date,
      required: [true, 'End time is required'],
      validate: {
        validator: function (value) {
          return value > this.startTime;
        },
        message: 'End time must be after start time',
      },
    },
    actualStartTime: {
      type: Date,
      default: null,
    },
    actualEndTime: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ['scheduled', 'active', 'closed', 'cancelled'],
        message: '{VALUE} is not a valid session status',
      },
      default: 'scheduled',
    },
    eligibleUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    recurrence: {
      isRecurring: {
        type: Boolean,
        default: false,
      },
      pattern: {
        type: String,
        enum: {
          values: ['daily', 'weekly', 'monthly', 'custom'],
          message: '{VALUE} is not a valid recurrence pattern',
        },
        default: null,
      },
      daysOfWeek: [
        {
          type: Number,
          min: [0, 'Day of week must be between 0 and 6'],
          max: [6, 'Day of week must be between 0 and 6'],
        },
      ],
      endDate: {
        type: Date,
        default: null,
      },
      parentSessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Session',
        default: null,
      },
    },
    settings: {
      lateThresholdMinutes: {
        type: Number,
        default: 15,
      },
      allowManualOverride: {
        type: Boolean,
        default: true,
      },
      autoCloseEnabled: {
        type: Boolean,
        default: true,
      },
      notifyAbsentees: {
        type: Boolean,
        default: true,
      },
    },
    stats: {
      totalEligible: {
        type: Number,
        default: 0,
      },
      totalPresent: {
        type: Number,
        default: 0,
      },
      totalAbsent: {
        type: Number,
        default: 0,
      },
      totalLate: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

sessionSchema.pre('save', function (next) {
  if (this.eligibleUsers) {
    this.stats.totalEligible = this.eligibleUsers.length;
  }
  next();
});

sessionSchema.index({ status: 1, scheduledDate: 1 });
sessionSchema.index({ instructorId: 1, scheduledDate: -1 });
sessionSchema.index({ department: 1, status: 1 });

module.exports = mongoose.model('Session', sessionSchema);
