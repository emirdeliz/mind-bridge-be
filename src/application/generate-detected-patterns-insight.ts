import { runPatientChatPatternsGraph } from '@ai/graphs/patient-chat-patterns.graph.js';
import type { Env } from '@config/env.js';
import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import {
  flattenInteractionGroups,
  getInteractionGroupsFromLastWeek,
  hasWeeklyPatientChatReports,
} from './patient-chat-interaction-groups.js';

const MAX_PATTERNS_CHARS = 280;

const truncate = (text: string): string => {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_PATTERNS_CHARS) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_PATTERNS_CHARS - 1).trimEnd()}…`;
};

export const generateDetectedPatternsInsight = async (
  env: Env,
  patientChatHistory: ClinicalChatMessage[],
  language: AppLanguage,
  sessionContext: string
): Promise<string | null> => {
  if (!hasWeeklyPatientChatReports(patientChatHistory)) {
    return null;
  }

  const weeklyHistory = flattenInteractionGroups(
    getInteractionGroupsFromLastWeek(patientChatHistory)
  );

  try {
    const patterns = await runPatientChatPatternsGraph(env, {
      patientChatHistory: weeklyHistory,
      sessionContext,
      language,
    });

    const normalized = truncate(patterns);
    return normalized || null;
  } catch {
    return null;
  }
};
