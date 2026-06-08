import type { SupabaseClient } from '@supabase/supabase-js';

import type { Env } from '@config/env.js';
import type { PatientClinicalContent } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';
import {
  endPsychologistPatientSession,
  ensurePatientClinicalContent,
  type EndPsychologistSessionPayload,
} from '@infrastructure/supabase/clinical-content.repository.js';

import { generateDashboardSnapshotAfterSession } from './generate-dashboard-snapshot.js';

export const endPsychologistSession = async (
  env: Env,
  admin: SupabaseClient,
  patientId: string,
  payload: EndPsychologistSessionPayload,
  language: AppLanguage = 'pt'
): Promise<PatientClinicalContent> => {
  const content = await ensurePatientClinicalContent(admin, patientId);

  const currentNote = content.sessionNotes.find(
    (entry) => entry.isCurrent === true
  );
  const sessionConsiderations =
    payload.currentSessionNoteContent ?? currentNote?.content ?? '';

  const dashboardSnapshot = await generateDashboardSnapshotAfterSession(env, {
    currentSnapshot: content.dashboardSnapshot,
    sessionConsiderations,
    sessionContext: content.sessionContext ?? '',
    chatHistory: content.psychologistChatSeed,
    language,
  });

  return endPsychologistPatientSession(
    admin,
    patientId,
    payload,
    dashboardSnapshot
  );
};
