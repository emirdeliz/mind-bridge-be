import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  AdminMetricsPeriod,
  AdminPlatformMetrics,
  AdminPlatformMetricsPoint,
} from '@domain/admin.types.js';
import { resolveAdminMetricsBillingMonths } from '@domain/admin-metrics-period.js';
import {
  getWeekRangesInBillingMonth,
  isBillableDuringBillingWeek,
} from '@domain/admin-metrics-week.js';
import { currentBillingMonth } from '@domain/billing-month.js';
import {
  aggregatePlatformBillingByMonth,
  getPlatformCurrency,
  listPlatformBillingRowsForMonths,
  listPlatformCareRelationships,
} from '@infrastructure/supabase/admin-platform-metrics.repository.js';

const aggregatePlatformMetricsByWeek = (
  weeks: ReturnType<typeof getWeekRangesInBillingMonth>,
  relationships: Awaited<ReturnType<typeof listPlatformCareRelationships>>
): AdminPlatformMetricsPoint[] =>
  weeks.map((week) => {
    const billable = relationships.filter((relationship) =>
      isBillableDuringBillingWeek(
        {
          patientId: relationship.patientId,
          fullName: null,
          email: null,
          createdAt: relationship.createdAt,
          disabledAt: relationship.disabledAt,
          isDeleted: relationship.isDeleted,
        },
        week
      )
    );

    const psychologists = new Set(
      billable.map((relationship) => relationship.psychologistId)
    );

    return {
      periodStart: week.periodStart,
      activePsychologists: psychologists.size,
      activePatients: billable.length,
      revenueCents: 0,
    };
  });

export const getAdminPlatformMetrics = async (
  admin: SupabaseClient,
  period: AdminMetricsPeriod
): Promise<AdminPlatformMetrics> => {
  const currency = await getPlatformCurrency(admin);

  if (period === 'month') {
    const billingMonth = currentBillingMonth();
    const [relationships, monthlyRows] = await Promise.all([
      listPlatformCareRelationships(admin),
      listPlatformBillingRowsForMonths(admin, [billingMonth]),
    ]);

    const points = aggregatePlatformMetricsByWeek(
      getWeekRangesInBillingMonth(billingMonth),
      relationships
    );
    const platformRevenueCents = monthlyRows.reduce(
      (total, row) => total + row.netAmountCents,
      0
    );

    return {
      period,
      granularity: 'week',
      currency,
      platformRevenueCents,
      points,
    };
  }

  const billingMonths = resolveAdminMetricsBillingMonths(period);
  const rows = await listPlatformBillingRowsForMonths(admin, billingMonths);
  const points = aggregatePlatformBillingByMonth(billingMonths, rows);
  const platformRevenueCents = points.reduce(
    (total, point) => total + point.revenueCents,
    0
  );

  return {
    period,
    granularity: 'month',
    currency,
    platformRevenueCents,
    points,
  };
};
