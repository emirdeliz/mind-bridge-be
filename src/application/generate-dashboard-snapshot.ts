import { runDashboardAnalyticsGraph } from '@ai/graphs/dashboard-analytics.graph.js';
import {
  parseDashboardAnalyticsResponse,
  type AiDashboardAnalyticsOutput,
} from '@ai/prompts/dashboard-analytics-response.js';
import type { Env } from '@config/env.js';
import type {
  ClinicalChatMessage,
  DashboardSnapshot,
} from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import {
  bumpDashboardSnapshotAfterSession,
  ensureDashboardSnapshotStructure,
} from './bump-dashboard-snapshot.js';

const MOOD_SERIES_NAME = 'Humor médio';
const MOOD_SERIES_COLOR = '#5eead4';
const CLINICAL_SERIES_NAME = 'Menções';
const CLINICAL_SERIES_COLOR = '#a78bfa';
const WEEKLY_SERIES_NAME = 'Interações';
const WEEKLY_SERIES_COLOR = '#818cf8';

const getTodayWeekdayIndex = (): number => {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
};

const alignSeriesLength = (
  data: number[],
  expectedLength: number,
  fallback: number[]
): number[] => {
  if (data.length === expectedLength) {
    return data;
  }

  if (data.length > expectedLength) {
    return data.slice(-expectedLength);
  }

  const padded = [...fallback];
  while (padded.length < expectedLength) {
    padded.unshift(padded[0] ?? fallback[0] ?? 0);
  }

  return [...padded.slice(0, expectedLength - data.length), ...data];
};

const applySupplementarySessionMetrics = (
  snapshot: DashboardSnapshot
): DashboardSnapshot => {
  const weeklyData = [...(snapshot.weeklyInteractionSeries[0]?.data ?? [])];
  const todayIndex = getTodayWeekdayIndex();
  if (weeklyData.length > todayIndex) {
    weeklyData[todayIndex] += 1;
  }

  const channels = snapshot.interactionChannels.map((channel) =>
    channel.name === 'Texto'
      ? { ...channel, value: channel.value + 1 }
      : channel
  );

  return {
    ...snapshot,
    weeklyInteractionSeries: [
      {
        name: snapshot.weeklyInteractionSeries[0]?.name ?? WEEKLY_SERIES_NAME,
        data: weeklyData,
        color: snapshot.weeklyInteractionSeries[0]?.color ?? WEEKLY_SERIES_COLOR,
      },
    ],
    interactionChannels: channels,
    lastUpdatedAt: new Date().toISOString(),
  };
};

const applyAiDashboardOutput = (
  base: DashboardSnapshot,
  ai: AiDashboardAnalyticsOutput
): DashboardSnapshot => {
  const moodCategories = base.moodTrendCategories;
  const themeCategories = base.clinicalThemeCategories;
  const previousMood = base.moodTrendSeries[0]?.data ?? [];
  const previousThemes = base.clinicalThemeSeries[0]?.data ?? [];

  const moodTrendData = alignSeriesLength(
    ai.moodTrendData,
    moodCategories.length || ai.moodTrendData.length,
    previousMood
  );
  const clinicalThemeData = alignSeriesLength(
    ai.clinicalThemeData,
    themeCategories.length || ai.clinicalThemeData.length,
    previousThemes
  );

  return applySupplementarySessionMetrics({
    ...base,
    moodDiaryAdherencePercent: ai.moodDiaryAdherencePercent,
    moodTrendSeries: [
      {
        name: base.moodTrendSeries[0]?.name ?? MOOD_SERIES_NAME,
        data: moodTrendData,
        color: base.moodTrendSeries[0]?.color ?? MOOD_SERIES_COLOR,
      },
    ],
    clinicalThemeSeries: [
      {
        name: base.clinicalThemeSeries[0]?.name ?? CLINICAL_SERIES_NAME,
        data: clinicalThemeData,
        color: base.clinicalThemeSeries[0]?.color ?? CLINICAL_SERIES_COLOR,
      },
    ],
    lastUpdatedAt: new Date().toISOString(),
  });
};

export type GenerateDashboardSnapshotInput = {
  currentSnapshot: DashboardSnapshot;
  sessionConsiderations: string;
  sessionContext: string;
  chatHistory: ClinicalChatMessage[];
  language?: AppLanguage;
};

/** Gera snapshot do painel via agente de IA; usa heurística se o modelo falhar. */
export const generateDashboardSnapshotAfterSession = async (
  env: Env,
  input: GenerateDashboardSnapshotInput
): Promise<DashboardSnapshot> => {
  const structuredBase = ensureDashboardSnapshotStructure(input.currentSnapshot);
  const sessionText = [input.sessionConsiderations, input.sessionContext]
    .filter(Boolean)
    .join(' ');

  try {
    const raw = await runDashboardAnalyticsGraph(env, {
      currentSnapshot: structuredBase,
      sessionConsiderations: input.sessionConsiderations,
      sessionContext: input.sessionContext,
      chatHistory: input.chatHistory,
      language: input.language,
    });

    const parsed = parseDashboardAnalyticsResponse(raw);
    if (!parsed) {
      throw new Error('Invalid dashboard analytics JSON from AI agent');
    }

    return applyAiDashboardOutput(structuredBase, parsed);
  } catch {
    return bumpDashboardSnapshotAfterSession(structuredBase, sessionText);
  }
};
