import { runPsychologistSessionInsightsGraph } from '@ai/graphs/psychologist-session-insights.graph.js';
import { parsePsychologistSessionInsightsResponse } from '@ai/prompts/psychologist-session-insights-response.js';
import type { Env } from '@config/env.js';
import type {
  ClinicalChatMessage,
  DashboardSnapshot,
  SessionInsight,
} from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

export type GeneratePsychologistSessionInsightsInput = {
  dashboardSnapshot: DashboardSnapshot;
  sessionConsiderations: string;
  sessionContext: string;
  chatHistory: ClinicalChatMessage[];
  language?: AppLanguage;
};

export type PsychologistSessionInsightsResult = {
  psychologistSummary: string;
  sessionInsights: SessionInsight[];
};

const INSIGHT_TITLES: Record<AppLanguage, string[]> = {
  pt: [
    'Indicadores-chave',
    'Padrões detectados',
    'Alertas para supervisão',
    'Ações recomendadas',
  ],
  es: [
    'Indicadores clave',
    'Patrones detectados',
    'Alertas de supervisión',
    'Acciones recomendadas',
  ],
  en: [
    'Key indicators',
    'Detected patterns',
    'Supervision alerts',
    'Recommended actions',
  ],
};

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

const latestChatLine = (
  chatHistory: ClinicalChatMessage[],
  sender: 'user' | 'agent'
): string => {
  const messages = chatHistory.filter((entry) => entry.sender === sender);
  return messages.at(-1)?.text.trim() ?? '';
};

const buildHeuristicPsychologistSessionInsights = (
  input: GeneratePsychologistSessionInsightsInput
): PsychologistSessionInsightsResult | null => {
  const language = input.language ?? 'pt';
  const considerations = input.sessionConsiderations.trim();
  const latestAgentReply = latestChatLine(input.chatHistory, 'agent');
  const latestPsychologistMessage = latestChatLine(input.chatHistory, 'user');

  if (!considerations && !latestAgentReply && !latestPsychologistMessage) {
    return null;
  }

  const moodAverage = averageMoodScore(input.dashboardSnapshot);
  const weeklyInteractions = weeklyInteractionTotal(input.dashboardSnapshot);
  const adherence = input.dashboardSnapshot.moodDiaryAdherencePercent;
  const titles = INSIGHT_TITLES[language] ?? INSIGHT_TITLES.pt;

  const summaryParts: string[] = [];
  if (considerations) {
    summaryParts.push(considerations);
  } else if (latestPsychologistMessage) {
    summaryParts.push(latestPsychologistMessage);
  }
  if (latestAgentReply) {
    summaryParts.push(latestAgentReply);
  }

  const psychologistSummary = summaryParts.join(' ').slice(0, 500);

  const indicators: string[] = [];
  if (moodAverage !== null) {
    indicators.push(`Humor médio ${moodAverage.toFixed(1)}/10`);
  }
  if (weeklyInteractions > 0) {
    indicators.push(`${weeklyInteractions} interações nesta semana`);
  }
  if (adherence > 0) {
    indicators.push(`Adesão ao diário ${adherence}%`);
  }
  if (input.chatHistory.length > 0) {
    indicators.push(`${input.chatHistory.length} mensagens no chat da sessão`);
  }

  const patterns: string[] = [];
  if (considerations) {
    patterns.push(`Considerações registradas: ${considerations.slice(0, 180)}`);
  }
  if (latestPsychologistMessage) {
    patterns.push(`Último pedido do psicólogo: ${latestPsychologistMessage.slice(0, 160)}`);
  }

  const alerts: string[] = [];
  if (moodAverage !== null && moodAverage <= 4) {
    alerts.push('Humor recente abaixo de 5/10 — monitorar estado emocional.');
  }
  if (adherence > 0 && adherence < 50) {
    alerts.push('Adesão ao diário abaixo da meta.');
  }
  if (!alerts.length) {
    alerts.push('Sem alertas críticos com base nos dados atuais.');
  }

  const actions: string[] = [];
  if (latestAgentReply) {
    actions.push(latestAgentReply);
  }
  if (considerations) {
    actions.push('Revisar e validar as considerações da sessão com o paciente.');
  }
  if (!actions.length) {
    actions.push('Registrar considerações da sessão para consolidar o plano terapêutico.');
  }

  const sessionInsights: SessionInsight[] = [
    {
      title: titles[0],
      body: indicators.join(' · ') || 'Aguardando mais dados da sessão.',
    },
    {
      title: titles[1],
      body: patterns.join(' · ') || 'Padrões ainda em formação nesta sessão.',
    },
    {
      title: titles[2],
      body: alerts.join(' · '),
    },
    {
      title: titles[3],
      body: actions.join(' · '),
    },
  ];

  return { psychologistSummary, sessionInsights };
};

export const generatePsychologistSessionInsights = async (
  env: Env,
  input: GeneratePsychologistSessionInsightsInput
): Promise<PsychologistSessionInsightsResult | null> => {
  const heuristic = buildHeuristicPsychologistSessionInsights(input);
  if (!heuristic) {
    return null;
  }

  try {
    const raw = await runPsychologistSessionInsightsGraph(env, input);
    const parsed = parsePsychologistSessionInsightsResponse(raw);
    if (parsed) {
      return parsed;
    }
  } catch {
    // fallback below
  }

  return heuristic;
};
