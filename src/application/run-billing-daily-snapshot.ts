import type { SupabaseClient } from '@supabase/supabase-js';

import { billingMonthFromDate } from '@domain/billing-month.js';
import { syncPsychologistBillingMonth } from '@application/sync-psychologist-billing-month.js';
import {
  countEnabledPatientsForPsychologist,
  listEnabledPatientIdsForPsychologist,
  listPsychologistIdsWithCareRelationships,
  upsertPsychologistBillingDailySnapshot,
} from '@infrastructure/supabase/billing.repository.js';

const snapshotDateFromDate = (date: Date): string => {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-${day}`;
};

export const runBillingDailySnapshot = async (
  admin: SupabaseClient,
  referenceDate = new Date()
): Promise<{ psychologistsProcessed: number }> => {
  const snapshotDate = snapshotDateFromDate(referenceDate);
  const billingMonth = billingMonthFromDate(referenceDate);
  const psychologistIds = await listPsychologistIdsWithCareRelationships(admin);

  for (const psychologistId of psychologistIds) {
    const [enabledPatientCount, patientIds] = await Promise.all([
      countEnabledPatientsForPsychologist(admin, psychologistId),
      listEnabledPatientIdsForPsychologist(admin, psychologistId),
    ]);

    await upsertPsychologistBillingDailySnapshot(
      admin,
      psychologistId,
      snapshotDate,
      enabledPatientCount,
      patientIds
    );

    await syncPsychologistBillingMonth(admin, psychologistId, billingMonth);
  }

  return { psychologistsProcessed: psychologistIds.length };
};
