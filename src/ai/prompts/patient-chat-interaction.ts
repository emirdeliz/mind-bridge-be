import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

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

const PATIENT_CHAT_MAX_SENTENCES = 2;

const splitSentences = (text: string): string[] =>
  text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) ??
  [text];

/** Keeps at most two short sentences — no mid-sentence cut. */
export const compactPatientChatResponse = (
  text: string,
  maxSentences = PATIENT_CHAT_MAX_SENTENCES
): string => {
  const normalized = text
    .split('\n')
    .map((line) => line.replace(/^[\s\-*•\d.)]+/, '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/…+/g, '')
    .replace(/\.{3,}/g, '')
    .trim();

  if (!normalized) {
    return '';
  }

  return splitSentences(normalized).slice(0, maxSentences).join(' ').trim();
};

export const finalizePatientChatResponse = (text: string): string =>
  compactPatientChatResponse(sanitizePatientChatResponse(text));

const FALLBACK_REPLIES: Record<AppLanguage, string> = {
  pt: 'Entendo. O que você sente agora?',
  es: 'Entiendo. ¿Qué siente ahora?',
  en: 'I understand. What do you feel right now?',
};

export const buildPatientChatBrevityGuidance = (language: AppLanguage): string => {
  const blocks: Record<AppLanguage, string> = {
    pt: [
      'TAMANHO DA RESPOSTA (obrigatório — prioridade máxima):',
      '- NO MÁXIMO 2 frases curtas. Ideal: 1 frase só.',
      '- Formato padrão: "Entendo." + UMA pergunta curta — ou só a pergunta.',
      '- Cada frase com no máximo 12 palavras.',
      '- PROIBIDO: parágrafos, listas, repetir o relato, validações longas.',
      'Exemplo RUIM: "Compreendo que compartilhar isso deve ser difícil; quando você pensa nessa situação com os colegas, o que sente no corpo neste momento?"',
      'Exemplo BOM: "Entendo. O que você sente agora ao pensar nos colegas?"',
    ].join('\n'),
    es: [
      'TAMAÑO DE LA RESPUESTA (obligatorio — máxima prioridad):',
      '- COMO MÁXIMO 2 frases cortas. Ideal: 1 sola frase.',
      '- Formato estándar: "Entiendo." + UNA pregunta corta — o solo la pregunta.',
      '- Cada frase con como máximo 12 palabras.',
      '- PROHIBIDO: párrafos, listas, repetir el relato, validaciones largas.',
      'Ejemplo MALO: "Comprendo que compartir esto debe ser difícil; cuando piensa en esa situación con los colegas, ¿qué siente en el cuerpo en este momento?"',
      'Ejemplo BUENO: "Entiendo. ¿Qué siente ahora al pensar en los colegas?"',
    ].join('\n'),
    en: [
      'REPLY LENGTH (required — top priority):',
      '- AT MOST 2 short sentences. Ideal: 1 sentence only.',
      '- Default format: "I understand." + ONE short question — or just the question.',
      '- Each sentence at most 12 words.',
      '- FORBIDDEN: paragraphs, lists, repeating the report, long validations.',
      'BAD example: "I understand that sharing this must be hard; when you think about that situation with colleagues, what do you feel in your body right now?"',
      'GOOD example: "I understand. What do you feel right now when you think about your colleagues?"',
    ].join('\n'),
  };

  return blocks[language] ?? blocks.pt;
};

export const buildPatientChatSimplicityGuidance = (
  language: AppLanguage
): string => {
  const blocks: Record<AppLanguage, string> = {
    pt: [
      'LINGUAGEM SIMPLES (obrigatório):',
      '- Palavras do dia a dia. Frases diretas.',
      '- PROIBIDO: termos clínicos, siglas, frases compostas longas, conectores em excesso (além disso, nesse sentido, por outro lado).',
      '- PROIBIDO começar com: "Agradeço por compartilhar", "Compreendo que isso deve ser", "Entendo como deve ser difícil".',
      '- Prefira: Entendo. / O que você sente? / O que passa na sua cabeça agora?',
      '- Uma ideia por frase. Sem explicações.',
    ].join('\n'),
    es: [
      'LENGUAJE SIMPLE (obligatorio):',
      '- Palabras cotidianas. Frases directas.',
      '- PROHIBIDO: términos clínicos, siglas, frases compuestas largas, conectores en exceso.',
      '- PROHIBIDO empezar con: "Agradezco que comparta", "Comprendo que esto debe ser", "Entiendo lo difícil que es".',
      '- Prefiere: Entiendo. / ¿Qué siente? / ¿Qué pasa por su cabeza ahora?',
      '- Una idea por frase. Sin explicaciones.',
    ].join('\n'),
    en: [
      'SIMPLE LANGUAGE (required):',
      '- Everyday words. Direct sentences.',
      '- FORBIDDEN: clinical terms, acronyms, long compound sentences, excess connectors.',
      '- FORBIDDEN openings: "Thank you for sharing", "I understand this must be", "I can imagine how hard".',
      '- Prefer: I understand. / What do you feel? / What goes through your mind right now?',
      '- One idea per sentence. No explanations.',
    ].join('\n'),
  };

  return blocks[language] ?? blocks.pt;
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
      'Perguntas que você já fez nesta interação:',
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
      'Preguntas que ya hiciste en esta interacción:',
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
      'Questions you already asked in this interaction:',
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
  questionCount: number,
  maxQuestionsPerInteraction = 5
): string => {
  const questionsRemaining = Math.max(
    0,
    maxQuestionsPerInteraction - questionCount
  );

  const blocks: Record<AppLanguage, string[]> = {
    pt: [
      `RITMO DA CONVERSA (máximo ${maxQuestionsPerInteraction} perguntas por interação):`,
      `- Perguntas já feitas nesta interação: ${questionCount} de ${maxQuestionsPerInteraction}.`,
      questionsRemaining > 0
        ? `- Restam ${questionsRemaining} pergunta(s) nesta interação — use com parcimônia.`
        : '- Limite atingido: encerre com acolhimento breve, SEM nova pergunta.',
      '- Cada resposta: no máximo 2 frases curtas (ideal: 1 frase + 1 pergunta).',
      '- Priorize UMA pergunta bem formulada; evite interrogatório.',
      '- Evite perguntas muito similares às anteriores: mude o ângulo a cada nova pergunta.',
      questionCount === 0
        ? 'Primeira pergunta: valide o relato e peça UM detalhe concreto.'
        : questionsRemaining === 1
          ? 'ÚLTIMA pergunta desta interação: faça UMA pergunta objetiva e essencial.'
          : questionCount <= 2
            ? 'Aprofunde com UMA pergunta nova sobre detalhe ainda não esclarecido.'
            : 'Já houve várias trocas: faça UMA pergunta que una os pontos em aberto ou encerre com: "Obrigado por conversar. Quando quiser retomar, é só escrever." (sem pergunta).',
    ],
    es: [
      `RITMO DE LA CONVERSACIÓN (máximo ${maxQuestionsPerInteraction} preguntas por interacción):`,
      `- Preguntas ya hechas en esta interacción: ${questionCount} de ${maxQuestionsPerInteraction}.`,
      questionsRemaining > 0
        ? `- Quedan ${questionsRemaining} pregunta(s) en esta interacción — úselas con moderación.`
        : '- Límite alcanzado: cierre con contención breve, SIN nueva pregunta.',
      '- Cada respuesta: como máximo 2 frases cortas (ideal: 1 frase + 1 pregunta).',
      '- Priorice UNA pregunta bien formulada; evite interrogatorio.',
      '- Evite preguntas muy similares a las anteriores: cambie el ángulo en cada nueva pregunta.',
      questionCount === 0
        ? 'Primera pregunta: valide el relato y pida UN detalle concreto.'
        : questionsRemaining === 1
          ? 'ÚLTIMA pregunta de esta interacción: haga UNA pregunta objetiva y esencial.'
          : questionCount <= 2
            ? 'Profundice con UNA pregunta nueva sobre un detalle aún no aclarado.'
            : 'Ya hubo varios intercambios: haga UNA pregunta que una los puntos abiertos o cierre con: "Gracias por conversar. Cuando quiera retomar, solo escriba." (sin pregunta).',
    ],
    en: [
      `CONVERSATION PACING (max ${maxQuestionsPerInteraction} questions per interaction):`,
      `- Questions already asked in this interaction: ${questionCount} of ${maxQuestionsPerInteraction}.`,
      questionsRemaining > 0
        ? `- ${questionsRemaining} question(s) left in this interaction — use them sparingly.`
        : '- Limit reached: close warmly in one short sentence, with NO new question.',
      '- Each reply: at most 2 short sentences (ideal: 1 sentence + 1 question).',
      '- Prioritize ONE well-formed question; avoid interrogation.',
      '- Avoid questions very similar to prior ones: change the angle with each new question.',
      questionCount === 0
        ? 'First question: validate the report and ask for ONE concrete detail.'
        : questionsRemaining === 1
          ? 'LAST question in this interaction: ask ONE essential, objective question.'
          : questionCount <= 2
            ? 'Deepen with ONE new question about a detail still not clear.'
            : 'Several exchanges already: ask ONE question tying open points or close with: "Thank you for talking. Whenever you want to continue, just write again." (no question).',
    ],
  };

  return (blocks[language] ?? blocks.pt).join('\n');
};
