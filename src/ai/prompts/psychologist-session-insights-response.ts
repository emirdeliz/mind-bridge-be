import type { SessionInsight } from '@domain/clinical-content.types.js';

export type PsychologistSessionInsightsOutput = {
  psychologistSummary: string;
  sessionInsights: SessionInsight[];
};

const normalizeInsight = (value: unknown): SessionInsight | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const body = typeof record.body === 'string' ? record.body.trim() : '';

  if (!title || !body) {
    return null;
  }

  return { title, body };
};

export const parsePsychologistSessionInsightsResponse = (
  raw: string
): PsychologistSessionInsightsOutput | null => {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const psychologistSummary =
      typeof parsed.psychologistSummary === 'string'
        ? parsed.psychologistSummary.trim()
        : '';
    const insightsRaw = parsed.sessionInsights;

    if (!psychologistSummary || !Array.isArray(insightsRaw)) {
      return null;
    }

    const sessionInsights = insightsRaw
      .map(normalizeInsight)
      .filter((entry): entry is SessionInsight => entry !== null);

    if (!sessionInsights.length) {
      return null;
    }

    return { psychologistSummary, sessionInsights };
  } catch {
    return null;
  }
};
