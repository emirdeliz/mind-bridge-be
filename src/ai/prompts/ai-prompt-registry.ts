import type { AiPromptTemplateDefinition } from '@domain/ai-prompt-template.types.js';

const PATIENT_CHAT_SYSTEM_TOKENS = [
  'core_guidance',
  'context_usage_guidance',
  'present_moment_guidance',
  'pacing_guidance',
  'text_context_label',
  'psychologist_context',
  'focus_block',
  'knowledge_section',
  'forbidden_line',
];

const PATIENT_CHAT_TURN_TOKENS = [
  'retry_guidance',
  'angle_guidance',
  'anti_repetition_guidance',
  'question_count',
  'step_hint',
  'user_message',
];

const COPILOT_SYSTEM_TOKENS = [
  'session_considerations',
  'clinical_context',
  'retrieval_context',
];

export const AI_PROMPT_TEMPLATE_DEFINITIONS: AiPromptTemplateDefinition[] = [
  {
    key: 'patient_chat.system',
    category: 'patient_chat',
    label: {
      pt: 'Chat do paciente — orientação principal',
      en: 'Patient chat — main guidance',
      es: 'Chat del paciente — orientación principal',
    },
    description: {
      pt: 'Orientações principais do agente que conversa com o paciente entre sessões.',
      en: 'Main guidance for the agent that talks to the patient between sessions.',
      es: 'Orientaciones principales del agente que conversa con el paciente entre sesiones.',
    },
    allowedTokens: PATIENT_CHAT_SYSTEM_TOKENS,
  },
  {
    key: 'patient_chat.turn_guidance',
    category: 'patient_chat',
    label: {
      pt: 'Chat do paciente — orientação por turno',
      en: 'Patient chat — turn guidance',
      es: 'Chat del paciente — orientación por turno',
    },
    description: {
      pt: 'Orientações dinâmicas adicionadas a cada mensagem do paciente.',
      en: 'Dynamic guidance added on each patient message.',
      es: 'Orientaciones dinámicas añadidas en cada mensaje del paciente.',
    },
    allowedTokens: PATIENT_CHAT_TURN_TOKENS,
  },
  {
    key: 'psychologist_copilot.system',
    category: 'psychologist_copilot',
    label: {
      pt: 'Copiloto do psicólogo — orientação principal',
      en: 'Psychologist copilot — main guidance',
      es: 'Copiloto del psicólogo — orientación principal',
    },
    description: {
      pt: 'Orientações do assistente usado pelo psicólogo durante sessões ao vivo.',
      en: 'Guidance for the assistant used by the psychologist during live sessions.',
      es: 'Orientaciones del asistente usado por el psicólogo durante sesiones en vivo.',
    },
    allowedTokens: COPILOT_SYSTEM_TOKENS,
  },
  {
    key: 'response_language.instruction',
    category: 'shared',
    label: {
      pt: 'Orientação de idioma da resposta',
      en: 'Response language guidance',
      es: 'Orientación de idioma de la respuesta',
    },
    description: {
      pt: 'Frase fixa anexada ao final da orientação principal do chat do paciente.',
      en: 'Fixed phrase appended to the end of the patient chat main guidance.',
      es: 'Frase fija añadida al final de la orientación principal del chat del paciente.',
    },
    allowedTokens: [],
  },
  {
    key: 'response_language.psychologist_brevity',
    category: 'psychologist_copilot',
    label: {
      pt: 'Copiloto — orientação de brevidade',
      en: 'Copilot — brevity guidance',
      es: 'Copiloto — orientación de brevedad',
    },
    description: {
      pt: 'Orientação para respostas curtas do copiloto em sessões ao vivo.',
      en: 'Guidance for short copilot replies during live sessions.',
      es: 'Orientación para respuestas cortas del copiloto en sesiones en vivo.',
    },
    allowedTokens: [],
  },
];

export const getAiPromptTemplateDefinition = (
  key: string
): AiPromptTemplateDefinition | undefined =>
  AI_PROMPT_TEMPLATE_DEFINITIONS.find((definition) => definition.key === key);

export const listAiPromptTemplateDefinitions = (): AiPromptTemplateDefinition[] =>
  [...AI_PROMPT_TEMPLATE_DEFINITIONS];
