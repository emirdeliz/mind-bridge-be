import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import {
  getInteractionGroupsFromLastWeek,
  PATIENT_CHAT_WEEKLY_LOOKBACK_MS,
} from '../../application/patient-chat-interaction-groups.js';
import { normalizeAppLanguage } from './psychologist-copilot-system.js';

const formatInteractionDate = (
  message: ClinicalChatMessage | undefined,
  language: AppLanguage
): string => {
  if (!message?.createdAt) {
    return '';
  }
  const parsed = Date.parse(message.createdAt);
  if (Number.isNaN(parsed)) {
    return '';
  }

  const locale =
    language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-US';

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(parsed));
};

const buildWeeklyDigest = (
  groups: ClinicalChatMessage[][],
  language: AppLanguage
): string => {
  if (!groups.length) {
    return '';
  }

  const labels: Record<AppLanguage, string> = {
    pt: 'conversa(s) na última semana',
    es: 'conversación(es) en la última semana',
    en: 'conversation(s) in the last week',
  };

  const lines = groups.map((messages, index) => {
    const firstUser = messages.find((message) => message.sender === 'user');
    const preview = (firstUser?.text ?? '').trim().slice(0, 100);
    const date = formatInteractionDate(firstUser, language);
    const dateSuffix = date ? `, ${date}` : '';
    return `${index + 1}. ${preview}${dateSuffix}`;
  });

  return `${groups.length} ${labels[language]}:\n${lines.join('\n')}`;
};

const formatWeeklyInteractionBlocks = (
  history: ClinicalChatMessage[],
  language: AppLanguage
): { digest: string; blocks: string; conversationCount: number } => {
  const groups = getInteractionGroupsFromLastWeek(history);

  const blocks = groups
    .map((messages, index) => {
      const firstUser = messages.find((message) => message.sender === 'user');
      const date = formatInteractionDate(firstUser, language);
      const header = date
        ? `--- Conversa ${index + 1} (${date}) ---`
        : `--- Conversa ${index + 1} ---`;

      const lines = messages
        .map((message) => {
          const role = message.sender === 'user' ? 'Paciente' : 'Agente';
          return `  ${role}: ${message.text}`;
        })
        .join('\n');

      return `${header}\n${lines}`;
    })
    .join('\n\n');

  return {
    digest: buildWeeklyDigest(groups, language),
    blocks,
    conversationCount: groups.length,
  };
};

export const buildPatientChatPatternsSystemPrompt = (
  languageInput: unknown,
  patientChatHistory: ClinicalChatMessage[],
  sessionContext: string
): string => {
  const language = normalizeAppLanguage(languageInput);
  const { digest, blocks, conversationCount } = formatWeeklyInteractionBlocks(
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
      'Responda em 3 a 5 frases curtas, texto corrido (sem listas numeradas).',
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
      'Responde en 3 a 5 frases cortas, texto continuo (sin listas numeradas).',
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
      'Reply in 3 to 5 short sentences, plain prose (no numbered lists).',
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
    pt: 'Sintetize padrões recorrentes de TODAS as conversas da última semana. Não foque só na última conversa. Retorne somente o texto dos padrões.',
    es: 'Sintetiza patrones recurrentes de TODAS las conversaciones de la última semana. No te centres solo en la última. Devuelve solo el texto de los patrones.',
    en: 'Synthesize recurring patterns from ALL conversations in the last week. Do not focus only on the latest conversation. Return only the patterns text.',
  };

  return blocks[language];
};
