import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

export const PATIENT_CHAT_MAX_RESPONSE_CHARS = 160;

const THINKING_PROCESS_PATTERN = /thinking\s*process\s*:?/i;

const ANALYSIS_LINE_PATTERN =
  /^\s*(\d+\.\s*)?(\*{1,2})?(analyze|analysis|constraints|role|step|reasoning)/i;

const PATIENT_RESPONSE_STARTERS =
  /\b(comprendo|agradeço|agradezco|thank you|i understand|poderia|could you|gostaria|em que|na conversa|durante|quando você|how did|en la conversación|en qué momento)\b/i;

const OPEN_THINK_TAG = '\u003cthink\u003e';
const CLOSE_THINK_TAG = '\u003c/think\u003e';

const stripThinkTags = (text: string): string => {
  let cleaned = text;
  const lower = cleaned.toLowerCase();
  const openIndex = lower.indexOf(OPEN_THINK_TAG);
  const closeIndex = lower.indexOf(CLOSE_THINK_TAG);

  if (openIndex >= 0 && closeIndex > openIndex) {
    cleaned =
      cleaned.slice(0, openIndex) +
      cleaned.slice(closeIndex + CLOSE_THINK_TAG.length);
  } else if (openIndex >= 0) {
    cleaned = cleaned.slice(0, openIndex);
  }

  return cleaned.trim();
};

export const isLeakedPatientChatReasoning = (text: string): boolean => {
  const cleaned = text.trim();
  if (!cleaned) {
    return true;
  }

  const firstLine = cleaned.split('\n')[0] ?? '';
  return (
    THINKING_PROCESS_PATTERN.test(cleaned) ||
    ANALYSIS_LINE_PATTERN.test(firstLine) ||
    /^\d+\.\s*\*\*/.test(cleaned)
  );
};

/** Removes leaked chain-of-thought before showing text to the patient. */
export const sanitizePatientChatResponse = (text: string): string => {
  let cleaned = stripThinkTags(text.trim());
  if (!cleaned) {
    return '';
  }

  const firstLine = cleaned.split('\n')[0] ?? '';
  const hasLeakedReasoning =
    THINKING_PROCESS_PATTERN.test(cleaned) ||
    ANALYSIS_LINE_PATTERN.test(firstLine);

  if (hasLeakedReasoning) {
    const paragraphs = cleaned
      .split(/\n{2,}/)
      .map((part) => part.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const conversational = paragraphs.filter(
      (part) =>
        !THINKING_PROCESS_PATTERN.test(part) &&
        !/^\d+\.\s*\*\*/.test(part) &&
        !/\*\s*role\s*:/i.test(part) &&
        !/\*\*analyze/i.test(part) &&
        (PATIENT_RESPONSE_STARTERS.test(part) || part.endsWith('?'))
    );

    if (conversational.length) {
      cleaned = conversational[conversational.length - 1] ?? cleaned;
    } else {
      const questionSentences = cleaned.match(/[^?\n]*\?/g);
      if (questionSentences?.length) {
        cleaned = questionSentences[questionSentences.length - 1].trim();
      } else {
        cleaned = cleaned.replace(/^[\s\S]*?thinking\s*process\s*:\s*/i, '');
        cleaned = cleaned
          .split('\n')
          .filter((line) => !ANALYSIS_LINE_PATTERN.test(line.trim()))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }
  }

  cleaned = cleaned
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  if (isLeakedPatientChatReasoning(cleaned)) {
    return '';
  }

  return cleaned;
};

export const truncatePatientChatResponse = (
  text: string,
  maxChars = PATIENT_CHAT_MAX_RESPONSE_CHARS
): string => {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  let cut = trimmed.slice(0, maxChars).trimEnd();
  const lastQuestion = cut.lastIndexOf('?');
  const lastSentenceEnd = Math.max(
    cut.lastIndexOf('.'),
    cut.lastIndexOf('!'),
    lastQuestion
  );

  if (lastSentenceEnd >= Math.floor(maxChars * 0.55)) {
    cut = cut.slice(0, lastSentenceEnd + 1).trimEnd();
    if (cut.length <= maxChars) {
      return cut;
    }
  }

  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace >= Math.floor(maxChars * 0.65)) {
    cut = cut.slice(0, lastSpace).trimEnd();
  }

  if (!cut.endsWith('?') && !cut.endsWith('.') && !cut.endsWith('!')) {
    if (cut.length + 1 <= maxChars) {
      return `${cut}?`;
    }
    return `${cut.slice(0, maxChars - 1).trimEnd()}?`;
  }

  return cut.slice(0, maxChars).trimEnd();
};

export const finalizePatientChatResponse = (text: string): string =>
  truncatePatientChatResponse(sanitizePatientChatResponse(text));

const FALLBACK_REPLIES: Record<AppLanguage, string> = {
  pt: 'Compreendo. O que você sente agora, além do que me contou?',
  es: 'Comprendo. ¿Qué siente ahora, además de lo que me contó?',
  en: 'I understand. What do you feel right now, besides what you shared?',
};

export const buildPresentMomentGuidance = (language: AppLanguage): string => {
  const blocks: Record<AppLanguage, string> = {
    pt: [
      'FOCO NO AGORA (obrigatório):',
      '- Responda e pergunte sobre o que o paciente sente ou vive NESTE MOMENTO da conversa.',
      '- PROIBIDO marcas temporais: hoje, ontem, amanhã, esta noite, esta manhã, essa semana, recentemente, ultimamente, no resto do dia, há pouco.',
      '- Prefira: "agora", "neste momento", "enquanto conversamos", "o que você sente", "o que percebe no corpo".',
      '- Exemplo RUIM (temporal): "Como a tristeza afetou seu sono hoje à noite?"',
      '- Exemplo BOM (agora): "Neste momento, além da tristeza, o que mais você sente?"',
    ].join('\n'),
    es: [
      'ENFOQUE EN EL AHORA (obligatorio):',
      '- Responde y pregunta por lo que el paciente siente o vive EN ESTE MOMENTO de la conversa.',
      '- PROHIBIDO marcas temporales: hoy, ayer, mañana, esta noche, esta mañana, esta semana, recientemente, últimamente, el resto del día.',
      '- Prefiere: "ahora", "en este momento", "mientras conversamos", "qué siente", "qué nota en el cuerpo".',
      '- Ejemplo MALO (temporal): "¿Cómo afectó la tristeza su sueño esta noche?"',
      '- Ejemplo BUENO (ahora): "En este momento, además de la tristeza, ¿qué más siente?"',
    ].join('\n'),
    en: [
      'PRESENT-MOMENT FOCUS (required):',
      '- Reply and ask about what the patient feels or experiences RIGHT NOW in this conversation.',
      '- FORBIDDEN time markers: today, yesterday, tomorrow, tonight, this morning, this week, recently, lately, rest of the day.',
      '- Prefer: "right now", "at this moment", "as we talk", "what you feel", "what you notice in your body".',
      '- BAD example (temporal): "How did the sadness affect your sleep tonight?"',
      '- GOOD example (now): "Right now, besides sadness, what else do you feel?"',
    ].join('\n'),
  };

  return blocks[language] ?? blocks.pt;
};

export const getPatientChatFallbackReply = (language: AppLanguage): string =>
  FALLBACK_REPLIES[language] ?? FALLBACK_REPLIES.pt;

/** @deprecated Legacy closing messages still recognized in old chat history. */
const LEGACY_CLOSING_MESSAGES: Record<AppLanguage, string> = {
  pt: 'Agradeço por compartilhar estas informações. Permaneço à disposição para apoiá-lo(a) quando necessário.',
  es: 'Agradezco que haya compartido esta información. Permanezco a su disposición para apoyarle cuando lo necesite.',
  en: 'Thank you for sharing this information. I remain available to support you whenever needed.',
};

const LEGACY_CLOSING_MESSAGE_SET = new Set(Object.values(LEGACY_CLOSING_MESSAGES));

export const isPatientChatClosingMessage = (text: string): boolean =>
  LEGACY_CLOSING_MESSAGE_SET.has(text.trim());

/** Agent turns with a question so far (legacy closing messages are excluded). */
export const countAgentQuestionsInChat = (
  chatHistory: ClinicalChatMessage[]
): number =>
  chatHistory.filter(
    (message) =>
      message.sender === 'agent' && !isPatientChatClosingMessage(message.text)
  ).length;

export const extractRecentAgentQuestions = (
  chatHistory: ClinicalChatMessage[],
  limit = 5
): string[] =>
  chatHistory
    .filter(
      (message) =>
        message.sender === 'agent' && !isPatientChatClosingMessage(message.text)
    )
    .slice(-limit)
    .map((message) => message.text);

export const buildAntiRepetitionGuidance = (
  language: AppLanguage,
  priorAgentQuestions: string[]
): string => {
  if (!priorAgentQuestions.length) {
    return '';
  }

  const listedQuestions = priorAgentQuestions
    .map((question, index) => `${index + 1}. "${question}"`)
    .join('\n');

  const blocks: Record<AppLanguage, string> = {
    pt: [
      'ANTI-REPETIÇÃO (obrigatório):',
      'Perguntas que você já fez nesta conversa:',
      listedQuestions,
      '- PROIBIDO repetir ou reformular com pouca mudança qualquer pergunta acima.',
      '- PROIBIDO fazer perguntas muito similares (mesmo tema, mesmo momento, mesma pessoa, mesma sensação).',
      '- Mude o ângulo: outra sensação no corpo, outra pessoa envolvida, outro pensamento que surge agora.',
      '- Se o paciente já respondeu um ponto, avance para outro ainda não explorado ou encerre com acolhimento.',
      'Exemplo RUIM (similar): já perguntou "o que sente agora de tristeza?" → não pergunte "a tristeza é forte neste momento?".',
      'Exemplo BOM (ângulo novo): após explorar a tristeza, pergunte o que mais surge no corpo ou na mente agora.',
    ].join('\n'),
    es: [
      'ANTI-REPETICIÓN (obligatorio):',
      'Preguntas que ya hiciste en esta conversación:',
      listedQuestions,
      '- PROHIBIDO repetir o reformular con poco cambio cualquier pregunta anterior.',
      '- PROHIBIDO hacer preguntas muy similares (mismo tema, mismo momento, misma persona, misma sensación).',
      '- Cambia el ángulo: otra sensación en el cuerpo, otra persona involucrada, otro pensamiento que surge ahora.',
      '- Si el paciente ya respondió un punto, avanza a otro aún no explorado o cierra con contención.',
      'Ejemplo MALO (similar): ya preguntó "¿qué siente ahora de tristeza?" → no pregunte "¿la tristeza es fuerte en este momento?".',
      'Ejemplo BUENO (ángulo nuevo): tras explorar la tristeza, pregunte qué más surge en el cuerpo o la mente ahora.',
    ].join('\n'),
    en: [
      'ANTI-REPETITION (required):',
      'Questions you already asked in this conversation:',
      listedQuestions,
      '- FORBIDDEN to repeat or lightly rephrase any question above.',
      '- FORBIDDEN to ask very similar questions (same theme, moment, person, or sensation).',
      '- Change the angle: another body sensation, another person involved, another thought arising now.',
      '- If the patient already answered a point, move to another unexplored aspect or close warmly.',
      'BAD example (similar): already asked "what sadness do you feel now?" → do not ask "is the sadness strong right now?".',
      'GOOD example (new angle): after exploring sadness, ask what else arises in the body or mind now.',
    ].join('\n'),
  };

  return blocks[language] ?? blocks.pt;
};

export const buildPatientChatPacingGuidance = (
  language: AppLanguage,
  questionCount: number
): string => {
  const blocks: Record<AppLanguage, string[]> = {
    pt: [
      'RITMO DA CONVERSA (sem limite fixo de perguntas):',
      '- Continue perguntando enquanto fizer sentido para entender a experiência do paciente.',
      '- Priorize SINTETIZAR: uma pergunta bem formulada vale mais que várias perguntas pequenas seguidas.',
      '- Evite fadiga: não repita o que o paciente já disse; não transforme a conversa em interrogatório.',
      '- Evite perguntas muito similares às anteriores: mude o ângulo a cada nova pergunta.',
      '- Prefira perguntas que conectem situação concreta + tema do contexto em uma única frase.',
      questionCount === 0
        ? 'Primeira pergunta: valide o relato e peça UM momento ou situação específica.'
        : questionCount <= 2
          ? 'Aprofunde com UMA pergunta nova e sintética sobre detalhe ainda não esclarecido.'
          : 'Já houve várias trocas: sintetize o que entendeu e faça UMA pergunta objetiva que una os pontos em aberto — ou encerre com acolhimento se já houver informação suficiente.',
    ],
    es: [
      'RITMO DE LA CONVERSACIÓN (sin límite fijo de preguntas):',
      '- Sigue preguntando mientras tenga sentido para comprender la experiencia del paciente.',
      '- Prioriza SINTETIZAR: una pregunta bien formulada vale más que varias preguntas pequeñas seguidas.',
      '- Evita fatiga: no repitas lo que el paciente ya dijo; no conviertas la charla en interrogatorio.',
      '- Evita preguntas muy similares a las anteriores: cambia el ángulo en cada nueva pregunta.',
      '- Prefiere preguntas que conecten situación concreta + tema del contexto en una sola frase.',
      questionCount === 0
        ? 'Primera pregunta: valide el relato y pida UN momento o situación específica.'
        : questionCount <= 2
          ? 'Profundiza con UNA pregunta nueva y sintética sobre un detalle aún no aclarado.'
          : 'Ya hubo varios intercambios: sintetiza lo comprendido y haz UNA pregunta objetiva que una los puntos abiertos — o cierra con contención si ya hay información suficiente.',
    ],
    en: [
      'CONVERSATION PACING (no fixed question limit):',
      '- Keep asking while it makes sense to understand the patient experience.',
      '- Prioritize SYNTHESIS: one well-formed question beats several small questions in a row.',
      '- Avoid fatigue: do not repeat what the patient already said; do not turn the chat into an interrogation.',
      '- Avoid questions very similar to prior ones: change the angle with each new question.',
      '- Prefer questions that connect a concrete situation + context theme in a single sentence.',
      questionCount === 0
        ? 'First question: validate the report and ask for ONE specific moment or situation.'
        : questionCount <= 2
          ? 'Deepen with ONE new, synthesized question about a detail still not clear.'
          : 'Several exchanges already: briefly synthesize what you understand and ask ONE objective question tying open points — or close warmly if there is enough information.',
    ],
  };

  return (blocks[language] ?? blocks.pt).join('\n');
};
