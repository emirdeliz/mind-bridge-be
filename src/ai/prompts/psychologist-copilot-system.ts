import type { AppLanguage } from '@domain/types.js';

export const normalizeAppLanguage = (value: unknown): AppLanguage => {
  if (value === 'en' || value === 'es' || value === 'pt') {
    return value;
  }
  return 'pt';
};

type CopilotContext = {
  sessionConsiderations: string;
  clinicalContext: string;
  retrievalContext: string;
};

const buildRetrievalContext = (
  language: AppLanguage,
  patientId: string
): string => {
  const labels: Record<
    AppLanguage,
    { title: string; mood: string; diary: string }
  > = {
    pt: {
      title: 'Dados recuperados (mock):',
      mood: `Paciente ${patientId}: humor médio 4,2/10 nos últimos 7 dias.`,
      diary: 'Adesão ao diário abaixo da meta.',
    },
    es: {
      title: 'Datos recuperados (mock):',
      mood: `Paciente ${patientId}: humor medio 4,2/10 en los últimos 7 días.`,
      diary: 'Adherencia al diario por debajo de la meta.',
    },
    en: {
      title: 'Retrieved data (mock):',
      mood: `Patient ${patientId}: mood avg 4.2/10 last 7 days.`,
      diary: 'Diary adherence below target.',
    },
  };

  const copy = labels[language];
  return [copy.title, `- ${copy.mood}`, `- ${copy.diary}`].join('\n');
};

export const buildPsychologistCopilotRetrievalContext = (
  language: AppLanguage,
  patientId: string
): string => buildRetrievalContext(language, patientId);

export const buildPsychologistCopilotSystemPrompt = (
  languageInput: unknown,
  context: CopilotContext
): string => {
  const language = normalizeAppLanguage(languageInput);

  const sessionNotes =
    context.sessionConsiderations.trim() || notProvided(language);
  const psychologistContext =
    context.clinicalContext.trim() || notProvided(language);

  const blocks: Record<AppLanguage, string[]> = {
    pt: [
      'IDIOMA OBRIGATÓRIO: português do Brasil. Nunca responda em inglês.',
      'Você auxilia um psicólogo durante sessões ao vivo.',
      'Dê UMA única frase curta (máximo 20 palavras), direta e acionável — sem diagnóstico definitivo.',
      'Proibido: listas, tópicos, markdown, saudações e parágrafos.',
      `Considerações da sessão atual: ${sessionNotes}`,
      `Contexto clínico do psicólogo: ${psychologistContext}`,
      context.retrievalContext,
      'Lembrete final: responda somente em português do Brasil, em uma frase.',
    ],
    es: [
      'IDIOMA OBLIGATORIO: español. Nunca respondas en inglés.',
      'Asistes a un psicólogo durante sesiones en vivo.',
      'Da UNA sola frase corta (máximo 20 palabras), directa y accionable — sin diagnóstico definitivo.',
      'Prohibido: listas, viñetas, markdown, saludos y párrafos.',
      `Consideraciones de la sesión actual: ${sessionNotes}`,
      `Contexto clínico del psicólogo: ${psychologistContext}`,
      context.retrievalContext,
      'Recordatorio final: responde solo en español, en una frase.',
    ],
    en: [
      'REQUIRED LANGUAGE: English only.',
      'You assist a psychotherapist during live sessions.',
      'Give ONE short sentence (max 20 words), direct and actionable — no definitive diagnosis.',
      'No lists, bullets, markdown, greetings, or paragraphs.',
      `Current session considerations: ${sessionNotes}`,
      `Psychologist clinical context: ${psychologistContext}`,
      context.retrievalContext,
      'Final reminder: reply in English only, in one sentence.',
    ],
  };

  return blocks[language].join('\n\n');
};

const notProvided = (language: AppLanguage): string => {
  switch (language) {
    case 'es':
      return 'No informado.';
    case 'en':
      return 'Not provided.';
    default:
      return 'Não informado.';
  }
};
