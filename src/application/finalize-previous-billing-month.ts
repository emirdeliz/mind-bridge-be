import type { SupabaseClient } from '@supabase/supabase-js';

import {
  billingMonthFromDate,
  previousBillingMonth,
} from '@domain/billing-month.js';
import { syncPsychologistBillingMonth } from '@application/sync-psychologist-billing-month.js';
import { listPsychologistIdsWithCareRelationships } from '@infrastructure/supabase/billing.repository.js';

export const finalizePreviousBillingMonth = async (
  admin: SupabaseClient,
  referenceDate = new Date()
): Promise<{ billingMonth: string; psychologistsProcessed: number }> => {
  const previousMonth = previousBillingMonth(billingMonthFromDate(referenceDate));
  const psychologistIds = await listPsychologistIdsWithCareRelationships(admin);

  for (const psychologistId of psychologistIds) {
    await syncPsychologistBillingMonth(admin, psychologistId, previousMonth, {
      finalize: true,
    });
  }

  return {
    billingMonth: previousMonth,
    psychologistsProcessed: psychologistIds.length,
  };
};
