import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  LogPatientInteractionPayload,
  PatientInteraction,
} from '@domain/patient-interaction.types.js';
import { keysToCamel, listKeysToCamel, toSnakeRecord } from '@helpers';

export const logPatientInteraction = async (
  admin: SupabaseClient,
  patientId: string,
  payload: LogPatientInteractionPayload
): Promise<PatientInteraction> => {
  const { data, error } = await admin
    .from('patient_interactions')
    .insert(
      toSnakeRecord({
        patientId,
        channel: payload.channel,
        source: payload.source ?? 'web',
        moodScore: payload.moodScore ?? null,
      })
    )
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to log patient interaction: ${error.message}`);
  }

  return keysToCamel<PatientInteraction>(data);
};

export const listPatientInteractionsSince = async (
  admin: SupabaseClient,
  patientId: string,
  sinceIso: string
): Promise<PatientInteraction[]> => {
  const { data, error } = await admin
    .from('patient_interactions')
    .select('*')
    .eq('patient_id', patientId)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to list patient interactions: ${error.message}`);
  }

  return listKeysToCamel<PatientInteraction>(data ?? []);
};
