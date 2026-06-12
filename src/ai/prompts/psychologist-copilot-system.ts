import type {
  DashboardSnapshot,
  PatientClinicalContent,
  SessionInsight,
} from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';
import { formatLikertCheckInForContext } from '@application/format-likert-check-in-context.js';
import { formatPatientAnamnesisForContext } from '@application/format-patient-anamnesis-context.js';
import { truncateContextText } from '@application/truncate-context-text.js';

const MAX_SUMMARY_CONTEXT_CHARS = 800;

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

type RetrievalContent = Pick<
  PatientClinicalContent,
  | 'dashboardSnapshot'
  | 'psychologistSummary'
  | 'patientSummary'
  | 'sessionInsights'
  | 'likertCheckIn'
  | 'anamnesis'
>;

const averageMoodScore = (snapshot: DashboardSnapshot): number | null => {
  const values = (snapshot.moodTrendSeries[0]?.data ?? []).filter(
    (value) => typeof value === 'number' && value > 0
  );
  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const weeklyInteractionTotal = (snapshot: DashboardSnapshot): number =>
  (snapshot.weeklyInteractionSeries[0]?.data ?? []).reduce(
    (sum, value) => sum + value,
    0
  );

const topInteractionChannel = (
  snapshot: DashboardSnapshot
): string | null => {
  const channels = [...(snapshot.interactionChannels ?? [])].sort(
    (left, right) => right.value - left.value
  );
  const top = channels.find((entry) => entry.value > 0);
  return top ? `${top.name} (${top.value})` : null;
};

const formatInsights = (insights: SessionInsight[]): string[] =>
  insights.map((insight) => `- ${insight.title}: ${insight.body}`);

export const buildPsychologistCopilotRetrievalContext = (
  languageInput: unknown,
  content: RetrievalContent
): string => {
  const language = normalizeAppLanguage(languageInput);
  const snapshot = content.dashboardSnapshot;
  const moodAverage = averageMoodScore(snapshot);
  const weeklyInteractions = weeklyInteractionTotal(snapshot);
  const adherence = snapshot.moodDiaryAdherencePercent;
  const mainChannel = topInteractionChannel(snapshot);
  const psychologistSummary = content.psychologistSummary?.trim() ?? '';
  const patientSummary = content.patientSummary?.trim() ?? '';
  const insights = formatInsights(content.sessionInsights ?? []);
  const likertContext = formatLikertCheckInForContext(language, content.likertCheckIn);
  const anamnesisContext = formatPatientAnamnesisForContext(language, content.anamnesis);

  const labels: Record<
    AppLanguage,
    {
      title: string;
      mood: (value: string) => string;
      adherence: (value: number) => string;
      weekly: (value: number) => string;
      channel: (value: string) => string;
      psychologistSummary: string;
      patientSummary: string;
      insightsTitle: string;
      empty: string;
    }
  > = {
    pt: {
      title: 'Dados do paciente (registro clínico):',
      mood: (value) => `Humor médio recente: ${value}/10.`,
      adherence: (value) => `Adesão ao diário (últimos 7 dias): ${value}%.`,
      weekly: (value) => `Interações nesta semana: ${value}.`,
      channel: (value) => `Canal de interação mais usado: ${value}.`,
      psychologistSummary: 'Resumo da interação (psicólogo):',
      patientSummary: 'Resumo da interação (paciente):',
      insightsTitle: 'Insights da sessão:',
      empty: 'Sem métricas de humor ou engajamento registradas ainda.',
    },
    es: {
      title: 'Datos del paciente (registro clínico):',
      mood: (value) => `Humor medio reciente: ${value}/10.`,
      adherence: (value) => `Adherencia al diario (últimos 7 días): ${value}%.`,
      weekly: (value) => `Interacciones esta semana: ${value}.`,
      channel: (value) => `Canal de interacción más usado: ${value}.`,
      psychologistSummary: 'Resumen de la interacción (psicólogo):',
      patientSummary: 'Resumen de la interacción (paciente):',
      insightsTitle: 'Insights de la sesión:',
      empty: 'Aún no hay métricas de humor o compromiso registradas.',
    },
    en: {
      title: 'Patient data (clinical record):',
      mood: (value) => `Recent mood average: ${value}/10.`,
      adherence: (value) => `Diary adherence (last 7 days): ${value}%.`,
      weekly: (value) => `Interactions this week: ${value}.`,
      channel: (value) => `Most used interaction channel: ${value}.`,
      psychologistSummary: 'Interaction summary (psychologist):',
      patientSummary: 'Interaction summary (patient):',
      insightsTitle: 'Session insights:',
      empty: 'No mood or engagement metrics recorded yet.',
    },
  };

  const copy = labels[language];
  const lines: string[] = [copy.title];

  if (moodAverage !== null) {
    lines.push(`- ${copy.mood(moodAverage.toFixed(1))}`);
  }
  if (adherence > 0) {
    lines.push(`- ${copy.adherence(adherence)}`);
  }
  if (weeklyInteractions > 0) {
    lines.push(`- ${copy.weekly(weeklyInteractions)}`);
  }
  if (mainChannel) {
    lines.push(`- ${copy.channel(mainChannel)}`);
  }
  if (psychologistSummary) {
    lines.push(
      `${copy.psychologistSummary} ${truncateContextText(psychologistSummary, MAX_SUMMARY_CONTEXT_CHARS)}`
    );
  }
  if (patientSummary) {
    lines.push(
      `${copy.patientSummary} ${truncateContextText(patientSummary, MAX_SUMMARY_CONTEXT_CHARS)}`
    );
  }
  if (anamnesisContext) {
    lines.push(anamnesisContext);
  }
  if (likertContext) {
    lines.push(likertContext);
  }
  if (insights.length) {
    lines.push(copy.insightsTitle, ...insights);
  }

  if (lines.length === 1) {
    lines.push(`- ${copy.empty}`);
  }

  return lines.join('\n');
};

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
      'FORMATO DA RESPOSTA (escolha conforme o pedido do psicólogo):',
      '- Pedido geral ou orientação pontual: UMA única frase curta (máximo 20 palavras), direta e acionável.',
      '- Pedido quantitativo explícito (ex.: "formule 5 perguntas", "liste 3 hipóteses", "dê 4 sugestões"): entregue exatamente a quantidade pedida em lista numerada (1., 2., 3., ...), sem limite de caracteres por item.',
      'Em pedidos quantitativos, cada item deve ser curto, claro e acionável — sem diagnóstico definitivo.',
      'PROIBIDO em qualquer caso: raciocínio interno, análise, "Thinking Process" ou texto explicativo fora da resposta final.',
      'Proibido: markdown, saudações e parágrafos introdutórios.',
      `Considerações da sessão atual: ${sessionNotes}`,
      `Contexto clínico do psicólogo: ${psychologistContext}`,
      context.retrievalContext,
      'Lembrete final: responda somente em português do Brasil, no formato adequado ao pedido.',
    ],
    es: [
      'IDIOMA OBLIGATORIO: español. Nunca respondas en inglés.',
      'Asistes a un psicólogo durante sesiones en vivo.',
      'FORMATO DE RESPUESTA (elige según la solicitud del psicólogo):',
      '- Solicitud general u orientación puntual: UNA sola frase corta (máximo 20 palabras), directa y accionable.',
      '- Solicitud cuantitativa explícita (ej.: "formula 5 preguntas", "lista 3 hipótesis", "da 4 sugerencias"): entrega exactamente la cantidad pedida en lista numerada (1., 2., 3., ...), sin límite de caracteres por ítem.',
      'En solicitudes cuantitativas, cada ítem debe ser corto, claro y accionable — sin diagnóstico definitivo.',
      'PROHIBIDO en cualquier caso: razonamiento interno, análisis, "Thinking Process" o texto explicativo fuera de la respuesta final.',
      'Prohibido: markdown, saludos y párrafos introductorios.',
      `Consideraciones de la sesión actual: ${sessionNotes}`,
      `Contexto clínico del psicólogo: ${psychologistContext}`,
      context.retrievalContext,
      'Recordatorio final: responde solo en español, en el formato adecuado a la solicitud.',
    ],
    en: [
      'REQUIRED LANGUAGE: English only.',
      'You assist a psychotherapist during live sessions.',
      'RESPONSE FORMAT (choose based on the psychologist request):',
      '- General guidance or a single tip: ONE short sentence (max 20 words), direct and actionable.',
      '- Explicit quantitative request (e.g. "formulate 5 questions", "list 3 hypotheses", "give 4 suggestions"): deliver exactly the requested quantity as a numbered list (1., 2., 3., ...), with no character limit per item.',
      'For quantitative requests, each item must be short, clear, and actionable — no definitive diagnosis.',
      'FORBIDDEN in all cases: internal reasoning, analysis, "Thinking Process", or explanatory text outside the final answer.',
      'No markdown, greetings, or introductory paragraphs.',
      `Current session considerations: ${sessionNotes}`,
      `Psychologist clinical context: ${psychologistContext}`,
      context.retrievalContext,
      'Final reminder: reply in English only, in the format that matches the request.',
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
