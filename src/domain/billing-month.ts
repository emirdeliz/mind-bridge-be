import type { PsychologistBillablePatient } from '@domain/billing.types.js';

export type BillingMonthBounds = {
  billingMonth: string;
  monthStart: Date;
  monthEndExclusive: Date;
};

export const billingMonthFromDate = (date: Date): string => {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-01`;
};

export const currentBillingMonth = (): string =>
  billingMonthFromDate(new Date());

export const billingMonthBounds = (
  billingMonth: string
): BillingMonthBounds => {
  const [yearPart, monthPart] = billingMonth.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart) - 1;

  const monthStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const monthEndExclusive = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));

  return {
    billingMonth: `${yearPart}-${monthPart.padStart(2, '0')}-01`,
    monthStart,
    monthEndExclusive,
  };
};

export const previousBillingMonth = (billingMonth: string): string => {
  const { monthStart } = billingMonthBounds(billingMonth);
  const previous = new Date(monthStart);
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  return billingMonthFromDate(previous);
};

export const nextBillingMonth = (billingMonth: string): string => {
  const { monthStart } = billingMonthBounds(billingMonth);
  const next = new Date(monthStart);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return billingMonthFromDate(next);
};

const BILLING_MONTH_PATTERN = /^\d{4}-\d{2}-01$/;

export const normalizeBillingMonth = (value: string): string => {
  const trimmed = value.trim();
  if (!BILLING_MONTH_PATTERN.test(trimmed)) {
    throw new Error('Invalid billing month format. Use YYYY-MM-01.');
  }

  return billingMonthBounds(trimmed).billingMonth;
};

export const isBillingMonthInFuture = (billingMonth: string): boolean => {
  const { monthStart } = billingMonthBounds(billingMonth);
  const current = billingMonthBounds(currentBillingMonth()).monthStart;
  return monthStart > current;
};

export type BillableRelationship = {
  patientId: string;
  fullName: string | null;
  email: string | null;
  createdAt: string;
  disabledAt: string | null;
  isDeleted: boolean;
};

const isBillableDuringWindow = (
  relationship: BillableRelationship,
  windowStart: Date,
  windowEndExclusive: Date
): boolean => {
  const enabledAt = new Date(relationship.createdAt);
  const disabledAt = relationship.disabledAt
    ? new Date(relationship.disabledAt)
    : null;

  return (
    enabledAt < windowEndExclusive &&
    (disabledAt === null || disabledAt > windowStart)
  );
};

const isBillableDuringMonth = (
  relationship: BillableRelationship,
  bounds: BillingMonthBounds
): boolean =>
  isBillableDuringWindow(
    relationship,
    bounds.monthStart,
    bounds.monthEndExclusive
  );

const wasDeactivatedDuringMonth = (
  disabledAt: string | null,
  bounds: BillingMonthBounds
): boolean => {
  if (!disabledAt) {
    return false;
  }

  const deactivatedAt = new Date(disabledAt);
  return (
    deactivatedAt > bounds.monthStart &&
    deactivatedAt < bounds.monthEndExclusive
  );
};

const wasEnabledAtMonthEnd = (
  disabledAt: string | null,
  bounds: BillingMonthBounds
): boolean =>
  disabledAt === null || new Date(disabledAt) >= bounds.monthEndExclusive;

const resolveIsCurrentlyEnabled = (
  relationship: BillableRelationship,
  bounds: BillingMonthBounds
): boolean => {
  const viewingCurrentMonth = bounds.monthEndExclusive > new Date();

  if (viewingCurrentMonth) {
    return !relationship.isDeleted;
  }

  return wasEnabledAtMonthEnd(relationship.disabledAt, bounds);
};

/** Patient-month: counts if the link was billable at any moment in the month. */
export const countBillablePatientsForMonth = (
  relationships: BillableRelationship[],
  bounds: BillingMonthBounds
): number => listBillablePatientsForMonth(relationships, bounds).length;

export const listBillablePatientsForMonth = (
  relationships: BillableRelationship[],
  bounds: BillingMonthBounds
): PsychologistBillablePatient[] => {
  const billablePatients = relationships
    .filter((relationship) => isBillableDuringMonth(relationship, bounds))
    .map((relationship) => ({
      patientId: relationship.patientId,
      fullName: relationship.fullName,
      email: relationship.email,
      enabledAt: relationship.createdAt,
      disabledAt: relationship.disabledAt,
      deactivatedDuringMonth: wasDeactivatedDuringMonth(
        relationship.disabledAt,
        bounds
      ),
      isCurrentlyEnabled: resolveIsCurrentlyEnabled(relationship, bounds),
    }));

  return billablePatients.sort((left, right) => {
    const leftName = left.fullName?.trim() ?? left.email ?? '';
    const rightName = right.fullName?.trim() ?? right.email ?? '';
    return leftName.localeCompare(rightName, undefined, {
      sensitivity: 'base',
    });
  });
};
