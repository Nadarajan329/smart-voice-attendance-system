const mongoose = require('mongoose');

const phraseSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, 'Phrase text is required'],
      trim: true,
      lowercase: true,
    },
    confidence: {
      type: Number,
      min: [0, 'Confidence must be between 0 and 1'],
      max: [1, 'Confidence must be between 0 and 1'],
      required: [true, 'Confidence score is required'],
    },
    capturedAt: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      wordCount: {
        type: Number,
      },
      avgWordConfidence: {
        type: Number,
      },
      language: {
        type: String,
        default: 'en-US',
      },
    },
  },
  { _id: true }
);

const phoneticRepresentationSchema = new mongoose.Schema(
  {
    algorithm: {
      type: String,
      enum: {
        values: ['metaphone', 'soundex', 'double_metaphone'],
        message: '{VALUE} is not a supported phonetic algorithm',
      },
      required: [true, 'Phonetic algorithm is required'],
    },
    value: {
      type: String,
      required: [true, 'Phonetic value is required'],
    },
  },
  { _id: false }
);

const voiceTemplateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    phrases: [phraseSchema],
    enrollmentPhrase: {
      type: String,
      required: [true, 'Enrollment phrase is required'],
      trim: true,
    },
    phoneticRepresentations: [phoneticRepresentationSchema],
    normalizedTokens: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    matchThreshold: {
      type: Number,
      default: 0.75,
      min: [0.5, 'Match threshold must be at least 0.5'],
      max: [1.0, 'Match threshold cannot exceed 1.0'],
    },
    enrollmentAttempts: {
      type: Number,
      default: 0,
    },
    successfulEnrollments: {
      type: Number,
      default: 0,
    },
    templateVersion: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'active', 'inactive', 'recalibrating'],
        message: '{VALUE} is not a valid template status',
      },
      default: 'active',
    },
    lastVerifiedAt: {
      type: Date,
      default: null,
    },
    verificationCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

voiceTemplateSchema.index({ userId: 1, status: 1 });
voiceTemplateSchema.index({ 'phrases.text': 'text' });
voiceTemplateSchema.index({ normalizedTokens: 1 });
voiceTemplateSchema.index({ status: 1 });

module.exports = mongoose.model('VoiceTemplate', voiceTemplateSchema);
