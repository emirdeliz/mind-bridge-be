import type { SupabaseClient } from '@supabase/supabase-js';

import type { PsychologistBillingSummary } from '@domain/billing.types.js';
import {
  countEnabledPatientsForPsychologist,
  getBillingPlatformPricing,
  getPsychologistBillingDiscount,
  listPsychologistBillingMonthly,
  upsertPsychologistBillingMonthly,
} from '@infrastructure/supabase/billing.repository.js';

const currentBillingMonth = (): string => {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${now.getUTCFullYear()}-${month}-01`;
};

const computeAmounts = (
  enabledPatientCount: number,
  unitPriceCents: number,
  discountPercent: number
) => {
  const grossAmountCents = enabledPatientCount * unitPriceCents;
  const discountAmountCents = Math.round(
    grossAmountCents * (discountPercent / 100)
  );
  const netAmountCents = grossAmountCents - discountAmountCents;

  return { grossAmountCents, discountAmountCents, netAmountCents };
};

export const getPsychologistBilling = async (
  admin: SupabaseClient,
  psychologistId: string
): Promise<PsychologistBillingSummary> => {
  const [pricing, discount, enabledPatientCount] = await Promise.all([
    getBillingPlatformPricing(admin),
    getPsychologistBillingDiscount(admin, psychologistId),
    countEnabledPatientsForPsychologist(admin, psychologistId),
  ]);

  const discountPercent = discount?.discountPercent ?? 0;
  const { grossAmountCents, discountAmountCents, netAmountCents } =
    computeAmounts(
      enabledPatientCount,
      pricing.pricePerPatientCents,
      discountPercent
    );

  const billingMonth = currentBillingMonth();
  await upsertPsychologistBillingMonthly(admin, psychologistId, {
    billingMonth,
    enabledPatientCount,
    unitPriceCents: pricing.pricePerPatientCents,
    grossAmountCents,
    discountPercent,
    discountAmountCents,
    netAmountCents,
  });

  const history = await listPsychologistBillingMonthly(admin, psychologistId);

  return {
    enabledPatientCount,
    unitPriceCents: pricing.pricePerPatientCents,
    currency: pricing.currency,
    grossAmountCents,
    discount,
    discountAmountCents,
    netAmountCents,
    history,
  };
};
