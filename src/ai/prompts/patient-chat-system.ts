import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import { PATIENT_CHAT_MAX_QUESTIONS_PER_INTERACTION } from './patient-chat-session.js';
import { buildContextFocusBlock } from './patient-chat-context-focus.js';
import {
  buildPatientChatCoreGuidance,
  buildPatientChatPacingGuidance,
  buildPresentMomentGuidance,
  buildPsychologistContextUsageGuidance,
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
  const hasTextContext = Boolean(context.psychologistContext.trim());
  const hasKnowledgeContext = Boolean(context.retrievalContext?.trim());
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
  const contextUsageGuidance = buildPsychologistContextUsageGuidance(
    language,
    { hasTextContext, hasKnowledgeContext }
  );

  const roleLine: Record<AppLanguage, string> = {
    pt: 'Você acompanha o paciente entre sessões, ajudando-o a registrar relatos do dia a dia que serão úteis na sessão com o psicólogo. Conversa de escuta — sem diagnóstico, sem jargão, sem substituir o psicólogo.',
    es: 'Acompañas al paciente entre sesiones, ayudándole a registrar relatos del día a día que serán útiles en la sesión con el psicólogo. Conversación de escucha — sin diagnóstico, sin jerga, sin reemplazar al psicólogo.',
    en: 'You accompany the patient between sessions, helping them record day-to-day reports that will be useful in the session with the psychologist. Listening conversation — no diagnosis, no jargon, do not replace the psychologist.',
  };

  const textContextLabel: Record<AppLanguage, string> = {
    pt: 'Contexto de texto do psicólogo (campo da sessão — uso interno, traduza para linguagem simples):',
    es: 'Contexto de texto del psicólogo (campo de la sesión — uso interno, traduzca a lenguaje simple):',
    en: 'Psychologist text context (session field — internal use, translate to simple language):',
  };

  const knowledgeHeader: Record<AppLanguage, string> = {
    pt: 'Trechos de documentos PDF do psicólogo (protocolos/orientações — referência interna para direcionar perguntas):',
    es: 'Fragmentos de documentos PDF del psicólogo (protocolos/orientaciones — referencia interna para orientar preguntas):',
    en: 'Excerpts from psychologist PDF documents (protocols/guidance — internal reference to guide questions):',
  };

  const knowledgeNote: Record<AppLanguage, string> = {
    pt: 'Use estes trechos para formular perguntas mais pertinentes ao contexto clínico. Não cite o documento nem termos técnicos ao paciente.',
    es: 'Use estos fragmentos para formular preguntas más pertinentes al contexto clínico. No cite el documento ni términos técnicos al paciente.',
    en: 'Use these excerpts to ask more relevant questions for the clinical context. Do not cite the document or technical terms to the patient.',
  };

  const forbiddenLine: Record<AppLanguage, string> = {
    pt: 'PROIBIDO: raciocínio interno, análise, "Thinking Process", listas numeradas. Envie SOMENTE a mensagem final ao paciente.',
    es: 'PROHIBIDO: razonamiento interno, análisis, "Thinking Process", listas numeradas. Envía SOLO el mensaje final al paciente.',
    en: 'FORBIDDEN: internal reasoning, analysis, "Thinking Process", numbered lists. Send ONLY the final message to the patient.',
  };

  return [
    roleLine[language] ?? roleLine.pt,
    coreGuidance,
    contextUsageGuidance,
    presentMomentGuidance,
    pacingGuidance,
    `${textContextLabel[language] ?? textContextLabel.pt}\n${psychologistContext}`,
    hasTextContext ? focusBlock : '',
    knowledgeBlock
      ? `${knowledgeHeader[language] ?? knowledgeHeader.pt}\n${knowledgeBlock}\n${knowledgeNote[language] ?? knowledgeNote.pt}`
      : '',
    forbiddenLine[language] ?? forbiddenLine.pt,
  ]
    .filter(Boolean)
    .join('\n\n');
};
