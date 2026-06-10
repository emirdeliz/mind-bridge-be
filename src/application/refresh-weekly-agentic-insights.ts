import type { SupabaseClient } from '@supabase/supabase-js';

import type { Env } from '@config/env.js';
import type { PatientClinicalContent } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';
import {
  ensurePatientClinicalContent,
  updatePsychologistSessionInsights,
} from '@infrastructure/supabase/clinical-content.repository.js';

import { applyAgenticPatternsInsight } from './apply-agentic-patterns-insight.js';
import { applyAgenticRecommendedActionsInsight } from './apply-agentic-recommended-actions-insight.js';
import { generateDetectedPatternsInsight } from './generate-detected-patterns-insight.js';
import { generateRecommendedActionsInsight } from './generate-recommended-actions-insight.js';
import { hasWeeklyPatientChatReports } from './patient-chat-interaction-groups.js';

const currentSessionConsiderations = (
  content: PatientClinicalContent
): string => {
  const currentNote = content.sessionNotes.find(
    (entry) => entry.isCurrent === true
  );
  return currentNote?.content?.trim() ?? '';
};

export const refreshWeeklyAgenticInsights = async (
  env: Env,
  admin: SupabaseClient,
  patientId: string,
  language: AppLanguage = 'pt'
): Promise<PatientClinicalContent> => {
  const content = await ensurePatientClinicalContent(admin, patientId);

  if (!hasWeeklyPatientChatReports(content.patientChatSeed)) {
    return content;
  }

  const sessionContext = content.sessionContext ?? '';
  const sessionConsiderations = currentSessionConsiderations(content);

  const [patternsBody, actionsBody] = await Promise.all([
    generateDetectedPatternsInsight(
      env,
      content.patientChatSeed,
      language,
      sessionContext
    ),
    generateRecommendedActionsInsight(
      env,
      content.patientChatSeed,
      language,
      sessionContext,
      sessionConsiderations
    ),
  ]);

  if (!patternsBody && !actionsBody) {
    return content;
  }

  let sessionInsights = content.sessionInsights;
  sessionInsights = applyAgenticPatternsInsight(
    sessionInsights,
    patternsBody,
    language
  );
  sessionInsights = applyAgenticRecommendedActionsInsight(
    sessionInsights,
    actionsBody,
    language
  );

  return updatePsychologistSessionInsights(admin, patientId, {
    dashboardSnapshot: content.dashboardSnapshot,
    psychologistSummary: content.psychologistSummary,
    sessionInsights,
  });
};
