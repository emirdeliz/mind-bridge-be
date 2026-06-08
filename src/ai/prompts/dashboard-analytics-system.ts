import type { ClinicalChatMessage, DashboardSnapshot } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import { normalizeAppLanguage } from './psychologist-copilot-system.js';

type DashboardAnalyticsContext = {
  currentSnapshot: DashboardSnapshot;
  sessionConsiderations: string;
  sessionContext: string;
  chatHistory: ClinicalChatMessage[];
};

const formatChatHistory = (history: ClinicalChatMessage[]): string => {
  if (!history.length) {
    return '(sem mensagens)';
  }

  return history
    .slice(-12)
    .map((entry) => {
      const role = entry.sender === 'user' ? 'Psicólogo' : 'Agente';
      return `- ${role}: ${entry.text}`;
    })
    .join('\n');
};

const snapshotSummary = (snapshot: DashboardSnapshot): string =>
  JSON.stringify(
    {
      moodDiaryAdherencePercent: snapshot.moodDiaryAdherencePercent,
      moodTrendCategories: snapshot.moodTrendCategories,
      moodTrendData: snapshot.moodTrendSeries[0]?.data ?? [],
      clinicalThemeCategories: snapshot.clinicalThemeCategories,
      clinicalThemeData: snapshot.clinicalThemeSeries[0]?.data ?? [],
    },
    null,
    2
  );

export const buildDashboardAnalyticsSystemPrompt = (
  languageInput: unknown,
  context: DashboardAnalyticsContext
): string => {
  const language = normalizeAppLanguage(languageInput);

  const blocks: Record<AppLanguage, string[]> = {
    pt: [
      'Você é um agente clínico que atualiza indicadores do painel do psicólogo após o encerramento de uma sessão.',
      'Analise considerações da sessão, contexto clínico e histórico de chat com o copiloto.',
      'Responda APENAS com um objeto JSON válido, sem markdown, sem texto extra.',
      'Schema obrigatório:',
      '{"moodDiaryAdherencePercent":number,"moodTrendData":number[],"clinicalThemeData":number[]}',
      '- moodDiaryAdherencePercent: inteiro de 0 a 100 (adesão estimada ao diário de humor).',
      '- moodTrendData: mesma quantidade de pontos que o histórico atual; cada valor entre 1 e 10 (evolução do humor).',
      '- clinicalThemeData: mesma quantidade de temas que o histórico atual; inteiros >= 0 (menções por tema).',
      'Mantenha coerência clínica: incremente temas realmente discutidos; ajuste humor conforme evolução relatada.',
      `Painel atual:\n${snapshotSummary(context.currentSnapshot)}`,
      `Considerações da sessão encerrada:\n${context.sessionConsiderations || '(vazio)'}`,
      `Contexto clínico:\n${context.sessionContext || '(vazio)'}`,
      `Chat psicólogo ↔ agente:\n${formatChatHistory(context.chatHistory)}`,
    ],
    es: [
      'Eres un agente clínico que actualiza indicadores del panel del psicólogo al finalizar una sesión.',
      'Analiza consideraciones de la sesión, contexto clínico e historial de chat con el copiloto.',
      'Responde SOLO con un objeto JSON válido, sin markdown ni texto adicional.',
      'Esquema obligatorio:',
      '{"moodDiaryAdherencePercent":number,"moodTrendData":number[],"clinicalThemeData":number[]}',
      '- moodDiaryAdherencePercent: entero de 0 a 100 (adherencia estimada al diario de humor).',
      '- moodTrendData: misma cantidad de puntos que el historial actual; cada valor entre 1 y 10.',
      '- clinicalThemeData: misma cantidad de temas que el historial actual; enteros >= 0.',
      'Mantén coherencia clínica según lo discutido en la sesión.',
      `Panel actual:\n${snapshotSummary(context.currentSnapshot)}`,
      `Consideraciones de la sesión:\n${context.sessionConsiderations || '(vacío)'}`,
      `Contexto clínico:\n${context.sessionContext || '(vacío)'}`,
      `Chat psicólogo ↔ agente:\n${formatChatHistory(context.chatHistory)}`,
    ],
    en: [
      'You are a clinical agent updating psychologist dashboard metrics after a session ends.',
      'Analyze session notes, clinical context, and psychologist–copilot chat history.',
      'Reply ONLY with valid JSON, no markdown, no extra text.',
      'Required schema:',
      '{"moodDiaryAdherencePercent":number,"moodTrendData":number[],"clinicalThemeData":number[]}',
      '- moodDiaryAdherencePercent: integer 0–100 (estimated mood diary adherence).',
      '- moodTrendData: same length as current trend; each value 1–10 (mood evolution).',
      '- clinicalThemeData: same length as current themes; integers >= 0 (mentions per theme).',
      'Keep clinical coherence with what was discussed in the session.',
      `Current dashboard:\n${snapshotSummary(context.currentSnapshot)}`,
      `Session considerations:\n${context.sessionConsiderations || '(empty)'}`,
      `Clinical context:\n${context.sessionContext || '(empty)'}`,
      `Psychologist ↔ agent chat:\n${formatChatHistory(context.chatHistory)}`,
    ],
  };

  return blocks[language].join('\n\n');
};
