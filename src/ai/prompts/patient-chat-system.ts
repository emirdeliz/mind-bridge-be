import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import { normalizeAppLanguage } from './psychologist-copilot-system.js';
import type { PatientChatInteractionPhase } from './patient-chat-interaction.js';

type PatientChatPromptContext = {
  psychologistContext: string;
  chatHistory: ClinicalChatMessage[];
  interactionPhase: PatientChatInteractionPhase;
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
  const recent = messages.slice(-8);
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

const questionPhaseInstructions: Record<
  AppLanguage,
  Record<Exclude<PatientChatInteractionPhase, 'closing'>, string>
> = {
  pt: {
    'question-1':
      'Esta é a 1ª pergunta do ciclo. Com base no contexto do psicólogo, acolha brevemente e termine com UM questionamento aberto ao paciente.',
    'question-2':
      'Esta é a 2ª pergunta do ciclo. Considere o que o paciente já respondeu e faça UM novo questionamento alinhado ao contexto do psicólogo.',
    'question-3':
      'Esta é a 3ª e última pergunta do ciclo. Faça UM questionamento final, ainda alinhado ao contexto do psicólogo, sem repetir perguntas anteriores.',
  },
  es: {
    'question-1':
      'Esta es la 1.ª pregunta del ciclo. Según el contexto del psicólogo, acoge brevemente y termina con UNA pregunta abierta al paciente.',
    'question-2':
      'Esta es la 2.ª pregunta del ciclo. Considera lo que el paciente ya respondió y haz UNA nueva pregunta alineada al contexto del psicólogo.',
    'question-3':
      'Esta es la 3.ª y última pregunta del ciclo. Haz UNA pregunta final alineada al contexto del psicólogo, sin repetir preguntas anteriores.',
  },
  en: {
    'question-1':
      'This is the 1st question in the cycle. Based on the psychologist context, respond briefly with empathy and end with ONE open question for the patient.',
    'question-2':
      'This is the 2nd question in the cycle. Consider what the patient already shared and ask ONE new question aligned with the psychologist context.',
    'question-3':
      'This is the 3rd and final question in the cycle. Ask ONE final question aligned with the psychologist context, without repeating earlier questions.',
  },
};

export const buildPatientChatSystemPrompt = (
  languageInput: unknown,
  context: PatientChatPromptContext
): string => {
  const language = normalizeAppLanguage(languageInput);
  const psychologistContext =
    context.psychologistContext.trim() || notProvided(language);
  const history = formatChatHistory(language, context.chatHistory);
  const phaseInstruction =
    context.interactionPhase === 'closing'
      ? ''
      : questionPhaseInstructions[language][context.interactionPhase];

  const blocks: Record<AppLanguage, string[]> = {
    pt: [
      'Você é um companheiro de apoio emocional para um paciente entre sessões de terapia.',
      'Seja empático e acolhedor, sem dar diagnóstico nem substituir o psicólogo.',
      'Responda em no máximo 2 frases curtas (até 40 palavras no total).',
      'OBRIGATÓRIO: sua resposta deve terminar com um questionamento (frase interrogativa).',
      'Proibido: listas, tópicos, markdown, saudações longas e parágrafos extensos.',
      'Se houver risco ou crise, incentive buscar ajuda profissional imediata em uma frase breve.',
      `Contexto do psicólogo para a IA (prioridade máxima): ${psychologistContext}`,
      phaseInstruction,
      `Histórico recente da conversa:\n${history}`,
      'Lembrete: resposta curta, natural e fluida; sempre finalize com uma pergunta ao paciente.',
    ],
    es: [
      'Eres un acompañante de apoyo emocional para un paciente entre sesiones de terapia.',
      'Sé empático y acogedor, sin diagnosticar ni reemplazar al psicólogo.',
      'Responde en máximo 2 frases cortas (hasta 40 palabras en total).',
      'OBLIGATORIO: tu respuesta debe terminar con una pregunta (frase interrogativa).',
      'Prohibido: listas, viñetas, markdown, saludos largos y párrafos extensos.',
      'Si hay riesgo o crisis, anima a buscar ayuda profesional inmediata en una frase breve.',
      `Contexto del psicólogo para la IA (máxima prioridad): ${psychologistContext}`,
      phaseInstruction,
      `Historial reciente de la conversa:\n${history}`,
      'Recordatorio: respuesta corta y natural; siempre termina con una pregunta al paciente.',
    ],
    en: [
      'You are a supportive emotional companion for a patient between therapy sessions.',
      'Be empathetic and warm, without diagnosing or replacing the psychologist.',
      'Reply in at most 2 short sentences (up to 40 words total).',
      'REQUIRED: your reply must end with a question (interrogative sentence).',
      'No lists, bullets, markdown, long greetings, or long paragraphs.',
      'If there is risk or crisis, encourage immediate professional help in one brief sentence.',
      `Psychologist context for the AI (top priority): ${psychologistContext}`,
      phaseInstruction,
      `Recent conversation history:\n${history}`,
      'Reminder: keep it short and natural; always end with a question for the patient.',
    ],
  };

  return (blocks[language] ?? blocks.pt).filter(Boolean).join('\n');
};
