export type PatientInteractionChannel = 'text' | 'audio' | 'notification' | 'mood_diary';

export type PatientInteractionSource = 'web' | 'app';

export type PatientInteraction = {
  id: string;
  patientId: string;
  channel: PatientInteractionChannel;
  source: PatientInteractionSource;
  moodScore: number | null;
  createdAt: string;
};

export type LogPatientInteractionPayload = {
  channel: PatientInteractionChannel;
  source?: PatientInteractionSource;
  moodScore?: number | null;
};
