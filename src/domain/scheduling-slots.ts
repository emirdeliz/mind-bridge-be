import type { SchedulingBreakInterval } from './scheduling.types.js';

export type SlotSettings = {
  sessionDurationMinutes: number;
  dayStartTime: string;
  dayEndTime: string;
  breakIntervals: SchedulingBreakInterval[];
};

export type TimeRange = {
  startMs: number;
  endMs: number;
};

export const parseTimeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map((part) => Number(part));
  return hours * 60 + minutes;
};

export const minutesToTime = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const slotOverlapsBreak = (
  slotStartMinutes: number,
  slotEndMinutes: number,
  breakIntervals: SchedulingBreakInterval[]
): boolean =>
  breakIntervals.some((interval) => {
    const breakStart = parseTimeToMinutes(interval.startTime);
    const breakEnd = parseTimeToMinutes(interval.endTime);
    return slotStartMinutes < breakEnd && slotEndMinutes > breakStart;
  });

export const generateDaySlotTimes = (settings: SlotSettings): string[] => {
  const dayStart = parseTimeToMinutes(settings.dayStartTime);
  const dayEnd = parseTimeToMinutes(settings.dayEndTime);
  const duration = settings.sessionDurationMinutes;
  const slots: string[] = [];

  for (let start = dayStart; start + duration <= dayEnd; start += duration) {
    const end = start + duration;
    if (!slotOverlapsBreak(start, end, settings.breakIntervals)) {
      slots.push(minutesToTime(start));
    }
  }

  return slots;
};

export const combineLocalDateAndTime = (
  dateKey: string,
  time: string,
  timeZoneOffsetMinutes: number
): Date => {
  const [year, month, day] = dateKey.split('-').map((part) => Number(part));
  const [hours, minutes] = time.split(':').map((part) => Number(part));
  const utcMs =
    Date.UTC(year, month - 1, day, hours, minutes) + timeZoneOffsetMinutes * 60_000;
  return new Date(utcMs);
};

export const toLocalDateKey = (date: Date, timeZoneOffsetMinutes: number): string => {
  const local = new Date(date.getTime() - timeZoneOffsetMinutes * 60_000);
  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, '0');
  const day = String(local.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const toLocalTime = (date: Date, timeZoneOffsetMinutes: number): string => {
  const local = new Date(date.getTime() - timeZoneOffsetMinutes * 60_000);
  const hours = String(local.getUTCHours()).padStart(2, '0');
  const minutes = String(local.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

export const appointmentRange = (
  startsAt: Date,
  durationMinutes: number
): TimeRange => ({
  startMs: startsAt.getTime(),
  endMs: startsAt.getTime() + durationMinutes * 60_000,
});

export const rangesOverlap = (left: TimeRange, right: TimeRange): boolean =>
  left.startMs < right.endMs && right.startMs < left.endMs;

export const appointmentOverlapsBreak = (
  startsAt: Date,
  durationMinutes: number,
  breakIntervals: SchedulingBreakInterval[],
  timeZoneOffsetMinutes: number
): boolean => {
  const startTime = toLocalTime(startsAt, timeZoneOffsetMinutes);
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = startMinutes + durationMinutes;

  return slotOverlapsBreak(startMinutes, endMinutes, breakIntervals);
};

export const findNextAvailableSlotStart = (
  dateKey: string,
  fromTime: string,
  settings: SlotSettings,
  occupiedRanges: TimeRange[],
  durationMinutes: number,
  timeZoneOffsetMinutes: number
): Date | null => {
  const slots = generateDaySlotTimes(settings);
  const fromIndex = Math.max(
    0,
    slots.findIndex((slot) => slot >= fromTime)
  );

  for (let index = fromIndex; index < slots.length; index += 1) {
    const candidateStart = combineLocalDateAndTime(
      dateKey,
      slots[index],
      timeZoneOffsetMinutes
    );
    const candidateRange = appointmentRange(candidateStart, durationMinutes);
    const overlaps = occupiedRanges.some((range) => rangesOverlap(candidateRange, range));
    if (!overlaps) {
      return candidateStart;
    }
  }

  return null;
};
