const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'my', 'name', 'i', 'am',
  'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might',
  'shall', 'can', 'need', 'dare', 'ought', 'used',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
  'from', 'as', 'into', 'through', 'during', 'before',
  'after', 'above', 'below', 'between', 'out', 'off',
  'over', 'under', 'again', 'further', 'then', 'once',
  'here', 'there', 'when', 'where', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 's', 't', 'just', 'don', 'now',
  'and', 'but', 'or', 'if', 'while', 'this', 'that',
  'it', 'he', 'she', 'we', 'they', 'me', 'him',
  'her', 'us', 'them',
]);

/**
 * Normalize text by lowering case, removing punctuation, and collapsing whitespace.
 * @param {string} text - The raw input text.
 * @returns {string} Normalized text.
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenize text into an array of words.
 * @param {string} text - The raw input text.
 * @returns {string[]} Array of non-empty word tokens.
 */
function tokenize(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }
  return normalized.split(/\s+/).filter((token) => token.length > 0);
}

/**
 * Remove common stop words from a token array.
 * @param {string[]} tokens - Array of word tokens.
 * @returns {string[]} Tokens with stop words removed.
 */
function removeStopWords(tokens) {
  if (!Array.isArray(tokens)) {
    return [];
  }
  return tokens.filter((token) => !STOP_WORDS.has(token.toLowerCase()));
}

module.exports = {
  normalizeText,
  tokenize,
  removeStopWords,
};
