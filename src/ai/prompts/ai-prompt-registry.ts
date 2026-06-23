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
      pt: 'Chat do paciente — prompt de sistema',
      en: 'Patient chat — system prompt',
      es: 'Chat del paciente — prompt de sistema',
    },
    description: {
      pt: 'Instruções principais do agente que conversa com o paciente entre sessões.',
      en: 'Main instructions for the agent that talks to the patient between sessions.',
      es: 'Instrucciones principales del agente que conversa con el paciente entre sesiones.',
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
      pt: 'Instruções dinâmicas adicionadas a cada mensagem do paciente.',
      en: 'Dynamic instructions added on each patient message.',
      es: 'Instrucciones dinámicas añadidas en cada mensaje del paciente.',
    },
    allowedTokens: PATIENT_CHAT_TURN_TOKENS,
  },
  {
    key: 'psychologist_copilot.system',
    category: 'psychologist_copilot',
    label: {
      pt: 'Copiloto do psicólogo — prompt de sistema',
      en: 'Psychologist copilot — system prompt',
      es: 'Copiloto del psicólogo — prompt de sistema',
    },
    description: {
      pt: 'Instruções do assistente usado pelo psicólogo durante sessões ao vivo.',
      en: 'Instructions for the assistant used by the psychologist during live sessions.',
      es: 'Instrucciones del asistente usado por el psicólogo durante sesiones en vivo.',
    },
    allowedTokens: COPILOT_SYSTEM_TOKENS,
  },
  {
    key: 'response_language.instruction',
    category: 'shared',
    label: {
      pt: 'Instrução de idioma da resposta',
      en: 'Response language instruction',
      es: 'Instrucción de idioma de la respuesta',
    },
    description: {
      pt: 'Frase fixa anexada ao final do prompt de sistema do chat do paciente.',
      en: 'Fixed phrase appended to the end of the patient chat system prompt.',
      es: 'Frase fija añadida al final del prompt de sistema del chat del paciente.',
    },
    allowedTokens: [],
  },
  {
    key: 'response_language.psychologist_brevity',
    category: 'psychologist_copilot',
    label: {
      pt: 'Copiloto — instrução de brevidade',
      en: 'Copilot — brevity instruction',
      es: 'Copiloto — instrucción de brevedad',
    },
    description: {
      pt: 'Instrução para respostas curtas do copiloto em sessões ao vivo.',
      en: 'Instruction for short copilot replies during live sessions.',
      es: 'Instrucción para respuestas cortas del copiloto en sesiones en vivo.',
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
