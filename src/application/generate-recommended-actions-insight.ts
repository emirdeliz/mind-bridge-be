import { runPatientChatRecommendedActionsGraph } from '@ai/graphs/patient-chat-recommended-actions.graph.js';
import type { Env } from '@config/env.js';
import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import {
  flattenInteractionGroups,
  getInteractionGroupsFromLastWeek,
  hasWeeklyPatientChatReports,
} from './patient-chat-interaction-groups.js';

const MAX_ACTIONS_CHARS = 320;

const truncate = (text: string): string => {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_ACTIONS_CHARS) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_ACTIONS_CHARS - 1).trimEnd()}…`;
};

export const generateRecommendedActionsInsight = async (
  env: Env,
  patientChatHistory: ClinicalChatMessage[],
  language: AppLanguage,
  sessionContext: string,
  sessionConsiderations: string
): Promise<string | null> => {
  if (!hasWeeklyPatientChatReports(patientChatHistory)) {
    return null;
  }

  const weeklyHistory = flattenInteractionGroups(
    getInteractionGroupsFromLastWeek(patientChatHistory)
  );

  try {
    const actions = await runPatientChatRecommendedActionsGraph(env, {
      patientChatHistory: weeklyHistory,
      sessionContext,
      sessionConsiderations,
      language,
    });

    const normalized = truncate(actions);
    return normalized || null;
  } catch {
    return null;
  }
};
