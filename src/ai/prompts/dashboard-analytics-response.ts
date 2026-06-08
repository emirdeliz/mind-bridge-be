export type AiDashboardAnalyticsOutput = {
  moodTrendLastValue: number;
  clinicalThemeIncrements: number[];
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
    const moodTrendLastValue = Number(parsed.moodTrendLastValue);
    const clinicalThemeIncrements = toNumberArray(parsed.clinicalThemeIncrements);

    if (Number.isNaN(moodTrendLastValue) || !clinicalThemeIncrements?.length) {
      return null;
    }

    return {
      moodTrendLastValue: Number(clamp(moodTrendLastValue, 1, 10).toFixed(1)),
      clinicalThemeIncrements: clinicalThemeIncrements.map((value) =>
        Math.max(0, Math.round(value))
      ),
    };
  } catch {
    return null;
  }
};
