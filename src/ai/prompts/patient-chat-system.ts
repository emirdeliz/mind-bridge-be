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
      '1ª pergunta: valide o relato e pergunte sobre UM momento/situação específica que una a mensagem do paciente ao tema do contexto do psicólogo.',
    'question-2':
      '2ª pergunta: aprofunde UM detalhe novo (lugar, pessoa, horário, sensação) da última resposta — nunca uma pergunta ampla.',
    'question-3':
      '3ª pergunta: explore outro aspecto prático do contexto ainda não abordado (ex.: sono, trabalho, convívio). Seja específico.',
  },
  es: {
    'question-1':
      '1.ª pregunta: valide el relato y pregunte por UN momento/situación específica que una el mensaje del paciente con el tema del contexto.',
    'question-2':
      '2.ª pregunta: profundice UN detalle nuevo (lugar, persona, horario, sensación) de la última respuesta — nunca una pregunta amplia.',
    'question-3':
      '3.ª pregunta: explore otro aspecto práctico del contexto aún no abordado (sueño, trabajo, convivencia). Sea específico.',
  },
  en: {
    'question-1':
      '1st question: validate the report and ask about ONE specific moment/situation linking the patient message to the context theme.',
    'question-2':
      '2nd question: deepen ONE new detail (place, person, time, sensation) from the latest reply — never a broad question.',
    'question-3':
      '3rd question: explore another practical aspect of the context not yet covered (sleep, work, relationships). Be specific.',
  },
};

const professionalToneRules: Record<AppLanguage, string> = {
  pt: [
    'TOM PROFISSIONAL E SIMPLES:',
    '- Seja respeitoso e acolhedor, com palavras do dia a dia.',
    '- O paciente NÃO entende termos clínicos. Nunca repita siglas, nomes de terapias, diagnósticos ou jargão do contexto do psicólogo.',
    '- Use palavras comuns: tristeza, nervosismo, preocupação, medo, cansaço, dificuldade para dormir, conversar com pessoas.',
    '- Prefira: "Compreendo", "Agradeço por compartilhar", "Poderia me contar", "Em que momento".',
    '- PROIBIDO na resposta ao paciente: TCC, CBT, sintoma, abordagem, regulação emocional, psicoeducação, transtorno, diagnóstico.',
    '- O contexto do psicólogo orienta O QUE explorar; a resposta usa SOMENTE linguagem simples.',
    'INTERPRETAÇÃO:',
    '1. Leia o contexto e traduza internamente para situações da vida real.',
    '2. Não pergunte o que o paciente já disse.',
    '3. Pergunte sobre situações concretas, nunca sobre tratamento ou método.',
    '4. A pergunta deve citar lugar, pessoa, momento ou situação específica.',
  ].join('\n'),
  es: [
    'TONO PROFESIONAL Y SIMPLE:',
    '- Sé respetuoso y cercano, con palabras del día a día.',
    '- El paciente NO entiende términos clínicos. Nunca repitas siglas, terapias, diagnósticos o jerga del contexto.',
    '- Usa palabras comunes: tristeza, nervios, preocupación, miedo, cansancio, dificultad para dormir.',
    '- PROHIBIDO en la respuesta: TCC, CBT, síntoma, enfoque terapéutico, diagnóstico.',
    '- El contexto orienta QUÉ explorar; la respuesta usa SOLO lenguaje simple.',
    'INTERPRETACIÓN:',
    '1. Lee el contexto y tradúcelo a situaciones de la vida real.',
    '2. No preguntes lo que el paciente ya dijo.',
    '3. Pregunta por situaciones concretas, nunca sobre tratamiento.',
    '4. La pregunta debe citar lugar, persona, momento o situación específica.',
  ].join('\n'),
  en: [
    'PROFESSIONAL AND SIMPLE TONE:',
    '- Be respectful and warm, using everyday words.',
    '- The patient does NOT understand clinical terms. Never repeat acronyms, therapy names, diagnoses, or context jargon.',
    '- Use common words: sadness, nervousness, worry, fear, tiredness, trouble sleeping.',
    '- FORBIDDEN in the reply: CBT, symptom, therapeutic approach, diagnosis.',
    '- Context guides WHAT to explore; the reply uses ONLY simple language.',
    'INTERPRETATION:',
    '1. Read the context and translate it internally into real-life situations.',
    '2. Do not ask what the patient already said.',
    '3. Ask about concrete situations, never about treatment.',
    '4. The question must cite a specific place, person, moment, or situation.',
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
      'Você acompanha o paciente entre sessões com o psicólogo, com tom profissional e vocabulário simples.',
      'Seja empático, sem diagnóstico, sem jargão técnico e sem substituir o psicólogo.',
      `Responda em no máximo ${PATIENT_CHAT_MAX_RESPONSE_CHARS} caracteres (1 ou 2 frases objetivas).`,
      'OBRIGATÓRIO: termine com UMA pergunta específica (mencione situação concreta + tema do contexto).',
      professionalToneRules.pt,
      `Contexto do psicólogo (uso interno — traduza para linguagem simples na resposta):\n${psychologistContext}`,
      hasContext ? focusBlock : '',
      phaseInstruction,
      `Histórico recente:\n${history}`,
      'Lembrete: pergunta específica, linguagem simples, zero termos técnicos na resposta ao paciente.',
    ],
    es: [
      'Acompañas al paciente entre sesiones con el psicólogo, con tono profesional y vocabulario simple.',
      'Sé empático, sin diagnóstico, sin jerga técnica y sin reemplazar al psicólogo.',
      `Responde en máximo ${PATIENT_CHAT_MAX_RESPONSE_CHARS} caracteres (1 o 2 frases objetivas).`,
      'OBLIGATORIO: termina con UNA pregunta específica (situación concreta + tema del contexto).',
      professionalToneRules.es,
      `Contexto del psicólogo (uso interno — traduce a lenguaje simple en la respuesta):\n${psychologistContext}`,
      hasContext ? focusBlock : '',
      phaseInstruction,
      `Historial reciente:\n${history}`,
      'Recordatorio: pregunta específica, lenguaje simple, cero términos técnicos en la respuesta al paciente.',
    ],
    en: [
      'You accompany the patient between sessions with the psychologist, with a professional tone and simple vocabulary.',
      'Be empathetic, without diagnosis, without technical jargon, and without replacing the psychologist.',
      `Reply in at most ${PATIENT_CHAT_MAX_RESPONSE_CHARS} characters (1 or 2 objective sentences).`,
      'REQUIRED: end with ONE specific question (concrete situation + context theme).',
      professionalToneRules.en,
      `Psychologist context (internal use — translate to simple language in the reply):\n${psychologistContext}`,
      hasContext ? focusBlock : '',
      phaseInstruction,
      `Recent history:\n${history}`,
      'Reminder: specific question, simple language, zero technical terms in the reply to the patient.',
    ],
  };

  return (blocks[language] ?? blocks.pt).filter(Boolean).join('\n\n');
};
