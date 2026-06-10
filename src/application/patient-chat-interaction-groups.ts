import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';

/** Lookback window for weekly pattern detection (7 days). */
export const PATIENT_CHAT_WEEKLY_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

/** Splits patient chat into conversation blocks (by interactionId / isInteractionStart). */
export const splitChatIntoInteractions = (
  messages: ClinicalChatMessage[]
): ClinicalChatMessage[][] => {
  if (!messages.length) {
    return [];
  }

  const interactions: ClinicalChatMessage[][] = [];
  let current: ClinicalChatMessage[] = [];
  let activeInteractionId: string | undefined;

  for (const message of messages) {
    const interactionId = message.interactionId;
    const startsNewInteraction =
      (message.isInteractionStart && current.length > 0) ||
      (interactionId &&
        activeInteractionId &&
        interactionId !== activeInteractionId &&
        message.sender === 'user');

    if (startsNewInteraction) {
      interactions.push(current);
      current = [];
    }

    current.push(message);
    if (interactionId) {
      activeInteractionId = interactionId;
    }
  }

  if (current.length) {
    interactions.push(current);
  }

  return interactions.length ? interactions : [messages];
};

const parseMessageTime = (message: ClinicalChatMessage): number | null => {
  if (!message.createdAt) {
    return null;
  }
  const parsed = Date.parse(message.createdAt);
  return Number.isNaN(parsed) ? null : parsed;
};

/** Interaction blocks whose first patient message falls within the lookback window. */
export const getInteractionGroupsFromLastWeek = (
  messages: ClinicalChatMessage[],
  nowMs: number = Date.now(),
  lookbackMs: number = PATIENT_CHAT_WEEKLY_LOOKBACK_MS
): ClinicalChatMessage[][] => {
  const cutoff = nowMs - lookbackMs;

  return splitChatIntoInteractions(messages).filter((group) => {
    const anchor =
      group.find((message) => message.sender === 'user') ?? group[0];
    if (!anchor) {
      return false;
    }
    const timestamp = parseMessageTime(anchor);
    return timestamp !== null && timestamp >= cutoff;
  });
};

export const flattenInteractionGroups = (
  groups: ClinicalChatMessage[][]
): ClinicalChatMessage[] => groups.flat();

export const hasWeeklyPatientChatReports = (
  messages: ClinicalChatMessage[],
  nowMs: number = Date.now()
): boolean =>
  getInteractionGroupsFromLastWeek(messages, nowMs).some((group) =>
    group.some((message) => message.sender === 'user')
  );
