import type { SupabaseClient } from '@supabase/supabase-js';

import type { Env } from '@config/env.js';
import type { AppLanguage } from '@domain/types.js';
import {
  ensurePatientClinicalContent,
  updatePatientDashboardSnapshot,
} from '@infrastructure/supabase/clinical-content.repository.js';

import { refreshPatientInteractionSummary } from './refresh-patient-interaction-summary.js';
import { refreshPsychologistSessionInsights } from './refresh-psychologist-session-insights.js';
import { updateMoodFromPatientChat } from './update-mood-from-patient-chat.js';

export type ProcessPatientChatSideEffectsInput = {
  patientId: string;
  userMessage: string;
  language: AppLanguage;
  isInteractionEnd: boolean;
};

/** Atualiza humor, resumo e insights sem bloquear a resposta do chat. */
export const processPatientChatSideEffects = async (
  env: Env,
  admin: SupabaseClient,
  input: ProcessPatientChatSideEffectsInput
): Promise<void> => {
  const content = await ensurePatientClinicalContent(admin, input.patientId);

  const moodSnapshot = await updateMoodFromPatientChat(env, {
    currentSnapshot: content.dashboardSnapshot,
    userMessage: input.userMessage,
    chatHistory: content.patientChatSeed,
    language: input.language,
    useHeuristicOnly: true,
  });
  await updatePatientDashboardSnapshot(admin, input.patientId, moodSnapshot);

  const refreshedContent = await refreshPatientInteractionSummary(
    env,
    admin,
    input.patientId,
    input.language
  );

  if (input.isInteractionEnd) {
    await refreshPsychologistSessionInsights(
      env,
      admin,
      input.patientId,
      input.language,
      { existingPatientSummary: refreshedContent.patientSummary }
    );
  }
};
