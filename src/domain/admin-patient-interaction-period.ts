export type AdminPatientInteractionPeriod =
  | 'week'
  | 'month'
  | '3m'
  | '6m'
  | '1y';

const PERIOD_DAYS: Record<AdminPatientInteractionPeriod, number> = {
  week: 7,
  month: 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
};

export const parseAdminPatientInteractionPeriod = (
  value: string | undefined
): AdminPatientInteractionPeriod => {
  if (
    value === 'week' ||
    value === 'month' ||
    value === '3m' ||
    value === '6m' ||
    value === '1y'
  ) {
    return value;
  }

  return 'month';
};

export const resolveAdminPatientInteractionSinceIso = (
  period: AdminPatientInteractionPeriod,
  reference = new Date()
): string => {
  const since = new Date(reference);
  since.setUTCDate(since.getUTCDate() - PERIOD_DAYS[period]);
  since.setUTCHours(0, 0, 0, 0);
  return since.toISOString();
};
