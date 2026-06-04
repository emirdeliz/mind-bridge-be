import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  ClinicalChatMessage,
  DashboardSnapshot,
  PatientClinicalContent,
  SessionInsight,
  SessionNoteEntry,
} from '@domain/clinical-content.types.js';

type ClinicalContentRow = {
  patient_id: string;
  dashboard_snapshot: DashboardSnapshot | null;
  session_context: string | null;
  session_notes: SessionNoteEntry[] | null;
  session_insights: SessionInsight[] | null;
  psychologist_summary: string | null;
  psychologist_chat_seed: ClinicalChatMessage[] | null;
  patient_chat_seed: ClinicalChatMessage[] | null;
  patient_summary: string | null;
};

const emptyDashboard = (): DashboardSnapshot => ({
  moodTrendCategories: [],
  moodTrendSeries: [],
  weeklyInteractionCategories: [],
  weeklyInteractionSeries: [],
  interactionChannels: [],
  moodDiaryAdherencePercent: 0,
  clinicalThemeCategories: [],
  clinicalThemeSeries: [],
  lastUpdatedAt: new Date().toISOString(),
});

const mapRow = (row: ClinicalContentRow): PatientClinicalContent => ({
  patientId: row.patient_id,
  dashboardSnapshot: row.dashboard_snapshot ?? emptyDashboard(),
  sessionContext: row.session_context,
  sessionNotes: row.session_notes ?? [],
  sessionInsights: row.session_insights ?? [],
  psychologistSummary: row.psychologist_summary,
  psychologistChatSeed: row.psychologist_chat_seed ?? [],
  patientChatSeed: row.patient_chat_seed ?? [],
  patientSummary: row.patient_summary,
});

export const getPatientClinicalContent = async (
  client: SupabaseClient,
  patientId: string
): Promise<PatientClinicalContent | null> => {
  const { data, error } = await client
    .from('patient_clinical_content')
    .select('*')
    .eq('patient_id', patientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load clinical content: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapRow(data as ClinicalContentRow);
};

export type ClinicalContentSeedPayload = Omit<
  PatientClinicalContent,
  'patientId'
>;

export const upsertPatientClinicalContent = async (
  admin: SupabaseClient,
  patientId: string,
  payload: ClinicalContentSeedPayload
): Promise<void> => {
  const { error } = await admin.from('patient_clinical_content').upsert(
    {
      patient_id: patientId,
      dashboard_snapshot: payload.dashboardSnapshot,
      session_context: payload.sessionContext,
      session_notes: payload.sessionNotes,
      session_insights: payload.sessionInsights,
      psychologist_summary: payload.psychologistSummary,
      psychologist_chat_seed: payload.psychologistChatSeed,
      patient_chat_seed: payload.patientChatSeed,
      patient_summary: payload.patientSummary,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'patient_id' }
  );

  if (error) {
    throw new Error(`Failed to upsert clinical content: ${error.message}`);
  }
};
