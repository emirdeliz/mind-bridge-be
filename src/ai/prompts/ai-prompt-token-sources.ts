import type { AppLanguage } from '@domain/types.js';

const systemSource: Record<AppLanguage, string> = {
  pt: 'Preenchido automaticamente pelo aplicativo a cada mensagem.',
  en: 'Filled automatically by the app on each message.',
  es: 'Completado automáticamente por la aplicación en cada mensaje.',
};

const psychologistTextSource: Record<AppLanguage, string> = {
  pt: 'Vem do texto de contexto que você preenche na sessão.',
  en: 'Comes from the context text you fill in during the session.',
  es: 'Proviene del texto de contexto que completa en la sesión.',
};

const psychologistDocumentsSource: Record<AppLanguage, string> = {
  pt: 'Vem dos PDFs enviados em Configurações → Documentos de contexto.',
  en: 'Comes from PDFs uploaded under Settings → Context documents.',
  es: 'Proviene de los PDF enviados en Configuración → Documentos de contexto.',
};

const patientMessageSource: Record<AppLanguage, string> = {
  pt: 'Vem da mensagem enviada pelo paciente.',
  en: 'Comes from the message sent by the patient.',
  es: 'Proviene del mensaje enviado por el paciente.',
};

const patientHistorySource: Record<AppLanguage, string> = {
  pt: 'Montado a partir das mensagens anteriores da conversa.',
  en: 'Built from earlier messages in the conversation.',
  es: 'Montado a partir de los mensajes anteriores de la conversación.',
};

const runtimeCounterSource: Record<AppLanguage, string> = {
  pt: 'Calculado automaticamente conforme a conversa avança.',
  en: 'Calculated automatically as the conversation progresses.',
  es: 'Calculado automáticamente a medida que avanza la conversación.',
};

const conditionalSource: Record<AppLanguage, string> = {
  pt: 'Só aparece em situações específicas; na maioria das vezes fica vazio.',
  en: 'Only appears in specific situations; usually empty.',
  es: 'Solo aparece en situaciones específicas; por lo general queda vacío.',
};

const languageInstructionSource: Record<AppLanguage, string> = {
  pt: 'Texto fixo do aplicativo para manter o idioma da resposta.',
  en: 'Fixed app text to keep the response language consistent.',
  es: 'Texto fijo de la aplicación para mantener el idioma de la respuesta.',
};

export const AI_PROMPT_TOKEN_SOURCES: Record<
  string,
  Record<AppLanguage, string>
> = {
  psychologist_context: psychologistTextSource,
  chat_history: patientHistorySource,
  user_message: patientMessageSource,
  question_count: runtimeCounterSource,
  max_questions: runtimeCounterSource,
  retrieval_context: psychologistDocumentsSource,
  knowledge_section: psychologistDocumentsSource,
  focus_block: psychologistTextSource,
  core_guidance: systemSource,
  pacing_guidance: systemSource,
  present_moment_guidance: systemSource,
  context_usage_guidance: systemSource,
  text_context_label: systemSource,
  forbidden_line: systemSource,
  retry_guidance: conditionalSource,
  angle_guidance: systemSource,
  anti_repetition_guidance: systemSource,
  step_hint: systemSource,
  session_considerations: {
    pt: 'Vem das considerações da sessão que você informa ao usar o copiloto.',
    en: 'Comes from session considerations you provide when using the copilot.',
    es: 'Proviene de las consideraciones de sesión que indica al usar el copiloto.',
  },
  clinical_context: {
    pt: 'Montado automaticamente a partir do prontuário e resumos clínicos do paciente.',
    en: 'Built automatically from the patient chart and clinical summaries.',
    es: 'Montado automáticamente a partir de la ficha y los resúmenes clínicos del paciente.',
  },
  language_instruction: languageInstructionSource,
};

export const getAiPromptTokenSource = (
  key: string
): Record<AppLanguage, string> =>
  AI_PROMPT_TOKEN_SOURCES[key] ?? systemSource;
