const natural = require('natural');
const { tokenize } = require('./textNormalizer');

const metaphone = new natural.Metaphone();
const soundEx = new natural.SoundEx();
const doubleMetaphone = new natural.DoubleMetaphone();

/**
 * Get Metaphone phonetic code for a word.
 * @param {string} text - Input word or text.
 * @returns {string} Metaphone code.
 */
function getMetaphone(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return metaphone.process(text);
}

/**
 * Get SoundEx phonetic code for a word.
 * @param {string} text - Input word or text.
 * @returns {string} SoundEx code.
 */
function getSoundex(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return soundEx.process(text);
}

/**
 * Get Double Metaphone phonetic codes for a word.
 * @param {string} text - Input word or text.
 * @returns {string[]} Array of two Double Metaphone codes.
 */
function getDoubleMetaphone(text) {
  if (!text || typeof text !== 'string') {
    return ['', ''];
  }
  return doubleMetaphone.process(text);
}

/**
 * Generate all phonetic encodings for each token in the text.
 * @param {string} text - Input text to encode.
 * @returns {Array<{algorithm: string, value: string}>} Array of encoding objects.
 */
function generateAllEncodings(text) {
  const tokens = tokenize(text);
  const encodings = [];

  for (const token of tokens) {
    const metaphoneCode = getMetaphone(token);
    if (metaphoneCode) {
      encodings.push({ algorithm: 'metaphone', value: metaphoneCode });
    }

    const soundexCode = getSoundex(token);
    if (soundexCode) {
      encodings.push({ algorithm: 'soundex', value: soundexCode });
    }

    const doubleMetaphoneCodes = getDoubleMetaphone(token);
    if (doubleMetaphoneCodes[0]) {
      encodings.push({ algorithm: 'double_metaphone', value: doubleMetaphoneCodes[0] });
    }
    if (doubleMetaphoneCodes[1] && doubleMetaphoneCodes[1] !== doubleMetaphoneCodes[0]) {
      encodings.push({ algorithm: 'double_metaphone', value: doubleMetaphoneCodes[1] });
    }
  }

  return encodings;
}

module.exports = {
  getMetaphone,
  getSoundex,
  getDoubleMetaphone,
  generateAllEncodings,
};
