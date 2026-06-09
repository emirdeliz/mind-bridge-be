import type { ClinicalChatMessage, DashboardSnapshot } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import { normalizeAppLanguage } from './psychologist-copilot-system.js';

type SessionInsightsContext = {
  dashboardSnapshot: DashboardSnapshot;
  sessionConsiderations: string;
  sessionContext: string;
  chatHistory: ClinicalChatMessage[];
};

const formatChatHistory = (history: ClinicalChatMessage[]): string => {
  if (!history.length) {
    return '';
  }

  return history
    .slice(-8)
    .map((entry) => {
      const role = entry.sender === 'user' ? 'Psicólogo' : 'Agente';
      return `- ${role}: ${entry.text}`;
    })
    .join('\n');
};

const snapshotMetrics = (snapshot: DashboardSnapshot): string => {
  const moodData = snapshot.moodTrendSeries[0]?.data ?? [];
  const moodValues = moodData.filter((value) => value > 0);
  const moodAverage = moodValues.length
    ? (moodValues.reduce((sum, value) => sum + value, 0) / moodValues.length).toFixed(1)
    : null;
  const weeklyTotal = (snapshot.weeklyInteractionSeries[0]?.data ?? []).reduce(
    (sum, value) => sum + value,
    0
  );

  return JSON.stringify(
    {
      moodAverage,
      moodDiaryAdherencePercent: snapshot.moodDiaryAdherencePercent,
      weeklyInteractions: weeklyTotal,
      clinicalThemes: snapshot.clinicalThemeCategories,
    },
    null,
    2
  );
};

export const buildPsychologistSessionInsightsSystemPrompt = (
  languageInput: unknown,
  context: SessionInsightsContext
): string => {
  const language = normalizeAppLanguage(languageInput);
  const considerations = context.sessionConsiderations.trim();
  const chatBlock = formatChatHistory(context.chatHistory);

  const blocks: Record<AppLanguage, string[]> = {
    pt: [
      'Você gera o resumo da sessão em andamento e insights clínicos para o psicólogo.',
      'Use PRINCIPALMENTE as considerações da sessão e o chat psicólogo ↔ agente.',
      'Métricas do paciente são complementares (humor, adesão, interações).',
      'Responda APENAS com JSON válido, sem markdown nem texto extra.',
      'Schema obrigatório:',
      '{"psychologistSummary":"string","sessionInsights":[{"title":"string","body":"string"}]}',
      '- psychologistSummary: 2–4 frases objetivas sobre a sessão em andamento.',
      '- sessionInsights: exatamente 4 itens com títulos:',
      '  1) Indicadores-chave',
      '  2) Padrões detectados',
      '  3) Alertas para supervisão',
      '  4) Ações recomendadas',
      'Sem diagnóstico definitivo. Linguagem clínica e acionável.',
      `Considerações da sessão:\n${considerations || '(vazio)'}`,
      `Contexto clínico:\n${context.sessionContext.trim() || '(vazio)'}`,
      `Métricas do paciente:\n${snapshotMetrics(context.dashboardSnapshot)}`,
      ...(chatBlock ? [`Chat psicólogo ↔ agente:\n${chatBlock}`] : []),
    ],
    es: [
      'Generas el resumen de la sesión en curso e insights clínicos para el psicólogo.',
      'Usa PRINCIPALMENTE las consideraciones de la sesión y el chat psicólogo ↔ agente.',
      'Las métricas del paciente son complementarias.',
      'Responde SOLO con JSON válido, sin markdown ni texto adicional.',
      'Esquema obligatorio:',
      '{"psychologistSummary":"string","sessionInsights":[{"title":"string","body":"string"}]}',
      '- psychologistSummary: 2–4 frases objetivas sobre la sesión en curso.',
      '- sessionInsights: exactamente 4 ítems con títulos:',
      '  1) Indicadores clave',
      '  2) Patrones detectados',
      '  3) Alertas de supervisión',
      '  4) Acciones recomendadas',
      'Sin diagnóstico definitivo.',
      `Consideraciones de la sesión:\n${considerations || '(vacío)'}`,
      `Contexto clínico:\n${context.sessionContext.trim() || '(vacío)'}`,
      `Métricas del paciente:\n${snapshotMetrics(context.dashboardSnapshot)}`,
      ...(chatBlock ? [`Chat psicólogo ↔ agente:\n${chatBlock}`] : []),
    ],
    en: [
      'You generate the in-progress session summary and clinical insights for the psychologist.',
      'Use PRIMARILY session considerations and psychologist ↔ agent chat.',
      'Patient metrics are supplementary.',
      'Reply ONLY with valid JSON, no markdown or extra text.',
      'Required schema:',
      '{"psychologistSummary":"string","sessionInsights":[{"title":"string","body":"string"}]}',
      '- psychologistSummary: 2–4 objective sentences about the ongoing session.',
      '- sessionInsights: exactly 4 items titled:',
      '  1) Key indicators',
      '  2) Detected patterns',
      '  3) Supervision alerts',
      '  4) Recommended actions',
      'No definitive diagnosis.',
      `Session considerations:\n${considerations || '(empty)'}`,
      `Clinical context:\n${context.sessionContext.trim() || '(empty)'}`,
      `Patient metrics:\n${snapshotMetrics(context.dashboardSnapshot)}`,
      ...(chatBlock ? [`Psychologist ↔ agent chat:\n${chatBlock}`] : []),
    ],
  };

  return blocks[language].join('\n\n');
};

export const buildPsychologistSessionInsightsHumanPrompt = (
  languageInput: unknown
): string => {
  const language = normalizeAppLanguage(languageInput);

  const blocks: Record<AppLanguage, string> = {
    pt: 'Atualize o resumo e os insights da sessão em andamento com base nos dados fornecidos. Retorne somente JSON.',
    es: 'Actualiza el resumen y los insights de la sesión en curso según los datos proporcionados. Devuelve solo JSON.',
    en: 'Update the in-progress session summary and insights from the provided data. Return JSON only.',
  };

  return blocks[language];
};
