import type { SessionInsight } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

export const PATTERNS_INSIGHT_TITLES: Record<AppLanguage, string> = {
  pt: 'Padrões detectados',
  es: 'Patrones detectados',
  en: 'Detected patterns',
};

const isPatternsInsightTitle = (
  title: string,
  language: AppLanguage
): boolean => {
  const normalized = title.trim().toLowerCase();
  const expected = PATTERNS_INSIGHT_TITLES[language].trim().toLowerCase();

  return (
    normalized === expected ||
    normalized.includes('padr') ||
    normalized.includes('patron') ||
    normalized.includes('pattern')
  );
};

export const applyAgenticPatternsInsight = (
  insights: SessionInsight[],
  patternsBody: string | null,
  language: AppLanguage
): SessionInsight[] => {
  if (!patternsBody?.trim()) {
    return insights;
  }

  const patternsTitle = PATTERNS_INSIGHT_TITLES[language];
  const next = insights.length ? [...insights] : [];
  const patternsIndex = next.findIndex((insight) =>
    isPatternsInsightTitle(insight.title, language)
  );
  const targetIndex = patternsIndex >= 0 ? patternsIndex : 1;

  while (next.length <= targetIndex) {
    next.push({ title: patternsTitle, body: '' });
  }

  next[targetIndex] = { title: patternsTitle, body: patternsBody };

  return next.slice(0, 4);
};
