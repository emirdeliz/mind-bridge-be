import type { DashboardSnapshot } from '@domain/clinical-content.types.js';
import type { PatientInteraction } from '@domain/patient-interaction.types.js';

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;
const MOOD_DIARY_TARGET_DAYS = 7;
const CHANNEL_LABELS: Record<string, string> = {
  text: 'Texto',
  audio: 'Áudio',
  notification: 'Notificação',
};
const CHANNEL_COLORS: Record<string, string> = {
  text: '#818cf8',
  audio: '#5eead4',
  notification: '#fbbf24',
};

const getWeekStart = (reference = new Date()): Date => {
  const start = new Date(reference);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

const toWeekdayIndex = (date: Date): number => {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
};

const uniqueMoodDiaryDays = (interactions: PatientInteraction[]): number => {
  const days = new Set<string>();
  for (const entry of interactions) {
    if (entry.channel !== 'mood_diary') continue;
    days.add(entry.createdAt.slice(0, 10));
  }
  return days.size;
};

export const computePatientDashboardMetrics = (
  interactions: PatientInteraction[],
  reference = new Date()
): Pick<
  DashboardSnapshot,
  | 'weeklyInteractionCategories'
  | 'weeklyInteractionSeries'
  | 'interactionChannels'
  | 'moodDiaryAdherencePercent'
> => {
  const weekStart = getWeekStart(reference);
  const weekInteractions = interactions.filter(
    (entry) => new Date(entry.createdAt) >= weekStart
  );

  const weeklyCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const entry of weekInteractions) {
    const index = toWeekdayIndex(new Date(entry.createdAt));
    weeklyCounts[index] += 1;
  }

  const channelCounts: Record<string, number> = {
    text: 0,
    audio: 0,
    notification: 0,
  };
  for (const entry of weekInteractions) {
    if (entry.channel in channelCounts) {
      channelCounts[entry.channel] += 1;
    }
  }

  const rollingWeekStart = new Date(reference);
  rollingWeekStart.setDate(rollingWeekStart.getDate() - 6);
  rollingWeekStart.setHours(0, 0, 0, 0);
  const moodDiaryDays = uniqueMoodDiaryDays(
    interactions.filter((entry) => new Date(entry.createdAt) >= rollingWeekStart)
  );
  const moodDiaryAdherencePercent = Math.min(
    100,
    Math.round((moodDiaryDays / MOOD_DIARY_TARGET_DAYS) * 100)
  );

  return {
    weeklyInteractionCategories: [...WEEKDAY_LABELS],
    weeklyInteractionSeries: [
      {
        name: 'Interações',
        data: weeklyCounts,
        color: '#818cf8',
      },
    ],
    interactionChannels: Object.entries(channelCounts).map(([channel, value]) => ({
      name: CHANNEL_LABELS[channel] ?? channel,
      value,
      color: CHANNEL_COLORS[channel],
    })),
    moodDiaryAdherencePercent,
  };
};

export const mergePatientMetricsIntoDashboard = (
  snapshot: DashboardSnapshot,
  interactions: PatientInteraction[]
): DashboardSnapshot => {
  const patientMetrics = computePatientDashboardMetrics(interactions);
  return {
    ...snapshot,
    ...patientMetrics,
    lastUpdatedAt: new Date().toISOString(),
  };
};
