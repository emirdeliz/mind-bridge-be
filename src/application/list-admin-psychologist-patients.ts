import type { SupabaseClient } from '@supabase/supabase-js';

import type { AdminPatientInteractionPeriod } from '@domain/admin-patient-interaction-period.js';
import { resolveAdminPatientInteractionSinceIso } from '@domain/admin-patient-interaction-period.js';
import type { AdminPsychologistPatientListItem } from '@domain/admin.types.js';
import { countAiAgentInteractionsByPatientsSince } from '@infrastructure/supabase/patient-interaction.repository.js';
import { listPatientsForPsychologist } from '@infrastructure/supabase/patient.repository.js';

export const listAdminPsychologistPatients = async (
  admin: SupabaseClient,
  psychologistId: string,
  options: {
    name?: string;
    includeDeleted?: boolean;
    interactionPeriod: AdminPatientInteractionPeriod;
  }
): Promise<{
  patients: AdminPsychologistPatientListItem[];
  interactionPeriod: AdminPatientInteractionPeriod;
}> => {
  const patients = await listPatientsForPsychologist(admin, psychologistId, {
    name: options.name,
    includeDeleted: options.includeDeleted ?? false,
  });

  const sinceIso = resolveAdminPatientInteractionSinceIso(
    options.interactionPeriod
  );
  const interactionCounts = await countAiAgentInteractionsByPatientsSince(
    admin,
    patients.map((patient) => patient.id),
    sinceIso
  );

  return {
    interactionPeriod: options.interactionPeriod,
    patients: patients.map((patient) => ({
      ...patient,
      aiInteractionCount: interactionCounts.get(patient.id) ?? 0,
    })),
  };
};
