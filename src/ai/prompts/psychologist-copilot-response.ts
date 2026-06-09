import type { AppLanguage } from '@domain/types.js';

/** Keeps brief copilot replies to a single sentence without cutting mid-text. */
export const PSYCHOLOGIST_COPILOT_MAX_SENTENCES = 1;

const NUMBERED_LIST_LINE_PATTERN = /^\s*\d+[\).:\-]\s+\S/;

const THINKING_PROCESS_PATTERN = /thinking\s*process\s*:?/i;

const ANALYSIS_LINE_PATTERN =
  /^\s*(\d+\.\s*)?(\*{1,2})?(analyze|analysis|constraints|role|step|reasoning)/i;

const COPILOT_META_PATTERN =
  /\b(the goal is to provide|max(?:imum)?\s+20\s+words|one single|for a psychologist assisting|direct, and actionable sentence)\b/i;

const OPEN_THINK_TAG = '\u003cthink\u003e';
const CLOSE_THINK_TAG = '\u003c/think\u003e';

const stripThinkTags = (text: string): string => {
  let cleaned = text;
  const lower = cleaned.toLowerCase();
  const openIndex = lower.indexOf(OPEN_THINK_TAG);
  const closeIndex = lower.indexOf(CLOSE_THINK_TAG);

  if (openIndex >= 0 && closeIndex > openIndex) {
    cleaned =
      cleaned.slice(0, openIndex) +
      cleaned.slice(closeIndex + CLOSE_THINK_TAG.length);
  } else if (openIndex >= 0) {
    cleaned = cleaned.slice(0, openIndex);
  }

  return cleaned.trim();
};

export const isLeakedPsychologistCopilotReasoning = (text: string): boolean => {
  const cleaned = text.trim();
  if (!cleaned) {
    return true;
  }

  const firstLine = cleaned.split('\n')[0] ?? '';
  return (
    THINKING_PROCESS_PATTERN.test(cleaned) ||
    ANALYSIS_LINE_PATTERN.test(firstLine) ||
    COPILOT_META_PATTERN.test(cleaned) ||
    /^\d+\.\s*\*\*/.test(cleaned)
  );
};

/** Removes leaked chain-of-thought before showing text to the psychologist. */
export const sanitizePsychologistCopilotResponse = (text: string): string => {
  let cleaned = stripThinkTags(text.trim());
  if (!cleaned) {
    return '';
  }

  const firstLine = cleaned.split('\n')[0] ?? '';
  const hasLeakedReasoning =
    THINKING_PROCESS_PATTERN.test(cleaned) ||
    ANALYSIS_LINE_PATTERN.test(firstLine) ||
    COPILOT_META_PATTERN.test(cleaned);

  if (hasLeakedReasoning) {
    const paragraphs = cleaned
      .split(/\n{2,}/)
      .map((part) => part.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const actionable = paragraphs.filter(
      (part) =>
        !THINKING_PROCESS_PATTERN.test(part) &&
        !COPILOT_META_PATTERN.test(part) &&
        !/^\d+\.\s*\*\*/.test(part) &&
        !/\*\*analyze/i.test(part)
    );

    if (actionable.length) {
      cleaned = actionable[actionable.length - 1] ?? cleaned;
    } else {
      cleaned = cleaned.replace(/^[\s\S]*?thinking\s*process\s*:\s*/i, '');
      cleaned = cleaned
        .split('\n')
        .filter((line) => {
          const trimmed = line.trim();
          return (
            trimmed &&
            !ANALYSIS_LINE_PATTERN.test(trimmed) &&
            !COPILOT_META_PATTERN.test(trimmed)
          );
        })
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  cleaned = cleaned
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  if (isLeakedPsychologistCopilotReasoning(cleaned)) {
    return '';
  }

  return cleaned;
};

const normalizeListLine = (line: string): string =>
  line
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

const isMetaLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed) {
    return true;
  }

  return (
    THINKING_PROCESS_PATTERN.test(trimmed) ||
    ANALYSIS_LINE_PATTERN.test(trimmed) ||
    COPILOT_META_PATTERN.test(trimmed)
  );
};

const extractNumberedList = (text: string): string => {
  const cleaned = stripThinkTags(text.trim());
  if (!cleaned) {
    return '';
  }

  const lines = cleaned
    .split('\n')
    .map(normalizeListLine)
    .filter(Boolean);

  const listLines = lines.filter(
    (line) => NUMBERED_LIST_LINE_PATTERN.test(line) && !isMetaLine(line)
  );

  return listLines.length >= 2 ? listLines.join('\n') : '';
};

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

const FALLBACK_REPLIES: Record<AppLanguage, string> = {
  pt: 'Valide o que o paciente expressou antes de aprofundar o tema.',
  es: 'Valide lo que el paciente expresó antes de profundizar el tema.',
  en: 'Validate what the patient expressed before deepening the topic.',
};

export const getPsychologistCopilotFallbackReply = (
  language: AppLanguage
): string => FALLBACK_REPLIES[language] ?? FALLBACK_REPLIES.pt;

export const finalizePsychologistCopilotReply = (
  text: string,
  language: AppLanguage
): string => {
  const numberedList = extractNumberedList(text);
  if (numberedList && !isLeakedPsychologistCopilotReasoning(numberedList)) {
    return numberedList;
  }

  const sanitized = sanitizePsychologistCopilotResponse(text);
  const compacted = compactPsychologistCopilotReply(sanitized);

  if (!compacted || isLeakedPsychologistCopilotReasoning(compacted)) {
    return getPsychologistCopilotFallbackReply(language);
  }

  return compacted;
};
