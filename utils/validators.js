const mongoose = require('mongoose');

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

/**
 * Validate email format.
 * @param {string} email - Email address to validate.
 * @returns {boolean} True if email format is valid.
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validate password strength.
 * Requires: min 8 characters, at least 1 uppercase, 1 lowercase, 1 number.
 * @param {string} password - Password to validate.
 * @returns {boolean} True if password meets strength requirements.
 */
function isValidPassword(password) {
  if (!password || typeof password !== 'string') {
    return false;
  }
  return PASSWORD_REGEX.test(password);
}

/**
 * Validate MongoDB ObjectId format.
 * @param {string} id - ID string to validate.
 * @returns {boolean} True if the ID is a valid ObjectId.
 */
function isValidObjectId(id) {
  if (!id) {
    return false;
  }
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Sanitize input by trimming whitespace and escaping HTML entities.
 * @param {string} text - Raw input text.
 * @returns {string} Sanitized text.
 */
function sanitizeInput(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return text
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

module.exports = {
  isValidEmail,
  isValidPassword,
  isValidObjectId,
  sanitizeInput,
};
