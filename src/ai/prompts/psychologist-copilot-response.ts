/** Keeps copilot replies to a single sentence without cutting mid-text. */
export const PSYCHOLOGIST_COPILOT_MAX_SENTENCES = 1;

/**
 * Strips list formatting and keeps the first sentence in full (no ellipsis).
 */
export const compactPsychologistCopilotReply = (
  text: string,
  maxSentences = PSYCHOLOGIST_COPILOT_MAX_SENTENCES
): string => {
  const withoutLists = text
    .split('\n')
    .map((line) => line.replace(/^[\s\-*•\d.)]+/, '').trim())
    .filter(Boolean)
    .join(' ');

  const normalized = withoutLists
    .replace(/\s+/g, ' ')
    .replace(/…+/g, '')
    .replace(/\.{3,}/g, '')
    .trim();

  if (!normalized) {
    return '';
  }

  const sentenceMatches = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [
    normalized,
  ];

  return sentenceMatches
    .slice(0, maxSentences)
    .join(' ')
    .trim();
};
