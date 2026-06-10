import type { SupabaseClient } from '@supabase/supabase-js';

import type { Env } from '@config/env.js';
import type { PatientClinicalContent } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';
import { ensurePatientClinicalContent } from '@infrastructure/supabase/clinical-content.repository.js';

import { hasWeeklyPatientChatReports } from './patient-chat-interaction-groups.js';
import { refreshPatientInteractionSummary } from './refresh-patient-interaction-summary.js';
import { refreshPsychologistSessionInsights } from './refresh-psychologist-session-insights.js';
import { refreshWeeklyAgenticInsights } from './refresh-weekly-agentic-insights.js';

const hasPatientChatReports = (content: PatientClinicalContent): boolean =>
  content.patientChatSeed.some((message) => message.sender === 'user');

const hasPsychologistSessionActivity = (
  content: PatientClinicalContent
): boolean =>
  content.psychologistChatSeed.length > 0 ||
  content.sessionNotes.some((note) => note.isCurrent && note.content?.trim());

/** Rebuild when patient chatted — summary is cheap and must reflect all conversations. */
export const needsPatientInteractionSummaryRefresh = (
  content: PatientClinicalContent
): boolean => hasPatientChatReports(content);

export const needsPsychologistSessionInsightsRefresh = (
  content: PatientClinicalContent
): boolean => {
  if (!hasPatientChatReports(content) && !hasPsychologistSessionActivity(content)) {
    return false;
  }

  return (
    !content.psychologistSummary?.trim() || !content.sessionInsights?.length
  );
};

export const ensureClinicalInsightsOnRead = async (
  env: Env,
  admin: SupabaseClient,
  patientId: string,
  language: AppLanguage,
  options: { includePsychologistInsights?: boolean } = {}
): Promise<PatientClinicalContent> => {
  let content = await ensurePatientClinicalContent(admin, patientId);

  if (needsPatientInteractionSummaryRefresh(content)) {
    content = await refreshPatientInteractionSummary(
      env,
      admin,
      patientId,
      language
    );
  }

  if (options.includePsychologistInsights) {
    if (needsPsychologistSessionInsightsRefresh(content)) {
      content = await refreshPsychologistSessionInsights(
        env,
        admin,
        patientId,
        language
      );
    } else if (hasWeeklyPatientChatReports(content.patientChatSeed)) {
      content = await refreshWeeklyAgenticInsights(
        env,
        admin,
        patientId,
        language
      );
    }
  }

  return content;
};
