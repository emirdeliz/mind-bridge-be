import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

type PatientMoodPromptInput = {
  userMessage: string;
  chatHistory: ClinicalChatMessage[];
  currentMoodValue: number | null;
};

const formatChatHistory = (messages: ClinicalChatMessage[]): string => {
  const recent = messages.slice(-8);
  if (!recent.length) {
    return '(sem histórico)';
  }

  return recent
    .map((message) => {
      const role = message.sender === 'user' ? 'Paciente' : 'Agente';
      return `${role}: ${message.text}`;
    })
    .join('\n');
};

const prompts: Record<
  AppLanguage,
  (input: PatientMoodPromptInput) => { system: string; human: string }
> = {
  pt: (input) => ({
    system: [
      'Você estima o humor emocional de um paciente (escala 1–10) com base nas mensagens trocadas com o agente de IA.',
      '1 = muito baixo, 10 = muito bom.',
      'Responda APENAS com JSON válido: {"moodScore":number}',
      'Considere tom, conteúdo emocional e evolução recente do diálogo.',
      `Humor atual no painel (último ponto): ${input.currentMoodValue ?? 'desconhecido'}`,
    ].join('\n'),
    human: [
      'Histórico recente:',
      formatChatHistory(input.chatHistory),
      '',
      'Nova mensagem do paciente:',
      input.userMessage,
    ].join('\n'),
  }),
  es: (input) => ({
    system: [
      'Estimas el estado de ánimo de un paciente (escala 1–10) según los mensajes con el agente de IA.',
      '1 = muy bajo, 10 = muy bueno.',
      'Responde SOLO con JSON válido: {"moodScore":number}',
      `Ánimo actual en el panel: ${input.currentMoodValue ?? 'desconocido'}`,
    ].join('\n'),
    human: [
      'Historial reciente:',
      formatChatHistory(input.chatHistory),
      '',
      'Nuevo mensaje del paciente:',
      input.userMessage,
    ].join('\n'),
  }),
  en: (input) => ({
    system: [
      'You estimate a patient mood score (1–10) from messages exchanged with the AI agent.',
      '1 = very low, 10 = very good.',
      'Reply ONLY with valid JSON: {"moodScore":number}',
      `Current dashboard mood: ${input.currentMoodValue ?? 'unknown'}`,
    ].join('\n'),
    human: [
      'Recent history:',
      formatChatHistory(input.chatHistory),
      '',
      'New patient message:',
      input.userMessage,
    ].join('\n'),
  }),
};

export const buildPatientMoodAnalyticsPrompts = (
  language: AppLanguage,
  input: PatientMoodPromptInput
): { system: string; human: string } => {
  const builder = prompts[language] ?? prompts.pt;
  return builder(input);
};
