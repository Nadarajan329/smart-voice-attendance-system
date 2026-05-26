const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      trim: true,
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid email address',
      ],
    },
    phone: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ['admin', 'instructor', 'student'],
        message: '{VALUE} is not a valid role',
      },
      default: 'student',
    },
    department: {
      type: String,
      trim: true,
    },
    enrollmentStatus: {
      type: String,
      enum: {
        values: ['pending', 'enrolled', 'voice_pending', 'suspended'],
        message: '{VALUE} is not a valid enrollment status',
      },
      default: 'pending',
    },
    parentEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    parentPhone: {
      type: String,
      trim: true,
    },
    supervisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    profileImage: {
      type: String,
      default: null,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    refreshToken: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.virtual('fullName').get(function () {
  return this.firstName + ' ' + this.lastName;
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.statics.findByCredentials = async function (email, password) {
  const user = await this.findOne({ email }).select('+password');
  if (!user) {
    throw new Error('Invalid email or password');
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error('Invalid email or password');
  }
  return user;
};

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ employeeId: 1 }, { unique: true });
userSchema.index({ role: 1, department: 1 });
userSchema.index({ isActive: 1, role: 1 });

module.exports = mongoose.model('User', userSchema);
