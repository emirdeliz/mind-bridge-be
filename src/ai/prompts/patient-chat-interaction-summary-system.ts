import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import { formatInteractionGroupsBlocks } from './patient-chat-weekly-context.js';
import { normalizeAppLanguage } from './psychologist-copilot-system.js';

export const buildPatientChatInteractionSummarySystemPrompt = (
  languageInput: unknown,
  interactionGroups: ClinicalChatMessage[][],
  sessionContext: string
): string => {
  const language = normalizeAppLanguage(languageInput);
  const blocks = formatInteractionGroupsBlocks(interactionGroups, language);
  const conversationCount = interactionGroups.length;

  const prompts: Record<AppLanguage, string[]> = {
    pt: [
      'Você resume conversas do paciente com o agente de IA para exibição clínica.',
      `Há ${conversationCount} conversa(s) abaixo, na ordem cronológica.`,
      'Para CADA conversa, escreva UM resumo objetivo em 1 frase curta (máx. 20 palavras).',
      'Sintetize tema principal e estado emocional — NÃO reproduza o texto literal do paciente.',
      'Sem diagnóstico definitivo. Linguagem clínica simples.',
      `Retorne exatamente ${conversationCount} linha(s), uma por conversa, na mesma ordem, sem numeração nem rótulos.`,
      `Contexto clínico (apoio):\n${sessionContext.trim() || '(não informado)'}`,
      `Conversas:\n${blocks || '(sem conversas)'}`,
    ],
    es: [
      'Resumes conversaciones del paciente con el agente de IA para visualización clínica.',
      `Hay ${conversationCount} conversación(es) abajo, en orden cronológico.`,
      'Para CADA conversación, escribe UN resumen objetivo en 1 frase corta (máx. 20 palabras).',
      'Sintetiza tema principal y estado emocional — NO reproduzcas el texto literal del paciente.',
      'Sin diagnóstico definitivo. Lenguaje clínico simple.',
      `Devuelve exactamente ${conversationCount} línea(s), una por conversación, en el mismo orden, sin numeración ni etiquetas.`,
      `Contexto clínico:\n${sessionContext.trim() || '(no informado)'}`,
      `Conversaciones:\n${blocks || '(sin conversaciones)'}`,
    ],
    en: [
      'You summarize patient conversations with the AI agent for clinical display.',
      `There are ${conversationCount} conversation(s) below, in chronological order.`,
      'For EACH conversation, write ONE objective summary in 1 short sentence (max 20 words).',
      'Synthesize main theme and emotional state — do NOT reproduce the patient literal text.',
      'No definitive diagnosis. Simple clinical language.',
      `Return exactly ${conversationCount} line(s), one per conversation, same order, no numbering or labels.`,
      `Clinical context:\n${sessionContext.trim() || '(not provided)'}`,
      `Conversations:\n${blocks || '(no conversations)'}`,
    ],
  };

  return (prompts[language] ?? prompts.pt).join('\n\n');
};

export const buildPatientChatInteractionSummaryHumanPrompt = (
  languageInput: unknown,
  conversationCount: number
): string => {
  const language = normalizeAppLanguage(languageInput);

  const blocks: Record<AppLanguage, string> = {
    pt: `Resuma cada conversa em 1 frase curta. Retorne exatamente ${conversationCount} linha(s), uma por conversa, somente o texto dos resumos.`,
    es: `Resume cada conversación en 1 frase corta. Devuelve exactamente ${conversationCount} línea(s), una por conversación, solo el texto de los resúmenes.`,
    en: `Summarize each conversation in 1 short sentence. Return exactly ${conversationCount} line(s), one per conversation, only the summary text.`,
  };

  return blocks[language];
};
