import type { SupabaseClient } from '@supabase/supabase-js';

import { computePsychologistBillingAmounts } from '@application/compute-psychologist-billing-amounts.js';
import { syncPsychologistBillingMonth } from '@application/sync-psychologist-billing-month.js';
import {
  currentBillingMonth,
  isBillingMonthInFuture,
  normalizeBillingMonth,
} from '@domain/billing-month.js';
import type { PsychologistBillingSummary } from '@domain/billing.types.js';
import { BadRequestError } from '@http/errors.js';
import {
  countBillablePatientsForPsychologistMonth,
  countEnabledPatientsForPsychologist,
  getBillingPlatformPricing,
  getPsychologistBillingDiscount,
  getPsychologistBillingMonthlyEntry,
  listBillablePatientsForPsychologistMonth,
  listPsychologistBillingMonthly,
} from '@infrastructure/supabase/billing.repository.js';

type GetPsychologistBillingOptions = {
  billingMonth?: string;
};

export const getPsychologistBilling = async (
  admin: SupabaseClient,
  psychologistId: string,
  options: GetPsychologistBillingOptions = {}
): Promise<PsychologistBillingSummary> => {
  const currentMonth = currentBillingMonth();
  let billingMonth = currentMonth;

  if (options.billingMonth) {
    try {
      billingMonth = normalizeBillingMonth(options.billingMonth);
    } catch {
      throw new BadRequestError('Invalid billing month format. Use YYYY-MM-01.');
    }
  }

  if (isBillingMonthInFuture(billingMonth)) {
    throw new BadRequestError('Billing month cannot be in the future');
  }

  const isCurrentMonth = billingMonth === currentMonth;

  if (isCurrentMonth) {
    await syncPsychologistBillingMonth(admin, psychologistId, billingMonth);
  }

  const [
    pricing,
    discount,
    history,
    monthlyEntry,
    billablePatients,
    currentlyEnabledPatientCount,
  ] = await Promise.all([
    getBillingPlatformPricing(admin),
    getPsychologistBillingDiscount(admin, psychologistId),
    listPsychologistBillingMonthly(admin, psychologistId),
    getPsychologistBillingMonthlyEntry(admin, psychologistId, billingMonth),
    listBillablePatientsForPsychologistMonth(
      admin,
      psychologistId,
      billingMonth
    ),
    isCurrentMonth
      ? countEnabledPatientsForPsychologist(admin, psychologistId)
      : Promise.resolve(0),
  ]);

  const useFinalizedMonthlyEntry = monthlyEntry?.isFinalized === true;

  let enabledPatientCount = billablePatients.length;
  let unitPriceCents = pricing.pricePerPatientCents;
  let grossAmountCents = 0;
  let discountPercent = discount?.discountPercent ?? 0;
  let discountAmountCents = 0;
  let netAmountCents = 0;

  if (useFinalizedMonthlyEntry && monthlyEntry) {
    enabledPatientCount = monthlyEntry.enabledPatientCount;
    unitPriceCents = monthlyEntry.unitPriceCents;
    grossAmountCents = monthlyEntry.grossAmountCents;
    discountPercent = monthlyEntry.discountPercent;
    discountAmountCents = monthlyEntry.discountAmountCents;
    netAmountCents = monthlyEntry.netAmountCents;
  } else {
    const computedCount = await countBillablePatientsForPsychologistMonth(
      admin,
      psychologistId,
      billingMonth
    );
    enabledPatientCount = computedCount;
    const amounts = computePsychologistBillingAmounts(
      computedCount,
      pricing.pricePerPatientCents,
      discount?.discountPercent ?? 0
    );
    grossAmountCents = amounts.grossAmountCents;
    discountAmountCents = amounts.discountAmountCents;
    netAmountCents = amounts.netAmountCents;
  }

  return {
    billingMonth,
    isCurrentMonth,
    enabledPatientCount,
    currentlyEnabledPatientCount,
    unitPriceCents,
    currency: pricing.currency,
    grossAmountCents,
    discount,
    discountPercent,
    discountAmountCents,
    netAmountCents,
    billablePatients,
    history,
  };
};
