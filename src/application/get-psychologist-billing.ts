import type { SupabaseClient } from '@supabase/supabase-js';

import { computePsychologistBillingAmounts } from '@application/compute-psychologist-billing-amounts.js';
import { syncPsychologistBillingMonth } from '@application/sync-psychologist-billing-month.js';
import { currentBillingMonth } from '@domain/billing-month.js';
import type { PsychologistBillingSummary } from '@domain/billing.types.js';
import {
  countBillablePatientsForPsychologistMonth,
  countEnabledPatientsForPsychologist,
  getBillingPlatformPricing,
  getPsychologistBillingDiscount,
  listPsychologistBillingMonthly,
} from '@infrastructure/supabase/billing.repository.js';

export const getPsychologistBilling = async (
  admin: SupabaseClient,
  psychologistId: string
): Promise<PsychologistBillingSummary> => {
  const billingMonth = currentBillingMonth();

  await syncPsychologistBillingMonth(admin, psychologistId, billingMonth);

  const [pricing, discount, billablePatientCount, currentlyEnabledPatientCount] =
    await Promise.all([
      getBillingPlatformPricing(admin),
      getPsychologistBillingDiscount(admin, psychologistId),
      countBillablePatientsForPsychologistMonth(
        admin,
        psychologistId,
        billingMonth
      ),
      countEnabledPatientsForPsychologist(admin, psychologistId),
    ]);

  const discountPercent = discount?.discountPercent ?? 0;
  const { grossAmountCents, discountAmountCents, netAmountCents } =
    computePsychologistBillingAmounts(
      billablePatientCount,
      pricing.pricePerPatientCents,
      discountPercent
    );

  const history = await listPsychologistBillingMonthly(admin, psychologistId);

  return {
    enabledPatientCount: billablePatientCount,
    currentlyEnabledPatientCount,
    unitPriceCents: pricing.pricePerPatientCents,
    currency: pricing.currency,
    grossAmountCents,
    discount,
    discountAmountCents,
    netAmountCents,
    history,
  };
};
