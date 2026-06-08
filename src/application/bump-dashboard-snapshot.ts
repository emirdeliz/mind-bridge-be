import type { DashboardSnapshot } from '@domain/clinical-content.types.js';

const DEFAULT_CLINICAL_THEMES = [
  'Ansiedade',
  'Sono',
  'Trabalho',
  'Somatização',
  'Humor',
] as const;

const THEME_KEYWORDS: Record<(typeof DEFAULT_CLINICAL_THEMES)[number], string[]> =
  {
    Ansiedade: ['ansiedade', 'ansios', 'preocup', 'nervos', 'anxiety'],
    Sono: ['sono', 'dormir', 'insônia', 'insonia', 'sleep'],
    Trabalho: ['trabalho', 'laboral', 'emprego', 'reunião', 'reuniao', 'work'],
    Somatização: ['somatiz', 'peito', 'dor', 'tensão', 'tensao', 'somatic'],
    Humor: ['humor', 'triste', 'deprim', 'motivação', 'motivacao', 'mood'],
  };

const MOOD_SERIES_NAME = 'Humor médio';
const MOOD_SERIES_COLOR = '#5eead4';
const CLINICAL_SERIES_NAME = 'Menções';
const CLINICAL_SERIES_COLOR = '#a78bfa';
const WEEKLY_SERIES_NAME = 'Interações';
const WEEKLY_SERIES_COLOR = '#818cf8';

const formatWeekLabel = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
};

const buildRecentWeekCategories = (): string[] => {
  const categories: string[] = [];
  const now = new Date();

  for (let offset = 5; offset >= 0; offset -= 1) {
    const weekDate = new Date(now);
    weekDate.setDate(weekDate.getDate() - offset * 7);
    categories.push(formatWeekLabel(weekDate));
  }

  return categories;
};

const isDashboardUninitialized = (snapshot: DashboardSnapshot): boolean =>
  snapshot.moodTrendCategories.length === 0 &&
  snapshot.moodTrendSeries.length === 0 &&
  snapshot.clinicalThemeCategories.length === 0;

export const ensureDashboardSnapshotStructure = (
  snapshot: DashboardSnapshot
): DashboardSnapshot => {
  if (!isDashboardUninitialized(snapshot)) {
    return snapshot;
  }

  const moodTrendCategories = buildRecentWeekCategories();

  return {
    ...snapshot,
    moodTrendCategories,
    moodTrendSeries: [
      {
        name: MOOD_SERIES_NAME,
        data: [4.8, 4.9, 5, 5, 4.9, 5],
        color: MOOD_SERIES_COLOR,
      },
    ],
    weeklyInteractionCategories: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
    weeklyInteractionSeries: [
      {
        name: WEEKLY_SERIES_NAME,
        data: [0, 0, 0, 0, 0, 0, 0],
        color: WEEKLY_SERIES_COLOR,
      },
    ],
    interactionChannels: [
      { name: 'Texto', value: 0, color: '#818cf8' },
      { name: 'Áudio', value: 0, color: '#5eead4' },
      { name: 'Notificação', value: 0, color: '#fbbf24' },
    ],
    moodDiaryAdherencePercent: 0,
    clinicalThemeCategories: [...DEFAULT_CLINICAL_THEMES],
    clinicalThemeSeries: [
      {
        name: CLINICAL_SERIES_NAME,
        data: [1, 1, 1, 1, 1],
        color: CLINICAL_SERIES_COLOR,
      },
    ],
    lastUpdatedAt: snapshot.lastUpdatedAt,
  };
};

const estimateMoodDelta = (sessionText: string): number => {
  const normalized = sessionText.toLowerCase();

  if (/melhor|progresso|positiv|estável|estavel|alívio|alivio/.test(normalized)) {
    return 0.5;
  }

  if (/pior|crise|agud|declínio|declinio|descompens/.test(normalized)) {
    return -0.4;
  }

  return 0.3;
};

const detectClinicalThemeIndex = (
  sessionText: string,
  categories: string[]
): number => {
  const normalized = sessionText.toLowerCase();

  for (let index = 0; index < categories.length; index += 1) {
    const theme = categories[index] as (typeof DEFAULT_CLINICAL_THEMES)[number];
    const keywords = THEME_KEYWORDS[theme] ?? [];

    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return index;
    }
  }

  return 0;
};

const getTodayWeekdayIndex = (): number => {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
};

/** Atualiza indicadores do painel após encerrar uma sessão de psicoterapia. */
export const bumpDashboardSnapshotAfterSession = (
  current: DashboardSnapshot,
  sessionText = ''
): DashboardSnapshot => {
  const base = ensureDashboardSnapshotStructure(current);

  const moodData = [...(base.moodTrendSeries[0]?.data ?? [])];
  if (moodData.length > 0) {
    const lastIndex = moodData.length - 1;
    const nextValue = moodData[lastIndex] + estimateMoodDelta(sessionText);
    moodData[lastIndex] = Math.min(10, Math.max(1, Number(nextValue.toFixed(1))));
  }

  const weeklyData = [...(base.weeklyInteractionSeries[0]?.data ?? [])];
  const todayIndex = getTodayWeekdayIndex();
  if (weeklyData.length > todayIndex) {
    weeklyData[todayIndex] += 1;
  }

  const channels = base.interactionChannels.map((channel) =>
    channel.name === 'Texto'
      ? { ...channel, value: channel.value + 1 }
      : channel
  );

  const clinicalCategories = base.clinicalThemeCategories.length
    ? base.clinicalThemeCategories
    : [...DEFAULT_CLINICAL_THEMES];
  const clinicalData = [
    ...(base.clinicalThemeSeries[0]?.data ??
      new Array(clinicalCategories.length).fill(0)),
  ];
  const themeIndex = detectClinicalThemeIndex(sessionText, clinicalCategories);
  if (clinicalData.length > themeIndex) {
    clinicalData[themeIndex] += 1;
  }

  const adherenceBoost = base.moodDiaryAdherencePercent === 0 ? 12 : 8;

  return {
    ...base,
    moodTrendSeries: [
      {
        name: base.moodTrendSeries[0]?.name ?? MOOD_SERIES_NAME,
        data: moodData,
        color: base.moodTrendSeries[0]?.color ?? MOOD_SERIES_COLOR,
      },
    ],
    weeklyInteractionSeries: [
      {
        name: base.weeklyInteractionSeries[0]?.name ?? WEEKLY_SERIES_NAME,
        data: weeklyData,
        color: base.weeklyInteractionSeries[0]?.color ?? WEEKLY_SERIES_COLOR,
      },
    ],
    interactionChannels: channels,
    moodDiaryAdherencePercent: Math.min(
      100,
      base.moodDiaryAdherencePercent + adherenceBoost
    ),
    clinicalThemeCategories: clinicalCategories,
    clinicalThemeSeries: [
      {
        name: base.clinicalThemeSeries[0]?.name ?? CLINICAL_SERIES_NAME,
        data: clinicalData,
        color: base.clinicalThemeSeries[0]?.color ?? CLINICAL_SERIES_COLOR,
      },
    ],
    lastUpdatedAt: new Date().toISOString(),
  };
};
