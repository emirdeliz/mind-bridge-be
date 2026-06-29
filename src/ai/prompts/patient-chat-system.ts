import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import { getActiveAiPromptTemplateContent } from '@application/ai-prompt-template-resolver.js';
import { PATIENT_CHAT_MAX_QUESTIONS_PER_INTERACTION } from './patient-chat-session.js';
import { buildContextFocusBlock } from './patient-chat-context-focus.js';
import {
  buildPatientChatCoreGuidance,
  buildPatientChatPacingGuidance,
  buildPresentMomentGuidance,
  buildPsychologistContextUsageGuidance,
} from './patient-chat-interaction.js';
import { applyPromptTokens } from '@ai/prompts/apply-prompt-tokens.js';
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

export const buildPatientChatKnowledgeSection = (
  language: AppLanguage,
  retrievalContext: string
): string => {
  const knowledgeBlock = retrievalContext.trim();
  if (!knowledgeBlock) {
    return '';
  }

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

  return [
    knowledgeHeader[language] ?? knowledgeHeader.pt,
    knowledgeBlock,
    knowledgeNote[language] ?? knowledgeNote.pt,
  ].join('\n');
};

const PATIENT_CHAT_TEXT_CONTEXT_LABEL: Record<AppLanguage, string> = {
  pt: 'Contexto de texto do psicólogo (campo da sessão — uso interno, traduza para linguagem simples):',
  es: 'Contexto de texto del psicólogo (campo de la sesión — uso interno, traduzca a lenguaje simple):',
  en: 'Psychologist text context (session field — internal use, translate to simple language):',
};

const PATIENT_CHAT_FORBIDDEN_LINE: Record<AppLanguage, string> = {
  pt: 'PROIBIDO: raciocínio interno, análise, "Thinking Process", listas numeradas. Envie SOMENTE a mensagem final ao paciente.',
  es: 'PROHIBIDO: razonamiento interno, análisis, "Thinking Process", listas numeradas. Envía SOLO el mensaje final al paciente.',
  en: 'FORBIDDEN: internal reasoning, analysis, "Thinking Process", numbered lists. Send ONLY the final message to the patient.',
};

export const getPatientChatTextContextLabel = (language: AppLanguage): string =>
  PATIENT_CHAT_TEXT_CONTEXT_LABEL[language] ?? PATIENT_CHAT_TEXT_CONTEXT_LABEL.pt;

export const getPatientChatForbiddenLine = (language: AppLanguage): string =>
  PATIENT_CHAT_FORBIDDEN_LINE[language] ?? PATIENT_CHAT_FORBIDDEN_LINE.pt;

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

  const focusBlock = hasTextContext
    ? buildContextFocusBlock(language, context.psychologistContext)
    : '';
  const pacingGuidance = buildPatientChatPacingGuidance(
    language,
    questionCount,
    PATIENT_CHAT_MAX_QUESTIONS_PER_INTERACTION
  );
  const coreGuidance = buildPatientChatCoreGuidance(language);
  const presentMomentGuidance = buildPresentMomentGuidance(language);
  const contextUsageGuidance = buildPsychologistContextUsageGuidance(language, {
    hasTextContext,
    hasKnowledgeContext,
  });

  const template = getActiveAiPromptTemplateContent(
    'patient_chat.system',
    language
  );

  return applyPromptTokens(template, {
    core_guidance: coreGuidance,
    context_usage_guidance: contextUsageGuidance,
    present_moment_guidance: presentMomentGuidance,
    pacing_guidance: pacingGuidance,
    text_context_label: getPatientChatTextContextLabel(language),
    psychologist_context: psychologistContext,
    focus_block: focusBlock,
    knowledge_section: buildPatientChatKnowledgeSection(
      language,
      context.retrievalContext ?? ''
    ),
    forbidden_line: getPatientChatForbiddenLine(language),
    retrieval_context: context.retrievalContext?.trim() ?? '',
    question_count: String(questionCount),
    max_questions: String(PATIENT_CHAT_MAX_QUESTIONS_PER_INTERACTION),
  });
};
