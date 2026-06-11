import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  ClinicalChatMessage,
  DashboardSnapshot,
  LikertCheckIn,
  LikertDimensionId,
  PatientAnamnesis,
  PatientClinicalContent,
  SessionInsight,
  SessionNoteEntry,
} from '@domain/clinical-content.types.js';
import { emptyPatientAnamnesis } from '@domain/clinical-content.types.js';
import { keysToCamel, toSnakeRecord } from '@helpers';

const normalizeAnamnesis = (value: Partial<PatientAnamnesis> | null | undefined): PatientAnamnesis => ({
  ...emptyPatientAnamnesis(),
  ...(value ?? {}),
});

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

const formatSessionTimeBr = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

export const buildCurrentSessionNote = (): SessionNoteEntry => {
  const now = new Date();
  const sessionDate = formatSessionDateBr(now);
  const sessionTime = formatSessionTimeBr(now);

  return {
    id: `session-${now.toISOString().replace(/[:.]/g, '-')}`,
    label: `Sessão ${sessionDate} ${sessionTime} (atual)`,
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
  likertCheckIn: null,
  anamnesis: emptyPatientAnamnesis(),
});

const hasCurrentSessionNote = (notes: SessionNoteEntry[]): boolean =>
  notes.some((entry) => entry.isCurrent === true);

const mapRow = (row: unknown): PatientClinicalContent => {
  const record = keysToCamel<PatientClinicalContent>(row);
  return {
    ...record,
    dashboardSnapshot: record.dashboardSnapshot ?? emptyDashboard(),
    sessionNotes: record.sessionNotes ?? [],
    sessionInsights: record.sessionInsights ?? [],
    psychologistChatSeed: record.psychologistChatSeed ?? [],
    patientChatSeed: record.patientChatSeed ?? [],
    likertCheckIn: record.likertCheckIn ?? null,
    anamnesis: normalizeAnamnesis(record.anamnesis),
  };
};

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

  return mapRow(data);
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
    anamnesis: existing.anamnesis,
  });

  return { ...existing, sessionNotes: nextNotes };
};

export type ClinicalContentSeedPayload = Omit<
  PatientClinicalContent,
  'patientId' | 'likertCheckIn'
> & {
  likertCheckIn?: LikertCheckIn | null;
};

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
    anamnesis: content.anamnesis,
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
    anamnesis: content.anamnesis,
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
    anamnesis: content.anamnesis,
  };

  await upsertPatientClinicalContent(admin, patientId, nextPayload);

  return { patientId, ...nextPayload };
};

export type UpdatePsychologistSessionInsightsPayload = {
  dashboardSnapshot?: DashboardSnapshot;
  psychologistSummary: string | null;
  sessionInsights: SessionInsight[];
};

export const updatePatientInteractionSummary = async (
  admin: SupabaseClient,
  patientId: string,
  patientSummary: string | null
): Promise<PatientClinicalContent> => {
  const content = await ensurePatientClinicalContent(admin, patientId);

  const nextPayload: ClinicalContentSeedPayload = {
    dashboardSnapshot: content.dashboardSnapshot,
    sessionContext: content.sessionContext,
    sessionNotes: content.sessionNotes,
    sessionInsights: content.sessionInsights,
    psychologistSummary: patientSummary,
    psychologistChatSeed: content.psychologistChatSeed,
    patientChatSeed: content.patientChatSeed,
    patientSummary,
    anamnesis: content.anamnesis,
  };

  await upsertPatientClinicalContent(admin, patientId, nextPayload);

  return { patientId, ...nextPayload };
};

export const updatePsychologistSessionInsights = async (
  admin: SupabaseClient,
  patientId: string,
  payload: UpdatePsychologistSessionInsightsPayload
): Promise<PatientClinicalContent> => {
  const content = await ensurePatientClinicalContent(admin, patientId);

  const nextPayload: ClinicalContentSeedPayload = {
    dashboardSnapshot: payload.dashboardSnapshot ?? content.dashboardSnapshot,
    sessionContext: content.sessionContext,
    sessionNotes: content.sessionNotes,
    sessionInsights: payload.sessionInsights,
    psychologistSummary: payload.psychologistSummary,
    psychologistChatSeed: content.psychologistChatSeed,
    patientChatSeed: content.patientChatSeed,
    patientSummary: content.patientSummary,
    anamnesis: content.anamnesis,
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
    anamnesis: content.anamnesis,
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
    psychologistChatSeed: [],
    patientChatSeed: content.patientChatSeed,
    patientSummary: content.patientSummary,
    anamnesis: content.anamnesis,
  };

  await upsertPatientClinicalContent(admin, patientId, nextPayload);

  return { patientId, ...nextPayload };
};

export const updatePsychologistPatientAnamnesis = async (
  admin: SupabaseClient,
  patientId: string,
  anamnesis: PatientAnamnesis
): Promise<PatientClinicalContent> => {
  const content = await ensurePatientClinicalContent(admin, patientId);

  const nextPayload: ClinicalContentSeedPayload = {
    dashboardSnapshot: content.dashboardSnapshot,
    sessionContext: content.sessionContext,
    sessionNotes: content.sessionNotes,
    sessionInsights: content.sessionInsights,
    psychologistSummary: content.psychologistSummary,
    psychologistChatSeed: content.psychologistChatSeed,
    patientChatSeed: content.patientChatSeed,
    patientSummary: content.patientSummary,
    anamnesis: normalizeAnamnesis(anamnesis),
  };

  await upsertPatientClinicalContent(admin, patientId, nextPayload);

  return { patientId, ...nextPayload };
};

export const upsertPatientClinicalContent = async (
  admin: SupabaseClient,
  patientId: string,
  payload: ClinicalContentSeedPayload
): Promise<void> => {
  const existing = await getPatientClinicalContent(admin, patientId);
  const likertCheckIn =
    payload.likertCheckIn !== undefined
      ? payload.likertCheckIn
      : (existing?.likertCheckIn ?? null);
  const anamnesis =
    payload.anamnesis !== undefined
      ? normalizeAnamnesis(payload.anamnesis)
      : normalizeAnamnesis(existing?.anamnesis);

  const { error } = await admin.from('patient_clinical_content').upsert(
    toSnakeRecord({
      patientId,
      dashboardSnapshot: payload.dashboardSnapshot,
      sessionContext: payload.sessionContext,
      sessionNotes: payload.sessionNotes,
      sessionInsights: payload.sessionInsights,
      psychologistSummary: payload.psychologistSummary,
      psychologistChatSeed: payload.psychologistChatSeed,
      patientChatSeed: payload.patientChatSeed,
      patientSummary: payload.patientSummary,
      likertCheckIn,
      anamnesis,
      updatedAt: new Date().toISOString(),
    }),
    { onConflict: 'patient_id' }
  );

  if (error) {
    throw new Error(`Failed to upsert clinical content: ${error.message}`);
  }
};

export const updatePatientLikertCheckIn = async (
  admin: SupabaseClient,
  patientId: string,
  scores: Partial<Record<LikertDimensionId, number>>
): Promise<PatientClinicalContent> => {
  const content = await ensurePatientClinicalContent(admin, patientId);
  const likertCheckIn: LikertCheckIn = {
    scores,
    updatedAt: new Date().toISOString(),
  };

  const nextPayload: ClinicalContentSeedPayload = {
    dashboardSnapshot: content.dashboardSnapshot,
    sessionContext: content.sessionContext,
    sessionNotes: content.sessionNotes,
    sessionInsights: content.sessionInsights,
    psychologistSummary: content.psychologistSummary,
    psychologistChatSeed: content.psychologistChatSeed,
    patientChatSeed: content.patientChatSeed,
    patientSummary: content.patientSummary,
    likertCheckIn,
    anamnesis: content.anamnesis,
  };

  await upsertPatientClinicalContent(admin, patientId, nextPayload);

  return { patientId, ...nextPayload };
};
