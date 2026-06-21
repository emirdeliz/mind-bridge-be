import type { SupabaseClient } from '@supabase/supabase-js';

import type { Env } from '@config/env.js';
import type { PatientClinicalContent } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';
import { ensurePatientClinicalContent } from '@infrastructure/supabase/clinical-content.repository.js';

import { PATTERNS_INSIGHT_TITLES } from './apply-agentic-patterns-insight.js';
import { RECOMMENDED_ACTIONS_INSIGHT_TITLES } from './apply-agentic-recommended-actions-insight.js';
import { countPatientUserMessagesInContent } from './patient-chat-message-count.js';
import { hasWeeklyPatientChatReports } from './patient-chat-interaction-groups.js';
import { refreshPatientInteractionSummary } from './refresh-patient-interaction-summary.js';
import { refreshPsychologistSessionInsights } from './refresh-psychologist-session-insights.js';
import { refreshWeeklyAgenticInsights } from './refresh-weekly-agentic-insights.js';

const hasPatientChatReports = (content: PatientClinicalContent): boolean =>
  content.patientChatSeed.some((message) => message.sender === 'user');

const hasPsychologistSessionActivity = (
  content: PatientClinicalContent
): boolean =>
  content.psychologistChatSeed.length > 0 ||
  content.sessionNotes.some((note) => note.isCurrent && note.content?.trim());

const AGENTIC_PENDING_MARKERS = [
  'pendente',
  'pending',
  'aguardando',
  'pendiente',
];

const isAgenticInsightPending = (body: string | undefined): boolean => {
  const trimmed = body?.trim() ?? '';
  if (!trimmed) {
    return true;
  }

  const lower = trimmed.toLowerCase();
  return AGENTIC_PENDING_MARKERS.some((marker) => lower.includes(marker));
};

const findInsightBodyByTitle = (
  content: PatientClinicalContent,
  title: string
): string | undefined =>
  content.sessionInsights.find((insight) => insight.title.trim() === title)
    ?.body;

const hasTruncatedSummaryLines = (summary: string): boolean =>
  summary
    .split(/\r?\n+/)
    .some((line) => /…\s*$/.test(line.trim()) || /\.\.\.\s*$/.test(line.trim()));

/** Refresh only when summary is missing or patient chat has new user messages. */
export const needsPatientInteractionSummaryRefresh = (
  content: PatientClinicalContent
): boolean => {
  if (!hasPatientChatReports(content)) {
    return false;
  }

  const currentCount = countPatientUserMessagesInContent(content);
  const summaryCount = content.patientSummaryUserMessageCount ?? 0;
  const summary = content.patientSummary?.trim() ?? '';

  if (!summary) {
    return true;
  }

  if (hasTruncatedSummaryLines(summary)) {
    return true;
  }

  return currentCount > summaryCount;
};

export const needsPsychologistSessionInsightsRefresh = (
  content: PatientClinicalContent
): boolean => {
  if (
    !hasPatientChatReports(content) &&
    !hasPsychologistSessionActivity(content)
  ) {
    return false;
  }

  return (
    !content.psychologistSummary?.trim() ||
    !content.sessionInsights?.length ||
    hasTruncatedSummaryLines(content.psychologistSummary)
  );
};

export const needsWeeklyAgenticInsightsRefresh = (
  content: PatientClinicalContent,
  language: AppLanguage
): boolean => {
  if (!hasWeeklyPatientChatReports(content.patientChatSeed)) {
    return false;
  }

  if (!content.sessionInsights?.length) {
    return false;
  }

  const patternsTitle = PATTERNS_INSIGHT_TITLES[language];
  const actionsTitle = RECOMMENDED_ACTIONS_INSIGHT_TITLES[language];
  const patternsBody = findInsightBodyByTitle(content, patternsTitle);
  const actionsBody = findInsightBodyByTitle(content, actionsTitle);

  return (
    isAgenticInsightPending(patternsBody) ||
    isAgenticInsightPending(actionsBody)
  );
};

export const ensureClinicalInsightsOnRead = async (
  env: Env,
  admin: SupabaseClient,
  patientId: string,
  language: AppLanguage,
  options: { includePsychologistInsights?: boolean } = {}
): Promise<PatientClinicalContent> => {
  let content = await ensurePatientClinicalContent(admin, patientId);

  if (needsPatientInteractionSummaryRefresh(content)) {
    content = await refreshPatientInteractionSummary(
      env,
      admin,
      patientId,
      language
    );
  }

  if (options.includePsychologistInsights) {
    if (needsPsychologistSessionInsightsRefresh(content)) {
      content = await refreshPsychologistSessionInsights(
        env,
        admin,
        patientId,
        language
      );
    } else if (needsWeeklyAgenticInsightsRefresh(content, language)) {
      content = await refreshWeeklyAgenticInsights(
        env,
        admin,
        patientId,
        language
      );
    }
  }

  return content;
};
