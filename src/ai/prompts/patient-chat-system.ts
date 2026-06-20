import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import { PATIENT_CHAT_MAX_QUESTIONS_PER_INTERACTION } from './patient-chat-session.js';
import { buildContextFocusBlock } from './patient-chat-context-focus.js';
import {
  buildPatientChatCoreGuidance,
  buildPatientChatPacingGuidance,
  buildPresentMomentGuidance,
} from './patient-chat-interaction.js';
import { normalizeAppLanguage } from './psychologist-copilot-system.js';

type PatientChatPromptContext = {
  psychologistContext: string;
  chatHistory: ClinicalChatMessage[];
  questionCount: number;
  retrievalContext?: string;
  /** When false, history is supplied as multi-turn chat messages instead. */
  includeChatHistory?: boolean;
};

const notProvided = (language: AppLanguage): string => {
  const labels: Record<AppLanguage, string> = {
    pt: '(não informado pelo psicólogo)',
    es: '(no informado por el psicólogo)',
    en: '(not provided by the psychologist)',
  };
  return labels[language];
};

export const buildPatientChatSystemPrompt = (
  languageInput: unknown,
  context: PatientChatPromptContext
): string => {
  const language = normalizeAppLanguage(languageInput);
  const psychologistContext =
    context.psychologistContext.trim() || notProvided(language);
  const hasContext = Boolean(context.psychologistContext.trim());
  const questionCount = context.questionCount;

  const focusBlock = buildContextFocusBlock(
    language,
    context.psychologistContext
  );
  const knowledgeBlock = context.retrievalContext?.trim() ?? '';
  const pacingGuidance = buildPatientChatPacingGuidance(
    language,
    questionCount,
    PATIENT_CHAT_MAX_QUESTIONS_PER_INTERACTION
  );
  const coreGuidance = buildPatientChatCoreGuidance(language);
  const presentMomentGuidance = buildPresentMomentGuidance(language);

  const roleLine: Record<AppLanguage, string> = {
    pt: 'Você acompanha o paciente entre sessões. Conversa natural de escuta — sem diagnóstico, sem jargão, sem substituir o psicólogo.',
    es: 'Acompañas al paciente entre sesiones. Conversación natural de escucha — sin diagnóstico, sin jerga, sin reemplazar al psicólogo.',
    en: 'You accompany the patient between sessions. Natural listening conversation — no diagnosis, no jargon, do not replace the psychologist.',
  };

  const forbiddenLine: Record<AppLanguage, string> = {
    pt: 'PROIBIDO: raciocínio interno, análise, "Thinking Process", listas numeradas. Envie SOMENTE a mensagem final ao paciente.',
    es: 'PROHIBIDO: razonamiento interno, análisis, "Thinking Process", listas numeradas. Envía SOLO el mensaje final al paciente.',
    en: 'FORBIDDEN: internal reasoning, analysis, "Thinking Process", numbered lists. Send ONLY the final message to the patient.',
  };

  const knowledgeNote: Record<AppLanguage, string> = {
    pt: 'Use somente como referência interna. Não cite o documento nem termos técnicos ao paciente.',
    es: 'Úsalo solo como referencia interna. No cites el documento ni términos técnicos al paciente.',
    en: 'Use only as internal reference. Do not cite the document or technical terms to the patient.',
  };

  return [
    roleLine[language] ?? roleLine.pt,
    coreGuidance,
    presentMomentGuidance,
    pacingGuidance,
    `Contexto do psicólogo (uso interno — traduza para linguagem simples):\n${psychologistContext}`,
    hasContext ? focusBlock : '',
    knowledgeBlock
      ? `${knowledgeBlock}\n${knowledgeNote[language] ?? knowledgeNote.pt}`
      : '',
    forbiddenLine[language] ?? forbiddenLine.pt,
  ]
    .filter(Boolean)
    .join('\n\n');
};
