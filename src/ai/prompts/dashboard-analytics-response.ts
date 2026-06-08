export type AiDashboardAnalyticsOutput = {
  moodDiaryAdherencePercent: number;
  moodTrendData: number[];
  clinicalThemeData: number[];
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const toNumberArray = (value: unknown): number[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const numbers = value.map((item) => Number(item));
  if (numbers.some((item) => Number.isNaN(item))) {
    return null;
  }

  return numbers;
};

export const parseDashboardAnalyticsResponse = (
  raw: string
): AiDashboardAnalyticsOutput | null => {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const adherence = Number(parsed.moodDiaryAdherencePercent);
    const moodTrendData = toNumberArray(parsed.moodTrendData);
    const clinicalThemeData = toNumberArray(parsed.clinicalThemeData);

    if (
      Number.isNaN(adherence) ||
      !moodTrendData?.length ||
      !clinicalThemeData?.length
    ) {
      return null;
    }

    return {
      moodDiaryAdherencePercent: Math.round(clamp(adherence, 0, 100)),
      moodTrendData: moodTrendData.map((value) =>
        Number(clamp(value, 1, 10).toFixed(1))
      ),
      clinicalThemeData: clinicalThemeData.map((value) =>
        Math.max(0, Math.round(value))
      ),
    };
  } catch {
    return null;
  }
};
