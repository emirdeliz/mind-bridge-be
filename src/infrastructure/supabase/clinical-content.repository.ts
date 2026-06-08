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

const formatSessionDateBr = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export const buildCurrentSessionNote = (): SessionNoteEntry => {
  const now = new Date();
  const sessionDate = formatSessionDateBr(now);
  const isoDate = now.toISOString().slice(0, 10);

  return {
    id: `session-${isoDate}`,
    label: `Sessão ${sessionDate} (atual)`,
    sessionDate,
    content: '',
    isCurrent: true,
  };
};

export const defaultClinicalContentPayload = (): ClinicalContentSeedPayload => ({
  dashboardSnapshot: emptyDashboard(),
  sessionContext: null,
  sessionNotes: [buildCurrentSessionNote()],
  sessionInsights: [],
  psychologistSummary: null,
  psychologistChatSeed: [],
  patientChatSeed: [],
  patientSummary: null,
});

const hasCurrentSessionNote = (notes: SessionNoteEntry[]): boolean =>
  notes.some((entry) => entry.isCurrent === true);

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

export const ensurePatientClinicalContent = async (
  admin: SupabaseClient,
  patientId: string
): Promise<PatientClinicalContent> => {
  const existing = await getPatientClinicalContent(admin, patientId);

  if (!existing) {
    const payload = defaultClinicalContentPayload();
    await upsertPatientClinicalContent(admin, patientId, payload);
    return { patientId, ...payload };
  }

  const notes = existing.sessionNotes ?? [];
  if (hasCurrentSessionNote(notes)) {
    return existing;
  }

  const nextNotes = [buildCurrentSessionNote(), ...notes];
  await upsertPatientClinicalContent(admin, patientId, {
    dashboardSnapshot: existing.dashboardSnapshot,
    sessionContext: existing.sessionContext,
    sessionNotes: nextNotes,
    sessionInsights: existing.sessionInsights,
    psychologistSummary: existing.psychologistSummary,
    psychologistChatSeed: existing.psychologistChatSeed,
    patientChatSeed: existing.patientChatSeed,
    patientSummary: existing.patientSummary,
  });

  return { ...existing, sessionNotes: nextNotes };
};

export type ClinicalContentSeedPayload = Omit<
  PatientClinicalContent,
  'patientId'
>;

export type UpdateClinicalSessionPayload = {
  sessionContext?: string | null;
  currentSessionNoteContent?: string | null;
};

export type EndPsychologistSessionPayload = {
  currentSessionNoteContent?: string | null;
};

export const updatePatientDashboardSnapshot = async (
  admin: SupabaseClient,
  patientId: string,
  dashboardSnapshot: DashboardSnapshot
): Promise<PatientClinicalContent> => {
  const content = await ensurePatientClinicalContent(admin, patientId);

  const nextPayload: ClinicalContentSeedPayload = {
    dashboardSnapshot,
    sessionContext: content.sessionContext,
    sessionNotes: content.sessionNotes,
    sessionInsights: content.sessionInsights,
    psychologistSummary: content.psychologistSummary,
    psychologistChatSeed: content.psychologistChatSeed,
    patientChatSeed: content.patientChatSeed,
    patientSummary: content.patientSummary,
  };

  await upsertPatientClinicalContent(admin, patientId, nextPayload);

  return { patientId, ...nextPayload };
};

export const appendPatientChatMessages = async (
  admin: SupabaseClient,
  patientId: string,
  messages: ClinicalChatMessage[]
): Promise<PatientClinicalContent> => {
  if (!messages.length) {
    return ensurePatientClinicalContent(admin, patientId);
  }

  const content = await ensurePatientClinicalContent(admin, patientId);
  const patientChatSeed = [...content.patientChatSeed, ...messages];

  const nextPayload: ClinicalContentSeedPayload = {
    dashboardSnapshot: content.dashboardSnapshot,
    sessionContext: content.sessionContext,
    sessionNotes: content.sessionNotes,
    sessionInsights: content.sessionInsights,
    psychologistSummary: content.psychologistSummary,
    psychologistChatSeed: content.psychologistChatSeed,
    patientChatSeed,
    patientSummary: content.patientSummary,
  };

  await upsertPatientClinicalContent(admin, patientId, nextPayload);

  return { patientId, ...nextPayload };
};

export const appendPsychologistChatMessages = async (
  admin: SupabaseClient,
  patientId: string,
  messages: ClinicalChatMessage[]
): Promise<PatientClinicalContent> => {
  if (!messages.length) {
    return ensurePatientClinicalContent(admin, patientId);
  }

  const content = await ensurePatientClinicalContent(admin, patientId);
  const psychologistChatSeed = [...content.psychologistChatSeed, ...messages];

  const nextPayload: ClinicalContentSeedPayload = {
    dashboardSnapshot: content.dashboardSnapshot,
    sessionContext: content.sessionContext,
    sessionNotes: content.sessionNotes,
    sessionInsights: content.sessionInsights,
    psychologistSummary: content.psychologistSummary,
    psychologistChatSeed,
    patientChatSeed: content.patientChatSeed,
    patientSummary: content.patientSummary,
  };

  await upsertPatientClinicalContent(admin, patientId, nextPayload);

  return { patientId, ...nextPayload };
};

export const updatePsychologistPatientClinicalSession = async (
  admin: SupabaseClient,
  patientId: string,
  payload: UpdateClinicalSessionPayload
): Promise<PatientClinicalContent> => {
  const content = await ensurePatientClinicalContent(admin, patientId);

  let sessionNotes = [...content.sessionNotes];
  if (payload.currentSessionNoteContent !== undefined) {
    const currentIndex = sessionNotes.findIndex(
      (entry) => entry.isCurrent === true
    );
    if (currentIndex < 0) {
      throw new Error('Current session note not found');
    }
    sessionNotes[currentIndex] = {
      ...sessionNotes[currentIndex],
      content: payload.currentSessionNoteContent ?? '',
    };
  }

  const sessionContext =
    payload.sessionContext !== undefined
      ? payload.sessionContext
      : content.sessionContext;

  const nextPayload: ClinicalContentSeedPayload = {
    dashboardSnapshot: content.dashboardSnapshot,
    sessionContext,
    sessionNotes,
    sessionInsights: content.sessionInsights,
    psychologistSummary: content.psychologistSummary,
    psychologistChatSeed: content.psychologistChatSeed,
    patientChatSeed: content.patientChatSeed,
    patientSummary: content.patientSummary,
  };

  await upsertPatientClinicalContent(admin, patientId, nextPayload);

  return { patientId, ...nextPayload };
};

export const endPsychologistPatientSession = async (
  admin: SupabaseClient,
  patientId: string,
  payload: EndPsychologistSessionPayload,
  dashboardSnapshot: DashboardSnapshot
): Promise<PatientClinicalContent> => {
  const content = await ensurePatientClinicalContent(admin, patientId);

  let sessionNotes = [...content.sessionNotes];
  const currentIndex = sessionNotes.findIndex(
    (entry) => entry.isCurrent === true
  );

  if (currentIndex >= 0) {
    const currentNote = sessionNotes[currentIndex];
    const noteContent =
      payload.currentSessionNoteContent ?? currentNote.content ?? '';

    sessionNotes[currentIndex] = {
      ...currentNote,
      content: noteContent,
      isCurrent: false,
      label: currentNote.label.replace(' (atual)', ''),
    };
  }

  sessionNotes = [buildCurrentSessionNote(), ...sessionNotes];

  const nextPayload: ClinicalContentSeedPayload = {
    dashboardSnapshot,
    sessionContext: content.sessionContext,
    sessionNotes,
    sessionInsights: content.sessionInsights,
    psychologistSummary: content.psychologistSummary,
    psychologistChatSeed: content.psychologistChatSeed,
    patientChatSeed: content.patientChatSeed,
    patientSummary: content.patientSummary,
  };

  await upsertPatientClinicalContent(admin, patientId, nextPayload);

  return { patientId, ...nextPayload };
};

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
