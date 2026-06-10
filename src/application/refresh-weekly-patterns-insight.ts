import type { SupabaseClient } from '@supabase/supabase-js';

import type { Env } from '@config/env.js';
import type { PatientClinicalContent } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';
import {
  ensurePatientClinicalContent,
  updatePsychologistSessionInsights,
} from '@infrastructure/supabase/clinical-content.repository.js';

import { generateDetectedPatternsInsight } from './generate-detected-patterns-insight.js';
import { hasWeeklyPatientChatReports } from './patient-chat-interaction-groups.js';
import { applyAgenticPatternsInsight } from './apply-agentic-patterns-insight.js';

export const refreshWeeklyPatternsInsight = async (
  env: Env,
  admin: SupabaseClient,
  patientId: string,
  language: AppLanguage = 'pt'
): Promise<PatientClinicalContent> => {
  const content = await ensurePatientClinicalContent(admin, patientId);

  if (!hasWeeklyPatientChatReports(content.patientChatSeed)) {
    return content;
  }

  const patternsBody = await generateDetectedPatternsInsight(
    env,
    content.patientChatSeed,
    language,
    content.sessionContext ?? ''
  );

  if (!patternsBody) {
    return content;
  }

  const sessionInsights = applyAgenticPatternsInsight(
    content.sessionInsights,
    patternsBody,
    language
  );

  return updatePsychologistSessionInsights(admin, patientId, {
    dashboardSnapshot: content.dashboardSnapshot,
    psychologistSummary: content.psychologistSummary,
    sessionInsights,
  });
};
