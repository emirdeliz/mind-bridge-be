export type AiPatientMoodOutput = {
  moodScore: number;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const parsePatientMoodAnalyticsResponse = (
  raw: string
): AiPatientMoodOutput | null => {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const moodScore = Number(parsed.moodScore);

    if (Number.isNaN(moodScore)) {
      return null;
    }

    return {
      moodScore: Number(clamp(moodScore, 1, 10).toFixed(1)),
    };
  } catch {
    return null;
  }
};
