import type { SupabaseClient } from '@supabase/supabase-js';

import type { PatientClinicalContent } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';
import {
  ensurePatientClinicalContent,
  updatePatientInteractionSummary,
} from '@infrastructure/supabase/clinical-content.repository.js';

import { buildPatientInteractionSummary } from './generate-patient-interaction-summary.js';

export const refreshPatientInteractionSummary = async (
  admin: SupabaseClient,
  patientId: string,
  language: AppLanguage = 'pt'
): Promise<PatientClinicalContent> => {
  const content = await ensurePatientClinicalContent(admin, patientId);
  const patientSummary = buildPatientInteractionSummary(
    content.patientChatSeed,
    language
  );

  return updatePatientInteractionSummary(admin, patientId, patientSummary);
};
