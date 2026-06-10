import type { SupabaseClient } from '@supabase/supabase-js';

import { computePsychologistBillingAmounts } from '@application/compute-psychologist-billing-amounts.js';
import {
  countBillablePatientsForPsychologistMonth,
  getBillingPlatformPricing,
  getPsychologistBillingDiscount,
  getPsychologistBillingMonthlyEntry,
  upsertPsychologistBillingMonthly,
} from '@infrastructure/supabase/billing.repository.js';

export const syncPsychologistBillingMonth = async (
  admin: SupabaseClient,
  psychologistId: string,
  billingMonth: string,
  options?: { finalize?: boolean }
): Promise<void> => {
  const existing = await getPsychologistBillingMonthlyEntry(
    admin,
    psychologistId,
    billingMonth
  );

  if (existing?.isFinalized) {
    return;
  }

  const [pricing, discount, billablePatientCount] = await Promise.all([
    getBillingPlatformPricing(admin),
    getPsychologistBillingDiscount(admin, psychologistId),
    countBillablePatientsForPsychologistMonth(
      admin,
      psychologistId,
      billingMonth
    ),
  ]);

  const discountPercent = discount?.discountPercent ?? 0;
  const { grossAmountCents, discountAmountCents, netAmountCents } =
    computePsychologistBillingAmounts(
      billablePatientCount,
      pricing.pricePerPatientCents,
      discountPercent
    );

  await upsertPsychologistBillingMonthly(admin, psychologistId, {
    billingMonth,
    enabledPatientCount: billablePatientCount,
    unitPriceCents: pricing.pricePerPatientCents,
    grossAmountCents,
    discountPercent,
    discountAmountCents,
    netAmountCents,
    isFinalized: options?.finalize ?? false,
  });
};
