export type ClinicalChatMessage = {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  createdAt: string;
};

export type SessionNoteEntry = {
  id: string;
  label: string;
  sessionDate: string;
  content: string;
  agenticSummary?: string;
  isCurrent?: boolean;
};

export type SessionInsight = {
  title: string;
  body: string;
};

export type DashboardChartSeries = {
  name: string;
  data: number[];
  color?: string;
};

export type DashboardDonutItem = {
  name: string;
  value: number;
  color?: string;
};

export type DashboardSnapshot = {
  moodTrendCategories: string[];
  moodTrendSeries: DashboardChartSeries[];
  weeklyInteractionCategories: string[];
  weeklyInteractionSeries: DashboardChartSeries[];
  interactionChannels: DashboardDonutItem[];
  moodDiaryAdherencePercent: number;
  clinicalThemeCategories: string[];
  clinicalThemeSeries: DashboardChartSeries[];
  lastUpdatedAt: string;
};

export type PatientClinicalContent = {
  patientId: string;
  dashboardSnapshot: DashboardSnapshot;
  sessionContext: string | null;
  sessionNotes: SessionNoteEntry[];
  sessionInsights: SessionInsight[];
  psychologistSummary: string | null;
  psychologistChatSeed: ClinicalChatMessage[];
  patientChatSeed: ClinicalChatMessage[];
  patientSummary: string | null;
};
