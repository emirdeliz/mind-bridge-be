import { HumanMessage, SystemMessage } from '@langchain/core/messages';

import type { Env } from '@config/env.js';
import { createPatientTopicClassifierModel } from '@ai/llm.js';
import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
const TOPIC_SHIFT_PATTERNS: RegExp[] = [
  /\boutro assunto\b/i,
  /\bmud(ar|ando) de (tema|assunto)\b/i,
  /\bnovo assunto\b/i,
  /\bquero falar (de|sobre|agora)\b/i,
  /\bvamos falar (de|sobre)\b/i,
  /\bdeixa(r)? (eu )?falar (de|sobre)\b/i,
  /\bagora (sobre|quero falar)\b/i,
  /\botro tema\b/i,
  /\bcambiar de tema\b/i,
  /\bnuevo tema\b/i,
  /\botro asunto\b/i,
  /\bquiero hablar (de|sobre)\b/i,
  /\banother topic\b/i,
  /\bchange (the )?subject\b/i,
  /\bnew topic\b/i,
  /\bi want to talk about\b/i,
  /\blet'?s talk about\b/i,
  /\bdifferent (topic|subject)\b/i,
];

const formatInteractionExchange = (
  interactionScope: ClinicalChatMessage[]
): string =>
  interactionScope
    .slice(-8)
    .map((message) => {
      const role = message.sender === 'user' ? 'Paciente' : 'Agente';
      return `${role}: ${message.text}`;
    })
    .join('\n');

/** Explicit phrases that signal the patient is starting a new topic. */
export const detectExplicitPatientTopicChange = (
  userMessage: string,
  interactionScope: ClinicalChatMessage[]
): boolean => {
  const priorUserMessages = interactionScope.filter(
    (message) => message.sender === 'user'
  ).length;

  if (priorUserMessages === 0) {
    return false;
  }

  const trimmed = userMessage.trim();
  return TOPIC_SHIFT_PATTERNS.some((pattern) => pattern.test(trimmed));
};

const parseTopicShiftClassifierReply = (raw: string): boolean => {
  const normalized = raw.trim().toUpperCase();
  return (
    normalized.startsWith('YES') ||
    normalized.startsWith('SIM') ||
    normalized.startsWith('SÍ') ||
    normalized.startsWith('SI ')
  );
};

/** Lightweight model check when the patient shifts topic without explicit phrases. */
export const classifyPatientTopicShift = async (
  env: Env,
  userMessage: string,
  interactionScope: ClinicalChatMessage[]
): Promise<boolean> => {
  if (detectExplicitPatientTopicChange(userMessage, interactionScope)) {
    return true;
  }

  const priorUserMessages = interactionScope.filter(
    (message) => message.sender === 'user'
  ).length;

  if (priorUserMessages === 0 || !interactionScope.length) {
    return false;
  }

  const model = createPatientTopicClassifierModel(env);
  const system = new SystemMessage(
    [
      'Classifique se a nova mensagem do paciente inicia um TEMA NOVO, claramente diferente da troca recente.',
      'Responda APENAS YES ou NO.',
      'YES = novo tema ou novo assunto.',
      'NO = continuação do mesmo tema.',
    ].join('\n')
  );
  const human = new HumanMessage(
    [
      'Troca recente:',
      formatInteractionExchange(interactionScope),
      '',
      `Nova mensagem do paciente: "${userMessage}"`,
      '',
      'Novo tema?',
    ].join('\n')
  );

  const response = await model.invoke([system, human]);
  const content =
    typeof response.content === 'string'
      ? response.content
      : String(response.content);

  return parseTopicShiftClassifierReply(content);
};
