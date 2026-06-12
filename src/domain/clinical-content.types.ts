export type ClinicalChatMessage = {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  createdAt: string;
  /** Groups messages from one patient-initiated topic until the agent closes the exchange. */
  interactionId?: string;
  /** True on the first user message of an interaction (shows a divider in the UI). */
  isInteractionStart?: boolean;
  /** True when the agent closes the interaction with a farewell (shows a divider after). */
  isInteractionEnd?: boolean;
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

export type LikertDimensionId = 'mood' | 'anxiety' | 'sleep' | 'wellbeing';

export type LikertCheckIn = {
  scores: Partial<Record<LikertDimensionId, number>>;
  updatedAt: string | null;
};

export const LIKERT_DIMENSION_IDS: LikertDimensionId[] = [
  'mood',
  'anxiety',
  'sleep',
  'wellbeing',
];

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

export type PatientAnamnesis = {
  chiefComplaint: string;
  currentHistory: string;
  personalHistory: string;
  familyHistory: string;
  socialHistory: string;
  medicalPsychiatricHistory: string;
  lifeHabits: string;
  emotionalBehavioral: string;
  therapeuticGoals: string;
  psychologistNotes: string;
};

export const emptyPatientAnamnesis = (): PatientAnamnesis => ({
  chiefComplaint: '',
  currentHistory: '',
  personalHistory: '',
  familyHistory: '',
  socialHistory: '',
  medicalPsychiatricHistory: '',
  lifeHabits: '',
  emotionalBehavioral: '',
  therapeuticGoals: '',
  psychologistNotes: '',
});

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
  patientSummaryUserMessageCount?: number;
  likertCheckIn?: LikertCheckIn | null;
  anamnesis: PatientAnamnesis;
};
