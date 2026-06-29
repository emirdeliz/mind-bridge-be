import type { AppLanguage } from '@domain/types.js';

import { buildContextFocusBlock } from './patient-chat-context-focus.js';
import {
  buildAntiRepetitionGuidance,
  buildPatientChatCoreGuidance,
  buildPatientChatPacingGuidance,
  buildPatientChatRetryGuidance,
  buildPresentMomentGuidance,
  buildPsychologistContextUsageGuidance,
  buildQuestionAngleGuidance,
} from './patient-chat-interaction.js';
import { PATIENT_CHAT_MAX_QUESTIONS_PER_INTERACTION } from './patient-chat-session.js';
import {
  buildPatientChatKnowledgeSection,
  getPatientChatForbiddenLine,
  getPatientChatTextContextLabel,
} from './patient-chat-system.js';
import { resolveLanguageInstruction } from './response-language.js';

const SAMPLE_PSYCHOLOGIST_CONTEXT: Record<AppLanguage, string> = {
  pt: 'Paciente em acompanhamento por ansiedade social. Foco em situações de evitação no trabalho e regulação emocional.',
  en: 'Patient in treatment for social anxiety. Focus on workplace avoidance and emotional regulation.',
  es: 'Paciente en seguimiento por ansiedad social. Enfoque en evitación laboral y regulación emocional.',
};

const SAMPLE_USER_MESSAGE: Record<AppLanguage, string> = {
  pt: 'Hoje me senti muito ansioso antes da reunião com a equipe.',
  en: 'Today I felt very anxious before the team meeting.',
  es: 'Hoy me sentí muy ansioso antes de la reunión con el equipo.',
};

const SAMPLE_RETRIEVAL_CONTEXT: Record<AppLanguage, string> = {
  pt: '[Doc: protocolo-ansiedade.pdf] Técnicas de regulação emocional e exposição gradual em contextos sociais.',
  en: '[Doc: anxiety-protocol.pdf] Emotional regulation techniques and gradual exposure in social contexts.',
  es: '[Doc: protocolo-ansiedad.pdf] Técnicas de regulación emocional y exposición gradual en contextos sociales.',
};

const SAMPLE_SESSION_CONSIDERATIONS: Record<AppLanguage, string> = {
  pt: 'Foco em técnicas de grounding nesta sessão. Observar padrões de evitação relatados no chat.',
  en: 'Focus on grounding techniques in this session. Observe avoidance patterns reported in chat.',
  es: 'Enfoque en técnicas de grounding en esta sesión. Observar patrones de evitación relatados en el chat.',
};

const SAMPLE_CLINICAL_CONTEXT: Record<AppLanguage, string> = {
  pt: 'Humor médio estável. Aderência ao diário em 72%. Últimas interações mencionam ansiedade em reuniões.',
  en: 'Average mood stable. Diary adherence at 72%. Recent interactions mention anxiety in meetings.',
  es: 'Humor promedio estable. Adherencia al diario en 72%. Últimas interacciones mencionan ansiedad en reuniones.',
};

const SAMPLE_AGENT_QUESTIONS: Record<AppLanguage, string[]> = {
  pt: [
    'Como você se sentiu quando entrou na sala de reunião?',
    'O que passou pela sua cabeça nesse momento?',
  ],
  en: [
    'How did you feel when you entered the meeting room?',
    'What went through your mind at that moment?',
  ],
  es: [
    '¿Cómo se sintió cuando entró en la sala de reunión?',
    '¿Qué pasó por su mente en ese momento?',
  ],
};

const SAMPLE_REJECTED_REPLY: Record<AppLanguage, string> = {
  pt: 'Thinking Process: analisar ansiedade... Como você se sentiu?',
  en: 'Thinking Process: analyze anxiety... How did you feel?',
  es: 'Thinking Process: analizar ansiedad... ¿Cómo se sintió?',
};

const SAMPLE_CHAT_HISTORY: Record<AppLanguage, string> = {
  pt: 'Paciente: Ontem foi difícil no trabalho.\nAgente: O que aconteceu que deixou o dia difícil?',
  en: 'Patient: Yesterday was hard at work.\nAgent: What happened that made the day difficult?',
  es: 'Paciente: Ayer fue difícil en el trabajo.\nAgente: ¿Qué pasó que hizo difícil el día?',
};

const buildStepHintPreview = (
  language: AppLanguage,
  questionCount: number
): string => {
  const stepHints: Record<AppLanguage, string> = {
    pt:
      questionCount === 0
        ? 'Ajude o paciente a iniciar ou continuar um relato do dia a dia — acolha e faça uma pergunta que o direcione a contar mais (use o contexto do psicólogo se disponível).'
        : 'Direcione o paciente no meio do relato com uma pergunta alinhada ao contexto do psicólogo ou, se couber, apenas acolha/reflita brevemente.',
    es:
      questionCount === 0
        ? 'Ayude al paciente a iniciar o continuar un relato del día a día — acoja y haga una pregunta que lo oriente a contar más (use el contexto del psicólogo si está disponible).'
        : 'Oriente al paciente en medio del relato con una pregunta alineada al contexto del psicólogo o, si corresponde, solo acoja/reflexione brevemente.',
    en:
      questionCount === 0
        ? 'Help the patient start or continue a day-to-day report — acknowledge and ask a question that guides them to say more (use psychologist context if available).'
        : 'Guide the patient through their report with a question aligned to the psychologist context or, if appropriate, only acknowledge/reflect briefly.',
  };

  return stepHints[language] ?? stepHints.pt;
};

export const buildAiPromptTokenPreview = (
  key: string,
  language: AppLanguage
): string => {
  const sampleContext = SAMPLE_PSYCHOLOGIST_CONTEXT[language];
  const sampleUserMessage = SAMPLE_USER_MESSAGE[language];
  const sampleRetrieval = SAMPLE_RETRIEVAL_CONTEXT[language];
  const sampleQuestions = SAMPLE_AGENT_QUESTIONS[language];
  const questionCount = 2;

  switch (key) {
    case 'psychologist_context':
      return sampleContext;
    case 'chat_history':
      return SAMPLE_CHAT_HISTORY[language];
    case 'user_message':
      return sampleUserMessage;
    case 'question_count':
      return String(questionCount);
    case 'max_questions':
      return String(PATIENT_CHAT_MAX_QUESTIONS_PER_INTERACTION);
    case 'retrieval_context':
      return sampleRetrieval;
    case 'knowledge_section':
      return buildPatientChatKnowledgeSection(language, sampleRetrieval);
    case 'focus_block':
      return buildContextFocusBlock(language, sampleContext);
    case 'core_guidance':
      return buildPatientChatCoreGuidance(language);
    case 'pacing_guidance':
      return buildPatientChatPacingGuidance(
        language,
        questionCount,
        PATIENT_CHAT_MAX_QUESTIONS_PER_INTERACTION
      );
    case 'present_moment_guidance':
      return buildPresentMomentGuidance(language);
    case 'context_usage_guidance':
      return buildPsychologistContextUsageGuidance(language, {
        hasTextContext: true,
        hasKnowledgeContext: true,
      });
    case 'text_context_label':
      return getPatientChatTextContextLabel(language);
    case 'forbidden_line':
      return getPatientChatForbiddenLine(language);
    case 'retry_guidance':
      return buildPatientChatRetryGuidance(
        language,
        SAMPLE_REJECTED_REPLY[language],
        sampleQuestions,
        1
      );
    case 'angle_guidance':
      return buildQuestionAngleGuidance(
        language,
        sampleUserMessage,
        sampleQuestions,
        { hasTextContext: true, hasKnowledgeContext: true }
      );
    case 'anti_repetition_guidance':
      return buildAntiRepetitionGuidance(language, sampleQuestions);
    case 'step_hint':
      return buildStepHintPreview(language, questionCount);
    case 'session_considerations':
      return SAMPLE_SESSION_CONSIDERATIONS[language];
    case 'clinical_context':
      return SAMPLE_CLINICAL_CONTEXT[language];
    case 'language_instruction':
      return resolveLanguageInstruction(language);
    default:
      return '';
  }
};

export const buildAiPromptTokenPreviews = (
  key: string
): Record<AppLanguage, string> => ({
  pt: buildAiPromptTokenPreview(key, 'pt'),
  en: buildAiPromptTokenPreview(key, 'en'),
  es: buildAiPromptTokenPreview(key, 'es'),
});
