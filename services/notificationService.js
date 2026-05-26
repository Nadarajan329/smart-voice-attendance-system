const nodemailer = require('nodemailer');
const Notification = require('../models/Notification');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');
const Session = require('../models/Session');

let transporter = null;

/**
 * Create a nodemailer SMTP transporter using environment variables.
 * Handles the case where SMTP is not configured gracefully.
 * @returns {Object|null} Nodemailer transporter or null if not configured.
 */
function createTransporter() {
  if (transporter) {
    return transporter;
  }

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn(
      'SMTP not configured. Email notifications will be skipped. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS environment variables.'
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: parseInt(port, 10) || 587,
    secure: parseInt(port, 10) === 465,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}

/**
 * Send an email notification.
 * @param {string} to - Recipient email address.
 * @param {string} subject - Email subject line.
 * @param {string} htmlContent - HTML body content.
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendEmail(to, subject, htmlContent) {
  const transport = createTransporter();

  if (!transport) {
    return {
      success: false,
      error: 'SMTP not configured. Email delivery is disabled.',
    };
  }

  try {
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html: htmlContent,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err) {
    console.error('Failed to send email:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Create a notification document in the database.
 * @param {Object} data - Notification data fields.
 * @returns {Promise<Object>} The created Notification document.
 */
async function createNotification(data) {
  const notification = await Notification.create(data);
  return notification;
}

/**
 * Dispatch absence alerts for all absent users in a session.
 * Creates in_app notifications for all absent users and sends emails
 * if SMTP is configured and user emails are available.
 * @param {string} sessionId - The session's ObjectId.
 * @returns {Promise<{notificationCount: number, emailsSent: number}>}
 */
async function dispatchAbsenceAlerts(sessionId) {
  const session = await Session.findById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const absentLogs = await AttendanceLog.find({
    sessionId,
    status: 'absent',
  }).populate('userId', 'firstName lastName email employeeId');

  let notificationCount = 0;
  let emailsSent = 0;

  for (const log of absentLogs) {
    const user = log.userId;
    if (!user) {
      continue;
    }

    const subject = `Absence Alert: ${session.title}`;
    const message = `Dear ${user.firstName} ${user.lastName}, you were marked absent for the session "${session.title}" scheduled on ${session.scheduledDate.toISOString().split('T')[0]}. If you believe this is an error, please contact your instructor.`;

    // Create in-app notification
    await createNotification({
      type: 'absence_alert',
      recipientId: user._id,
      recipientEmail: user.email,
      subject,
      message,
      channel: 'in_app',
      relatedSessionId: sessionId,
      relatedUserId: user._id,
      deliveryStatus: 'delivered',
      deliveredAt: new Date(),
    });
    notificationCount++;

    // Attempt email notification if configured
    if (user.email) {
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d32f2f;">Absence Alert</h2>
          <p>Dear <strong>${user.firstName} ${user.lastName}</strong>,</p>
          <p>You were marked <strong>absent</strong> for the following session:</p>
          <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Session</td><td style="padding: 8px; border: 1px solid #ddd;">${session.title}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Date</td><td style="padding: 8px; border: 1px solid #ddd;">${session.scheduledDate.toISOString().split('T')[0]}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Department</td><td style="padding: 8px; border: 1px solid #ddd;">${session.department}</td></tr>
          </table>
          <p>If you believe this is an error, please contact your instructor.</p>
        </div>
      `;

      const emailResult = await sendEmail(user.email, subject, htmlContent);

      if (emailResult.success) {
        await createNotification({
          type: 'absence_alert',
          recipientId: user._id,
          recipientEmail: user.email,
          subject,
          message,
          channel: 'email',
          relatedSessionId: sessionId,
          relatedUserId: user._id,
          deliveryStatus: 'sent',
          deliveredAt: new Date(),
        });
        notificationCount++;
        emailsSent++;
      }
    }
  }

  return { notificationCount, emailsSent };
}

module.exports = {
  createTransporter,
  sendEmail,
  createNotification,
  dispatchAbsenceAlerts,
};
