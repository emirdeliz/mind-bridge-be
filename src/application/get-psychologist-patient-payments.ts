import type { SupabaseClient } from '@supabase/supabase-js';

import {
  currentBillingMonth,
  isBillingMonthInFuture,
  normalizeBillingMonth,
} from '@domain/billing-month.js';
import type { PsychologistPatientPaymentsSummary } from '@domain/patient-payment.types.js';
import { BadRequestError } from '@http/errors.js';
import {
  getBillingPlatformPricing,
  listBillablePatientsForPsychologistMonth,
  listPsychologistBillingMonthly,
} from '@infrastructure/supabase/billing.repository.js';
import {
  listPatientPaymentMonths,
  listPatientSessionPaymentsForMonth,
} from '@infrastructure/supabase/patient-payment.repository.js';

type GetPsychologistPatientPaymentsOptions = {
  billingMonth?: string;
};

const mergeAvailableMonths = (
  currentMonth: string,
  billingHistoryMonths: string[],
  paymentMonths: string[]
): string[] => {
  const merged = new Set<string>([currentMonth, ...billingHistoryMonths, ...paymentMonths]);
  return [...merged].sort();
};

export const getPsychologistPatientPayments = async (
  admin: SupabaseClient,
  psychologistId: string,
  options: GetPsychologistPatientPaymentsOptions = {}
): Promise<PsychologistPatientPaymentsSummary> => {
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

  const [pricing, billablePatients, payments, billingHistory, paymentMonths] =
    await Promise.all([
      getBillingPlatformPricing(admin),
      listBillablePatientsForPsychologistMonth(
        admin,
        psychologistId,
        billingMonth
      ),
      listPatientSessionPaymentsForMonth(
        admin,
        psychologistId,
        billingMonth
      ),
      listPsychologistBillingMonthly(admin, psychologistId),
      listPatientPaymentMonths(admin, psychologistId),
    ]);

  const paymentsByPatientId = new Map(
    payments.map((payment) => [payment.patientId, payment])
  );

  const patients = billablePatients.map((patient) => {
    const payment = paymentsByPatientId.get(patient.patientId) ?? null;
    return {
      patientId: patient.patientId,
      fullName: patient.fullName,
      email: patient.email,
      isCompliant: payment !== null,
      payment,
    };
  });

  const compliantCount = patients.filter((patient) => patient.isCompliant).length;
  const nonCompliantCount = patients.length - compliantCount;
  const totalCollectedCents = payments.reduce(
    (sum, payment) => sum + payment.amountCents,
    0
  );

  return {
    billingMonth,
    isCurrentMonth: billingMonth === currentMonth,
    currency: pricing.currency,
    totalCollectedCents,
    compliantCount,
    nonCompliantCount,
    expectedPatientCount: patients.length,
    patients,
    availableMonths: mergeAvailableMonths(
      currentMonth,
      billingHistory.map((entry) => entry.billingMonth),
      paymentMonths
    ),
  };
};
