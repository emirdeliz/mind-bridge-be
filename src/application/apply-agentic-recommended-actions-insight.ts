import type { SessionInsight } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

export const RECOMMENDED_ACTIONS_INSIGHT_TITLES: Record<AppLanguage, string> = {
  pt: 'Ações recomendadas',
  es: 'Acciones recomendadas',
  en: 'Recommended actions',
};

const isRecommendedActionsInsightTitle = (
  title: string,
  language: AppLanguage
): boolean => {
  const normalized = title.trim().toLowerCase();
  const expected = RECOMMENDED_ACTIONS_INSIGHT_TITLES[language]
    .trim()
    .toLowerCase();

  return (
    normalized === expected ||
    normalized.includes('ação') ||
    normalized.includes('acao') ||
    normalized.includes('accion') ||
    normalized.includes('action') ||
    normalized.includes('recomend')
  );
};

export const applyAgenticRecommendedActionsInsight = (
  insights: SessionInsight[],
  actionsBody: string | null,
  language: AppLanguage
): SessionInsight[] => {
  if (!actionsBody?.trim()) {
    return insights;
  }

  const actionsTitle = RECOMMENDED_ACTIONS_INSIGHT_TITLES[language];
  const next = insights.length ? [...insights] : [];
  const actionsIndex = next.findIndex((insight) =>
    isRecommendedActionsInsightTitle(insight.title, language)
  );
  const targetIndex = actionsIndex >= 0 ? actionsIndex : 3;

  while (next.length <= targetIndex) {
    next.push({ title: actionsTitle, body: '' });
  }

  next[targetIndex] = { title: actionsTitle, body: actionsBody };

  return next.slice(0, 4);
};
