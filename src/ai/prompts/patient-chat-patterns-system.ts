import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import { PATIENT_CHAT_WEEKLY_LOOKBACK_MS } from '../../application/patient-chat-interaction-groups.js';
import { formatWeeklyPatientChatContext } from './patient-chat-weekly-context.js';
import { normalizeAppLanguage } from './psychologist-copilot-system.js';

export const buildPatientChatPatternsSystemPrompt = (
  languageInput: unknown,
  patientChatHistory: ClinicalChatMessage[],
  sessionContext: string
): string => {
  const language = normalizeAppLanguage(languageInput);
  const { digest, blocks, conversationCount } = formatWeeklyPatientChatContext(
    patientChatHistory,
    language
  );

  const prompts: Record<AppLanguage, string[]> = {
    pt: [
      'Você identifica PADRÕES clínicos recorrentes nas conversas do paciente com o agente de IA.',
      `Janela de análise: últimos ${PATIENT_CHAT_WEEKLY_LOOKBACK_MS / (24 * 60 * 60 * 1000)} dias (${conversationCount} conversa(s) neste período).`,
      'OBRIGATÓRIO: sintetize padrões que atravessam VÁRIAS conversas da semana — não descreva só a conversa mais recente.',
      'Busque recorrências emocionais, cognitivas, comportamentais, gatilhos e contextos entre conversas.',
      'Se houver apenas uma conversa na semana, descreva padrões emergentes nela e o que monitorar.',
      'Use linguagem clínica objetiva, sem diagnóstico definitivo.',
      'Seja MUITO conciso: no máximo 2 frases curtas, texto corrido (sem listas).',
      `Contexto do psicólogo (apoio):\n${sessionContext.trim() || '(não informado)'}`,
      digest ? `Panorama semanal:\n${digest}` : '',
      `Detalhes das conversas (última semana):\n${blocks || '(sem conversas na última semana)'}`,
    ],
    es: [
      'Identificas PATRONES clínicos recurrentes en las conversaciones del paciente con el agente de IA.',
      `Ventana de análisis: últimos ${PATIENT_CHAT_WEEKLY_LOOKBACK_MS / (24 * 60 * 60 * 1000)} días (${conversationCount} conversación(es) en este período).`,
      'OBLIGATORIO: sintetiza patrones que cruzan VARIAS conversaciones de la semana — no describas solo la más reciente.',
      'Busca recurrencias emocionales, cognitivas, conductuales, disparadores y contextos entre conversaciones.',
      'Lenguaje clínico objetivo, sin diagnóstico definitivo.',
      'Sé MUY conciso: máximo 2 frases cortas, texto continuo (sin listas).',
      `Contexto del psicólogo:\n${sessionContext.trim() || '(no informado)'}`,
      digest ? `Panorama semanal:\n${digest}` : '',
      `Detalles de las conversaciones (última semana):\n${blocks || '(sin conversaciones en la última semana)'}`,
    ],
    en: [
      'You identify recurring clinical PATTERNS in the patient conversations with the AI agent.',
      `Analysis window: last ${PATIENT_CHAT_WEEKLY_LOOKBACK_MS / (24 * 60 * 60 * 1000)} days (${conversationCount} conversation(s) in this period).`,
      'REQUIRED: synthesize patterns across MULTIPLE conversations this week — do not describe only the latest one.',
      'Look for recurring emotional, cognitive, behavioral themes, triggers and contexts across conversations.',
      'Use objective clinical language, no definitive diagnosis.',
      'Be VERY concise: at most 2 short sentences, plain prose (no lists).',
      `Psychologist context:\n${sessionContext.trim() || '(not provided)'}`,
      digest ? `Weekly overview:\n${digest}` : '',
      `Conversation details (last week):\n${blocks || '(no conversations in the last week)'}`,
    ],
  };

  return (prompts[language] ?? prompts.pt).filter(Boolean).join('\n\n');
};

export const buildPatientChatPatternsHumanPrompt = (
  languageInput: unknown
): string => {
  const language = normalizeAppLanguage(languageInput);

  const blocks: Record<AppLanguage, string> = {
    pt: 'Resuma em no máximo 2 frases curtas os padrões de TODAS as conversas da semana. Sem introdução. Retorne somente o texto.',
    es: 'Resume en máximo 2 frases cortas los patrones de TODAS las conversaciones de la semana. Sin introducción. Devuelve solo el texto.',
    en: 'Summarize in at most 2 short sentences the patterns from ALL conversations this week. No introduction. Return only the text.',
  };

  return blocks[language];
};
