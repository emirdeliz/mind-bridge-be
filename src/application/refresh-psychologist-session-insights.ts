import type { SupabaseClient } from '@supabase/supabase-js';

import type { Env } from '@config/env.js';
import type { PatientClinicalContent } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';
import {
  ensurePatientClinicalContent,
  updatePsychologistSessionInsights,
} from '@infrastructure/supabase/clinical-content.repository.js';

import { enrichDashboardSnapshotWithPatientActivity } from './enrich-dashboard-snapshot.js';
import { generatePsychologistSessionInsights } from './generate-psychologist-session-insights.js';

const currentSessionConsiderations = (
  content: PatientClinicalContent
): string => {
  const currentNote = content.sessionNotes.find(
    (entry) => entry.isCurrent === true
  );
  return currentNote?.content?.trim() ?? '';
};

export const refreshPsychologistSessionInsights = async (
  env: Env,
  admin: SupabaseClient,
  patientId: string,
  language: AppLanguage = 'pt'
): Promise<PatientClinicalContent> => {
  const content = await ensurePatientClinicalContent(admin, patientId);
  const dashboardSnapshot = await enrichDashboardSnapshotWithPatientActivity(
    admin,
    patientId,
    content.dashboardSnapshot,
    content.patientChatSeed
  );

  const generated = await generatePsychologistSessionInsights(env, {
    dashboardSnapshot,
    sessionConsiderations: currentSessionConsiderations(content),
    sessionContext: content.sessionContext ?? '',
    chatHistory: content.psychologistChatSeed,
    language,
  });

  if (!generated) {
    return { ...content, dashboardSnapshot };
  }

  return updatePsychologistSessionInsights(admin, patientId, {
    dashboardSnapshot,
    psychologistSummary: generated.psychologistSummary,
    sessionInsights: generated.sessionInsights,
  });
};
