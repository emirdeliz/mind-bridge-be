export type SchedulingBreakInterval = {
  startTime: string;
  endTime: string;
};

export type PsychologistSchedulingSettings = {
  psychologistId: string;
  sessionDurationMinutes: number;
  dayStartTime: string;
  dayEndTime: string;
  breakIntervals: SchedulingBreakInterval[];
  updatedAt: string;
};

export type PsychologistAppointment = {
  id: string;
  psychologistId: string;
  patientId: string;
  patientFullName: string | null;
  patientEmail: string | null;
  startsAt: string;
  durationMinutes: number;
  notes: string | null;
};

export type SchedulingConflictPreview = {
  appointmentId: string;
  patientFullName: string | null;
  startsAt: string;
};
