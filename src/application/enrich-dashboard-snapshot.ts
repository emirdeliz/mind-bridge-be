import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  ClinicalChatMessage,
  DashboardSnapshot,
} from '@domain/clinical-content.types.js';
import type { LogPatientInteractionPayload } from '@domain/patient-interaction.types.js';
import {
  listPatientInteractionsSince,
  logPatientInteraction,
} from '@infrastructure/supabase/patient-interaction.repository.js';

import { mergePatientMetricsIntoDashboard } from './compute-patient-dashboard-metrics.js';

const backfillFromPatientChatSeed = async (
  admin: SupabaseClient,
  patientId: string,
  chatSeed: ClinicalChatMessage[]
): Promise<void> => {
  const existing = await listPatientInteractionsSince(
    admin,
    patientId,
    new Date(0).toISOString()
  );
  if (existing.length > 0) {
    return;
  }

  for (const message of chatSeed) {
    if (message.sender !== 'user') continue;
    const payload: LogPatientInteractionPayload = {
      channel: 'text',
      source: 'web',
    };
    await admin.from('patient_interactions').insert({
      patient_id: patientId,
      channel: payload.channel,
      source: payload.source ?? 'web',
      mood_score: null,
      created_at: message.createdAt,
    });
  }
};

export const enrichDashboardSnapshotWithPatientActivity = async (
  admin: SupabaseClient,
  patientId: string,
  snapshot: DashboardSnapshot,
  patientChatSeed: ClinicalChatMessage[] = []
): Promise<DashboardSnapshot> => {
  await backfillFromPatientChatSeed(admin, patientId, patientChatSeed);

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const interactions = await listPatientInteractionsSince(
    admin,
    patientId,
    since.toISOString()
  );

  return mergePatientMetricsIntoDashboard(snapshot, interactions);
};

export const recordPatientInteraction = async (
  admin: SupabaseClient,
  patientId: string,
  payload: LogPatientInteractionPayload
) => logPatientInteraction(admin, patientId, payload);
