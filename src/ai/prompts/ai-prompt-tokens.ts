import type { AiPromptTokenDefinition } from '@domain/ai-prompt-template.types.js';

/** Reserved words injected at runtime when templates use #token_name syntax. */
export const AI_PROMPT_TOKEN_DEFINITIONS: AiPromptTokenDefinition[] = [
  {
    key: 'psychologist_context',
    label: {
      pt: 'Contexto do psicólogo',
      en: 'Psychologist context',
      es: 'Contexto del psicólogo',
    },
    description: {
      pt: 'Texto de contexto clínico definido pelo psicólogo para o paciente ou sessão.',
      en: 'Clinical context text defined by the psychologist for the patient or session.',
      es: 'Texto de contexto clínico definido por el psicólogo para el paciente o la sesión.',
    },
    example: {
      pt: 'Paciente em acompanhamento por ansiedade social...',
      en: 'Patient in treatment for social anxiety...',
      es: 'Paciente en seguimiento por ansiedad social...',
    },
  },
  {
    key: 'chat_history',
    label: {
      pt: 'Histórico de conversas',
      en: 'Conversation history',
      es: 'Historial de conversación',
    },
    description: {
      pt: 'Mensagens recentes entre paciente e agente, formatadas para contexto.',
      en: 'Recent messages between patient and agent, formatted for context.',
      es: 'Mensajes recientes entre paciente y agente, formateados para contexto.',
    },
    example: {
      pt: 'Paciente: Ontem foi difícil no trabalho.\nAgente: O que aconteceu?',
      en: 'Patient: Yesterday was hard at work.\nAgent: What happened?',
      es: 'Paciente: Ayer fue difícil en el trabajo.\nAgente: ¿Qué pasó?',
    },
  },
  {
    key: 'user_message',
    label: {
      pt: 'Mensagem atual do paciente',
      en: 'Current patient message',
      es: 'Mensaje actual del paciente',
    },
    description: {
      pt: 'Última mensagem enviada pelo paciente nesta interação.',
      en: 'Latest message sent by the patient in this interaction.',
      es: 'Último mensaje enviado por el paciente en esta interacción.',
    },
    example: {
      pt: 'Hoje me senti muito ansioso antes da reunião.',
      en: 'Today I felt very anxious before the meeting.',
      es: 'Hoy me sentí muy ansioso antes de la reunión.',
    },
  },
  {
    key: 'question_count',
    label: {
      pt: 'Contagem de perguntas',
      en: 'Question count',
      es: 'Conteo de preguntas',
    },
    description: {
      pt: 'Número de perguntas já feitas pelo agente na interação atual.',
      en: 'Number of questions already asked by the agent in the current interaction.',
      es: 'Número de preguntas ya hechas por el agente en la interacción actual.',
    },
    example: { pt: '2', en: '2', es: '2' },
  },
  {
    key: 'max_questions',
    label: {
      pt: 'Limite de perguntas',
      en: 'Question limit',
      es: 'Límite de preguntas',
    },
    description: {
      pt: 'Máximo de perguntas permitidas por interação.',
      en: 'Maximum questions allowed per interaction.',
      es: 'Máximo de preguntas permitidas por interacción.',
    },
    example: { pt: '5', en: '5', es: '5' },
  },
  {
    key: 'retrieval_context',
    label: {
      pt: 'Trechos de documentos (RAG)',
      en: 'Document excerpts (RAG)',
      es: 'Fragmentos de documentos (RAG)',
    },
    description: {
      pt: 'Trechos recuperados de PDFs do psicólogo via busca semântica.',
      en: 'Excerpts retrieved from psychologist PDFs via semantic search.',
      es: 'Fragmentos recuperados de PDFs del psicólogo vía búsqueda semántica.',
    },
    example: {
      pt: '[Doc: protocolo.pdf] Técnicas de regulação emocional...',
      en: '[Doc: protocol.pdf] Emotional regulation techniques...',
      es: '[Doc: protocolo.pdf] Técnicas de regulación emocional...',
    },
  },
  {
    key: 'knowledge_section',
    label: {
      pt: 'Seção de conhecimento',
      en: 'Knowledge section',
      es: 'Sección de conocimiento',
    },
    description: {
      pt: 'Bloco completo com cabeçalho, trechos RAG e instruções de uso (vazio se não houver documentos).',
      en: 'Full block with header, RAG excerpts, and usage instructions (empty if no documents).',
      es: 'Bloque completo con encabezado, fragmentos RAG e instrucciones de uso (vacío si no hay documentos).',
    },
    example: {
      pt: 'Trechos de documentos PDF do psicólogo:\n...',
      en: 'Excerpts from psychologist PDF documents:\n...',
      es: 'Fragmentos de documentos PDF del psicólogo:\n...',
    },
  },
  {
    key: 'focus_block',
    label: {
      pt: 'Temas prioritários',
      en: 'Priority themes',
      es: 'Temas prioritarios',
    },
    description: {
      pt: 'Temas extraídos do contexto do psicólogo para orientar perguntas (vazio se não houver contexto).',
      en: 'Themes extracted from psychologist context to guide questions (empty if no context).',
      es: 'Temas extraídos del contexto del psicólogo para orientar preguntas (vacío si no hay contexto).',
    },
    example: {
      pt: 'Temas prioritários do psicólogo:\n- Ansiedade social\n- Evitação',
      en: 'Priority themes from the psychologist:\n- Social anxiety\n- Avoidance',
      es: 'Temas prioritarios del psicólogo:\n- Ansiedad social\n- Evitación',
    },
  },
  {
    key: 'core_guidance',
    label: {
      pt: 'Orientações centrais',
      en: 'Core guidance',
      es: 'Orientaciones centrales',
    },
    description: {
      pt: 'Regras centrais de conduta do agente de chat do paciente.',
      en: 'Core conduct rules for the patient chat agent.',
      es: 'Reglas centrales de conducta del agente de chat del paciente.',
    },
    example: {
      pt: 'Faça uma pergunta por vez. Não diagnostique...',
      en: 'Ask one question at a time. Do not diagnose...',
      es: 'Haz una pregunta a la vez. No diagnostiques...',
    },
  },
  {
    key: 'pacing_guidance',
    label: {
      pt: 'Orientação de ritmo',
      en: 'Pacing guidance',
      es: 'Orientación de ritmo',
    },
    description: {
      pt: 'Instruções sobre ritmo e limite de perguntas na interação.',
      en: 'Instructions on pacing and question limits in the interaction.',
      es: 'Instrucciones sobre ritmo y límite de preguntas en la interacción.',
    },
    example: {
      pt: 'Você já fez 2 perguntas. Restam 3 nesta interação.',
      en: 'You have asked 2 questions. 3 remain in this interaction.',
      es: 'Ya hiciste 2 preguntas. Quedan 3 en esta interacción.',
    },
  },
  {
    key: 'present_moment_guidance',
    label: {
      pt: 'Momento presente',
      en: 'Present moment',
      es: 'Momento presente',
    },
    description: {
      pt: 'Orientação para focar no relato recente do paciente.',
      en: 'Guidance to focus on the patient recent report.',
      es: 'Orientación para enfocarse en el relato reciente del paciente.',
    },
    example: {
      pt: 'Priorize o que o paciente acabou de relatar...',
      en: 'Prioritize what the patient just reported...',
      es: 'Prioriza lo que el paciente acaba de relatar...',
    },
  },
  {
    key: 'context_usage_guidance',
    label: {
      pt: 'Uso do contexto',
      en: 'Context usage',
      es: 'Uso del contexto',
    },
    description: {
      pt: 'Como usar contexto textual e documentos sem expor jargão ao paciente.',
      en: 'How to use text context and documents without exposing jargon to the patient.',
      es: 'Cómo usar contexto textual y documentos sin exponer jerga al paciente.',
    },
    example: {
      pt: 'Use o contexto internamente para formular perguntas simples...',
      en: 'Use context internally to formulate simple questions...',
      es: 'Use el contexto internamente para formular preguntas simples...',
    },
  },
  {
    key: 'text_context_label',
    label: {
      pt: 'Rótulo do contexto',
      en: 'Context label',
      es: 'Etiqueta del contexto',
    },
    description: {
      pt: 'Rótulo introdutório antes do texto de contexto do psicólogo.',
      en: 'Introductory label before psychologist context text.',
      es: 'Etiqueta introductoria antes del texto de contexto del psicólogo.',
    },
    example: {
      pt: 'Contexto de texto do psicólogo (campo da sessão):',
      en: 'Psychologist text context (session field):',
      es: 'Contexto de texto del psicólogo (campo de la sesión):',
    },
  },
  {
    key: 'forbidden_line',
    label: {
      pt: 'Restrições finais',
      en: 'Final restrictions',
      es: 'Restricciones finales',
    },
    description: {
      pt: 'Linha de proibições (raciocínio interno, listas, etc.).',
      en: 'Prohibition line (internal reasoning, lists, etc.).',
      es: 'Línea de prohibiciones (razonamiento interno, listas, etc.).',
    },
    example: {
      pt: 'PROIBIDO: raciocínio interno, análise...',
      en: 'FORBIDDEN: internal reasoning, analysis...',
      es: 'PROHIBIDO: razonamiento interno, análisis...',
    },
  },
  {
    key: 'retry_guidance',
    label: {
      pt: 'Orientação de retry',
      en: 'Retry guidance',
      es: 'Orientación de reintento',
    },
    description: {
      pt: 'Instruções quando uma resposta anterior foi rejeitada (vazio se não houver retry).',
      en: 'Instructions when a previous reply was rejected (empty if no retry).',
      es: 'Instrucciones cuando una respuesta anterior fue rechazada (vacío si no hay reintento).',
    },
    example: {
      pt: 'A resposta anterior foi rejeitada. Reformule sem repetir...',
      en: 'The previous reply was rejected. Rephrase without repeating...',
      es: 'La respuesta anterior fue rechazada. Reformule sin repetir...',
    },
  },
  {
    key: 'angle_guidance',
    label: {
      pt: 'Ângulo da pergunta',
      en: 'Question angle',
      es: 'Ángulo de la pregunta',
    },
    description: {
      pt: 'Sugestão de ângulo para a próxima pergunta com base no relato.',
      en: 'Suggested angle for the next question based on the report.',
      es: 'Sugerencia de ángulo para la próxima pregunta según el relato.',
    },
    example: {
      pt: 'Explore o contexto emocional antes do evento...',
      en: 'Explore the emotional context before the event...',
      es: 'Explore el contexto emocional antes del evento...',
    },
  },
  {
    key: 'anti_repetition_guidance',
    label: {
      pt: 'Anti-repetição',
      en: 'Anti-repetition',
      es: 'Anti-repetición',
    },
    description: {
      pt: 'Instruções para evitar repetir perguntas já feitas.',
      en: 'Instructions to avoid repeating questions already asked.',
      es: 'Instrucciones para evitar repetir preguntas ya hechas.',
    },
    example: {
      pt: 'Não repita perguntas similares a: "Como você se sentiu?"',
      en: 'Do not repeat questions similar to: "How did you feel?"',
      es: 'No repitas preguntas similares a: "¿Cómo te sentiste?"',
    },
  },
  {
    key: 'step_hint',
    label: {
      pt: 'Dica da etapa',
      en: 'Step hint',
      es: 'Pista de la etapa',
    },
    description: {
      pt: 'Orientação conforme a etapa da interação (início vs meio do relato).',
      en: 'Guidance based on interaction stage (start vs middle of report).',
      es: 'Orientación según la etapa de la interacción (inicio vs medio del relato).',
    },
    example: {
      pt: 'Ajude o paciente a iniciar um relato do dia a dia...',
      en: 'Help the patient start a day-to-day report...',
      es: 'Ayude al paciente a iniciar un relato del día a día...',
    },
  },
  {
    key: 'session_considerations',
    label: {
      pt: 'Considerações da sessão',
      en: 'Session considerations',
      es: 'Consideraciones de la sesión',
    },
    description: {
      pt: 'Notas e considerações da sessão atual do psicólogo.',
      en: 'Notes and considerations for the psychologist current session.',
      es: 'Notas y consideraciones de la sesión actual del psicólogo.',
    },
    example: {
      pt: 'Foco em técnicas de grounding nesta sessão.',
      en: 'Focus on grounding techniques in this session.',
      es: 'Enfoque en técnicas de grounding en esta sesión.',
    },
  },
  {
    key: 'clinical_context',
    label: {
      pt: 'Contexto clínico',
      en: 'Clinical context',
      es: 'Contexto clínico',
    },
    description: {
      pt: 'Contexto clínico consolidado do paciente para o copiloto.',
      en: 'Consolidated patient clinical context for the copilot.',
      es: 'Contexto clínico consolidado del paciente para el copiloto.',
    },
    example: {
      pt: 'Resumo clínico, humor médio, aderência...',
      en: 'Clinical summary, average mood, adherence...',
      es: 'Resumen clínico, humor promedio, adherencia...',
    },
  },
  {
    key: 'language_instruction',
    label: {
      pt: 'Instrução de idioma',
      en: 'Language instruction',
      es: 'Instrucción de idioma',
    },
    description: {
      pt: 'Instrução fixa para responder no idioma configurado.',
      en: 'Fixed instruction to respond in the configured language.',
      es: 'Instrucción fija para responder en el idioma configurado.',
    },
    example: {
      pt: 'Responda sempre em português do Brasil...',
      en: 'Always respond in English...',
      es: 'Responde siempre en español...',
    },
  },
];

export const getAiPromptTokenDefinition = (
  key: string
): AiPromptTokenDefinition | undefined =>
  AI_PROMPT_TOKEN_DEFINITIONS.find((token) => token.key === key);
