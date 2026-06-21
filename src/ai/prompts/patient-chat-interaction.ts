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

const FALLBACK_REPLIES: Record<AppLanguage, string[]> = {
  pt: [
    'Parece que isso tem pesado bastante para você.',
    'Faz sentido você se sentir assim diante disso.',
    'O que mais ficou com você depois do que contou?',
  ],
  es: [
    'Parece que esto ha pesado bastante para usted.',
    'Tiene sentido que se sienta así ante esto.',
    '¿Qué fue lo que más se quedó con usted después de lo que contó?',
  ],
  en: [
    'It sounds like this has weighed on you quite a bit.',
    'It makes sense that you would feel this way about it.',
    'What stayed with you most after what you shared?',
  ],
};

export const buildPatientChatBrevityGuidance = (
  language: AppLanguage
): string => {
  const blocks: Record<AppLanguage, string> = {
    pt: [
      'FORMATO:',
      '- Até 3 frases curtas, linguagem do dia a dia.',
      '- Pode ser só acolhimento/reflexão (1–2 frases) OU acolhimento + pergunta — varie entre turnos.',
      '- Cerca de 1 em cada 3–4 respostas: apenas reflita o relato, sem pergunta.',
      '- PROIBIDO: parágrafos, listas, repetir o relato inteiro.',
    ].join('\n'),
    es: [
      'FORMATO:',
      '- Hasta 3 frases cortas, lenguaje cotidiano.',
      '- Puede ser solo acogida/reflexión (1–2 frases) O acogida + pregunta — varíe entre turnos.',
      '- Aproximadamente 1 de cada 3–4 respuestas: solo reflexione el relato, sin pregunta.',
      '- PROHIBIDO: párrafos, listas, repetir todo el relato.',
    ].join('\n'),
    en: [
      'FORMAT:',
      '- Up to 3 short sentences, everyday language.',
      '- May be acknowledgment/reflection only (1–2 sentences) OR acknowledgment + question — vary across turns.',
      '- Roughly 1 in every 3–4 replies: reflect on the report only, with no question.',
      '- FORBIDDEN: paragraphs, lists, repeating the full report.',
    ].join('\n'),
  };

  return blocks[language] ?? blocks.pt;
};

export const buildPatientChatSimplicityGuidance = (
  language: AppLanguage
): string => {
  const blocks: Record<AppLanguage, string> = {
    pt: [
      'LINGUAGEM:',
      '- Palavras do dia a dia; evite jargão clínico, siglas e diagnósticos.',
      '- Use as palavras que o paciente usou; evite frases de manual.',
      '- Varie aberturas — não comece sempre igual.',
    ].join('\n'),
    es: [
      'LENGUAJE:',
      '- Palabras cotidianas; evite jerga clínica, siglas y diagnósticos.',
      '- Use las palabras del paciente; evite frases de manual.',
      '- Varíe los inicios — no empiece siempre igual.',
    ].join('\n'),
    en: [
      'LANGUAGE:',
      '- Everyday words; avoid clinical jargon, acronyms, and diagnoses.',
      '- Use the patient\'s own words; avoid scripted phrases.',
      '- Vary openings — do not always start the same way.',
    ].join('\n'),
  };

  return blocks[language] ?? blocks.pt;
};

export const buildPatientChatPurposeGuidance = (
  language: AppLanguage
): string => {
  const blocks: Record<AppLanguage, string> = {
    pt: [
      'OBJETIVO DESTA CONVERSA:',
      '- Ajudar o paciente a fazer relatos do dia a dia — situações, sentimentos e experiências vividas entre sessões.',
      '- Esses relatos serão usados pelo psicólogo na próxima sessão; você está facilitando esse registro, não conduzindo a terapia.',
      '- Faça perguntas abertas para direcionar o paciente no meio do relato: ajude-o a contar mais, com clareza e detalhes úteis.',
      '- Use o contexto configurado pelo psicólogo (texto + documentos) para orientar QUAIS aspectos do relato vale a pena explorar.',
    ].join('\n'),
    es: [
      'OBJETIVO DE ESTA CONVERSACIÓN:',
      '- Ayudar al paciente a hacer relatos del día a día — situaciones, sentimientos y experiencias vividas entre sesiones.',
      '- Esos relatos serán usados por el psicólogo en la próxima sesión; usted facilita ese registro, no conduce la terapia.',
      '- Haga preguntas abiertas para orientar al paciente en medio del relato: ayúdelo a contar más, con claridad y detalles útiles.',
      '- Use el contexto configurado por el psicólogo (texto + documentos) para orientar QUÉ aspectos del relato conviene explorar.',
    ].join('\n'),
    en: [
      'PURPOSE OF THIS CONVERSATION:',
      '- Help the patient share day-to-day reports — situations, feelings, and experiences between sessions.',
      '- These reports will be used by the psychologist in the next session; you are facilitating that record, not running therapy.',
      '- Ask open questions to guide the patient through their report: help them say more, with clarity and useful detail.',
      '- Use the context configured by the psychologist (text + documents) to guide WHICH aspects of the report are worth exploring.',
    ].join('\n'),
  };

  return blocks[language] ?? blocks.pt;
};

export const buildPsychologistContextUsageGuidance = (
  language: AppLanguage,
  options: {
    hasTextContext: boolean;
    hasKnowledgeContext: boolean;
  }
): string => {
  const blocks: Record<AppLanguage, string[]> = {
    pt: [
      'CONTEXTO DO PSICÓLOGO (como usar nas perguntas):',
      '- O psicólogo fornece contexto de duas formas: (1) texto de orientação da sessão e (2) documentos PDF indexados (protocolos, orientações).',
      options.hasTextContext
        ? '- Texto da sessão: indica temas, foco clínico e o que o psicólogo quer acompanhar — traduza para linguagem simples ao perguntar.'
        : '- Texto da sessão: não informado — baseie-se no relato do paciente e nos documentos, se houver.',
      options.hasKnowledgeContext
        ? '- Documentos PDF (RAG): ampliam seu entendimento interno sobre abordagem e protocolo — use para formular perguntas mais pertinentes, sem citar o documento ao paciente.'
        : '- Documentos PDF: nenhum trecho relevante nesta mensagem — use o texto da sessão e o relato do paciente.',
      '- As perguntas devem ajudar o paciente a relatar experiências do dia a dia alinhadas a esse contexto, sempre com palavras simples.',
    ],
    es: [
      'CONTEXTO DEL PSICÓLOGO (cómo usarlo en las preguntas):',
      '- El psicólogo proporciona contexto de dos formas: (1) texto de orientación de la sesión y (2) documentos PDF indexados (protocolos, orientaciones).',
      options.hasTextContext
        ? '- Texto de la sesión: indica temas, foco clínico y qué quiere acompañar el psicólogo — traduzca a lenguaje simple al preguntar.'
        : '- Texto de la sesión: no informado — base en el relato del paciente y en los documentos, si hay.',
      options.hasKnowledgeContext
        ? '- Documentos PDF (RAG): amplían su comprensión interna sobre enfoque y protocolo — úselos para formular preguntas más pertinentes, sin citar el documento al paciente.'
        : '- Documentos PDF: ningún fragmento relevante en este mensaje — use el texto de la sesión y el relato del paciente.',
      '- Las preguntas deben ayudar al paciente a relatar experiencias del día a día alineadas con ese contexto, siempre con palabras simples.',
    ],
    en: [
      'PSYCHOLOGIST CONTEXT (how to use it in questions):',
      '- The psychologist provides context in two ways: (1) session guidance text and (2) indexed PDF documents (protocols, guidance).',
      options.hasTextContext
        ? '- Session text: indicates themes, clinical focus, and what the psychologist wants to track — translate to simple language when asking.'
        : '- Session text: not provided — rely on the patient report and documents, if any.',
      options.hasKnowledgeContext
        ? '- PDF documents (RAG): broaden your internal understanding of approach and protocol — use them to ask more relevant questions, without citing the document to the patient.'
        : '- PDF documents: no relevant excerpt for this message — use session text and the patient report.',
      '- Questions should help the patient report day-to-day experiences aligned with that context, always in simple words.',
    ],
  };

  return (blocks[language] ?? blocks.pt).join('\n');
};

export const buildPsychologistStanceGuidance = (
  language: AppLanguage
): string => {
  const blocks: Record<AppLanguage, string> = {
    pt: [
      'POSTURA CLÍNICA:',
      '- Seu papel é facilitar relatos do dia a dia que ajudarão o psicólogo na sessão.',
      '- Faça perguntas abertas para direcionar o paciente no meio do relato — convide a contar situações, sentimentos e detalhes concretos.',
      '- Use o contexto do psicólogo (texto + documentos) para decidir o que explorar; traduza tudo para linguagem simples.',
      '- Aprofunde o que o paciente acabou de dizer antes de mudar de tema; às vezes basta acolher ou refletir brevemente.',
      '- Não diagnostique, não interprete em voz alta, não prescreva.',
      '- PROIBIDO: TCC, CBT, sintoma, transtorno, diagnóstico, marcas temporais (hoje, ontem).',
    ].join('\n'),
    es: [
      'POSTURA CLÍNICA:',
      '- Su papel es facilitar relatos del día a día que ayudarán al psicólogo en la sesión.',
      '- Haga preguntas abiertas para orientar al paciente en medio del relato — invite a contar situaciones, sentimientos y detalles concretos.',
      '- Use el contexto del psicólogo (texto + documentos) para decidir qué explorar; traduzca todo a lenguaje simple.',
      '- Profundice lo que el paciente acaba de decir antes de cambiar de tema; a veces basta acoger o reflexionar brevemente.',
      '- No diagnostique, no interprete en voz alta, no prescriba.',
      '- PROHIBIDO: TCC, CBT, síntoma, trastorno, diagnóstico, marcas temporales (hoy, ayer).',
    ].join('\n'),
    en: [
      'CLINICAL STANCE:',
      '- Your role is to facilitate day-to-day reports that will help the psychologist in session.',
      '- Ask open questions to guide the patient through their report — invite them to share situations, feelings, and concrete details.',
      '- Use the psychologist context (text + documents) to decide what to explore; translate everything into simple language.',
      '- Deepen what the patient just said before changing topic; sometimes brief acknowledgment or reflection is enough.',
      '- Do not diagnose, interpret aloud, or prescribe.',
      '- FORBIDDEN: CBT, symptom, disorder, diagnosis, time anchors (today, yesterday).',
    ].join('\n'),
  };

  return blocks[language] ?? blocks.pt;
};

export const buildPatientChatCoreGuidance = (
  language: AppLanguage
): string =>
  [
    buildPatientChatPurposeGuidance(language),
    buildPsychologistStanceGuidance(language),
    buildPatientChatBrevityGuidance(language),
    buildPatientChatSimplicityGuidance(language),
  ].join('\n\n');

export const buildPresentMomentGuidance = (language: AppLanguage): string => {
  const blocks: Record<AppLanguage, string> = {
    pt: [
      'FOCO NO RELATO DO DIA A DIA:',
      '- Ajude o paciente a relatar situações vividas, com as palavras dele.',
      '- Suas perguntas devem direcionar o relato — não repetir o que já foi dito.',
      '- Pense: o que ajudaria o psicólogo a entender melhor essa experiência na sessão?',
    ].join('\n'),
    es: [
      'ENFOQUE EN EL RELATO DEL DÍA A DÍA:',
      '- Ayude al paciente a relatar situaciones vividas, con sus palabras.',
      '- Sus preguntas deben orientar el relato — no repetir lo ya dicho.',
      '- Piense: ¿qué ayudaría al psicólogo a entender mejor esta experiencia en la sesión?',
    ].join('\n'),
    en: [
      'DAY-TO-DAY REPORT FOCUS:',
      '- Help the patient report lived situations, in their own words.',
      '- Your questions should guide the report — do not repeat what was already said.',
      '- Ask yourself: what would help the psychologist understand this experience better in session?',
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
    const contextual: Record<AppLanguage, string[]> = {
      pt: [
        `Parece difícil lidar com ${snippet}.`,
        `O que mais pesa para você quando pensa em ${snippet}?`,
      ],
      es: [
        `Parece difícil lidiar con ${snippet}.`,
        `¿Qué pesa más para usted cuando piensa en ${snippet}?`,
      ],
      en: [
        `It sounds hard to deal with ${snippet}.`,
        `What weighs on you most when you think about ${snippet}?`,
      ],
    };
    const options = contextual[language] ?? contextual.pt;
    return options[Math.floor(Math.random() * options.length)]!;
  }

  const options = FALLBACK_REPLIES[language] ?? FALLBACK_REPLIES.pt;
  return options[Math.floor(Math.random() * options.length)]!;
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

const agentReplyHasQuestion = (text: string): boolean => text.trim().endsWith('?');

/** Agent turns that ended with a question (legacy closing messages are excluded). */
export const countAgentQuestionsInChat = (
  chatHistory: ClinicalChatMessage[]
): number =>
  chatHistory.filter(
    (message) =>
      message.sender === 'agent' &&
      !isPatientChatClosingMessage(message.text) &&
      agentReplyHasQuestion(message.text)
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

type ExplorationDimension = {
  id: string;
  keywords: string[];
};

const EXPLORATION_DIMENSIONS: Record<AppLanguage, ExplorationDimension[]> = {
  pt: [
    { id: 'body', keywords: ['corpo', 'peito', 'garganta', 'respir', 'tens', 'fisic'] },
    { id: 'thought', keywords: ['pens', 'mente', 'imag', 'ideia', 'cabec'] },
    { id: 'person', keywords: ['pessoa', 'relac', 'coleg', 'famil', 'parceir', 'amig'] },
    { id: 'emotion', keywords: ['sent', 'emoc', 'trist', 'ansied', 'medo', 'raiv'] },
    { id: 'meaning', keywords: ['signif', 'represent', 'import', 'sentido'] },
    { id: 'coping', keywords: ['fez', 'evit', 'reag', 'lidar', 'enfrent'] },
    { id: 'need', keywords: ['precis', 'falt', 'apoio', 'queria'] },
    { id: 'routine', keywords: ['sono', 'rotina', 'trabalh', 'dia a dia'] },
  ],
  es: [
    { id: 'body', keywords: ['cuerpo', 'pecho', 'garganta', 'respir', 'tens', 'fisic'] },
    { id: 'thought', keywords: ['pens', 'mente', 'imag', 'idea', 'cabeza'] },
    { id: 'person', keywords: ['persona', 'relac', 'coleg', 'famil', 'pareja', 'amig'] },
    { id: 'emotion', keywords: ['sent', 'emoc', 'trist', 'ansied', 'miedo', 'enfad'] },
    { id: 'meaning', keywords: ['signif', 'represent', 'import', 'sentido'] },
    { id: 'coping', keywords: ['hizo', 'evit', 'reacc', 'afront', 'lidar'] },
    { id: 'need', keywords: ['necesit', 'falt', 'apoyo', 'queria'] },
    { id: 'routine', keywords: ['sueño', 'rutina', 'trabaj', 'día a día'] },
  ],
  en: [
    { id: 'body', keywords: ['body', 'chest', 'throat', 'breath', 'tens', 'physic'] },
    { id: 'thought', keywords: ['think', 'mind', 'imag', 'idea', 'head'] },
    { id: 'person', keywords: ['person', 'relat', 'colleag', 'famil', 'partner', 'friend'] },
    { id: 'emotion', keywords: ['feel', 'emotion', 'sad', 'anxi', 'fear', 'angry'] },
    { id: 'meaning', keywords: ['mean', 'represent', 'matter', 'sense'] },
    { id: 'coping', keywords: ['did', 'avoid', 'react', 'cope', 'handle'] },
    { id: 'need', keywords: ['need', 'miss', 'support', 'wanted'] },
    { id: 'routine', keywords: ['sleep', 'routine', 'work', 'daily'] },
  ],
};

const DIMENSION_LABELS: Record<
  AppLanguage,
  Record<string, string>
> = {
  pt: {
    body: 'sensações corporais',
    thought: 'pensamentos ou imagens',
    person: 'pessoas ou relações envolvidas',
    emotion: 'emoções (com as palavras do paciente)',
    meaning: 'significado pessoal do que aconteceu',
    coping: 'o que fez ou evitou fazer',
    need: 'necessidades ou apoio',
    routine: 'impacto na rotina',
  },
  es: {
    body: 'sensaciones corporales',
    thought: 'pensamientos o imágenes',
    person: 'personas o vínculos involucrados',
    emotion: 'emociones (con las palabras del paciente)',
    meaning: 'significado personal de lo ocurrido',
    coping: 'qué hizo o evitó hacer',
    need: 'necesidades o apoyo',
    routine: 'impacto en la rutina',
  },
  en: {
    body: 'body sensations',
    thought: 'thoughts or images',
    person: 'people or relationships involved',
    emotion: 'emotions (in the patient\'s words)',
    meaning: 'personal meaning of what happened',
    coping: 'what they did or avoided doing',
    need: 'needs or support',
    routine: 'impact on daily routine',
  },
};

const normalizeForKeywordMatch = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

const detectExploredDimensionIds = (
  language: AppLanguage,
  priorReplies: string[]
): Set<string> => {
  const combined = normalizeForKeywordMatch(priorReplies.join(' '));
  const dimensions = EXPLORATION_DIMENSIONS[language] ?? EXPLORATION_DIMENSIONS.pt;
  const explored = new Set<string>();

  for (const dimension of dimensions) {
    if (
      dimension.keywords.some((keyword) => combined.includes(keyword))
    ) {
      explored.add(dimension.id);
    }
  }

  return explored;
};

/** Soft exploration hints from prior turns — no fixed rotation by question number. */
export const buildQuestionAngleGuidance = (
  language: AppLanguage,
  userMessage: string,
  priorAgentReplies: string[] = [],
  options?: {
    hasTextContext?: boolean;
    hasKnowledgeContext?: boolean;
  }
): string => {
  const dimensions = EXPLORATION_DIMENSIONS[language] ?? EXPLORATION_DIMENSIONS.pt;
  const labels = DIMENSION_LABELS[language] ?? DIMENSION_LABELS.pt;
  const explored = detectExploredDimensionIds(language, priorAgentReplies);
  const userNormalized = normalizeForKeywordMatch(userMessage);

  const mentionedInMessage = dimensions
    .filter((dimension) =>
      dimension.keywords.some((keyword) => userNormalized.includes(keyword))
    )
    .map((dimension) => labels[dimension.id] ?? dimension.id);

  const notYetExplored = dimensions
    .filter((dimension) => !explored.has(dimension.id))
    .map((dimension) => labels[dimension.id] ?? dimension.id);

  const blocks: Record<AppLanguage, string[]> = {
    pt: [
      'DIRECIONAMENTO DO RELATO (sugestão — não é roteiro):',
      '- Suas perguntas ajudam o paciente a elaborar relatos úteis para a sessão com o psicólogo.',
      options?.hasTextContext || options?.hasKnowledgeContext
        ? '- Alinhe as perguntas ao contexto do psicólogo (texto e/ou documentos), traduzindo para linguagem do dia a dia.'
        : '- Baseie-se no relato atual do paciente para direcionar as perguntas.',
      '- Escolha o que fizer sentido para a mensagem atual; não siga ordem fixa.',
      mentionedInMessage.length
        ? `- O paciente mencionou: ${mentionedInMessage.join(', ')} — pode aprofundar isso.`
        : '- Aprofunde um aspecto concreto do relato atual.',
      notYetExplored.length
        ? `- Ainda pouco explorado nesta interação (se relevante): ${notYetExplored.slice(0, 4).join(', ')}.`
        : '- Já explorou vários aspectos — pode refletir brevemente ou encerrar com acolhimento.',
      '- Se o paciente trouxe algo novo, priorize isso em vez de mudar de tema.',
    ],
    es: [
      'ORIENTACIÓN DEL RELATO (sugerencia — no es guion):',
      '- Sus preguntas ayudan al paciente a elaborar relatos útiles para la sesión con el psicólogo.',
      options?.hasTextContext || options?.hasKnowledgeContext
        ? '- Alinee las preguntas al contexto del psicólogo (texto y/o documentos), traduciendo a lenguaje cotidiano.'
        : '- Base en el relato actual del paciente para orientar las preguntas.',
      '- Elija lo que tenga sentido para el mensaje actual; no siga un orden fijo.',
      mentionedInMessage.length
        ? `- El paciente mencionó: ${mentionedInMessage.join(', ')} — puede profundizar eso.`
        : '- Profundice un aspecto concreto del relato actual.',
      notYetExplored.length
        ? `- Aún poco explorado en esta interacción (si aplica): ${notYetExplored.slice(0, 4).join(', ')}.`
        : '- Ya exploró varios aspectos — puede reflexionar brevemente o cerrar con contención.',
      '- Si el paciente trajo algo nuevo, priorícelo antes de cambiar de tema.',
    ],
    en: [
      'REPORT GUIDANCE (suggestion — not a script):',
      '- Your questions help the patient elaborate reports useful for the session with the psychologist.',
      options?.hasTextContext || options?.hasKnowledgeContext
        ? '- Align questions with the psychologist context (text and/or documents), translated into everyday language.'
        : '- Base questions on the patient\'s current report.',
      '- Choose what fits the current message; do not follow a fixed order.',
      mentionedInMessage.length
        ? `- The patient mentioned: ${mentionedInMessage.join(', ')} — you may deepen that.`
        : '- Deepen one concrete aspect of the current report.',
      notYetExplored.length
        ? `- Still lightly explored in this interaction (if relevant): ${notYetExplored.slice(0, 4).join(', ')}.`
        : '- Several aspects already explored — brief reflection or warm closing is fine.',
      '- If the patient brought something new, prioritize that before changing topic.',
    ],
  };

  return (blocks[language] ?? blocks.pt).join('\n');
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
      'Gere uma resposta NOVA — pode ser reflexão breve ou pergunta com ângulo diferente.',
      'PROIBIDO reformular a mesma pergunta com poucas palavras trocadas.',
    ].join('\n'),
    es: [
      `REINTENTO ${attempt} — La respuesta "${rejectedReply}" fue RECHAZADA por ser similar a preguntas anteriores.`,
      'Preguntas anteriores en esta interacción:',
      listedQuestions,
      'Genere una respuesta NUEVA — puede ser reflexión breve o pregunta con ángulo diferente.',
      'PROHIBIDO reformular la misma pregunta con pocas palabras cambiadas.',
    ].join('\n'),
    en: [
      `RETRY ${attempt} — The reply "${rejectedReply}" was REJECTED for being similar to prior questions.`,
      'Prior questions in this interaction:',
      listedQuestions,
      'Generate a NEW reply — brief reflection or a question from a different angle.',
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
          ? `Parece que ${topic} tem sido difícil de lidar.`
          : 'Parece que isso tem sido difícil de lidar.',
      (topic) =>
        topic
          ? `Faz sentido você se sentir assim por causa de ${topic}.`
          : 'Faz sentido você se sentir assim.',
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
          ? `Parece que ${topic} ha sido difícil de lidiar.`
          : 'Parece que esto ha sido difícil de lidiar.',
      (topic) =>
        topic
          ? `Tiene sentido que se sienta así por ${topic}.`
          : 'Tiene sentido que se sienta así.',
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
          ? `It sounds like ${topic} has been hard to deal with.`
          : 'It sounds like this has been hard to deal with.',
      (topic) =>
        topic
          ? `It makes sense that you would feel this way about ${topic}.`
          : 'It makes sense that you would feel this way.',
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
      '- Se o paciente já respondeu um ponto, avance ou responda só com acolhimento/reflexão breve.',
    ].join('\n'),
    es: [
      'ANTI-REPETICIÓN (obligatorio):',
      'Preguntas que ya hiciste en esta interacción:',
      listedQuestions,
      '- PROHIBIDO repetir o reformular con poco cambio cualquier pregunta anterior.',
      '- PROHIBIDO hacer preguntas muy similares (mismo tema, mismo momento, misma persona, misma sensación).',
      '- Si el paciente ya respondió un punto, avance o responda solo con contención/reflexión breve.',
    ].join('\n'),
    en: [
      'ANTI-REPETITION (required):',
      'Questions you already asked in this interaction:',
      listedQuestions,
      '- FORBIDDEN to repeat or lightly rephrase any question above.',
      '- FORBIDDEN to ask very similar questions (same theme, moment, person, or sensation).',
      '- If the patient already answered a point, move on or reply with brief acknowledgment/reflection only.',
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
      '- Cada interação ajuda o paciente a construir relatos do dia a dia para a sessão com o psicólogo.',
      `- Perguntas já feitas nesta interação: ${questionCount} de ${maxQuestionsPerInteraction}.`,
      questionsRemaining > 0
        ? `- Restam ${questionsRemaining} pergunta(s) nesta interação — use com parcimônia.`
        : '- Limite atingido: encerre com acolhimento breve, SEM nova pergunta.',
      '- Cada resposta: até 3 frases — reflexão, acolhimento ou pergunta (varie).',
      '- Nem todo turno precisa de pergunta; ~1 em cada 3–4 respostas pode ser só acolhimento.',
      '- Quando perguntar: uma pergunta aberta ligada ao que o paciente acabou de dizer.',
      questionCount === 0
        ? 'Primeira resposta: acolha e convide a elaborar — pergunta opcional se couber naturalmente.'
        : questionsRemaining === 1
          ? 'Última pergunta permitida nesta interação — faça uma pergunta essencial ou encerre só com acolhimento.'
          : questionCount <= 2
            ? 'Aprofunde o relato atual ou responda com reflexão breve sem pergunta.'
            : 'Várias trocas já: reflexão, pergunta que una pontos em aberto, ou encerramento acolhedor.',
    ],
    es: [
      `RITMO DE LA CONVERSACIÓN (máximo ${maxQuestionsPerInteraction} preguntas por interacción):`,
      '- Cada interacción ayuda al paciente a construir relatos del día a día para la sesión con el psicólogo.',
      `- Preguntas ya hechas en esta interacción: ${questionCount} de ${maxQuestionsPerInteraction}.`,
      questionsRemaining > 0
        ? `- Quedan ${questionsRemaining} pregunta(s) en esta interacción — úselas con moderación.`
        : '- Límite alcanzado: cierre con contención breve, SIN nueva pregunta.',
      '- Cada respuesta: hasta 3 frases — reflexión, acogida o pregunta (varíe).',
      '- No todo turno necesita pregunta; ~1 de cada 3–4 respuestas puede ser solo contención.',
      '- Cuando pregunte: una pregunta abierta ligada a lo que el paciente acaba de decir.',
      questionCount === 0
        ? 'Primera respuesta: acoja e invite a elaborar — pregunta opcional si encaja naturalmente.'
        : questionsRemaining === 1
          ? 'Última pregunta permitida en esta interacción — haga una pregunta esencial o cierre solo con contención.'
          : questionCount <= 2
            ? 'Profundice el relato actual o responda con reflexión breve sin pregunta.'
            : 'Varios intercambios ya: reflexión, pregunta que una puntos abiertos o cierre acogedor.',
    ],
    en: [
      `CONVERSATION PACING (max ${maxQuestionsPerInteraction} questions per interaction):`,
      '- Each interaction helps the patient build day-to-day reports for the session with the psychologist.',
      `- Questions already asked in this interaction: ${questionCount} of ${maxQuestionsPerInteraction}.`,
      questionsRemaining > 0
        ? `- ${questionsRemaining} question(s) left in this interaction — use them sparingly.`
        : '- Limit reached: close warmly in one short sentence, with NO new question.',
      '- Each reply: up to 3 sentences — reflection, acknowledgment, or question (vary).',
      '- Not every turn needs a question; ~1 in every 3–4 replies can be acknowledgment only.',
      '- When asking: one open question tied to what the patient just said.',
      questionCount === 0
        ? 'First reply: acknowledge and invite elaboration — question optional if it feels natural.'
        : questionsRemaining === 1
          ? 'Last question allowed in this interaction — ask one essential question or close with acknowledgment only.'
          : questionCount <= 2
            ? 'Deepen the current report or reply with brief reflection and no question.'
            : 'Several exchanges already: reflection, a question tying open points, or warm closing.',
    ],
  };

  return (blocks[language] ?? blocks.pt).join('\n');
};
