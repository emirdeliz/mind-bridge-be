/** Clinical demo payloads keyed by patient email. */

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

const daysAgoDate = (daysAgo) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
};

const atLocalTimeIso = (date, hour, minute = 0) => {
  const value = new Date(date);
  value.setHours(hour, minute, 0, 0);
  return value.toISOString();
};

const formatSessionDate = (date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const sessionIdFromDate = (date) =>
  `session-${formatSessionDate(date).replace(/\//g, '-')}`;

const emptyAnamnesis = () => ({
  chiefComplaint: '',
  currentHistory: '',
  personalHistory: '',
  familyHistory: '',
  socialHistory: '',
  medicalPsychiatricHistory: '',
  lifeHabits: '',
  emotionalBehavioral: '',
  therapeuticGoals: '',
  psychologistNotes: '',
});

const buildCarlosClinicalPayload = () => {
  const sessionToday = daysAgoDate(0);
  const session7d = daysAgoDate(7);
  const session14d = daysAgoDate(14);
  const session21d = daysAgoDate(21);
  const chat1 = daysAgoDate(1);
  const chat2 = daysAgoDate(2);

  return {
    dashboardSnapshot: {
      moodTrendCategories: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
      moodTrendSeries: [
        {
          name: 'Humor médio',
          data: [6.1, 5.8, 5.2, 4.8, 4.5, 4.9],
          color: '#5eead4',
        },
      ],
      weeklyInteractionCategories: [
        'Seg',
        'Ter',
        'Qua',
        'Qui',
        'Sex',
        'Sáb',
        'Dom',
      ],
      weeklyInteractionSeries: [
        { name: 'Interações', data: [2, 2, 2, 2, 2, 1, 2], color: '#818cf8' },
      ],
      interactionChannels: [
        { name: 'Texto', value: 9, color: '#818cf8' },
        { name: 'Áudio', value: 2, color: '#5eead4' },
        { name: 'Notificação', value: 2, color: '#fbbf24' },
      ],
      moodDiaryAdherencePercent: 71,
      clinicalThemeCategories: [
        'Humor baixo',
        'Motivação',
        'Relacionamentos',
        'Autocrítica',
        'Rotina',
      ],
      clinicalThemeSeries: [
        { name: 'Menções', data: [11, 9, 7, 6, 5], color: '#a78bfa' },
      ],
      lastUpdatedAt: new Date().toISOString(),
    },
    sessionContext:
      'Paciente: Carlos Amaro, 38 anos. Abordagem TCC com foco em humor deprimido, autocrítica e reativação comportamental. Meta atual: retomar rotina de exercícios 3x/semana e reduzir isolamento social nos fins de semana. Plano de cuidado acordado com o psicólogo Emir Marques.',
    sessionNotes: [
      {
        id: sessionIdFromDate(sessionToday),
        label: `Sessão ${formatSessionDate(sessionToday)} (atual)`,
        sessionDate: formatSessionDate(sessionToday),
        content:
          'Próxima sessão: revisar escala de ativação comportamental. Explorar padrão de autocrítica após conversas com família. Validar adesão ao diário de humor e ao experimento de caminhada matinal.',
        isCurrent: true,
      },
      {
        id: sessionIdFromDate(session7d),
        label: `Sessão ${formatSessionDate(session7d)}`,
        sessionDate: formatSessionDate(session7d),
        agenticSummary:
          'Humor estável com leve melhora após retomada de caminhadas. Isolamento no fim de semana mantido. Autocrítica presente em relatos familiares. Sem alertas de risco.',
        content:
          'Paciente relatou duas caminhadas curtas na semana. Manteve isolamento no domingo. Trabalhada reestruturação de pensamentos sobre expectativas familiares.',
      },
      {
        id: sessionIdFromDate(session14d),
        label: `Sessão ${formatSessionDate(session14d)}`,
        sessionDate: formatSessionDate(session14d),
        agenticSummary:
          'Psicoeducação sobre ciclo humor–evitação. Paciente aceitou experimento de contato social semanal. Adesão ao diário em 5/7 dias.',
        content:
          'Mapeamento de atividades prazerosas. Definido experimento de um café com amigo por semana. Reforçado registro de humor à noite.',
      },
      {
        id: sessionIdFromDate(session21d),
        label: `Sessão ${formatSessionDate(session21d)}`,
        sessionDate: formatSessionDate(session21d),
        agenticSummary:
          'Avaliação inicial: humor rebaixado há 6 semanas, fadiga e perda de interesse. Metas de ativação comportamental definidas.',
        content:
          'Avaliação inicial. Metas de ativação comportamental e diário de humor combinadas com o paciente.',
      },
    ],
    sessionInsights: [
      {
        title: 'Indicadores-chave',
        body: 'Engajamento +15% · Humor médio 4,9/10 · 5/7 dias com interação · Adesão ao diário 71% · 2 reforços de ativação comportamental',
      },
      {
        title: 'Padrões detectados',
        body: 'Humor mais baixo à noite · Autocrítica após contato familiar · Menos interações no fim de semana · Melhora leve após atividade física',
      },
      {
        title: 'Alertas para supervisão',
        body: 'Risco emocional baixo a moderado — sem linguagem de risco nas últimas 72h · Isolamento recorrente aos domingos · Monitorar persistência do humor rebaixado',
      },
      {
        title: 'Ações recomendadas',
        body: 'Revisar escala de ativação na abertura · Reforçar plano de caminhada 3x/semana · Explorar crenças sobre merecimento social · Checar segurança se humor ≤ 3/10 por 3 dias',
      },
    ],
    psychologistSummary:
      'Resumo agêntico (7 dias): 13 interações, humor médio 4,9/10, fadiga e autocrítica recorrentes com leve melhora após exercício. Risco baixo a moderado sem alertas de segurança. Adesão ao diário em 71%. Prioridades: ativação comportamental, contato social planejado e manejo da autocrítica.',
    psychologistChatSeed: [
      {
        id: 'carlos-psy-1',
        sender: 'user',
        text: 'Consolidar interações do paciente Carlos Amaro nos últimos 7 dias.',
        createdAt: atLocalTimeIso(sessionToday, 10, 0),
      },
      {
        id: 'carlos-psy-2',
        sender: 'agent',
        text: 'Insight 1 — Engajamento: 13 interações na semana (+15%). Canais: texto (69%), áudio (15%), notificação (15%). Picos: manhã e noite.',
        createdAt: atLocalTimeIso(sessionToday, 10, 1),
      },
      {
        id: 'carlos-psy-3',
        sender: 'agent',
        text: 'Insight 2 — Humor: média 4,9/10 (↑ 0,4). Termos recorrentes: “cansado”, “sem vontade”, “me culpei”. Melhora relatada após caminhada.',
        createdAt: atLocalTimeIso(sessionToday, 10, 2),
      },
      {
        id: 'carlos-psy-4',
        sender: 'user',
        text: 'Há sinais de risco nas mensagens recentes?',
        createdAt: atLocalTimeIso(sessionToday, 10, 5),
      },
      {
        id: 'carlos-psy-5',
        sender: 'agent',
        text: 'Insight 3 — Risco: sem menções a autolesão ou ideação suicida. Risco emocional baixo a moderado. Recomenda-se checagem de segurança se humor ≤ 3/10 por 3 dias seguidos.',
        createdAt: atLocalTimeIso(sessionToday, 10, 6),
      },
    ],
    patientChatSeed: [
      {
        id: 'carlos-patient-1',
        sender: 'user',
        text: 'Acordei sem energia de novo e quase não saí do quarto.',
        createdAt: atLocalTimeIso(chat1, 8, 30),
      },
      {
        id: 'carlos-patient-2',
        sender: 'agent',
        text: 'Obrigado por compartilhar. O que você acha que mais dificultou levantar hoje — cansaço, falta de vontade ou algo que aconteceu ontem?',
        createdAt: atLocalTimeIso(chat1, 8, 31),
      },
      {
        id: 'carlos-patient-3',
        sender: 'user',
        text: 'Acho que foi a conversa com minha mãe. Fiquei me culpando depois.',
        createdAt: atLocalTimeIso(chat1, 8, 33),
      },
      {
        id: 'carlos-patient-4',
        sender: 'agent',
        text: 'Vamos anotar isso no seu plano. Que tal uma caminhada curta de 10 minutos hoje e registrar como você se sente depois?',
        createdAt: atLocalTimeIso(chat1, 8, 34),
      },
      {
        id: 'carlos-patient-5',
        sender: 'user',
        text: 'Consegui caminhar ontem e me senti um pouco melhor.',
        createdAt: atLocalTimeIso(chat2, 19, 15),
      },
      {
        id: 'carlos-patient-6',
        sender: 'agent',
        text: 'Que bom registrar essa melhora. O que foi diferente na caminhada em relação aos dias em que você ficou em casa?',
        createdAt: atLocalTimeIso(chat2, 19, 16),
      },
    ],
    patientSummary:
      'Últimos 7 dias: 6 mensagens trocadas. Temas principais: humor baixo, autocrítica após contato familiar e reativação com caminhada. Agente reforçou registro de humor e atividade física leve. Risco emocional: baixo a moderado.',
    likertCheckIn: {
      scores: { mood: 5, anxiety: 4, sleep: 5, wellbeing: 4 },
      updatedAt: atLocalTimeIso(chat1, 8, 0),
      checkInDate: chat1.toISOString().slice(0, 10),
    },
    anamnesis: {
      ...emptyAnamnesis(),
      chiefComplaint: 'Humor rebaixado, fadiga e autocrítica há cerca de 6 semanas.',
      currentHistory:
        'Relata isolamento aos fins de semana e redução de atividades prazerosas. Melhora leve após caminhadas curtas.',
      therapeuticGoals:
        'Retomar exercícios 3x/semana, reduzir isolamento social e manejar autocrítica após contato familiar.',
      psychologistNotes:
        'Plano TCC com ativação comportamental. Monitorar humor ≤ 3/10 por 3 dias consecutivos.',
    },
  };
};

const buildAnaClinicalPayload = () => {
  const sessionToday = daysAgoDate(0);
  const session7d = daysAgoDate(7);
  const session14d = daysAgoDate(14);
  const session21d = daysAgoDate(21);
  const chat1 = daysAgoDate(0);
  const chat2 = daysAgoDate(1);

  return {
    dashboardSnapshot: {
      moodTrendCategories: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
      moodTrendSeries: [
        {
          name: 'Humor médio',
          data: [5.4, 5.1, 4.7, 4.3, 3.9, 4.2],
          color: '#5eead4',
        },
      ],
      weeklyInteractionCategories: [
        'Seg',
        'Ter',
        'Qua',
        'Qui',
        'Sex',
        'Sáb',
        'Dom',
      ],
      weeklyInteractionSeries: [
        { name: 'Interações', data: [2, 1, 0, 1, 1, 0, 1], color: '#818cf8' },
      ],
      interactionChannels: [
        { name: 'Texto', value: 4, color: '#818cf8' },
        { name: 'Áudio', value: 1, color: '#5eead4' },
        { name: 'Notificação', value: 1, color: '#fbbf24' },
      ],
      moodDiaryAdherencePercent: 29,
      clinicalThemeCategories: [
        'Ansiedade',
        'Sono',
        'Trabalho',
        'Somatização',
        'Humor',
      ],
      clinicalThemeSeries: [
        { name: 'Menções', data: [12, 9, 8, 6, 5], color: '#a78bfa' },
      ],
      lastUpdatedAt: new Date().toISOString(),
    },
    sessionContext:
      'Paciente: Ana Mendes, 32 anos. Abordagem TCC com foco em ansiedade antecipatória e higiene do sono. Meta atual: reduzir evitação em contextos laborais e aumentar adesão ao diário de humor (meta ≥ 5 registros/semana). Plano de cuidado acordado com o psicólogo Aluizio Vilar.',
    sessionNotes: [
      {
        id: sessionIdFromDate(sessionToday),
        label: `Sessão ${formatSessionDate(sessionToday)} (atual)`,
        sessionDate: formatSessionDate(sessionToday),
        content:
          'Próxima sessão: revisar experimento comportamental da semana. Validar uso da respiração 4-7-8. Explorar crença central sobre desempenho profissional. Considerar escala GAD-7 na abertura.',
        isCurrent: true,
      },
      {
        id: sessionIdFromDate(session7d),
        label: `Sessão ${formatSessionDate(session7d)}`,
        sessionDate: formatSessionDate(session7d),
        agenticSummary:
          'Leve melhora do sono com rotina sem telas às 22h; exposição gradual no trabalho mantida. Adesão ao diário ainda abaixo da meta (3x/semana). Sem alertas de risco.',
        content:
          'Paciente relatou melhora leve no sono após rotina de desligar telas às 22h. Revisado registro de pensamentos; mantida exposição gradual no ambiente de trabalho.',
      },
      {
        id: sessionIdFromDate(session14d),
        label: `Sessão ${formatSessionDate(session14d)}`,
        sessionDate: formatSessionDate(session14d),
        agenticSummary:
          'Mapeamento inicial de gatilhos em reuniões; psicoeducação sobre ciclo ansiedade–evitação. Paciente aderiu ao experimento de check-in emocional pré-apresentações.',
        content:
          'Primeira elaboração de gatilhos de ansiedade em reuniões. Psicoeducação sobre ciclo ansiedade–evitação.',
      },
      {
        id: sessionIdFromDate(session21d),
        label: `Sessão ${formatSessionDate(session21d)}`,
        sessionDate: formatSessionDate(session21d),
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
      'Resumo agêntico (7 dias): 6 interações, humor médio 4,2/10, sono fragmentado e ansiedade situacional ligada ao trabalho. Risco moderado sem alertas de segurança imediatos. Adesão ao diário abaixo da meta (29%). Prioridades: reforçar regulação pré-evento, revisar experimento TCC e aplicar GAD-7 na sessão.',
    psychologistChatSeed: [
      {
        id: 'ana-psy-1',
        sender: 'user',
        text: 'Consolidar interações da paciente Ana Mendes nos últimos 7 dias e destacar padrões clínicos.',
        createdAt: atLocalTimeIso(sessionToday, 13, 50),
      },
      {
        id: 'ana-psy-2',
        sender: 'agent',
        text: 'Insight 1 — Engajamento: 6 interações na semana (+20%). Horários de pico: 08h–10h e 21h–23h. Canal predominante: texto (67%).',
        createdAt: atLocalTimeIso(sessionToday, 13, 51),
      },
      {
        id: 'ana-psy-3',
        sender: 'agent',
        text: 'Insight 2 — Humor e sintomas: média 4,2/10 (↓ 0,8). Termos recorrentes: “aperto no peito”, “não dormi”, “reunião”.',
        createdAt: atLocalTimeIso(sessionToday, 13, 52),
      },
      {
        id: 'ana-psy-4',
        sender: 'user',
        text: 'Há indicadores de risco nas mensagens recentes?',
        createdAt: atLocalTimeIso(sessionToday, 13, 55),
      },
      {
        id: 'ana-psy-5',
        sender: 'agent',
        text: 'Insight 3 — Risco: nenhuma menção explícita a autolesão. Risco emocional moderado (ansiedade + sono). Recomenda-se checagem de segurança na próxima sessão.',
        createdAt: atLocalTimeIso(sessionToday, 13, 56),
      },
    ],
    patientChatSeed: [
      {
        id: 'ana-patient-1',
        sender: 'user',
        text: 'Hoje acordei muito ansiosa pensando na reunião da tarde.',
        createdAt: atLocalTimeIso(chat1, 9, 15),
      },
      {
        id: 'ana-patient-2',
        sender: 'agent',
        text: 'Obrigado por compartilhar. Antes da reunião, você percebeu algum sinal no corpo — taquicardia, tensão nos ombros ou pensamentos acelerados?',
        createdAt: atLocalTimeIso(chat1, 9, 16),
      },
      {
        id: 'ana-patient-3',
        sender: 'user',
        text: 'Senti o peito apertado e não consegui dormir direito ontem.',
        createdAt: atLocalTimeIso(chat1, 9, 17),
      },
      {
        id: 'ana-patient-4',
        sender: 'agent',
        text: 'Vamos registrar isso no seu plano de cuidado. Que tal uma pausa de 2 minutos de respiração antes da reunião e anotar como você se sente depois?',
        createdAt: atLocalTimeIso(chat1, 9, 18),
      },
      {
        id: 'ana-patient-5',
        sender: 'user',
        text: 'A respiração ajudou um pouco, mas ainda fiquei tensa na reunião.',
        createdAt: atLocalTimeIso(chat2, 21, 10),
      },
      {
        id: 'ana-patient-6',
        sender: 'agent',
        text: 'Bom que experimentou a técnica. O que mais te deixou tensa durante a reunião — o conteúdo, a avaliação dos colegas ou outra expectativa?',
        createdAt: atLocalTimeIso(chat2, 21, 11),
      },
    ],
    patientSummary:
      'Últimas 48h: mensagens sobre ansiedade antecipatória no trabalho, sintomas corporais (aperto no peito) e sono prejudicado. Agente sugeriu respiração guiada e registro pós-reunião. Risco emocional: moderado.',
    likertCheckIn: {
      scores: { mood: 4, anxiety: 7, sleep: 3, wellbeing: 4 },
      updatedAt: atLocalTimeIso(chat1, 9, 0),
      checkInDate: chat1.toISOString().slice(0, 10),
    },
    anamnesis: {
      ...emptyAnamnesis(),
      chiefComplaint:
        'Ansiedade antecipatória em contextos laborais, com sintomas somáticos e sono fragmentado.',
      currentHistory:
        'Piora em semanas de apresentações e reuniões. Experimentos de exposição gradual e higiene do sono em andamento.',
      therapeuticGoals:
        'Reduzir evitação no trabalho, melhorar higiene do sono e elevar adesão ao diário de humor para ≥ 5 registros/semana.',
      psychologistNotes:
        'Abrir próxima sessão com GAD-7. Renegociar meta do diário para 3x/semana com lembrete às 20h se adesão continuar baixa.',
    },
  };
};

/** Interações da semana corrente (weekday 0=Seg … 6=Dom). */
export const INTERACTION_SPECS_BY_EMAIL = {
  'carlosamaro@gmail.com': [
    { weekday: 0, hourUTC: 9, channel: 'text' },
    { weekday: 0, hourUTC: 21, channel: 'text' },
    { weekday: 1, hourUTC: 8, channel: 'text' },
    { weekday: 1, hourUTC: 20, channel: 'audio' },
    { weekday: 2, hourUTC: 10, channel: 'text' },
    { weekday: 2, hourUTC: 22, channel: 'notification' },
    { weekday: 3, hourUTC: 9, channel: 'text' },
    { weekday: 3, hourUTC: 19, channel: 'text' },
    { weekday: 4, hourUTC: 11, channel: 'text' },
    { weekday: 4, hourUTC: 21, channel: 'audio' },
    { weekday: 5, hourUTC: 10, channel: 'text' },
    { weekday: 6, hourUTC: 18, channel: 'text' },
    { weekday: 6, hourUTC: 20, channel: 'notification' },
  ],
  'ana.mendes@gmail.com': [
    { weekday: 0, hourUTC: 9, channel: 'text' },
    { weekday: 0, hourUTC: 21, channel: 'text' },
    { weekday: 1, hourUTC: 8, channel: 'audio' },
    { weekday: 3, hourUTC: 22, channel: 'text' },
    { weekday: 4, hourUTC: 9, channel: 'text' },
    { weekday: 6, hourUTC: 20, channel: 'notification' },
  ],
};

export const resolvePatientClinicalPayload = (email) => {
  if (email === 'carlosamaro@gmail.com') {
    return buildCarlosClinicalPayload();
  }
  if (email === 'ana.mendes@gmail.com') {
    return buildAnaClinicalPayload();
  }
  return {
    dashboardSnapshot: emptyDashboard(),
    sessionContext: null,
    sessionNotes: [],
    sessionInsights: [],
    psychologistSummary: null,
    psychologistChatSeed: [],
    patientChatSeed: [],
    patientSummary: null,
    likertCheckIn: null,
    anamnesis: emptyAnamnesis(),
  };
};
