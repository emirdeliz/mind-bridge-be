/** Demo clinical content keyed by patient email (ClinicalContentSeedPayload shape). */

const emptyDashboard = () => ({
  moodTrendCategories: [],
  moodTrendSeries: [],
  weeklyInteractionCategories: [],
  weeklyInteractionSeries: [],
  interactionChannels: [],
  moodDiaryAdherencePercent: 0,
  clinicalThemeCategories: [],
  clinicalThemeSeries: [],
  lastUpdatedAt: new Date().toISOString(),
});

const minimalPayload = () => ({
  dashboardSnapshot: emptyDashboard(),
  sessionContext: null,
  sessionNotes: [],
  sessionInsights: [],
  psychologistSummary: null,
  psychologistChatSeed: [],
  patientChatSeed: [],
  patientSummary: null,
});

const anaDashboardSnapshot = {
  moodTrendCategories: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
  moodTrendSeries: [
    { name: 'Humor médio', data: [5.4, 5.1, 4.7, 4.3, 3.9, 4.2], color: '#5eead4' },
  ],
  weeklyInteractionCategories: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
  weeklyInteractionSeries: [
    { name: 'Interações', data: [2, 1, 0, 1, 1, 0, 1], color: '#818cf8' },
  ],
  interactionChannels: [
    { name: 'Texto', value: 4, color: '#818cf8' },
    { name: 'Áudio', value: 1, color: '#5eead4' },
    { name: 'Notificação', value: 1, color: '#fbbf24' },
  ],
  moodDiaryAdherencePercent: 29,
  clinicalThemeCategories: ['Ansiedade', 'Sono', 'Trabalho', 'Somatização', 'Humor'],
  clinicalThemeSeries: [
    { name: 'Menções', data: [12, 9, 8, 6, 5], color: '#a78bfa' },
  ],
  lastUpdatedAt: '2026-06-02T14:00:00.000Z',
};

export const DEMO_CLINICAL_BY_EMAIL = {
  'ana.demo@mindbridge.local': {
    dashboardSnapshot: anaDashboardSnapshot,
    sessionContext:
      'Paciente: Ana M., 32 anos. Abordagem TCC com foco em ansiedade antecipatória e higiene do sono. Meta atual: reduzir evitação em contextos laborais e aumentar adesão ao diário de humor (meta ≥ 5 registros/semana).',
    sessionNotes: [
      {
        id: 'session-2026-06-03',
        label: 'Sessão 03/06/2026 (atual)',
        sessionDate: '03/06/2026',
        content:
          'Próxima sessão: revisar experimento comportamental da semana 3. Validar uso da respiração 4-7-8. Explorar crença central sobre desempenho profissional. Considerar escala de ansiedade (GAD-7) na abertura.',
        isCurrent: true,
      },
      {
        id: 'session-2026-05-27',
        label: 'Sessão 27/05/2026',
        sessionDate: '27/05/2026',
        agenticSummary:
          'Leve melhora do sono com rotina sem telas às 22h; exposição gradual no trabalho mantida. Adesão ao diário ainda abaixo da meta (3x/semana). Sem alertas de risco.',
        content:
          'Paciente relatou melhora leve no sono após rotina de desligar telas às 22h. Revisado registro de pensamentos; mantida exposição gradual no ambiente de trabalho. Combinado envio de diário de humor 3x na semana.',
      },
      {
        id: 'session-2026-05-20',
        label: 'Sessão 20/05/2026',
        sessionDate: '20/05/2026',
        agenticSummary:
          'Mapeamento inicial de gatilhos em reuniões; psicoeducação sobre ciclo ansiedade–evitação. Paciente aderiu ao experimento de check-in emocional pré-apresentações. Sem indicadores de risco na sessão.',
        content:
          'Primeira elaboração de gatilhos de ansiedade em reuniões. Psicoeducação sobre ciclo ansiedade–evitação. Paciente aceitou experimento de check-in emocional antes de apresentações. Sem indicadores de risco na sessão.',
      },
      {
        id: 'session-2026-05-13',
        label: 'Sessão 13/05/2026',
        sessionDate: '13/05/2026',
        agenticSummary:
          'Reforço de registro de pensamentos; paciente relatou dois episódios de insônia. Mantida meta de diário 3x/semana. Sem alteração de risco.',
        content:
          'Revisão do registro de pensamentos da semana. Dois episódios de insônia relatados. Reforçada meta do diário de humor.',
      },
      {
        id: 'session-2026-05-06',
        label: 'Sessão 06/05/2026',
        sessionDate: '06/05/2026',
        agenticSummary:
          'Psicoeducação sobre higiene do sono; combinado experimento de desligar telas. Humor estável (média 5/10 na semana).',
        content:
          'Psicoeducação sobre higiene do sono. Experimento de rotina noturna sem telas introduzido.',
      },
      {
        id: 'session-2026-04-29',
        label: 'Sessão 29/04/2026',
        sessionDate: '29/04/2026',
        agenticSummary:
          'Avaliação inicial de ansiedade antecipatória no trabalho; definidas metas de TCC e diário de humor.',
        content:
          'Avaliação inicial. Metas de TCC e diário de humor definidas com a paciente.',
      },
    ],
    sessionInsights: [
      {
        title: 'Indicadores-chave',
        body: 'Engajamento +20% · Humor médio 4,2/10 · Sono prejudicado em 4/7 noites · Adesão ao diário 29% · 3 reforços de respiração pelo agente',
      },
      {
        title: 'Padrões detectados',
        body: 'Pico de ansiedade 1–2h antes de reuniões · Sintomas somáticos (aperto no peito) co-ocorrem com relatos de insônia · Menos interações nos fins de semana',
      },
      {
        title: 'Alertas para supervisão',
        body: 'Risco emocional moderado — sem linguagem de risco imediato nas últimas 48h · Queda de humor vs. semana anterior · Meta terapêutica de diário não atingida',
      },
      {
        title: 'Ações recomendadas',
        body: 'Abrir sessão com GAD-7 · Validar protocolo de segurança · Ajustar meta do diário para 3x/semana com lembrete às 20h · Revisar exposição gradual no contexto laboral',
      },
    ],
    psychologistSummary:
      'Resumo agentico (7 dias): 6 interações, humor médio 4,2/10, sono fragmentado e ansiedade situacional ligada ao trabalho. Risco moderado sem alertas de segurança imediatos. Adesão ao diário abaixo da meta (29%). Prioridades: reforçar regulação pré-evento, revisar experimento TCC e aplicar GAD-7 na sessão.',
    psychologistChatSeed: [
      {
        id: 'mock-psy-1',
        sender: 'user',
        text: 'Consolidar interações da paciente Ana M. nos últimos 7 dias e destacar padrões clínicos.',
        createdAt: '2026-06-02T13:50:00.000Z',
      },
      {
        id: 'mock-psy-2',
        sender: 'agent',
        text: 'Insight 1 — Engajamento: 6 interações na semana (+20% vs. semana anterior). Horários de pico: 08h–10h e 21h–23h. Canal predominante: texto (67%).',
        createdAt: '2026-06-02T13:51:00.000Z',
      },
      {
        id: 'mock-psy-3',
        sender: 'agent',
        text: 'Insight 2 — Humor e sintomas: média de humor 4,2/10 (↓ 0,8). Termos recorrentes: “aperto no peito”, “não dormi”, “reunião”. Correlação sugerida entre eventos laborais e queixas somáticas.',
        createdAt: '2026-06-02T13:52:00.000Z',
      },
      {
        id: 'mock-psy-4',
        sender: 'user',
        text: 'Há indicadores de risco ou sinais de descompensação nas mensagens recentes?',
        createdAt: '2026-06-02T13:55:00.000Z',
      },
      {
        id: 'mock-psy-5',
        sender: 'agent',
        text: 'Insight 3 — Risco: nenhuma menção explícita a autolesão ou ideação suicida nas últimas 48h. Risco emocional classificado como moderado (ansiedade + sono). Recomenda-se checagem direta de segurança na próxima sessão.',
        createdAt: '2026-06-02T13:56:00.000Z',
      },
      {
        id: 'mock-psy-6',
        sender: 'agent',
        text: 'Insight 4 — Adesão ao plano: diário de humor preenchido 2/7 dias. Técnica de respiração citada 1 vez pelo paciente; reforço pelo agente 3 vezes. Oportunidade: renegociar meta para 3 registros/semana com lembretes às 20h.',
        createdAt: '2026-06-02T13:57:00.000Z',
      },
      {
        id: 'mock-psy-7',
        sender: 'user',
        text: 'Sugerir foco para a próxima sessão de 50 minutos.',
        createdAt: '2026-06-02T14:00:00.000Z',
      },
      {
        id: 'mock-psy-8',
        sender: 'agent',
        text: 'Insight 5 — Pauta sugerida: (1) mapear gatilhos pré-reunião; (2) revisar experimento de exposição gradual; (3) monitorar sono com registro de despertares; (4) fechar com escala GAD-7 e plano de crise se ansiedade ≥ 8/10.',
        createdAt: '2026-06-02T14:01:00.000Z',
      },
      {
        id: 'mock-psy-9',
        sender: 'agent',
        text: 'Insight 6 — Prognóstico assistido por IA: tendência de estabilização se adesão ao diário subir para ≥ 50% nos próximos 10 dias. Caso contrário, escalar para contato de check-in em 72h.',
        createdAt: '2026-06-02T14:02:00.000Z',
      },
    ],
    patientChatSeed: [
      {
        id: 'mock-patient-1',
        sender: 'user',
        text: 'Hoje acordei muito ansioso pensando na reunião da tarde.',
        createdAt: '2026-06-02T09:15:00.000Z',
      },
      {
        id: 'mock-patient-2',
        sender: 'agent',
        text: 'Obrigado por compartilhar. Antes da reunião, você percebeu algum sinal no corpo — taquicardia, tensão nos ombros ou pensamentos acelerados?',
        createdAt: '2026-06-02T09:16:00.000Z',
      },
      {
        id: 'mock-patient-3',
        sender: 'user',
        text: 'Senti o peito apertado e não consegui dormir direito ontem.',
        createdAt: '2026-06-02T09:17:00.000Z',
      },
      {
        id: 'mock-patient-4',
        sender: 'agent',
        text: 'Vamos registrar isso no seu plano de cuidado. Que tal uma pausa de 2 minutos de respiração antes da reunião e anotar como você se sente depois?',
        createdAt: '2026-06-02T09:18:00.000Z',
      },
    ],
    patientSummary:
      'Últimas 48h: 4 mensagens trocadas. Temas principais: ansiedade antecipatória no trabalho, sintomas corporais (aperto no peito) e sono prejudicado. Agente sugeriu respiração guiada e registro pós-reunião. Risco emocional: moderado. Encaminhar reflexão para a próxima sessão com o psicólogo.',
  },
  'bruno.demo@mindbridge.local': minimalPayload(),
  'carla.demo@mindbridge.local': minimalPayload(),
  'diego.demo@mindbridge.local': minimalPayload(),
  'josecarlos@gmail.com': {
    ...minimalPayload(),
    sessionContext:
      'Paciente José Carlos. Meta: identificar gatilhos em interações do dia a dia.',
    sessionNotes: [
      {
        id: 'session-2026-06-08',
        label: 'Sessão 08/06/2026 (atual)',
        sessionDate: '08/06/2026',
        content: '',
        isCurrent: true,
      },
    ],
  },
};
