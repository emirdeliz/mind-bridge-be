import {
  billingMonthBounds,
  currentBillingMonth,
  type BillableRelationship,
} from '@domain/billing-month.js';

export type BillingWeekRange = {
  periodStart: string;
  windowStart: Date;
  windowEndExclusive: Date;
};

const formatUtcDateIso = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getWeekRangesInBillingMonth = (
  billingMonth: string = currentBillingMonth()
): BillingWeekRange[] => {
  const { monthStart, monthEndExclusive } = billingMonthBounds(billingMonth);
  const ranges: BillingWeekRange[] = [];
  let cursor = new Date(monthStart);

  while (cursor < monthEndExclusive) {
    const nextWeek = new Date(cursor);
    nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
    const windowEndExclusive =
      nextWeek < monthEndExclusive ? nextWeek : new Date(monthEndExclusive);

    ranges.push({
      periodStart: formatUtcDateIso(cursor),
      windowStart: new Date(cursor),
      windowEndExclusive,
    });

    cursor = windowEndExclusive;
  }

  return ranges;
};

export const isBillableDuringBillingWeek = (
  relationship: BillableRelationship,
  week: BillingWeekRange
): boolean => {
  const enabledAt = new Date(relationship.createdAt);
  const disabledAt = relationship.disabledAt
    ? new Date(relationship.disabledAt)
    : null;

  return (
    enabledAt < week.windowEndExclusive &&
    (disabledAt === null || disabledAt > week.windowStart)
  );
};
