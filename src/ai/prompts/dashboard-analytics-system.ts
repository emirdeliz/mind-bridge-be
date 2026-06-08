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
    return '';
  }

  return history
    .slice(-5)
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

const hasConsiderations = (text: string): boolean => text.trim().length > 0;

export const buildDashboardAnalyticsSystemPrompt = (
  languageInput: unknown,
  context: DashboardAnalyticsContext
): string => {
  const language = normalizeAppLanguage(languageInput);
  const considerations = context.sessionConsiderations.trim();
  const chatBlock = formatChatHistory(context.chatHistory);

  const blocks: Record<AppLanguage, string[]> = {
    pt: [
      'Você é um agente clínico que atualiza indicadores do painel do psicólogo após o encerramento de uma sessão.',
      'FONTE PRINCIPAL (obrigatória): o texto em "Considerações da sessão encerrada".',
      'Baseie adesão ao diário, humor e temas clínicos PRINCIPALMENTE nessas considerações.',
      'Use contexto clínico e chat apenas como complemento quando as considerações forem insuficientes.',
      'Responda APENAS com um objeto JSON válido, sem markdown, sem texto extra.',
      'Schema obrigatório:',
      '{"moodDiaryAdherencePercent":number,"moodTrendLastValue":number,"clinicalThemeIncrements":number[]}',
      '- moodDiaryAdherencePercent: inteiro 0–100 estimado a partir das considerações.',
      '- moodTrendLastValue: número 1–10 para o ÚLTIMO ponto da evolução do humor (período mais recente).',
      '- clinicalThemeIncrements: array com mesma quantidade de temas do painel; quantos pontos SOMAR em cada tema mencionado nas considerações (0 se não mencionado).',
      `Considerações da sessão encerrada (FONTE PRINCIPAL):\n${considerations || '(vazio — use contexto e chat com cautela)'}`,
      `Painel atual (referência numérica):\n${snapshotSummary(context.currentSnapshot)}`,
      `Contexto clínico (complementar):\n${context.sessionContext.trim() || '(vazio)'}`,
      ...(chatBlock && !hasConsiderations(considerations)
        ? [`Chat psicólogo ↔ agente (complementar):\n${chatBlock}`]
        : chatBlock
          ? [`Chat psicólogo ↔ agente (apenas complemento):\n${chatBlock}`]
          : []),
      hasConsiderations(considerations)
        ? 'Lembrete: as considerações da sessão são a fonte principal — não ignore esse texto.'
        : 'Lembrete: sem considerações; infira com cautela a partir do contexto e do chat.',
    ],
    es: [
      'Eres un agente clínico que actualiza indicadores del panel del psicólogo al finalizar una sesión.',
      'FUENTE PRINCIPAL (obligatoria): el texto en "Consideraciones de la sesión".',
      'Basa adherencia, humor y temas clínicos PRINCIPALMENTE en esas consideraciones.',
      'Usa contexto clínico y chat solo como complemento.',
      'Responde SOLO con JSON válido, sin markdown ni texto adicional.',
      'Esquema obligatorio:',
      '{"moodDiaryAdherencePercent":number,"moodTrendLastValue":number,"clinicalThemeIncrements":number[]}',
      '- moodDiaryAdherencePercent: entero 0–100 según las consideraciones.',
      '- moodTrendLastValue: número 1–10 para el ÚLTIMO punto de evolución del humor.',
      '- clinicalThemeIncrements: array con la misma cantidad de temas; puntos a SUMAR por tema mencionado (0 si no aplica).',
      `Consideraciones de la sesión (FUENTE PRINCIPAL):\n${considerations || '(vacío)'}`,
      `Panel actual:\n${snapshotSummary(context.currentSnapshot)}`,
      `Contexto clínico (complementario):\n${context.sessionContext.trim() || '(vacío)'}`,
      ...(chatBlock ? [`Chat psicólogo ↔ agente (complemento):\n${chatBlock}`] : []),
    ],
    en: [
      'You are a clinical agent updating psychologist dashboard metrics after a session ends.',
      'PRIMARY SOURCE (required): the text in "Session considerations".',
      'Base diary adherence, mood, and clinical themes PRIMARILY on those considerations.',
      'Use clinical context and chat only as supplementary input.',
      'Reply ONLY with valid JSON, no markdown, no extra text.',
      'Required schema:',
      '{"moodDiaryAdherencePercent":number,"moodTrendLastValue":number,"clinicalThemeIncrements":number[]}',
      '- moodDiaryAdherencePercent: integer 0–100 from session considerations.',
      '- moodTrendLastValue: number 1–10 for the LATEST mood trend point only.',
      '- clinicalThemeIncrements: array matching theme count; points to ADD per theme mentioned (0 if not mentioned).',
      `Session considerations (PRIMARY SOURCE):\n${considerations || '(empty)'}`,
      `Current dashboard:\n${snapshotSummary(context.currentSnapshot)}`,
      `Clinical context (supplementary):\n${context.sessionContext.trim() || '(empty)'}`,
      ...(chatBlock ? [`Psychologist ↔ agent chat (supplementary):\n${chatBlock}`] : []),
    ],
  };

  return blocks[language].join('\n\n');
};

export const buildDashboardAnalyticsHumanPrompt = (
  languageInput: unknown,
  sessionConsiderations: string
): string => {
  const language = normalizeAppLanguage(languageInput);
  const considerations = sessionConsiderations.trim();

  const blocks: Record<AppLanguage, string> = {
    pt: considerations
      ? `Com base PRINCIPALMENTE nas considerações abaixo, atualize os indicadores do painel e retorne somente JSON.\n\nConsiderações da sessão:\n${considerations}`
      : 'Atualize os indicadores do painel com base no contexto disponível e retorne somente JSON.',
    es: considerations
      ? `Con base PRINCIPALMENTE en las consideraciones siguientes, actualiza los indicadores y devuelve solo JSON.\n\nConsideraciones:\n${considerations}`
      : 'Actualiza los indicadores del panel según el contexto disponible y devuelve solo JSON.',
    en: considerations
      ? `Based PRIMARILY on the considerations below, update dashboard metrics and return JSON only.\n\nSession considerations:\n${considerations}`
      : 'Update dashboard metrics from available context and return JSON only.',
  };

  return blocks[language];
};
