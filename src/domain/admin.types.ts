export type AdminMetricsPeriod = 'month' | '3m' | '6m' | '1y';

export type AdminMetricsGranularity = 'week' | 'month';

export type AdminPlatformMetricsPoint = {
  periodStart: string;
  activePsychologists: number;
  activePatients: number;
  revenueCents: number;
};

/** @deprecated Use AdminPlatformMetricsPoint */
export type AdminPlatformMetricsMonthPoint = AdminPlatformMetricsPoint & {
  billingMonth: string;
};

export type AdminPlatformMetrics = {
  period: AdminMetricsPeriod;
  granularity: AdminMetricsGranularity;
  currency: string;
  platformRevenueCents: number;
  points: AdminPlatformMetricsPoint[];
};

export type AdminPsychologistListItem = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  activePatientCount: number;
  totalPatientCount: number;
};

export type AdminPsychologistPatientListItem = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  lastConsultationAt: string | null;
  isDeleted: boolean;
  aiInteractionCount: number;
};
