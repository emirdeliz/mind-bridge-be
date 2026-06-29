import type { AppLanguage } from '@domain/types.js';

const systemSource: Record<AppLanguage, string> = {
  pt: 'Gerado automaticamente pelo aplicativo em cada mensagem. Não é editável nesta tela — a prévia mostra o que será inserido no lugar de #palavra_reservada.',
  en: 'Generated automatically by the app on each message. Not editable on this screen — the preview shows what will be inserted in place of #reserved_word.',
  es: 'Generado automáticamente por la aplicación en cada mensaje. No es editable en esta pantalla — la vista previa muestra lo que se insertará en lugar de #palabra_reservada.',
};

const psychologistTextSource: Record<AppLanguage, string> = {
  pt: 'Vem do campo de contexto de texto que você preenche na sessão com o paciente.',
  en: 'Comes from the text context field you fill in during the patient session.',
  es: 'Proviene del campo de contexto de texto que completa en la sesión con el paciente.',
};

const psychologistDocumentsSource: Record<AppLanguage, string> = {
  pt: 'Montado a partir dos trechos recuperados dos PDFs enviados em Configurações → Documentos de contexto.',
  en: 'Built from excerpts retrieved from PDFs uploaded under Settings → Context documents.',
  es: 'Montado a partir de fragmentos recuperados de los PDF enviados en Configuración → Documentos de contexto.',
};

const patientMessageSource: Record<AppLanguage, string> = {
  pt: 'Vem da mensagem enviada pelo paciente nesta conversa.',
  en: 'Comes from the message sent by the patient in this conversation.',
  es: 'Proviene del mensaje enviado por el paciente en esta conversación.',
};

const patientHistorySource: Record<AppLanguage, string> = {
  pt: 'Montado automaticamente a partir das mensagens anteriores entre paciente e agente.',
  en: 'Built automatically from previous messages between patient and agent.',
  es: 'Montado automáticamente a partir de los mensajes anteriores entre paciente y agente.',
};

const runtimeCounterSource: Record<AppLanguage, string> = {
  pt: 'Calculado automaticamente durante a conversa com base no andamento da interação.',
  en: 'Calculated automatically during the conversation based on interaction progress.',
  es: 'Calculado automáticamente durante la conversación según el progreso de la interacción.',
};

const conditionalSource: Record<AppLanguage, string> = {
  pt: 'Inserido somente em situações específicas; na maioria das mensagens fica vazio.',
  en: 'Inserted only in specific situations; empty on most messages.',
  es: 'Insertado solo en situaciones específicas; en la mayoría de los mensajes queda vacío.',
};

const languageInstructionSource: Record<AppLanguage, string> = {
  pt: 'Texto fixo anexado pelo aplicativo para manter o idioma da resposta.',
  en: 'Fixed text appended by the app to keep the response language consistent.',
  es: 'Texto fijo añadido por la aplicación para mantener el idioma de la respuesta.',
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
