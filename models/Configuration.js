const mongoose = require('mongoose');

const configurationSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'Configuration key is required'],
      unique: true,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Configuration value is required'],
    },
    category: {
      type: String,
      enum: {
        values: [
          'voice_recognition',
          'attendance',
          'notification',
          'security',
          'system',
          'ui',
        ],
        message: '{VALUE} is not a valid configuration category',
      },
      required: [true, 'Category is required'],
    },
    description: {
      type: String,
      trim: true,
    },
    dataType: {
      type: String,
      enum: {
        values: ['string', 'number', 'boolean', 'object', 'array'],
        message: '{VALUE} is not a valid data type',
      },
      required: [true, 'Data type is required'],
    },
    isEditable: {
      type: Boolean,
      default: true,
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

configurationSchema.statics.getConfig = async function (key, defaultValue) {
  const config = await this.findOne({ key });
  if (!config) {
    return defaultValue !== undefined ? defaultValue : null;
  }
  return config.value;
};

configurationSchema.statics.setConfig = async function (key, value, modifiedBy) {
  const config = await this.findOneAndUpdate(
    { key },
    {
      value,
      lastModifiedBy: modifiedBy,
    },
    {
      new: true,
      runValidators: true,
    }
  );
  if (!config) {
    throw new Error(`Configuration key "${key}" not found`);
  }
  return config;
};

configurationSchema.index({ category: 1, key: 1 });

module.exports = mongoose.model('Configuration', configurationSchema);
