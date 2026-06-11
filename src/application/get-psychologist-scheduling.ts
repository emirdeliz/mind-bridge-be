import type { SupabaseClient } from '@supabase/supabase-js';

import { generateDaySlotTimes } from '@domain/scheduling-slots.js';
import type {
  PsychologistAppointment,
  PsychologistSchedulingSettings,
} from '@domain/scheduling.types.js';
import {
  getSchedulingSettings,
  listAppointmentsBetween,
} from '@infrastructure/supabase/scheduling.repository.js';

export type PsychologistSchedulingWeek = {
  settings: PsychologistSchedulingSettings;
  weekStart: string;
  weekEnd: string;
  slotTimes: string[];
  appointments: PsychologistAppointment[];
};

export const getPsychologistSchedulingWeek = async (
  admin: SupabaseClient,
  psychologistId: string,
  weekStartIso: string
): Promise<PsychologistSchedulingWeek> => {
  const settings = await getSchedulingSettings(admin, psychologistId);
  const weekStart = new Date(weekStartIso);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const appointments = await listAppointmentsBetween(
    admin,
    psychologistId,
    weekStart.toISOString(),
    weekEnd.toISOString()
  );

  const slotTimes = generateDaySlotTimes({
    sessionDurationMinutes: settings.sessionDurationMinutes,
    dayStartTime: settings.dayStartTime,
    dayEndTime: settings.dayEndTime,
    breakIntervals: settings.breakIntervals,
  });

  return {
    settings,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    slotTimes,
    appointments,
  };
};
