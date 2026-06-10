import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import { PATIENT_CHAT_WEEKLY_LOOKBACK_MS } from '../../application/patient-chat-interaction-groups.js';
import { formatWeeklyPatientChatContext } from './patient-chat-weekly-context.js';
import { normalizeAppLanguage } from './psychologist-copilot-system.js';

export const buildPatientChatRecommendedActionsSystemPrompt = (
  languageInput: unknown,
  patientChatHistory: ClinicalChatMessage[],
  sessionContext: string,
  sessionConsiderations: string
): string => {
  const language = normalizeAppLanguage(languageInput);
  const { digest, blocks, conversationCount } = formatWeeklyPatientChatContext(
    patientChatHistory,
    language
  );

  const prompts: Record<AppLanguage, string[]> = {
    pt: [
      'Você sugere AÇÕES RECOMENDADAS para o psicólogo na próxima sessão, com base nas conversas do paciente com o agente de IA.',
      `Janela de análise: últimos ${PATIENT_CHAT_WEEKLY_LOOKBACK_MS / (24 * 60 * 60 * 1000)} dias (${conversationCount} conversa(s) neste período).`,
      'OBRIGATÓRIO: proponha ações que considerem TODAS as conversas da semana — não foque só na mais recente.',
      'Cada ação deve ser concreta, acionável na sessão clínica e ligada ao que o paciente relatou.',
      'Priorize exploração terapêutica, validação, psicoeducação e monitoramento — sem prescrever tratamento médico.',
      'Sem diagnóstico definitivo. Linguagem clínica objetiva.',
      'Seja MUITO conciso: 2 a 3 ações, uma por linha, no máximo 12 palavras cada (sem numeração nem marcadores).',
      `Considerações da sessão em andamento:\n${sessionConsiderations.trim() || '(não informado)'}`,
      `Contexto clínico:\n${sessionContext.trim() || '(não informado)'}`,
      digest ? `Panorama semanal:\n${digest}` : '',
      `Detalhes das conversas (última semana):\n${blocks || '(sem conversas na última semana)'}`,
    ],
    es: [
      'Sugieres ACCIONES RECOMENDADAS para el psicólogo en la próxima sesión, según las conversaciones del paciente con el agente de IA.',
      `Ventana de análisis: últimos ${PATIENT_CHAT_WEEKLY_LOOKBACK_MS / (24 * 60 * 60 * 1000)} días (${conversationCount} conversación(es) en este período).`,
      'OBLIGATORIO: propón acciones que consideren TODAS las conversaciones de la semana — no solo la más reciente.',
      'Cada acción debe ser concreta, aplicable en sesión y vinculada a lo que el paciente relató.',
      'Sin diagnóstico definitivo. Lenguaje clínico objetivo.',
      'Sé MUY conciso: 2 a 3 acciones, una por línea, máximo 12 palabras cada una (sin numeración ni viñetas).',
      `Consideraciones de la sesión en curso:\n${sessionConsiderations.trim() || '(no informado)'}`,
      `Contexto clínico:\n${sessionContext.trim() || '(no informado)'}`,
      digest ? `Panorama semanal:\n${digest}` : '',
      `Detalles de las conversaciones (última semana):\n${blocks || '(sin conversaciones en la última semana)'}`,
    ],
    en: [
      'You suggest RECOMMENDED ACTIONS for the psychologist in the next session, based on patient conversations with the AI agent.',
      `Analysis window: last ${PATIENT_CHAT_WEEKLY_LOOKBACK_MS / (24 * 60 * 60 * 1000)} days (${conversationCount} conversation(s) in this period).`,
      'REQUIRED: propose actions that consider ALL conversations this week — not only the latest one.',
      'Each action must be concrete, actionable in session, and tied to what the patient reported.',
      'No definitive diagnosis. Use objective clinical language.',
      'Be VERY concise: 2 to 3 actions, one per line, at most 12 words each (no numbering or bullets).',
      `Ongoing session considerations:\n${sessionConsiderations.trim() || '(not provided)'}`,
      `Clinical context:\n${sessionContext.trim() || '(not provided)'}`,
      digest ? `Weekly overview:\n${digest}` : '',
      `Conversation details (last week):\n${blocks || '(no conversations in the last week)'}`,
    ],
  };

  return (prompts[language] ?? prompts.pt).filter(Boolean).join('\n\n');
};

export const buildPatientChatRecommendedActionsHumanPrompt = (
  languageInput: unknown
): string => {
  const language = normalizeAppLanguage(languageInput);

  const blocks: Record<AppLanguage, string> = {
    pt: 'Liste 2 a 3 ações bem curtas (máx. 12 palavras cada) com base na semana. Uma por linha. Retorne somente o texto.',
    es: 'Lista 2 a 3 acciones muy cortas (máx. 12 palabras cada una) según la semana. Una por línea. Devuelve solo el texto.',
    en: 'List 2 to 3 very short actions (max 12 words each) from the week. One per line. Return only the text.',
  };

  return blocks[language];
};
