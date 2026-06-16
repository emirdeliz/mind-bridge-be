import { runPatientMoodAnalyticsGraph } from '@ai/graphs/patient-mood-analytics.graph.js';
import { parsePatientMoodAnalyticsResponse } from '@ai/prompts/patient-mood-analytics-response.js';
import type { Env } from '@config/env.js';
import type {
  ClinicalChatMessage,
  DashboardSnapshot,
} from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import { ensureDashboardSnapshotStructure } from './bump-dashboard-snapshot.js';

const MOOD_SERIES_NAME = 'Humor médio';
const MOOD_SERIES_COLOR = '#5eead4';

const estimateMoodFromPatientMessage = (
  message: string,
  currentMood: number
): number => {
  const normalized = message.toLowerCase();
  let delta = 0;

  if (
    /triste|deprim|ansios|pior|mal|chor|desesper|solidão|solidao|medo|culpa|raiva|sozinh|vazio/.test(
      normalized
    )
  ) {
    delta -= 1.2;
  }

  if (
    /feliz|bem|melhor|grato|motivad|calm|alívio|alivio|ótimo|otimo|esperança|esperanca/.test(
      normalized
    )
  ) {
    delta += 1.2;
  }

  return Math.min(10, Math.max(1, Number((currentMood + delta).toFixed(1))));
};

const applyMoodScore = (
  snapshot: DashboardSnapshot,
  moodScore: number
): DashboardSnapshot => {
  const moodData = [...(snapshot.moodTrendSeries[0]?.data ?? [])];

  if (moodData.length > 0) {
    moodData[moodData.length - 1] = moodScore;
  } else {
    moodData.push(moodScore);
  }

  return {
    ...snapshot,
    moodTrendSeries: [
      {
        name: snapshot.moodTrendSeries[0]?.name ?? MOOD_SERIES_NAME,
        data: moodData,
        color: snapshot.moodTrendSeries[0]?.color ?? MOOD_SERIES_COLOR,
      },
    ],
    lastUpdatedAt: new Date().toISOString(),
  };
};

export type UpdateMoodFromPatientChatInput = {
  currentSnapshot: DashboardSnapshot;
  userMessage: string;
  chatHistory: ClinicalChatMessage[];
  language?: AppLanguage;
  /** Evita LLM extra no pós-processamento assíncrono do chat. */
  useHeuristicOnly?: boolean;
};

/** Atualiza evolução do humor com base na interação paciente ↔ agente de IA. */
export const updateMoodFromPatientChat = async (
  env: Env,
  input: UpdateMoodFromPatientChatInput
): Promise<DashboardSnapshot> => {
  const base = ensureDashboardSnapshotStructure(input.currentSnapshot);
  const currentMood =
    base.moodTrendSeries[0]?.data?.[base.moodTrendSeries[0].data.length - 1] ??
    5;
  const userMessage = input.userMessage.trim();

  if (!userMessage) {
    return base;
  }

  if (input.useHeuristicOnly) {
    const fallbackScore = estimateMoodFromPatientMessage(
      userMessage,
      currentMood
    );
    return applyMoodScore(base, fallbackScore);
  }

  try {
    const raw = await runPatientMoodAnalyticsGraph(env, {
      userMessage,
      chatHistory: input.chatHistory,
      currentMoodValue: currentMood,
      language: input.language,
    });
    const parsed = parsePatientMoodAnalyticsResponse(raw);

    if (parsed) {
      return applyMoodScore(base, parsed.moodScore);
    }
  } catch {
    // Fallback heurístico abaixo.
  }

  const fallbackScore = estimateMoodFromPatientMessage(
    userMessage,
    currentMood
  );
  return applyMoodScore(base, fallbackScore);
};
