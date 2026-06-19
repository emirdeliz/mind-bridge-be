import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import { PATIENT_CHAT_MAX_QUESTIONS_PER_INTERACTION } from './patient-chat-session.js';
import { buildContextFocusBlock } from './patient-chat-context-focus.js';
import {
  buildPatientChatBrevityGuidance,
  buildPatientChatPacingGuidance,
  buildPatientChatSimplicityGuidance,
  buildPresentMomentGuidance,
  buildPsychologistStanceGuidance,
} from './patient-chat-interaction.js';
import { normalizeAppLanguage } from './psychologist-copilot-system.js';

type PatientChatPromptContext = {
  psychologistContext: string;
  chatHistory: ClinicalChatMessage[];
  questionCount: number;
  retrievalContext?: string;
  /** When false, history is supplied as multi-turn chat messages instead. */
  includeChatHistory?: boolean;
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
    '- Prefira curiosidade genuína: "O que isso despertou em você?", "Como foi para você?", "O que mais te chamou atenção?".',
    '- PROIBIDO marcas temporais na resposta: hoje, ontem, esta noite, esta manhã, recentemente, no resto do dia.',
    '- PROIBIDO na resposta ao paciente: TCC, CBT, sintoma, abordagem, regulação emocional, psicoeducação, transtorno, diagnóstico.',
    '- O contexto do psicólogo orienta O QUE explorar; a resposta usa SOMENTE linguagem simples.',
    'INTERPRETAÇÃO:',
    '1. Leia o contexto e traduza internamente para situações da vida real.',
    '2. Não pergunte o que o paciente já disse.',
    '3. Pergunte de forma aberta sobre o que o paciente trouxe — pessoa, situação ou sentimento.',
    '4. Aprofunde com curiosidade clínica, sem roteiro fixo nem fórmulas repetidas.',
  ].join('\n'),
  es: [
    'TONO PROFESIONAL Y SIMPLE:',
    '- Sé respetuoso y cercano, con palabras del día a día.',
    '- El paciente NO entiende términos clínicos. Nunca repitas siglas, terapias, diagnósticos o jerga del contexto.',
    '- Usa palabras comunes: tristeza, nervios, preocupación, miedo, cansancio, dificultad para dormir.',
    '- Prefiere curiosidad genuina: "¿Qué le despertó esto?", "¿Cómo fue para usted?", "¿Qué más le llamó la atención?".',
    '- PROHIBIDO en la respuesta: TCC, CBT, síntoma, enfoque terapéutico, diagnóstico.',
    '- El contexto orienta QUÉ explorar; la respuesta usa SOLO lenguaje simple.',
    'INTERPRETACIÓN:',
    '1. Lee el contexto y tradúcelo a situaciones de la vida real.',
    '2. No preguntes lo que el paciente ya dijo.',
    '3. Pregunta de forma abierta sobre lo que el paciente trajo — persona, situación o sentimiento.',
    '4. Profundiza con curiosidad clínica, sin guion fijo ni fórmulas repetidas.',
  ].join('\n'),
  en: [
    'PROFESSIONAL AND SIMPLE TONE:',
    '- Be respectful and warm, using everyday words.',
    '- The patient does NOT understand clinical terms. Never repeat acronyms, therapy names, diagnoses, or context jargon.',
    '- Use common words: sadness, nervousness, worry, fear, tiredness, trouble sleeping.',
    '- Prefer genuine curiosity: "What did that stir in you?", "What was that like for you?", "What stood out most?"',
    '- FORBIDDEN in the reply: CBT, symptom, therapeutic approach, diagnosis.',
    '- Context guides WHAT to explore; the reply uses ONLY simple language.',
    'INTERPRETATION:',
    '1. Read the context and translate it internally into real-life situations.',
    '2. Do not ask what the patient already said.',
    '3. Ask openly about what the patient brought up — person, situation, or feeling.',
    '4. Deepen with clinical curiosity, no fixed script or repeated formulas.',
  ].join('\n'),
};

export const buildPatientChatSystemPrompt = (
  languageInput: unknown,
  context: PatientChatPromptContext
): string => {
  const language = normalizeAppLanguage(languageInput);
  const psychologistContext =
    context.psychologistContext.trim() || notProvided(language);
  const includeChatHistory = context.includeChatHistory !== false;
  const history = includeChatHistory
    ? formatChatHistory(language, context.chatHistory)
    : '';
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
  const psychologistStanceGuidance = buildPsychologistStanceGuidance(language);

  const blocks: Record<AppLanguage, string[]> = {
    pt: [
      'REGRA PRINCIPAL: resposta com até 3 frases curtas, linguagem simples como em uma conversa acolhedora.',
      'Você acompanha o paciente entre sessões. Tom de escuta clínica, sem diagnóstico, sem jargão e sem substituir o psicólogo.',
      'Faça UMA pergunta aberta por resposta — convide o paciente a elaborar, não apenas confirmar.',
      psychologistStanceGuidance,
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
      includeChatHistory ? `Histórico recente:\n${history}` : '',
      'PROIBIDO: raciocínio interno, análise, "Thinking Process", listas numeradas ou blocos de raciocínio. Envie SOMENTE a mensagem final ao paciente.',
      'Lembrete final: até 3 frases curtas, palavras simples, uma pergunta aberta, postura de escuta — sem repetir o paciente nem usar fórmulas.',
    ],
    es: [
      'REGLA PRINCIPAL: respuesta con hasta 3 frases cortas, lenguaje simple como en una conversación acogedora.',
      'Acompañas al paciente entre sesiones. Tono de escucha clínica, sin diagnóstico, sin jerga y sin reemplazar al psicólogo.',
      'Haga UNA pregunta abierta por respuesta — invite a elaborar, no solo a confirmar.',
      psychologistStanceGuidance,
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
      includeChatHistory ? `Historial reciente:\n${history}` : '',
      'PROHIBIDO: razonamiento interno, análisis, "Thinking Process", listas numeradas o bloques de razonamiento. Envía SOLO el mensaje final al paciente.',
      'Recordatorio final: hasta 3 frases cortas, palabras simples, una pregunta abierta, postura de escucha — sin repetir al paciente ni usar fórmulas.',
    ],
    en: [
      'MAIN RULE: reply with up to 3 short sentences, simple language like a warm conversation.',
      'You accompany the patient between sessions. Clinical listening tone, no diagnosis, no jargon, do not replace the psychologist.',
      'Ask ONE open question per reply — invite the patient to elaborate, not just confirm.',
      psychologistStanceGuidance,
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
      includeChatHistory ? `Recent history:\n${history}` : '',
      'FORBIDDEN: internal reasoning, analysis, "Thinking Process", numbered lists, or reasoning blocks. Send ONLY the final message to the patient.',
      'Final reminder: up to 3 short sentences, simple words, one open question, listening stance — do not repeat the patient or use formulas.',
    ],
  };

  return (blocks[language] ?? blocks.pt).filter(Boolean).join('\n\n');
};
