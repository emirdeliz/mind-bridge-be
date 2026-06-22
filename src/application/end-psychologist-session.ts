import type { SupabaseClient } from '@supabase/supabase-js';

import type { Env } from '@config/env.js';
import type { PatientClinicalContent } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';
import {
  endPsychologistPatientSession,
  ensurePatientClinicalContent,
  type EndPsychologistSessionPayload,
} from '@infrastructure/supabase/clinical-content.repository.js';
import { updatePatientLastConsultationAt } from '@infrastructure/supabase/patient.repository.js';

import { enrichDashboardSnapshotWithPatientActivity } from './enrich-dashboard-snapshot.js';
import { generateDashboardSnapshotAfterSession } from './generate-dashboard-snapshot.js';

export const endPsychologistSession = async (
  env: Env,
  admin: SupabaseClient,
  psychologistId: string,
  patientId: string,
  payload: EndPsychologistSessionPayload,
  language: AppLanguage = 'pt'
): Promise<PatientClinicalContent> => {
  const content = await ensurePatientClinicalContent(admin, patientId);

  const currentNote = content.sessionNotes.find(
    (entry) => entry.isCurrent === true
  );
  const sessionConsiderations = (
    payload.currentSessionNoteContent !== undefined &&
    payload.currentSessionNoteContent !== null
      ? payload.currentSessionNoteContent
      : (currentNote?.content ?? '')
  ).trim();

  const aiSnapshot = await generateDashboardSnapshotAfterSession(env, {
    currentSnapshot: content.dashboardSnapshot,
    sessionConsiderations,
    sessionContext: content.sessionContext ?? '',
    chatHistory: content.psychologistChatSeed,
    language,
  });

  const dashboardSnapshot = await enrichDashboardSnapshotWithPatientActivity(
    admin,
    patientId,
    aiSnapshot,
    content.patientChatSeed
  );

  const endedContent = await endPsychologistPatientSession(
    admin,
    patientId,
    payload,
    dashboardSnapshot
  );

  await updatePatientLastConsultationAt(
    admin,
    psychologistId,
    patientId,
    new Date().toISOString()
  );

  return endedContent;
};
