import { runPsychologistSessionInsightsGraph } from '@ai/graphs/psychologist-session-insights.graph.js';
import { parsePsychologistSessionInsightsResponse } from '@ai/prompts/psychologist-session-insights-response.js';
import type { Env } from '@config/env.js';

import { applyAgenticPatternsInsight } from './apply-agentic-patterns-insight.js';
import { applyAgenticRecommendedActionsInsight } from './apply-agentic-recommended-actions-insight.js';
import { generateDetectedPatternsInsight } from './generate-detected-patterns-insight.js';
import { generateRecommendedActionsInsight } from './generate-recommended-actions-insight.js';
import {
  buildHeuristicPatientInteractionSummary,
  generatePatientInteractionSummary,
} from './generate-patient-interaction-summary.js';
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
  patientChatHistory: ClinicalChatMessage[];
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
  const latestPatientReport = latestChatLine(input.patientChatHistory, 'user');
  const patientUserCount = input.patientChatHistory.filter(
    (entry) => entry.sender === 'user'
  ).length;

  if (
    !considerations &&
    !latestAgentReply &&
    !latestPsychologistMessage &&
    !latestPatientReport
  ) {
    return null;
  }

  const moodAverage = averageMoodScore(input.dashboardSnapshot);
  const weeklyInteractions = weeklyInteractionTotal(input.dashboardSnapshot);
  const adherence = input.dashboardSnapshot.moodDiaryAdherencePercent;
  const titles = INSIGHT_TITLES[language] ?? INSIGHT_TITLES.pt;

  const interactionsSummary = buildHeuristicPatientInteractionSummary(
    input.patientChatHistory,
    language
  );

  const summaryParts: string[] = [];
  if (interactionsSummary) {
    summaryParts.push(interactionsSummary);
  } else if (considerations) {
    summaryParts.push(considerations);
  } else if (latestPsychologistMessage) {
    summaryParts.push(latestPsychologistMessage);
  }

  const psychologistSummary = summaryParts.join('\n');

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
  if (patientUserCount > 0) {
    indicators.push(
      `${patientUserCount} mensagem(ns) do paciente com o agente de IA`
    );
  }

  const patterns: string[] = [];
  if (latestPatientReport) {
    patterns.push(
      'Análise agêntica pendente — relatos do paciente disponíveis em múltiplas conversas.'
    );
  } else if (considerations) {
    patterns.push(`Considerações registradas: ${considerations.slice(0, 180)}`);
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
  if (latestPatientReport) {
    actions.push(
      'Análise agêntica pendente — ações serão sugeridas com base nas conversas da última semana.'
    );
  } else if (considerations) {
    actions.push('Revisar e validar as considerações da sessão com o paciente.');
  } else {
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
  const language = input.language ?? 'pt';
  const [interactionsSummary, agenticPatterns, agenticActions] = await Promise.all([
    generatePatientInteractionSummary(
      env,
      input.patientChatHistory,
      language,
      input.sessionContext
    ),
    generateDetectedPatternsInsight(
      env,
      input.patientChatHistory,
      language,
      input.sessionContext
    ),
    generateRecommendedActionsInsight(
      env,
      input.patientChatHistory,
      language,
      input.sessionContext,
      input.sessionConsiderations
    ),
  ]);


  const heuristic = buildHeuristicPsychologistSessionInsights(input);
  if (!heuristic) {
    return null;
  }

  const withAgenticInsights = (result: PsychologistSessionInsightsResult) => {
    let sessionInsights = applyAgenticPatternsInsight(
      result.sessionInsights,
      agenticPatterns,
      language
    );
    sessionInsights = applyAgenticRecommendedActionsInsight(
      sessionInsights,
      agenticActions,
      language
    );

    return {
      psychologistSummary: interactionsSummary ?? result.psychologistSummary,
      sessionInsights,
    };
  };

  try {
    const raw = await runPsychologistSessionInsightsGraph(env, input);
    const parsed = parsePsychologistSessionInsightsResponse(raw);
    if (parsed) {
      return withAgenticInsights(parsed);
    }
  } catch {
    // fallback below
  }

  return withAgenticInsights(heuristic);
};
