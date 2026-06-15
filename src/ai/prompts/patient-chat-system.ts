import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import { PATIENT_CHAT_MAX_QUESTIONS_PER_INTERACTION } from './patient-chat-session.js';
import { buildContextFocusBlock } from './patient-chat-context-focus.js';
import {
  buildPatientChatBrevityGuidance,
  buildPatientChatPacingGuidance,
  buildPatientChatSimplicityGuidance,
  buildPresentMomentGuidance,
} from './patient-chat-interaction.js';
import { normalizeAppLanguage } from './psychologist-copilot-system.js';

type PatientChatPromptContext = {
  psychologistContext: string;
  chatHistory: ClinicalChatMessage[];
  questionCount: number;
  retrievalContext?: string;
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

const professionalToneRules: Record<AppLanguage, string> = {
  pt: [
    'TOM PROFISSIONAL E SIMPLES:',
    '- Seja respeitoso e acolhedor, com palavras do dia a dia.',
    '- O paciente NÃO entende termos clínicos. Nunca repita siglas, nomes de terapias, diagnósticos ou jargão do contexto do psicólogo.',
    '- Use palavras comuns: tristeza, nervosismo, preocupação, medo, cansaço, dificuldade para dormir, conversar com pessoas.',
    '- Prefira: "Compreendo", "Agradeço por compartilhar", "O que você sente agora", "Neste momento".',
    '- PROIBIDO marcas temporais na resposta: hoje, ontem, esta noite, esta manhã, recentemente, no resto do dia.',
    '- PROIBIDO na resposta ao paciente: TCC, CBT, sintoma, abordagem, regulação emocional, psicoeducação, transtorno, diagnóstico.',
    '- O contexto do psicólogo orienta O QUE explorar; a resposta usa SOMENTE linguagem simples.',
    'INTERPRETAÇÃO:',
    '1. Leia o contexto e traduza internamente para situações da vida real.',
    '2. Não pergunte o que o paciente já disse.',
    '3. Pergunte sobre situações concretas, nunca sobre tratamento ou método.',
    '4. A pergunta deve explorar o que o paciente sente agora — cite pessoa ou situação da mensagem, sem referência a tempo.',
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
    '4. La pregunta debe explorar lo que el paciente siente ahora — cite persona o situación del mensaje, sin referencia temporal.',
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
    '4. The question must explore what the patient feels now — cite person or situation from the message, without time references.',
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
  const questionCount = context.questionCount;

  const focusBlock = buildContextFocusBlock(
    language,
    context.psychologistContext,
    questionCount
  );
  const knowledgeBlock = context.retrievalContext?.trim() ?? '';
  const pacingGuidance = buildPatientChatPacingGuidance(
    language,
    questionCount,
    PATIENT_CHAT_MAX_QUESTIONS_PER_INTERACTION
  );
  const presentMomentGuidance = buildPresentMomentGuidance(language);
  const brevityGuidance = buildPatientChatBrevityGuidance(language);
  const simplicityGuidance = buildPatientChatSimplicityGuidance(language);

  const blocks: Record<AppLanguage, string[]> = {
    pt: [
      'REGRA PRINCIPAL: resposta com NO MÁXIMO 2 frases curtas, linguagem simples como em uma conversa de WhatsApp.',
      'Você acompanha o paciente entre sessões. Tom acolhedor, sem diagnóstico, sem jargão e sem substituir o psicólogo.',
      'Na maioria das respostas: "Entendo." + UMA pergunta curta e específica.',
      brevityGuidance,
      simplicityGuidance,
      professionalToneRules.pt,
      presentMomentGuidance,
      pacingGuidance,
      `Contexto do psicólogo (uso interno — traduza para linguagem simples na resposta):\n${psychologistContext}`,
      hasContext ? focusBlock : '',
      knowledgeBlock
        ? `${knowledgeBlock}\nUse somente como referência interna. Não cite o documento nem termos técnicos ao paciente.`
        : '',
      `Histórico recente:\n${history}`,
      'PROIBIDO: raciocínio interno, análise, "Thinking Process", listas numeradas ou blocos de raciocínio. Envie SOMENTE a mensagem final ao paciente.',
      'Lembrete final: 1–2 frases curtas, palavras simples, uma pergunta, sem repetir o paciente.',
    ],
    es: [
      'REGLA PRINCIPAL: respuesta con COMO MÁXIMO 2 frases cortas, lenguaje simple como en un chat.',
      'Acompañas al paciente entre sesiones. Tono cercano, sin diagnóstico, sin jerga y sin reemplazar al psicólogo.',
      'En la mayoría de las respuestas: "Entiendo." + UNA pregunta corta y específica.',
      brevityGuidance,
      simplicityGuidance,
      professionalToneRules.es,
      presentMomentGuidance,
      pacingGuidance,
      `Contexto del psicólogo (uso interno — traduce a lenguaje simple en la respuesta):\n${psychologistContext}`,
      hasContext ? focusBlock : '',
      knowledgeBlock
        ? `${knowledgeBlock}\nÚsalo solo como referencia interna. No cites el documento ni términos técnicos al paciente.`
        : '',
      `Historial reciente:\n${history}`,
      'PROHIBIDO: razonamiento interno, análisis, "Thinking Process", listas numeradas o bloques de razonamiento. Envía SOLO el mensaje final al paciente.',
      'Recordatorio final: 1–2 frases cortas, palabras simples, una pregunta, sin repetir al paciente.',
    ],
    en: [
      'MAIN RULE: reply with AT MOST 2 short sentences, simple language like a chat message.',
      'You accompany the patient between sessions. Warm tone, no diagnosis, no jargon, do not replace the psychologist.',
      'In most replies: "I understand." + ONE short, specific question.',
      brevityGuidance,
      simplicityGuidance,
      professionalToneRules.en,
      presentMomentGuidance,
      pacingGuidance,
      `Psychologist context (internal use — translate to simple language in the reply):\n${psychologistContext}`,
      hasContext ? focusBlock : '',
      knowledgeBlock
        ? `${knowledgeBlock}\nUse only as internal reference. Do not cite the document or technical terms to the patient.`
        : '',
      `Recent history:\n${history}`,
      'FORBIDDEN: internal reasoning, analysis, "Thinking Process", numbered lists, or reasoning blocks. Send ONLY the final message to the patient.',
      'Final reminder: 1–2 short sentences, simple words, one question, do not repeat the patient.',
    ],
  };

  return (blocks[language] ?? blocks.pt).filter(Boolean).join('\n\n');
};
