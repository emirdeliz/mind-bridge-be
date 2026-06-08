import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import { buildContextFocusBlock } from './patient-chat-context-focus.js';
import { normalizeAppLanguage } from './psychologist-copilot-system.js';
import {
  PATIENT_CHAT_MAX_RESPONSE_CHARS,
  type PatientChatInteractionPhase,
} from './patient-chat-interaction.js';

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
      '1ª pergunta: acolha o que o paciente disse em linguagem simples e pergunte sobre uma situação concreta do dia a dia (não sobre tratamento).',
    'question-2':
      '2ª pergunta: aprofunde um detalhe NOVO da resposta do paciente ou uma situação prática ainda não explorada.',
    'question-3':
      '3ª pergunta: explore outro aspecto prático (pessoas, rotina, sono, trabalho). Não repita o que já foi perguntado ou respondido.',
  },
  es: {
    'question-1':
      '1.ª pregunta: acompaña lo que dijo el paciente en lenguaje simple y pregunta por una situación concreta del día a día.',
    'question-2':
      '2.ª pregunta: profundiza un detalle NUEVO de la respuesta del paciente.',
    'question-3':
      '3.ª pregunta: explora otro aspecto práctico. No repitas lo ya preguntado o respondido.',
  },
  en: {
    'question-1':
      '1st question: acknowledge what the patient said in simple language and ask about one concrete daily situation.',
    'question-2':
      '2nd question: deepen one NEW detail from the patient reply.',
    'question-3':
      '3rd question: explore another practical aspect. Do not repeat what was already asked or answered.',
  },
};

const literalResponseRules: Record<AppLanguage, string> = {
  pt: [
    'INTERPRETAÇÃO LITERAL:',
    '1. Leia o contexto do psicólogo literalmente e entenda o que ele quer que você explore com o paciente.',
    '2. Leia a mensagem e o histórico do paciente literalmente — não pergunte o que ele já disse.',
    '3. Responda em linguagem simples, como em conversa do dia a dia; o paciente não tem formação em saúde.',
    '4. Se o contexto usar termos técnicos, interprete o sentido e fale ao paciente só com palavras comuns, sem repetir o jargão.',
    '5. Pergunte sobre situações concretas da vida do paciente, não sobre método ou plano de tratamento.',
    '6. A pergunta deve ser algo que o paciente ainda não respondeu e que ajude a entender a experiência dele.',
  ].join('\n'),
  es: [
    'INTERPRETACIÓN LITERAL:',
    '1. Lee el contexto del psicólogo literalmente y entiende qué debe explorarse con el paciente.',
    '2. Lee el mensaje y el historial del paciente literalmente — no preguntes lo que ya dijo.',
    '3. Responde en lenguaje simple; el paciente no tiene formación en salud.',
    '4. Si el contexto usa términos técnicos, interpreta el sentido y habla al paciente solo con palabras comunes.',
    '5. Pregunta por situaciones concretas de la vida del paciente, no sobre método o plan de tratamiento.',
    '6. La pregunta debe ser algo que el paciente aún no respondió.',
  ].join('\n'),
  en: [
    'LITERAL INTERPRETATION:',
    '1. Read the psychologist context literally and understand what should be explored with the patient.',
    '2. Read the patient message and history literally — do not ask what they already said.',
    '3. Reply in simple everyday language; the patient has no healthcare training.',
    '4. If the context uses technical terms, interpret the meaning and speak to the patient only in common words.',
    '5. Ask about concrete situations in the patient life, not about treatment method or plan.',
    '6. The question must be something the patient has not already answered.',
  ].join('\n'),
};

export const buildPatientChatSystemPrompt = (
  languageInput: unknown,
  context: PatientChatPromptContext
): string => {
  const language = normalizeAppLanguage(languageInput);
  const psychologistContext =
    context.psychologistContext.trim() || notProvided(language);
  const history = formatChatHistory(language, context.chatHistory);
  const hasContext = Boolean(context.psychologistContext.trim());
  const phase = context.interactionPhase;

  if (phase === 'closing') {
    return '';
  }

  const focusBlock = buildContextFocusBlock(
    language,
    context.psychologistContext,
    phase
  );
  const phaseInstruction = questionPhaseInstructions[language][phase];

  const blocks: Record<AppLanguage, string[]> = {
    pt: [
      'Você conversa com o paciente entre sessões de forma acolhedora e simples.',
      'Seja empático, sem diagnóstico e sem substituir o psicólogo.',
      `Responda em no máximo ${PATIENT_CHAT_MAX_RESPONSE_CHARS} caracteres (1 ou 2 frases curtas).`,
      'OBRIGATÓRIO: termine com UMA pergunta sobre a vida prática do paciente (frase interrogativa).',
      literalResponseRules.pt,
      `Contexto do psicólogo (interprete literalmente):\n${psychologistContext}`,
      hasContext ? focusBlock : '',
      phaseInstruction,
      `Histórico recente:\n${history}`,
      'Lembrete: interprete o contexto, fale de forma simples e faça uma pergunta nova e concreta.',
    ],
    es: [
      'Conversas con el paciente entre sesiones de forma cercana y simple.',
      'Sé empático, sin diagnóstico y sin reemplazar al psicólogo.',
      `Responde en máximo ${PATIENT_CHAT_MAX_RESPONSE_CHARS} caracteres (1 o 2 frases cortas).`,
      'OBLIGATORIO: termina con UNA pregunta sobre la vida práctica del paciente.',
      literalResponseRules.es,
      `Contexto del psicólogo (interpreta literalmente):\n${psychologistContext}`,
      hasContext ? focusBlock : '',
      phaseInstruction,
      `Historial reciente:\n${history}`,
      'Recordatorio: interpreta el contexto, habla de forma simple y haz una pregunta nueva y concreta.',
    ],
    en: [
      'You chat with the patient between sessions in a warm, simple way.',
      'Be empathetic, no diagnosis, and do not replace the psychologist.',
      `Reply in at most ${PATIENT_CHAT_MAX_RESPONSE_CHARS} characters (1 or 2 short sentences).`,
      'REQUIRED: end with ONE question about the patient practical daily life.',
      literalResponseRules.en,
      `Psychologist context (interpret literally):\n${psychologistContext}`,
      hasContext ? focusBlock : '',
      phaseInstruction,
      `Recent history:\n${history}`,
      'Reminder: interpret the context, use simple language, and ask one new concrete question.',
    ],
  };

  return (blocks[language] ?? blocks.pt).filter(Boolean).join('\n\n');
};
