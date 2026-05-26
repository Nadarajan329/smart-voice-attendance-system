const fuzzball = require('fuzzball');
const { normalizeText, tokenize } = require('../utils/textNormalizer');
const { getMetaphone } = require('../utils/phoneticEncoder');

/**
 * Perform fuzzy string matching between input and template text.
 * @param {string} input - The spoken transcript.
 * @param {string} template - The stored enrollment phrase.
 * @returns {number} Similarity score 0-100.
 */
function fuzzyMatch(input, template) {
  const normalizedInput = normalizeText(input);
  const normalizedTemplate = normalizeText(template);

  if (!normalizedInput || !normalizedTemplate) {
    return 0;
  }

  return fuzzball.ratio(normalizedInput, normalizedTemplate);
}

/**
 * Perform token-level matching between input and template.
 * Each input token is compared against all template tokens;
 * a match is counted if any comparison yields fuzzball.ratio >= 85.
 * @param {string} input - The spoken transcript.
 * @param {string} template - The stored enrollment phrase.
 * @returns {number} Percentage of input tokens matched (0-100).
 */
function tokenMatch(input, template) {
  const inputTokens = tokenize(input);
  const templateTokens = tokenize(template);

  if (inputTokens.length === 0 || templateTokens.length === 0) {
    return 0;
  }

  let matchedCount = 0;

  for (const inputToken of inputTokens) {
    let tokenMatched = false;
    for (const templateToken of templateTokens) {
      if (fuzzball.ratio(inputToken, templateToken) >= 85) {
        tokenMatched = true;
        break;
      }
    }
    if (tokenMatched) {
      matchedCount++;
    }
  }

  return (matchedCount / inputTokens.length) * 100;
}

/**
 * Perform phonetic matching using Metaphone codes.
 * Compares Metaphone representations of both strings.
 * @param {string} input - The spoken transcript.
 * @param {string} template - The stored enrollment phrase.
 * @returns {number} 1.0 if phonetic codes match, 0 otherwise.
 */
function phoneticMatch(input, template) {
  const inputTokens = tokenize(input);
  const templateTokens = tokenize(template);

  if (inputTokens.length === 0 || templateTokens.length === 0) {
    return 0;
  }

  const inputCodes = inputTokens.map((t) => getMetaphone(t)).join(' ');
  const templateCodes = templateTokens.map((t) => getMetaphone(t)).join(' ');

  return inputCodes === templateCodes ? 1.0 : 0;
}

/**
 * Find the best matching template for a given transcript.
 * Uses weighted scoring: fuzzy (0.5), token (0.3), phonetic (0.2).
 * @param {string} transcript - The spoken transcript to match.
 * @param {Array} templates - Array of VoiceTemplate documents.
 * @returns {Object} Match result with matched flag, userId, score, templateId, phrase, method.
 */
function findBestMatch(transcript, templates) {
  if (!transcript || !templates || templates.length === 0) {
    return { matched: false };
  }

  const FUZZY_WEIGHT = 0.5;
  const TOKEN_WEIGHT = 0.3;
  const PHONETIC_WEIGHT = 0.2;

  let bestResult = null;
  let bestScore = 0;
  let bestTemplate = null;
  let bestPhrase = null;

  for (const template of templates) {
    if (!template.phrases || template.phrases.length === 0) {
      continue;
    }

    const threshold = (template.matchThreshold || 0.75) * 100;

    for (const phrase of template.phrases) {
      const phraseText = phrase.text;

      if (!phraseText) {
        continue;
      }

      const fuzzyScore = fuzzyMatch(transcript, phraseText);
      const tokenScore = tokenMatch(transcript, phraseText);
      const phoneticScore = phoneticMatch(transcript, phraseText) * 100;

      const combinedScore =
        fuzzyScore * FUZZY_WEIGHT +
        tokenScore * TOKEN_WEIGHT +
        phoneticScore * PHONETIC_WEIGHT;

      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        bestTemplate = template;
        bestPhrase = phraseText;

        let method = 'fuzzy';
        if (phoneticScore === 100) {
          method = 'phonetic';
        } else if (tokenScore > fuzzyScore) {
          method = 'token';
        }

        bestResult = {
          matched: true,
          userId: template.userId,
          score: Math.round(combinedScore * 100) / 100,
          templateId: template._id,
          phrase: bestPhrase,
          method,
        };
      }
    }
  }

  if (!bestResult || !bestTemplate) {
    return { matched: false };
  }

  const threshold = (bestTemplate.matchThreshold || 0.75) * 100;
  if (bestScore < threshold) {
    return { matched: false };
  }

  return bestResult;
}

module.exports = {
  fuzzyMatch,
  tokenMatch,
  phoneticMatch,
  findBestMatch,
};
