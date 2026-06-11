import type { SupabaseClient } from '@supabase/supabase-js';

import type { SlotSettings } from '@domain/scheduling-slots.js';
import type {
  PsychologistSchedulingSettings,
  SchedulingBreakInterval,
  SchedulingConflictPreview,
} from '@domain/scheduling.types.js';
import { BadRequestError } from '@http/errors.js';
import {
  deleteAppointmentsByIds,
  listAppointmentsBetween,
  upsertSchedulingSettings,
} from '@infrastructure/supabase/scheduling.repository.js';

import { findBreakConflicts } from './scheduling-conflicts.js';

export type UpdateSchedulingSettingsInput = {
  sessionDurationMinutes: number;
  dayStartTime: string;
  dayEndTime: string;
  breakIntervals: SchedulingBreakInterval[];
  confirmRemoveConflicts?: boolean;
  timeZoneOffsetMinutes: number;
};

export type UpdateSchedulingSettingsResult =
  | {
      status: 'saved';
      settings: PsychologistSchedulingSettings;
      removedAppointmentIds: string[];
    }
  | {
      status: 'confirmation_required';
      conflicts: SchedulingConflictPreview[];
    };

const toSlotSettings = (
  settings: UpdateSchedulingSettingsInput
): SlotSettings => ({
  sessionDurationMinutes: settings.sessionDurationMinutes,
  dayStartTime: settings.dayStartTime,
  dayEndTime: settings.dayEndTime,
  breakIntervals: settings.breakIntervals,
});

export const updatePsychologistSchedulingSettings = async (
  admin: SupabaseClient,
  psychologistId: string,
  input: UpdateSchedulingSettingsInput
): Promise<UpdateSchedulingSettingsResult> => {
  if (input.sessionDurationMinutes <= 0) {
    throw new BadRequestError('Session duration must be greater than zero');
  }

  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setUTCMonth(rangeStart.getUTCMonth() - 3);
  const rangeEnd = new Date(now);
  rangeEnd.setUTCMonth(rangeEnd.getUTCMonth() + 12);

  const appointments = await listAppointmentsBetween(
    admin,
    psychologistId,
    rangeStart.toISOString(),
    rangeEnd.toISOString()
  );

  const conflicts = findBreakConflicts(
    appointments,
    toSlotSettings(input),
    input.timeZoneOffsetMinutes
  );

  if (conflicts.length && !input.confirmRemoveConflicts) {
    return {
      status: 'confirmation_required',
      conflicts,
    };
  }

  const removedIds = conflicts.map((item) => item.appointmentId);
  if (removedIds.length) {
    await deleteAppointmentsByIds(admin, psychologistId, removedIds);
  }

  const settings = await upsertSchedulingSettings(admin, psychologistId, {
    sessionDurationMinutes: input.sessionDurationMinutes,
    dayStartTime: input.dayStartTime,
    dayEndTime: input.dayEndTime,
    breakIntervals: input.breakIntervals,
  });

  return {
    status: 'saved',
    settings,
    removedAppointmentIds: removedIds,
  };
};
