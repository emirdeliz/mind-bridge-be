import {
  appointmentOverlapsBreak,
  appointmentRange,
  rangesOverlap,
  type SlotSettings,
} from '@domain/scheduling-slots.js';
import type {
  PsychologistAppointment,
  SchedulingConflictPreview,
} from '@domain/scheduling.types.js';

export const findBreakConflicts = (
  appointments: PsychologistAppointment[],
  settings: SlotSettings,
  timeZoneOffsetMinutes: number
): SchedulingConflictPreview[] =>
  appointments
    .filter((appointment) =>
      appointmentOverlapsBreak(
        new Date(appointment.startsAt),
        appointment.durationMinutes,
        settings.breakIntervals,
        timeZoneOffsetMinutes
      )
    )
    .map((appointment) => ({
      appointmentId: appointment.id,
      patientFullName: appointment.patientFullName,
      startsAt: appointment.startsAt,
    }));

export const findOverlappingAppointments = (
  appointments: PsychologistAppointment[],
  candidateStart: Date,
  durationMinutes: number,
  excludeId?: string
): PsychologistAppointment[] => {
  const candidateRange = appointmentRange(candidateStart, durationMinutes);
  return appointments.filter((appointment) => {
    if (excludeId && appointment.id === excludeId) {
      return false;
    }
    const range = appointmentRange(
      new Date(appointment.startsAt),
      appointment.durationMinutes
    );
    return rangesOverlap(candidateRange, range);
  });
};
