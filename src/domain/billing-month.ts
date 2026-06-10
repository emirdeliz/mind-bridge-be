export type BillingMonthBounds = {
  billingMonth: string;
  monthStart: Date;
  monthEndExclusive: Date;
};

export const billingMonthFromDate = (date: Date): string => {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-01`;
};

export const currentBillingMonth = (): string => billingMonthFromDate(new Date());

export const billingMonthBounds = (billingMonth: string): BillingMonthBounds => {
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

type BillableRelationship = {
  patientId: string;
  createdAt: string;
  disabledAt: string | null;
};

/** Patient-month: counts if the link was billable at any moment in the month. */
export const countBillablePatientsForMonth = (
  relationships: BillableRelationship[],
  bounds: BillingMonthBounds
): number => {
  const billablePatientIds = new Set<string>();

  for (const relationship of relationships) {
    const enabledAt = new Date(relationship.createdAt);
    const disabledAt = relationship.disabledAt
      ? new Date(relationship.disabledAt)
      : null;

    const overlapsMonth =
      enabledAt < bounds.monthEndExclusive &&
      (disabledAt === null || disabledAt > bounds.monthStart);

    if (overlapsMonth) {
      billablePatientIds.add(relationship.patientId);
    }
  }

  return billablePatientIds.size;
};
