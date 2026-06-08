import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import { normalizeAppLanguage } from './psychologist-copilot-system.js';

type PatientChatPromptContext = {
  psychologistContext: string;
  retrievalContext: string;
  chatHistory: ClinicalChatMessage[];
};

const notProvided = (language: AppLanguage): string => {
  const labels: Record<AppLanguage, string> = {
    pt: '(não informado pelo psicólogo)',
    es: '(no informado por el psicólogo)',
    en: '(not provided by the psychologist)',
  };
  return labels[language];
};

const formatChatHistory = (
  language: AppLanguage,
  messages: ClinicalChatMessage[]
): string => {
  const recent = messages.slice(-6);
  if (!recent.length) {
    const empty: Record<AppLanguage, string> = {
      pt: '(primeira mensagem da conversa)',
      es: '(primer mensaje de la conversa)',
      en: '(first message in the conversation)',
    };
    return empty[language];
  }

  return recent
    .map((message) => {
      const role =
        message.sender === 'user'
          ? language === 'pt'
            ? 'Paciente'
            : language === 'es'
              ? 'Paciente'
              : 'Patient'
          : language === 'pt'
            ? 'Agente'
            : language === 'es'
              ? 'Agente'
              : 'Agent';
      return `${role}: ${message.text}`;
    })
    .join('\n');
};

export const buildPatientChatSystemPrompt = (
  languageInput: unknown,
  context: PatientChatPromptContext
): string => {
  const language = normalizeAppLanguage(languageInput);
  const psychologistContext =
    context.psychologistContext.trim() || notProvided(language);
  const history = formatChatHistory(language, context.chatHistory);

  const blocks: Record<AppLanguage, string[]> = {
    pt: [
      'Você é um companheiro de apoio emocional para um paciente entre sessões de terapia.',
      'Seja empático e acolhedor, sem dar diagnóstico nem substituir o psicólogo.',
      'Responda em no máximo 2 frases curtas (até 35 palavras no total).',
      'Proibido: listas, tópicos, markdown, saudações longas e parágrafos extensos.',
      'Se houver risco ou crise, incentive buscar ajuda profissional imediata em uma frase breve.',
      `Contexto do psicólogo para a IA: ${psychologistContext}`,
      context.retrievalContext,
      `Histórico recente da conversa:\n${history}`,
      'Lembrete: resposta curta, natural e fluida para chat.',
    ],
    es: [
      'Eres un acompañante de apoyo emocional para un paciente entre sesiones de terapia.',
      'Sé empático y acogedor, sin diagnosticar ni reemplazar al psicólogo.',
      'Responde en máximo 2 frases cortas (hasta 35 palabras en total).',
      'Prohibido: listas, viñetas, markdown, saludos largos y párrafos extensos.',
      'Si hay riesgo o crisis, anima a buscar ayuda profesional inmediata en una frase breve.',
      `Contexto del psicólogo para la IA: ${psychologistContext}`,
      context.retrievalContext,
      `Historial reciente de la conversa:\n${history}`,
      'Recordatorio: respuesta corta, natural y fluida para chat.',
    ],
    en: [
      'You are a supportive emotional companion for a patient between therapy sessions.',
      'Be empathetic and warm, without diagnosing or replacing the psychologist.',
      'Reply in at most 2 short sentences (up to 35 words total).',
      'No lists, bullets, markdown, long greetings, or long paragraphs.',
      'If there is risk or crisis, encourage immediate professional help in one brief sentence.',
      `Psychologist context for the AI: ${psychologistContext}`,
      context.retrievalContext,
      `Recent conversation history:\n${history}`,
      'Reminder: keep the reply short, natural, and chat-friendly.',
    ],
  };

  return (blocks[language] ?? blocks.pt).join('\n');
};
