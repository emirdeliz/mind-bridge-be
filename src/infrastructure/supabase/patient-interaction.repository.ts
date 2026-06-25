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

const AI_AGENT_INTERACTION_CHANNELS = ['text', 'audio'] as const;

export const countAiAgentInteractionsByPatientsSince = async (
  admin: SupabaseClient,
  patientIds: string[],
  sinceIso: string
): Promise<Map<string, number>> => {
  const counts = new Map<string, number>();
  for (const patientId of patientIds) {
    counts.set(patientId, 0);
  }

  if (!patientIds.length) {
    return counts;
  }

  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await admin
      .from('patient_interactions')
      .select('patient_id')
      .in('patient_id', patientIds)
      .in('channel', [...AI_AGENT_INTERACTION_CHANNELS])
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(
        `Failed to count patient AI interactions: ${error.message}`
      );
    }

    const rows = data ?? [];
    if (!rows.length) {
      break;
    }

    for (const row of rows) {
      const patientId = row.patient_id as string;
      counts.set(patientId, (counts.get(patientId) ?? 0) + 1);
    }

    if (rows.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return counts;
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
