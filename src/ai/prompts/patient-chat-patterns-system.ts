import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import { PATIENT_CHAT_WEEKLY_LOOKBACK_MS } from '@application/patient-chat-interaction-groups.js';
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
      'Seja MUITO conciso: 2 a 3 itens curtos, um por linha (sem numeração nem marcadores).',
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
      'Sé MUY conciso: 2 a 3 ítems cortos, uno por línea (sin numeración ni viñetas).',
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
      'Be VERY concise: 2 to 3 short items, one per line (no numbering or bullets).',
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
    pt: 'Liste 2 a 3 padrões bem curtos de TODAS as conversas da semana. Um por linha. Retorne somente o texto.',
    es: 'Lista 2 a 3 patrones muy cortos de TODAS las conversaciones de la semana. Uno por línea. Devuelve solo el texto.',
    en: 'List 2 to 3 very short patterns from ALL conversations this week. One per line. Return only the text.',
  };

  return blocks[language];
};
