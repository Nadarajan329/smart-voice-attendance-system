require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const connectDB = require('../config/db');

// We'll import models after they're available
let User, VoiceTemplate, Session, AttendanceLog, Configuration;

const defaultConfigs = [
  { key: 'voice.confidence_threshold', category: 'voice_recognition', value: 0.75, dataType: 'number', description: 'Minimum confidence score for voice verification' },
  { key: 'voice.max_enrollment_attempts', category: 'voice_recognition', value: 5, dataType: 'number', description: 'Max attempts allowed for enrollment' },
  { key: 'voice.required_successful_enrollments', category: 'voice_recognition', value: 3, dataType: 'number', description: 'Successful enrollments needed for baseline' },
  { key: 'voice.max_verification_attempts', category: 'voice_recognition', value: 3, dataType: 'number', description: 'Max voice verification attempts per session' },
  { key: 'attendance.late_threshold_minutes', category: 'attendance', value: 15, dataType: 'number', description: 'Minutes after session start to mark as late' },
  { key: 'attendance.auto_absent_enabled', category: 'attendance', value: true, dataType: 'boolean', description: 'Auto-mark absent on session close' },
  { key: 'notification.email_enabled', category: 'notification', value: true, dataType: 'boolean', description: 'Enable email notifications' },
  { key: 'notification.sms_enabled', category: 'notification', value: false, dataType: 'boolean', description: 'Enable SMS notifications' },
  { key: 'notification.retention_days', category: 'notification', value: 90, dataType: 'number', description: 'Days to keep notifications' },
  { key: 'security.bcrypt_salt_rounds', category: 'security', value: 12, dataType: 'number', description: 'Bcrypt salt rounds' },
  { key: 'security.max_login_attempts', category: 'security', value: 5, dataType: 'number', description: 'Max failed login attempts before lockout' },
  { key: 'system.timezone', category: 'system', value: 'Asia/Kolkata', dataType: 'string', description: 'System timezone' },
];

const sampleUsers = [
  {
    employeeId: 'ADM001',
    firstName: 'Admin',
    lastName: 'User',
    email: process.env.ADMIN_EMAIL || 'admin@voiceattendance.com',
    phone: '+91-9876543210',
    password: process.env.ADMIN_PASSWORD || 'Admin@123456',
    role: 'admin',
    department: 'Administration',
    enrollmentStatus: 'enrolled',
    isActive: true
  },
  {
    employeeId: 'INS001',
    firstName: 'Dr. Priya',
    lastName: 'Sharma',
    email: 'priya.sharma@voiceattendance.com',
    phone: '+91-9876543211',
    password: 'Instructor@123',
    role: 'instructor',
    department: 'Computer Science',
    enrollmentStatus: 'enrolled',
    isActive: true
  },
  {
    employeeId: 'INS002',
    firstName: 'Prof. Rajesh',
    lastName: 'Kumar',
    email: 'rajesh.kumar@voiceattendance.com',
    phone: '+91-9876543212',
    password: 'Instructor@123',
    role: 'instructor',
    department: 'Electronics',
    enrollmentStatus: 'enrolled',
    isActive: true
  },
  {
    employeeId: 'STU001',
    firstName: 'Aarav',
    lastName: 'Patel',
    email: 'aarav.patel@student.voiceattendance.com',
    phone: '+91-9876543213',
    password: 'Student@123',
    role: 'student',
    department: 'Computer Science',
    enrollmentStatus: 'enrolled',
    parentEmail: 'parent.patel@email.com',
    isActive: true
  },
  {
    employeeId: 'STU002',
    firstName: 'Meera',
    lastName: 'Singh',
    email: 'meera.singh@student.voiceattendance.com',
    phone: '+91-9876543214',
    password: 'Student@123',
    role: 'student',
    department: 'Computer Science',
    enrollmentStatus: 'enrolled',
    parentEmail: 'parent.singh@email.com',
    isActive: true
  },
  {
    employeeId: 'STU003',
    firstName: 'Rohan',
    lastName: 'Gupta',
    email: 'rohan.gupta@student.voiceattendance.com',
    phone: '+91-9876543215',
    password: 'Student@123',
    role: 'student',
    department: 'Computer Science',
    enrollmentStatus: 'voice_pending',
    parentEmail: 'parent.gupta@email.com',
    isActive: true
  },
  {
    employeeId: 'STU004',
    firstName: 'Ananya',
    lastName: 'Reddy',
    email: 'ananya.reddy@student.voiceattendance.com',
    phone: '+91-9876543216',
    password: 'Student@123',
    role: 'student',
    department: 'Electronics',
    enrollmentStatus: 'enrolled',
    parentEmail: 'parent.reddy@email.com',
    isActive: true
  },
  {
    employeeId: 'STU005',
    firstName: 'Vikram',
    lastName: 'Joshi',
    email: 'vikram.joshi@student.voiceattendance.com',
    phone: '+91-9876543217',
    password: 'Student@123',
    role: 'student',
    department: 'Electronics',
    enrollmentStatus: 'enrolled',
    parentEmail: 'parent.joshi@email.com',
    isActive: true
  }
];

async function seedDatabase() {
  try {
    await connectDB();

    // Lazy-load models (they might not be registered yet at require time)
    User = require('../models/User');
    VoiceTemplate = require('../models/VoiceTemplate');
    Session = require('../models/Session');
    AttendanceLog = require('../models/AttendanceLog');
    Configuration = require('../models/Configuration');

    console.log('🌱 Starting database seeding...\n');

    // ─── Seed Configurations ──────────────────────────────────────────────
    console.log('📋 Seeding configurations...');
    for (const config of defaultConfigs) {
      await Configuration.findOneAndUpdate(
        { key: config.key },
        { $setOnInsert: config },
        { upsert: true, new: true }
      );
    }
    console.log(`   ✅ ${defaultConfigs.length} configurations seeded\n`);

    // ─── Seed Users ───────────────────────────────────────────────────────
    console.log('👥 Seeding users...');
    const createdUsers = [];
    for (const userData of sampleUsers) {
      const existing = await User.findOne({ email: userData.email });
      if (!existing) {
        const user = new User(userData);
        await user.save();
        createdUsers.push(user);
        console.log(`   ✅ Created ${user.role}: ${user.fullName} (${user.email})`);
      } else {
        createdUsers.push(existing);
        console.log(`   ⏭️  Skipped (exists): ${existing.fullName}`);
      }
    }
    console.log(`   Total: ${createdUsers.length} users\n`);

    // ─── Seed Voice Templates (for enrolled students) ─────────────────────
    console.log('🎤 Seeding voice templates...');
    const enrolledStudents = createdUsers.filter(
      u => u.role === 'student' && u.enrollmentStatus === 'enrolled'
    );

    for (const student of enrolledStudents) {
      const existing = await VoiceTemplate.findOne({ userId: student._id });
      if (!existing) {
        const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
        const template = new VoiceTemplate({
          userId: student._id,
          enrollmentPhrase: fullName,
          phrases: [
            { text: fullName, confidence: 0.92, metadata: { wordCount: 2, avgWordConfidence: 0.92, language: 'en-US' } },
            { text: fullName, confidence: 0.88, metadata: { wordCount: 2, avgWordConfidence: 0.88, language: 'en-US' } },
            { text: fullName, confidence: 0.95, metadata: { wordCount: 2, avgWordConfidence: 0.95, language: 'en-US' } }
          ],
          phoneticRepresentations: [
            { algorithm: 'metaphone', value: fullName.split(' ').map(w => w.toUpperCase().slice(0, 2)).join('') },
            { algorithm: 'soundex', value: fullName.split(' ').map(w => w[0].toUpperCase() + '000').join('') }
          ],
          normalizedTokens: fullName.split(' '),
          matchThreshold: 0.75,
          enrollmentAttempts: 3,
          successfulEnrollments: 3,
          status: 'active',
          templateVersion: 1
        });
        await template.save();
        console.log(`   ✅ Template created for: ${student.fullName}`);
      } else {
        console.log(`   ⏭️  Skipped (exists): ${student.fullName}`);
      }
    }
    console.log('');

    // ─── Seed Sessions ────────────────────────────────────────────────────
    console.log('📅 Seeding sessions...');
    const instructor = createdUsers.find(u => u.role === 'instructor');
    const students = createdUsers.filter(u => u.role === 'student');

    if (instructor && students.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const sessions = [
        {
          title: 'Data Structures - Morning',
          description: 'DSA fundamentals lecture',
          department: 'Computer Science',
          scheduledDate: today,
          startTime: new Date(today.getTime() + 9 * 60 * 60 * 1000),
          endTime: new Date(today.getTime() + 10 * 60 * 60 * 1000),
          status: 'active',
          actualStartTime: new Date(today.getTime() + 9 * 60 * 60 * 1000)
        },
        {
          title: 'Machine Learning Lab',
          description: 'Hands-on ML workshop',
          department: 'Computer Science',
          scheduledDate: today,
          startTime: new Date(today.getTime() + 14 * 60 * 60 * 1000),
          endTime: new Date(today.getTime() + 16 * 60 * 60 * 1000),
          status: 'scheduled'
        },
        {
          title: 'Web Development',
          description: 'Full-stack web dev class',
          department: 'Computer Science',
          scheduledDate: new Date(today.getTime() - 86400000), // yesterday
          startTime: new Date(today.getTime() - 86400000 + 10 * 60 * 60 * 1000),
          endTime: new Date(today.getTime() - 86400000 + 12 * 60 * 60 * 1000),
          status: 'closed',
          actualStartTime: new Date(today.getTime() - 86400000 + 10 * 60 * 60 * 1000),
          actualEndTime: new Date(today.getTime() - 86400000 + 12 * 60 * 60 * 1000)
        }
      ];

      for (const sessionData of sessions) {
        const existing = await Session.findOne({ title: sessionData.title, scheduledDate: sessionData.scheduledDate });
        if (!existing) {
          const csStudents = students.filter(s => s.department === 'Computer Science');
          const session = new Session({
            ...sessionData,
            instructorId: instructor._id,
            eligibleUsers: csStudents.map(s => s._id),
            settings: { lateThresholdMinutes: 15, allowManualOverride: true, autoCloseEnabled: true, notifyAbsentees: true },
            stats: { totalEligible: csStudents.length, totalPresent: 0, totalAbsent: 0, totalLate: 0 }
          });
          await session.save();
          console.log(`   ✅ Session: ${session.title} (${session.status})`);

          // Seed attendance logs for closed sessions
          if (session.status === 'closed') {
            for (let i = 0; i < csStudents.length; i++) {
              const status = i < Math.ceil(csStudents.length * 0.7) ? 'present' : 'absent';
              const existing = await AttendanceLog.findOne({ userId: csStudents[i]._id, sessionId: session._id });
              if (!existing) {
                await AttendanceLog.create({
                  userId: csStudents[i]._id,
                  sessionId: session._id,
                  status: status,
                  verificationMethod: status === 'present' ? 'voice' : 'system_auto',
                  voiceVerification: status === 'present' ? {
                    transcript: csStudents[i].fullName.toLowerCase(),
                    confidenceScore: 0.85 + Math.random() * 0.1,
                    matchScore: 85 + Math.random() * 10,
                    processingTimeMs: 800 + Math.random() * 400,
                    apiUsed: 'web_speech_api',
                    attempts: 1
                  } : undefined,
                  markedAt: session.actualStartTime
                });
              }
            }
            // Update session stats
            const presentCount = Math.ceil(csStudents.length * 0.7);
            session.stats.totalPresent = presentCount;
            session.stats.totalAbsent = csStudents.length - presentCount;
            await session.save();
          }
        } else {
          console.log(`   ⏭️  Skipped (exists): ${sessionData.title}`);
        }
      }
    }
    console.log('');

    console.log('🎉 Database seeding completed successfully!\n');
    console.log('─── Login Credentials ───────────────────');
    console.log(`Admin:      ${sampleUsers[0].email} / ${sampleUsers[0].password}`);
    console.log(`Instructor: ${sampleUsers[1].email} / ${sampleUsers[1].password}`);
    console.log(`Student:    ${sampleUsers[3].email} / ${sampleUsers[3].password}`);
    console.log('─────────────────────────────────────────\n');

    if (require.main === module) {
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    if (require.main === module) {
      process.exit(1);
    }
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
