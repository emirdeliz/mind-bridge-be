import type { AdminMetricsPeriod } from '@domain/admin.types.js';
import {
  currentBillingMonth,
  previousBillingMonth,
} from '@domain/billing-month.js';

export const resolveAdminMetricsBillingMonths = (
  period: AdminMetricsPeriod
): string[] => {
  const current = currentBillingMonth();
  const monthCount =
    period === 'month' ? 1 : period === '3m' ? 3 : period === '6m' ? 6 : 12;

  const months: string[] = [current];
  let cursor = current;

  for (let index = 1; index < monthCount; index += 1) {
    cursor = previousBillingMonth(cursor);
    months.unshift(cursor);
  }

  return months;
};

export const parseAdminMetricsPeriod = (
  value: string | undefined
): AdminMetricsPeriod => {
  if (value === 'month' || value === '3m' || value === '6m' || value === '1y') {
    return value;
  }

  return 'month';
};
