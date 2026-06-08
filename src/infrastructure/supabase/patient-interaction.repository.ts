import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  LogPatientInteractionPayload,
  PatientInteraction,
  PatientInteractionChannel,
  PatientInteractionSource,
} from '@domain/patient-interaction.types.js';

type PatientInteractionRow = {
  id: string;
  patient_id: string;
  channel: PatientInteractionChannel;
  source: PatientInteractionSource;
  mood_score: number | null;
  created_at: string;
};

const mapRow = (row: PatientInteractionRow): PatientInteraction => ({
  id: row.id,
  patientId: row.patient_id,
  channel: row.channel,
  source: row.source,
  moodScore: row.mood_score,
  createdAt: row.created_at,
});

export const logPatientInteraction = async (
  admin: SupabaseClient,
  patientId: string,
  payload: LogPatientInteractionPayload
): Promise<PatientInteraction> => {
  const { data, error } = await admin
    .from('patient_interactions')
    .insert({
      patient_id: patientId,
      channel: payload.channel,
      source: payload.source ?? 'web',
      mood_score: payload.moodScore ?? null,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to log patient interaction: ${error.message}`);
  }

  return mapRow(data as PatientInteractionRow);
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

  return ((data ?? []) as PatientInteractionRow[]).map(mapRow);
};
