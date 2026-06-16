import type { SupabaseClient } from '@supabase/supabase-js';

import {
  appointmentRange,
  findNextAvailableSlotStart,
  rangesOverlap,
  toLocalDateKey,
  toLocalTime,
  type SlotSettings,
} from '@domain/scheduling-slots.js';
import type { PsychologistAppointment } from '@domain/scheduling.types.js';
import { BadRequestError } from '@http/errors.js';
import {
  getAppointmentById,
  listAppointmentsBetween,
  updateAppointmentStart,
} from '@infrastructure/supabase/scheduling.repository.js';

import { findOverlappingAppointments } from './scheduling-conflicts.js';

const weekRangeIso = (weekStartIso: string): { start: string; end: string } => {
  const start = new Date(weekStartIso);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start: start.toISOString(), end: end.toISOString() };
};

const MAX_CONFLICT_RESOLUTIONS = 32;

export const movePsychologistAppointment = async (
  admin: SupabaseClient,
  psychologistId: string,
  appointmentId: string,
  targetStartsAtIso: string,
  settings: SlotSettings,
  timeZoneOffsetMinutes: number,
  weekStartIso: string
): Promise<PsychologistAppointment[]> => {
  const moving = await getAppointmentById(admin, psychologistId, appointmentId);

  if (!moving) {
    throw new BadRequestError('Appointment not found');
  }

  const { start, end } = weekRangeIso(weekStartIso);
  const weekAppointments = await listAppointmentsBetween(
    admin,
    psychologistId,
    start,
    end
  );
  const appointments = weekAppointments.some((item) => item.id === moving.id)
    ? weekAppointments
    : [...weekAppointments, moving];

  const targetStart = new Date(targetStartsAtIso);
  const updates = new Map<string, string>();

  const startAtFor = (id: string): Date => {
    const value = updates.get(id);
    if (value) {
      return new Date(value);
    }
    const appointment = appointments.find((item) => item.id === id);
    if (!appointment) {
      throw new BadRequestError('Appointment not found');
    }
    return new Date(appointment.startsAt);
  };

  const buildOccupiedRanges = (
    excludeIds: Set<string>
  ): ReturnType<typeof appointmentRange>[] =>
    appointments
      .filter((item) => !excludeIds.has(item.id))
      .map((item) =>
        appointmentRange(startAtFor(item.id), item.durationMinutes)
      );

  const findConflictingAppointment = (
    id: string,
    startAt: Date,
    durationMinutes: number
  ): PsychologistAppointment | undefined => {
    const candidateRange = appointmentRange(startAt, durationMinutes);
    return appointments.find((item) => {
      if (item.id === id) {
        return false;
      }
      const range = appointmentRange(startAtFor(item.id), item.durationMinutes);
      return rangesOverlap(candidateRange, range);
    });
  };

  const resolveConflicts = (id: string, startAt: Date, depth = 0): void => {
    if (depth > MAX_CONFLICT_RESOLUTIONS) {
      throw new BadRequestError('No available slot to resolve conflict');
    }

    const current = appointments.find((item) => item.id === id);
    if (!current) {
      return;
    }

    updates.set(id, startAt.toISOString());

    const conflicting = findConflictingAppointment(
      id,
      startAt,
      current.durationMinutes
    );
    if (!conflicting) {
      return;
    }

    const dateKey = toLocalDateKey(startAt, timeZoneOffsetMinutes);
    const fromTime = toLocalTime(startAt, timeZoneOffsetMinutes);
    const nextStart = findNextAvailableSlotStart(
      dateKey,
      fromTime,
      settings,
      buildOccupiedRanges(new Set([conflicting.id])),
      conflicting.durationMinutes,
      timeZoneOffsetMinutes
    );

    if (!nextStart) {
      throw new BadRequestError('No available slot to resolve conflict');
    }

    resolveConflicts(conflicting.id, nextStart, depth + 1);
  };

  const initialOverlaps = findOverlappingAppointments(
    appointments,
    targetStart,
    moving.durationMinutes,
    appointmentId
  );

  if (initialOverlaps.length) {
    resolveConflicts(appointmentId, targetStart);
  } else {
    updates.set(appointmentId, targetStart.toISOString());
  }

  const updatedAppointments: PsychologistAppointment[] = [];
  for (const [id, startsAt] of updates.entries()) {
    const original = appointments.find((item) => item.id === id);
    if (!original || original.startsAt === startsAt) {
      continue;
    }
    updatedAppointments.push(
      await updateAppointmentStart(admin, psychologistId, id, startsAt)
    );
  }

  return updatedAppointments;
};
