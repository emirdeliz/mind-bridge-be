import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

const THINKING_PROCESS_PATTERN = /thinking\s*process\s*:?/i;

const ANALYSIS_LINE_PATTERN =
  /^\s*(\d+\.\s*)?(\*{1,2})?(analyze|analysis|constraints|role|step|reasoning)/i;

const PATIENT_RESPONSE_STARTERS =
  /\b(entendo|entiendo|i understand|comprendo|agradeço|agradezco|thank you|poderia|could you|gostaria|em que|na conversa|durante|quando você|how did|en la conversación|en qué momento|o que você|what do you|qué siente)\b/i;

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
  const looksLikeShortReply =
    cleaned.length <= 220 &&
    !THINKING_PROCESS_PATTERN.test(cleaned) &&
    !ANALYSIS_LINE_PATTERN.test(firstLine) &&
    !/^\d+\.\s*\*\*/.test(cleaned);

  if (looksLikeShortReply) {
    return false;
  }

  return (
    THINKING_PROCESS_PATTERN.test(cleaned) ||
    ANALYSIS_LINE_PATTERN.test(firstLine) ||
    /^\d+\.\s*\*\*/.test(cleaned)
  );
};

/** Last patient-facing question in raw model output (before compacting). */
export const extractLastQuestionFromRaw = (text: string): string => {
  const cleaned = stripThinkTags(text.trim());
  if (!cleaned) {
    return '';
  }

  const questionSentences =
    cleaned.match(/[^?\n]{8,}\?/g)?.map((part) => part.trim()) ?? [];

  for (let index = questionSentences.length - 1; index >= 0; index -= 1) {
    const candidate = questionSentences[index] ?? '';
    if (!candidate || ANALYSIS_LINE_PATTERN.test(candidate)) {
      continue;
    }
    if (/^\d+\.\s*\*\*/.test(candidate)) {
      continue;
    }
    return candidate;
  }

  return '';
};

const extractTopicSnippet = (userMessage: string | undefined): string => {
  const normalized = userMessage?.replace(/\s+/g, ' ').trim() ?? '';
  if (!normalized) {
    return '';
  }

  const words = normalized
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 6);

  if (!words.length) {
    return normalized.slice(0, 48).trim();
  }

  let snippet = words.join(' ');
  if (snippet.length > 48) {
    snippet = `${snippet.slice(0, 45).trim()}…`;
  }

  return snippet;
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

const PATIENT_CHAT_MAX_SENTENCES = 3;

const splitSentences = (text: string): string[] =>
  text
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
    ?.map((part) => part.trim())
    .filter(Boolean) ?? [text];

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

export const finalizePatientChatResponse = (text: string): string => {
  const sanitized = compactPatientChatResponse(sanitizePatientChatResponse(text));
  if (sanitized) {
    return sanitized;
  }

  const recoveredQuestion = compactPatientChatResponse(
    extractLastQuestionFromRaw(text)
  );
  if (recoveredQuestion && !isLeakedPatientChatReasoning(recoveredQuestion)) {
    return recoveredQuestion;
  }

  return '';
};

const FALLBACK_REPLIES: Record<AppLanguage, string> = {
  pt: 'O que mais ficou com você depois do que contou?',
  es: '¿Qué fue lo que más se quedó con usted después de lo que contó?',
  en: 'What stayed with you most after what you shared?',
};

export const buildPatientChatBrevityGuidance = (
  language: AppLanguage
): string => {
  const blocks: Record<AppLanguage, string> = {
    pt: [
      'FORMATO DA RESPOSTA:',
      '- Até 3 frases curtas. Pode começar com acolhimento breve (1 frase) + UMA pergunta aberta.',
      '- A pergunta deve convidar o paciente a elaborar — não apenas confirmar com sim/não.',
      '- PROIBIDO: parágrafos, listas, repetir o relato inteiro, validações longas.',
      'Exemplo RUIM (fechado e formulaico): "O que você sente agora?"',
      'Exemplo BOM (aberto): "Quando pensa na conversa com seus colegas, o que mais pesa para você nessa situação?"',
      'Exemplo BOM (aberto): "Como você descreveria o que passou dentro de você naquele momento?"',
    ].join('\n'),
    es: [
      'FORMATO DE LA RESPUESTA:',
      '- Hasta 3 frases cortas. Puede empezar con acogida breve (1 frase) + UNA pregunta abierta.',
      '- La pregunta debe invitar a elaborar — no solo confirmar con sí/no.',
      '- PROHIBIDO: párrafos, listas, repetir todo el relato, validaciones largas.',
      'Ejemplo MALO (cerrado y formulaico): "¿Qué siente ahora?"',
      'Ejemplo BUENO (abierto): "Cuando piensa en la conversación con sus colegas, ¿qué pesa más para usted en esa situación?"',
      'Ejemplo BUENO (abierto): "¿Cómo describiría lo que pasó dentro de usted en ese momento?"',
    ].join('\n'),
    en: [
      'REPLY FORMAT:',
      '- Up to 3 short sentences. You may start with brief acknowledgment (1 sentence) + ONE open question.',
      '- The question should invite the patient to elaborate — not just confirm with yes/no.',
      '- FORBIDDEN: paragraphs, lists, repeating the full report, long validations.',
      'BAD example (closed and formulaic): "What do you feel right now?"',
      'GOOD example (open): "When you think about the conversation with your colleagues, what weighs on you most in that situation?"',
      'GOOD example (open): "How would you describe what went on inside you in that moment?"',
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
      '- Palavras do dia a dia, como numa conversa de consultório acolhedora.',
      '- PROIBIDO: termos clínicos, siglas, diagnósticos, nomes de terapias.',
      '- Evite frases de manual ("Agradeço por compartilhar", "Compreendo que deve ser difícil").',
      '- Prefira curiosidade genuína: "O que isso despertou em você?", "Como foi para você?", "O que mais te chamou atenção?".',
    ].join('\n'),
    es: [
      'LENGUAJE SIMPLE (obligatorio):',
      '- Palabras cotidianas, como en una conversación acogedora de consulta.',
      '- PROHIBIDO: términos clínicos, siglas, diagnósticos, nombres de terapias.',
      '- Evite frases de manual ("Agradezco que comparta", "Comprendo que debe ser difícil").',
      '- Prefiera curiosidad genuina: "¿Qué le despertó esto?", "¿Cómo fue para usted?", "¿Qué más le llamó la atención?".',
    ].join('\n'),
    en: [
      'SIMPLE LANGUAGE (required):',
      '- Everyday words, like a warm session conversation.',
      '- FORBIDDEN: clinical terms, acronyms, diagnoses, therapy names.',
      '- Avoid scripted phrases ("Thank you for sharing", "I understand this must be hard").',
      '- Prefer genuine curiosity: "What did that stir in you?", "What was that like for you?", "What stood out most?"',
    ].join('\n'),
  };

  return blocks[language] ?? blocks.pt;
};

export const buildPsychologistStanceGuidance = (
  language: AppLanguage
): string => {
  const blocks: Record<AppLanguage, string> = {
    pt: [
      'POSTURA CLÍNICA (pense como psicólogo em escuta inicial):',
      '- Ouça o relato com curiosidade, não com roteiro fixo.',
      '- Faça perguntas ABERTAS que ampliem o entendimento — convidem o paciente a contar mais.',
      '- Inícios úteis: "O que...", "Como...", "De que forma...", "O que isso representa...", "O que você notou...".',
      '- Evite perguntas fechadas repetidas ("O que sente agora?", "Está triste?") — variar é essencial.',
      '- Aprofunde o que o paciente JÁ trouxe antes de mudar de tema.',
      '- Não diagnostique, não interprete em voz alta, não prescreva — apenas explore com respeito.',
      '- Uma pergunta por vez. Deixe espaço para o paciente pensar e responder.',
    ].join('\n'),
    es: [
      'POSTURA CLÍNICA (piense como psicólogo en escucha inicial):',
      '- Escuche el relato con curiosidad, no con guion fijo.',
      '- Haga preguntas ABIERTAS que amplíen la comprensión — inviten a contar más.',
      '- Inicios útiles: "¿Qué...", "¿Cómo...", "¿De qué forma...", "¿Qué representa...", "¿Qué notó...".',
      '- Evite preguntas cerradas repetidas ("¿Qué siente ahora?", "¿Está triste?") — variar es esencial.',
      '- Profundice lo que el paciente YA trajo antes de cambiar de tema.',
      '- No diagnostique, no interprete en voz alta, no prescriba — solo explore con respeto.',
      '- Una pregunta a la vez. Deje espacio para que el paciente piense y responda.',
    ].join('\n'),
    en: [
      'CLINICAL STANCE (think like a psychologist in initial listening):',
      '- Listen with curiosity, not a fixed script.',
      '- Ask OPEN questions that broaden understanding — invite the patient to say more.',
      '- Useful openings: "What...", "How...", "In what way...", "What does this represent...", "What did you notice...".',
      '- Avoid repeated closed questions ("What do you feel now?", "Are you sad?") — variety is essential.',
      '- Deepen what the patient ALREADY shared before changing topic.',
      '- Do not diagnose, interpret aloud, or prescribe — only explore with respect.',
      '- One question at a time. Leave room for the patient to think and answer.',
    ].join('\n'),
  };

  return blocks[language] ?? blocks.pt;
};

export const buildPresentMomentGuidance = (language: AppLanguage): string => {
  const blocks: Record<AppLanguage, string> = {
    pt: [
      'FOCO NO RELATO (obrigatório):',
      '- Responda sobre o que o paciente descreveu: pessoa, lugar, situação ou sensação concreta.',
      '- Pode explorar o evento que o paciente mencionou, sem fixar em calendário (evite: hoje, ontem, amanhã, essa semana).',
      '- Exemplo RUIM (genérico e fechado): "Como você está?"',
      '- Exemplo BOM (aberto e específico): "O que mais ficou com você depois dessa conversa com os colegas?"',
    ].join('\n'),
    es: [
      'ENFOQUE EN EL RELATO (obligatorio):',
      '- Responde sobre lo que el paciente describió: persona, lugar, situación o sensación concreta.',
      '- Puede explorar el evento que mencionó, sin fijarse en calendario (evite: hoy, ayer, mañana, esta semana).',
      '- Ejemplo MALO (genérico y cerrado): "¿Cómo está?"',
      '- Ejemplo BUENO (abierto y específico): "¿Qué fue lo que más se quedó con usted después de esa conversación con los colegas?"',
    ].join('\n'),
    en: [
      'REPORT FOCUS (required):',
      '- Reply about what the patient described: person, place, situation, or concrete sensation.',
      '- You may explore the event they mentioned without calendar anchors (avoid: today, yesterday, tomorrow, this week).',
      '- BAD example (generic and closed): "How are you?"',
      '- GOOD example (open and specific): "What stayed with you most after that conversation with your colleagues?"',
    ].join('\n'),
  };

  return blocks[language] ?? blocks.pt;
};

export const getPatientChatFallbackReply = (
  language: AppLanguage,
  userMessage?: string
): string => {
  const snippet = extractTopicSnippet(userMessage);

  if (snippet) {
    const contextual: Record<AppLanguage, string> = {
      pt: `O que mais pesa para você quando pensa em ${snippet}?`,
      es: `¿Qué pesa más para usted cuando piensa en ${snippet}?`,
      en: `What weighs on you most when you think about ${snippet}?`,
    };
    return contextual[language] ?? contextual.pt;
  }

  return FALLBACK_REPLIES[language] ?? FALLBACK_REPLIES.pt;
};

/** @deprecated Legacy closing messages still recognized in old chat history. */
const LEGACY_CLOSING_MESSAGES: Record<AppLanguage, string> = {
  pt: 'Agradeço por compartilhar estas informações. Permaneço à disposição para apoiá-lo(a) quando necessário.',
  es: 'Agradezco que haya compartido esta información. Permanezco a su disposición para apoyarle cuando lo necesite.',
  en: 'Thank you for sharing this information. I remain available to support you whenever needed.',
};

const LEGACY_CLOSING_MESSAGE_SET = new Set(
  Object.values(LEGACY_CLOSING_MESSAGES)
);

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

export const PATIENT_CHAT_SIMILARITY_THRESHOLD = 0.72;
export const PATIENT_CHAT_MAX_SIMILARITY_RETRIES = 2;

export const tokenizeForSimilarity = (text: string): string[] => {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);

  return [...new Set(normalized)];
};

const jaccardSimilarity = (left: string[], right: string[]): number => {
  if (!left.length || !right.length) {
    return 0;
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let intersection = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
};

export const isSimilarPatientChatReply = (
  candidate: string,
  priorReplies: string[],
  threshold = PATIENT_CHAT_SIMILARITY_THRESHOLD
): boolean => {
  const normalizedCandidate = candidate.trim();
  if (!normalizedCandidate || !priorReplies.length) {
    return false;
  }

  const candidateTokens = tokenizeForSimilarity(normalizedCandidate);
  if (!candidateTokens.length) {
    return false;
  }

  return priorReplies.some((priorReply) => {
    const normalizedPrior = priorReply.trim();
    if (!normalizedPrior) {
      return false;
    }

    if (normalizedCandidate === normalizedPrior) {
      return true;
    }

    const priorTokens = tokenizeForSimilarity(normalizedPrior);
    return jaccardSimilarity(candidateTokens, priorTokens) >= threshold;
  });
};

export const buildQuestionAngleGuidance = (
  language: AppLanguage,
  questionCount: number
): string => {
  const angles: Record<AppLanguage, string[]> = {
    pt: [
      'ÂNGULO DESTA PERGUNTA — faça UMA pergunta aberta sobre sensações no corpo (peito, garganta, tensão, respiração). Ex.: "O que você percebe no corpo quando pensa nisso?"',
      'ÂNGULO DESTA PERGUNTA — explore pensamentos ou imagens que surgiram. Ex.: "Que pensamento ou imagem veio à sua mente?"',
      'ÂNGULO DESTA PERGUNTA — explore uma pessoa envolvida e o impacto relacional. Ex.: "Como foi para você na relação com essa pessoa?"',
      'ÂNGULO DESTA PERGUNTA — explore o que o paciente gostaria que fosse diferente. Ex.: "O que você gostaria que fosse diferente nessa situação?"',
      'ÂNGULO DESTA PERGUNTA — explore impacto na rotina (sono, trabalho, relações). Ex.: "De que forma isso tem afetado seu dia a dia?"',
      'ÂNGULO DESTA PERGUNTA — explore a emoção predominante com as palavras do paciente. Ex.: "Como você nomearia o que sentiu naquele momento?"',
      'ÂNGULO DESTA PERGUNTA — explore o significado pessoal do evento. Ex.: "O que essa situação representa para você?"',
      'ÂNGULO DESTA PERGUNTA — explore o que fez ou evitou fazer (enfrentamento). Ex.: "O que você fez ou deixou de fazer quando isso aconteceu?"',
      'ÂNGULO DESTA PERGUNTA — explore o diálogo interno. Ex.: "O que você disse a si mesmo(a) na hora?"',
      'ÂNGULO DESTA PERGUNTA — explore necessidade não atendida. Ex.: "O que você precisava naquele momento e não teve?"',
      'ÂNGULO DESTA PERGUNTA — explore o que antecedeu o desconforto. Ex.: "O que estava acontecendo logo antes de se sentir assim?"',
      'ÂNGULO DESTA PERGUNTA — explore rede de apoio. Ex.: "Com quem você gostaria de falar sobre isso?"',
    ],
    es: [
      'ÁNGULO DE ESTA PREGUNTA — haga UNA pregunta abierta sobre sensaciones corporales. Ej.: "¿Qué nota en el cuerpo cuando piensa en esto?"',
      'ÁNGULO DE ESTA PREGUNTA — explore pensamientos o imágenes. Ej.: "¿Qué pensamiento o imagen vino a su mente?"',
      'ÁNGULO DE ESTA PREGUNTA — explore una persona involucrada y el vínculo. Ej.: "¿Cómo fue para usted en la relación con esa persona?"',
      'ÁNGULO DE ESTA PREGUNTA — explore qué le gustaría que fuera diferente. Ej.: "¿Qué le gustaría que fuera diferente en esa situación?"',
      'ÁNGULO DE ESTA PREGUNTA — explore impacto en la rutina. Ej.: "¿De qué forma ha afectado su día a día?"',
      'ÁNGULO DE ESTA PREGUNTA — explore la emoción predominante. Ej.: "¿Cómo nombraría lo que sintió en ese momento?"',
      'ÁNGULO DE ESTA PREGUNTA — explore el significado personal. Ej.: "¿Qué representa esa situación para usted?"',
      'ÁNGULO DE ESTA PREGUNTA — explore qué hizo o evitó hacer. Ej.: "¿Qué hizo o dejó de hacer cuando ocurrió?"',
      'ÁNGULO DE ESTA PREGUNTA — explore el diálogo interno. Ej.: "¿Qué se dijo a sí mismo(a) en ese momento?"',
      'ÁNGULO DE ESTA PREGUNTA — explore necesidad no atendida. Ej.: "¿Qué necesitaba en ese momento y no tuvo?"',
      'ÁNGULO DE ESTA PREGUNTA — explore qué antecedió al malestar. Ej.: "¿Qué estaba pasando justo antes de sentirse así?"',
      'ÁNGULO DE ESTA PREGUNTA — explore red de apoyo. Ej.: "¿Con quién le gustaría hablar sobre esto?"',
    ],
    en: [
      'ANGLE FOR THIS QUESTION — ask ONE open question about body sensations. E.g.: "What do you notice in your body when you think about this?"',
      'ANGLE FOR THIS QUESTION — explore thoughts or images. E.g.: "What thought or image came to your mind?"',
      'ANGLE FOR THIS QUESTION — explore a person involved and the relationship. E.g.: "What was that like for you with that person?"',
      'ANGLE FOR THIS QUESTION — explore what they would like to be different. E.g.: "What would you like to be different in that situation?"',
      'ANGLE FOR THIS QUESTION — explore impact on daily routine. E.g.: "In what way has this affected your daily life?"',
      'ANGLE FOR THIS QUESTION — explore the predominant emotion in the patient\'s words. E.g.: "How would you name what you felt in that moment?"',
      'ANGLE FOR THIS QUESTION — explore personal meaning. E.g.: "What does this situation represent for you?"',
      'ANGLE FOR THIS QUESTION — explore what they did or avoided. E.g.: "What did you do or avoid doing when it happened?"',
      'ANGLE FOR THIS QUESTION — explore inner dialogue. E.g.: "What did you tell yourself at the time?"',
      'ANGLE FOR THIS QUESTION — explore unmet need. E.g.: "What did you need in that moment and not have?"',
      'ANGLE FOR THIS QUESTION — explore what preceded the distress. E.g.: "What was going on right before you felt this way?"',
      'ANGLE FOR THIS QUESTION — explore support network. E.g.: "Who would you like to talk to about this?"',
    ],
  };

  const options = angles[language] ?? angles.pt;
  return options[questionCount % options.length] ?? options[0]!;
};

export const buildPatientChatRetryGuidance = (
  language: AppLanguage,
  rejectedReply: string,
  priorReplies: string[],
  attempt: number
): string => {
  const listedQuestions = priorReplies
    .map((question, index) => `${index + 1}. "${question}"`)
    .join('\n');

  const blocks: Record<AppLanguage, string> = {
    pt: [
      `RETRY ${attempt} — A resposta "${rejectedReply}" foi REJEITADA por ser similar a perguntas anteriores.`,
      'Perguntas anteriores nesta interação:',
      listedQuestions,
      'Gere UMA pergunta NOVA com ângulo diferente (corpo, emoção, pensamento, pessoa, significado, enfrentamento, necessidade, apoio ou consequência).',
      'PROIBIDO reformular a mesma pergunta com poucas palavras trocadas.',
    ].join('\n'),
    es: [
      `REINTENTO ${attempt} — La respuesta "${rejectedReply}" fue RECHAZADA por ser similar a preguntas anteriores.`,
      'Preguntas anteriores en esta interacción:',
      listedQuestions,
      'Genere UNA pregunta NUEVA con ángulo diferente (cuerpo, emoción, pensamiento, persona, significado, afrontamiento, necesidad, apoyo o consecuencia).',
      'PROHIBIDO reformular la misma pregunta con pocas palabras cambiadas.',
    ].join('\n'),
    en: [
      `RETRY ${attempt} — The reply "${rejectedReply}" was REJECTED for being similar to prior questions.`,
      'Prior questions in this interaction:',
      listedQuestions,
      'Generate ONE NEW question from a different angle (body, emotion, thought, person, meaning, coping, need, support, or consequence).',
      'FORBIDDEN to lightly rephrase the same question.',
    ].join('\n'),
  };

  return blocks[language] ?? blocks.pt;
};

const extractTopicSnippetForFallback = (userMessage: string | undefined): string => {
  const normalized = userMessage?.replace(/\s+/g, ' ').trim() ?? '';
  if (!normalized) {
    return '';
  }

  const words = normalized
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 5);

  if (!words.length) {
    return normalized.slice(0, 40).trim();
  }

  let snippet = words.join(' ');
  if (snippet.length > 40) {
    snippet = `${snippet.slice(0, 37).trim()}…`;
  }

  return snippet;
};

export const buildDistinctPatientChatFallback = (
  language: AppLanguage,
  userMessage: string | undefined,
  questionCount: number,
  priorReplies: string[]
): string => {
  const snippet = extractTopicSnippetForFallback(userMessage);
  const angleTemplates: Record<AppLanguage, Array<(topic: string) => string>> = {
    pt: [
      (topic) =>
        topic
          ? `Qual pensamento veio primeiro quando pensou em ${topic}?`
          : 'Qual pensamento veio primeiro?',
      (topic) =>
        topic
          ? `Quem mais estava envolvido nessa situação com ${topic}?`
          : 'Quem mais estava envolvido nessa situação?',
      (topic) =>
        topic
          ? `O que muda no seu corpo quando pensa em ${topic}?`
          : 'O que muda no seu corpo quando pensa nisso?',
      (topic) =>
        topic
          ? `O que você gostaria que fosse diferente em relação a ${topic}?`
          : 'O que você gostaria que fosse diferente?',
      (topic) =>
        topic
          ? `Como isso com ${topic} tem afetado seu sono ou sua rotina?`
          : 'Como isso tem afetado seu sono ou sua rotina?',
      (topic) =>
        topic
          ? `Qual sentimento pesa mais quando pensa em ${topic}?`
          : 'Qual sentimento pesa mais agora?',
      (topic) =>
        topic
          ? `O que essa situação com ${topic} significa para você?`
          : 'O que essa situação significa para você?',
      (topic) =>
        topic
          ? `O que você fez ou deixou de fazer quando pensou em ${topic}?`
          : 'O que você fez ou deixou de fazer na hora?',
      (topic) =>
        topic
          ? `O que você disse a si mesmo(a) quando isso com ${topic} aconteceu?`
          : 'O que você disse a si mesmo(a) na hora?',
      (topic) =>
        topic
          ? `O que você precisava e não conseguiu em relação a ${topic}?`
          : 'O que você precisava e não conseguiu?',
      (topic) =>
        topic
          ? `O que aconteceu logo antes de se sentir assim por causa de ${topic}?`
          : 'O que aconteceu logo antes de se sentir assim?',
      (topic) =>
        topic
          ? `De quem você gostaria de apoio para lidar com ${topic}?`
          : 'De quem você gostaria de apoio agora?',
    ],
    es: [
      (topic) =>
        topic
          ? `¿Qué pensamiento vino primero al pensar en ${topic}?`
          : '¿Qué pensamiento vino primero?',
      (topic) =>
        topic
          ? `¿Quién más estuvo involucrado en esa situación con ${topic}?`
          : '¿Quién más estuvo involucrado en esa situación?',
      (topic) =>
        topic
          ? `¿Qué cambia en su cuerpo cuando piensa en ${topic}?`
          : '¿Qué cambia en su cuerpo cuando piensa en eso?',
      (topic) =>
        topic
          ? `¿Qué le gustaría que fuera diferente respecto a ${topic}?`
          : '¿Qué le gustaría que fuera diferente?',
      (topic) =>
        topic
          ? `¿Cómo ha afectado esto de ${topic} su sueño o su rutina?`
          : '¿Cómo ha afectado esto su sueño o su rutina?',
      (topic) =>
        topic
          ? `¿Qué sentimiento pesa más cuando piensa en ${topic}?`
          : '¿Qué sentimiento pesa más ahora?',
      (topic) =>
        topic
          ? `¿Qué significa para usted esa situación con ${topic}?`
          : '¿Qué significa para usted esa situación?',
      (topic) =>
        topic
          ? `¿Qué hizo o dejó de hacer cuando pensó en ${topic}?`
          : '¿Qué hizo o dejó de hacer en ese momento?',
      (topic) =>
        topic
          ? `¿Qué se dijo a sí mismo(a) cuando pasó lo de ${topic}?`
          : '¿Qué se dijo a sí mismo(a) en ese momento?',
      (topic) =>
        topic
          ? `¿Qué necesitaba y no recibió respecto a ${topic}?`
          : '¿Qué necesitaba y no recibió?',
      (topic) =>
        topic
          ? `¿Qué pasó justo antes de sentirse así por ${topic}?`
          : '¿Qué pasó justo antes de sentirse así?',
      (topic) =>
        topic
          ? `¿De quién le gustaría apoyo para lidiar con ${topic}?`
          : '¿De quién le gustaría apoyo ahora?',
    ],
    en: [
      (topic) =>
        topic
          ? `What thought came first when you thought about ${topic}?`
          : 'What thought came first?',
      (topic) =>
        topic
          ? `Who else was involved in that situation with ${topic}?`
          : 'Who else was involved in that situation?',
      (topic) =>
        topic
          ? `What changes in your body when you think about ${topic}?`
          : 'What changes in your body when you think about it?',
      (topic) =>
        topic
          ? `What would you like to be different about ${topic}?`
          : 'What would you like to be different?',
      (topic) =>
        topic
          ? `How has this about ${topic} affected your sleep or daily routine?`
          : 'How has this affected your sleep or daily routine?',
      (topic) =>
        topic
          ? `Which feeling weighs most when you think about ${topic}?`
          : 'Which feeling weighs most right now?',
      (topic) =>
        topic
          ? `What does this situation with ${topic} mean to you?`
          : 'What does this situation mean to you?',
      (topic) =>
        topic
          ? `What did you do or avoid doing when you thought about ${topic}?`
          : 'What did you do or avoid doing at the time?',
      (topic) =>
        topic
          ? `What did you tell yourself when this about ${topic} happened?`
          : 'What did you tell yourself at the time?',
      (topic) =>
        topic
          ? `What did you need and not receive regarding ${topic}?`
          : 'What did you need and not receive?',
      (topic) =>
        topic
          ? `What happened right before you felt this way about ${topic}?`
          : 'What happened right before you felt this way?',
      (topic) =>
        topic
          ? `Who would you want support from to cope with ${topic}?`
          : 'Who would you want support from now?',
    ],
  };

  const templates = angleTemplates[language] ?? angleTemplates.pt;
  for (let offset = 0; offset < templates.length; offset += 1) {
    const template = templates[(questionCount + offset) % templates.length]!;
    const candidate = template(snippet);
    if (!isSimilarPatientChatReply(candidate, priorReplies, 0.5)) {
      return candidate;
    }
  }

  return getPatientChatFallbackReply(language, userMessage);
};

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
      'Exemplo RUIM (similar): já perguntou sobre tristeza no corpo → não pergunte de novo "o que sente de tristeza".',
      'Exemplo BOM (ângulo novo e aberto): após falar da tristeza, pergunte "O que essa tristeza representa para você nessa situação?"',
    ].join('\n'),
    es: [
      'ANTI-REPETICIÓN (obligatorio):',
      'Preguntas que ya hiciste en esta interacción:',
      listedQuestions,
      '- PROHIBIDO repetir o reformular con poco cambio cualquier pregunta anterior.',
      '- PROHIBIDO hacer preguntas muy similares (mismo tema, mismo momento, misma persona, misma sensación).',
      '- Cambia el ángulo: otra sensación en el cuerpo, otra persona involucrada, otro pensamiento que surge ahora.',
      '- Si el paciente ya respondió un punto, avanza a otro aún no explorado o cierra con contención.',
      'Ejemplo MALO (similar): ya preguntó sobre tristeza en el cuerpo → no pregunte de nuevo "qué siente de tristeza".',
      'Ejemplo BUENO (ángulo nuevo y abierto): tras hablar de la tristeza, pregunte "¿Qué representa esa tristeza para usted en esa situación?"',
    ].join('\n'),
    en: [
      'ANTI-REPETITION (required):',
      'Questions you already asked in this interaction:',
      listedQuestions,
      '- FORBIDDEN to repeat or lightly rephrase any question above.',
      '- FORBIDDEN to ask very similar questions (same theme, moment, person, or sensation).',
      '- Change the angle: another body sensation, another person involved, another thought arising now.',
      '- If the patient already answered a point, move to another unexplored aspect or close warmly.',
      'BAD example (similar): already asked about sadness in the body → do not ask again "what sadness do you feel".',
      'GOOD example (new open angle): after sadness, ask "What does that sadness represent for you in that situation?"',
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
      '- Cada resposta: até 3 frases curtas (acolhimento opcional + pergunta aberta).',
      '- Priorize UMA pergunta aberta que aprofunde o relato; evite interrogatório.',
      '- Varie o tipo de pergunta a cada turno — não repita estrutura ("o que sente", "o que pensa").',
      questionCount === 0
        ? 'Primeira pergunta: acolha brevemente e convide o paciente a elaborar UM aspecto do relato.'
        : questionsRemaining === 1
          ? 'ÚLTIMA pergunta desta interação: uma pergunta aberta essencial que una o que já foi dito.'
          : questionCount <= 2
            ? 'Aprofunde com UMA pergunta aberta sobre algo que o paciente mencionou mas ainda não explorou.'
            : 'Já houve várias trocas: faça UMA pergunta aberta que una os pontos em aberto ou encerre com acolhimento (sem pergunta).',
    ],
    es: [
      `RITMO DE LA CONVERSACIÓN (máximo ${maxQuestionsPerInteraction} preguntas por interacción):`,
      `- Preguntas ya hechas en esta interacción: ${questionCount} de ${maxQuestionsPerInteraction}.`,
      questionsRemaining > 0
        ? `- Quedan ${questionsRemaining} pregunta(s) en esta interacción — úselas con moderación.`
        : '- Límite alcanzado: cierre con contención breve, SIN nueva pregunta.',
      '- Cada respuesta: hasta 3 frases cortas (acogida opcional + pregunta abierta).',
      '- Priorice UNA pregunta abierta que profundice el relato; evite interrogatorio.',
      '- Varíe el tipo de pregunta en cada turno — no repita estructura ("qué siente", "qué piensa").',
      questionCount === 0
        ? 'Primera pregunta: acoja brevemente e invite a elaborar UN aspecto del relato.'
        : questionsRemaining === 1
          ? 'ÚLTIMA pregunta de esta interacción: una pregunta abierta esencial que una lo ya dicho.'
          : questionCount <= 2
            ? 'Profundice con UNA pregunta abierta sobre algo mencionado pero aún no explorado.'
            : 'Ya hubo varios intercambios: haga UNA pregunta abierta que una los puntos abiertos o cierre con contención (sin pregunta).',
    ],
    en: [
      `CONVERSATION PACING (max ${maxQuestionsPerInteraction} questions per interaction):`,
      `- Questions already asked in this interaction: ${questionCount} of ${maxQuestionsPerInteraction}.`,
      questionsRemaining > 0
        ? `- ${questionsRemaining} question(s) left in this interaction — use them sparingly.`
        : '- Limit reached: close warmly in one short sentence, with NO new question.',
      '- Each reply: up to 3 short sentences (optional acknowledgment + open question).',
      '- Prioritize ONE open question that deepens the report; avoid interrogation.',
      '- Vary question type each turn — do not repeat structure ("what you feel", "what you think").',
      questionCount === 0
        ? 'First question: briefly acknowledge and invite the patient to elaborate on ONE aspect of their report.'
        : questionsRemaining === 1
          ? 'LAST question in this interaction: one essential open question tying together what was said.'
          : questionCount <= 2
            ? 'Deepen with ONE open question about something mentioned but not yet explored.'
            : 'Several exchanges already: ask ONE open question tying open points or close warmly (no question).',
    ],
  };

  return (blocks[language] ?? blocks.pt).join('\n');
};
