import type { SupabaseClient } from '@supabase/supabase-js';

import type { Env } from '@config/env.js';
import type { PatientClinicalContent } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';
import {
  ensurePatientClinicalContent,
  updatePatientInteractionSummary,
} from '@infrastructure/supabase/clinical-content.repository.js';

import { countPatientUserMessagesInContent } from './patient-chat-message-count.js';
import { generatePatientInteractionSummary } from './generate-patient-interaction-summary.js';

export const refreshPatientInteractionSummary = async (
  env: Env,
  admin: SupabaseClient,
  patientId: string,
  language: AppLanguage = 'pt'
): Promise<PatientClinicalContent> => {
  const content = await ensurePatientClinicalContent(admin, patientId);
  const patientSummary = await generatePatientInteractionSummary(
    env,
    content.patientChatSeed,
    language,
    content.sessionContext ?? ''
  );
  const userMessageCount = countPatientUserMessagesInContent(content);

  return updatePatientInteractionSummary(
    admin,
    patientId,
    patientSummary,
    userMessageCount
  );
};
