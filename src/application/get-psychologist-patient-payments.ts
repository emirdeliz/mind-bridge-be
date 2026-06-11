import type { SupabaseClient } from '@supabase/supabase-js';

import {
  billingMonthBounds,
  currentBillingMonth,
  isBillingMonthInFuture,
  listBillablePatientsForMonth,
  normalizeBillingMonth,
} from '@domain/billing-month.js';
import type { PsychologistPatientPaymentsSummary } from '@domain/patient-payment.types.js';
import { BadRequestError } from '@http/errors.js';
import {
  getBillingPlatformPricing,
  listCareRelationshipsForBilling,
  listPsychologistBillingMonthly,
} from '@infrastructure/supabase/billing.repository.js';
import {
  listAllPatientSessionPayments,
  listPatientPaymentMonths,
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

const monthsUpTo = (availableMonths: string[], billingMonth: string): string[] =>
  availableMonths.filter((month) => month <= billingMonth);

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

  const [pricing, relationships, allPayments, billingHistory, paymentMonths] =
    await Promise.all([
      getBillingPlatformPricing(admin),
      listCareRelationshipsForBilling(admin, psychologistId),
      listAllPatientSessionPayments(admin, psychologistId),
      listPsychologistBillingMonthly(admin, psychologistId),
      listPatientPaymentMonths(admin, psychologistId),
    ]);

  const availableMonths = mergeAvailableMonths(
    currentMonth,
    billingHistory.map((entry) => entry.billingMonth),
    paymentMonths
  );

  const billableRelationships = relationships.map((relationship) => ({
    patientId: relationship.patientId,
    fullName: relationship.fullName,
    email: relationship.email,
    createdAt: relationship.createdAt,
    disabledAt: relationship.disabledAt,
    isDeleted: relationship.isDeleted,
  }));

  const paymentsByPatientMonth = new Map<string, Map<string, (typeof allPayments)[number]>>();
  for (const payment of allPayments) {
    const byMonth = paymentsByPatientMonth.get(payment.patientId) ?? new Map();
    byMonth.set(payment.billingMonth, payment);
    paymentsByPatientMonth.set(payment.patientId, byMonth);
  }

  const unpaidBillingMonthsByPatient = new Map<string, string[]>();
  const patientInfoById = new Map<
    string,
    { fullName: string | null; email: string | null }
  >();

  for (const month of monthsUpTo(availableMonths, billingMonth)) {
    const bounds = billingMonthBounds(month);
    const billablePatients = listBillablePatientsForMonth(
      billableRelationships,
      bounds
    );

    for (const patient of billablePatients) {
      patientInfoById.set(patient.patientId, {
        fullName: patient.fullName,
        email: patient.email,
      });

      const hasPayment =
        paymentsByPatientMonth.get(patient.patientId)?.has(month) ?? false;
      if (!hasPayment) {
        const unpaid = unpaidBillingMonthsByPatient.get(patient.patientId) ?? [];
        unpaid.push(month);
        unpaidBillingMonthsByPatient.set(patient.patientId, unpaid);
      }
    }
  }

  const selectedMonthBounds = billingMonthBounds(billingMonth);
  const billableInSelectedMonth = listBillablePatientsForMonth(
    billableRelationships,
    selectedMonthBounds
  );

  for (const patient of billableInSelectedMonth) {
    patientInfoById.set(patient.patientId, {
      fullName: patient.fullName,
      email: patient.email,
    });
  }

  const patientIds = new Set<string>([
    ...billableInSelectedMonth.map((patient) => patient.patientId),
    ...unpaidBillingMonthsByPatient.keys(),
  ]);

  const billableInSelectedMonthIds = new Set(
    billableInSelectedMonth.map((patient) => patient.patientId)
  );

  const patients = [...patientIds]
    .map((patientId) => {
      const info = patientInfoById.get(patientId) ?? {
        fullName: null,
        email: null,
      };
      const isBillableInSelectedMonth = billableInSelectedMonthIds.has(patientId);
      const payment =
        paymentsByPatientMonth.get(patientId)?.get(billingMonth) ?? null;
      const unpaidBillingMonths = unpaidBillingMonthsByPatient.get(patientId) ?? [];
      const isCompliant = isBillableInSelectedMonth ? payment !== null : false;

      return {
        patientId,
        fullName: info.fullName,
        email: info.email,
        isCompliant,
        isBillableInSelectedMonth,
        unpaidBillingMonths,
        payment,
      };
    })
    .sort((left, right) => {
      const leftName = left.fullName?.trim() ?? left.email ?? '';
      const rightName = right.fullName?.trim() ?? right.email ?? '';
      return leftName.localeCompare(rightName, undefined, { sensitivity: 'base' });
    });

  const billablePatientsInMonth = patients.filter(
    (patient) => patient.isBillableInSelectedMonth
  );
  const compliantCount = billablePatientsInMonth.filter(
    (patient) => patient.isCompliant
  ).length;
  const nonCompliantCount = billablePatientsInMonth.length - compliantCount;
  const totalCollectedCents = allPayments
    .filter((payment) => payment.billingMonth === billingMonth)
    .reduce((sum, payment) => sum + payment.amountCents, 0);

  return {
    billingMonth,
    isCurrentMonth: billingMonth === currentMonth,
    currency: pricing.currency,
    totalCollectedCents,
    compliantCount,
    nonCompliantCount,
    expectedPatientCount: billablePatientsInMonth.length,
    patients,
    availableMonths,
  };
};
