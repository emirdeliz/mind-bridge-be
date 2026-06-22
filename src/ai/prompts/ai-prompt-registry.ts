import type { AiPromptTemplateDefinition } from '@domain/ai-prompt-template.types.js';

const PATIENT_CHAT_SYSTEM_TOKENS = [
  'core_guidance',
  'context_usage_guidance',
  'present_moment_guidance',
  'pacing_guidance',
  'text_context_label',
  'psychologist_context',
  'focus_block',
  'knowledge_section',
  'forbidden_line',
];

const PATIENT_CHAT_TURN_TOKENS = [
  'retry_guidance',
  'angle_guidance',
  'anti_repetition_guidance',
  'question_count',
  'step_hint',
  'user_message',
];

const COPILOT_SYSTEM_TOKENS = [
  'session_considerations',
  'clinical_context',
  'retrieval_context',
];

export const AI_PROMPT_TEMPLATE_DEFINITIONS: AiPromptTemplateDefinition[] = [
  {
    key: 'patient_chat.system',
    category: 'patient_chat',
    label: {
      pt: 'Chat do paciente — prompt de sistema',
      en: 'Patient chat — system prompt',
      es: 'Chat del paciente — prompt de sistema',
    },
    description: {
      pt: 'Instruções principais do agente que conversa com o paciente entre sessões.',
      en: 'Main instructions for the agent that talks to the patient between sessions.',
      es: 'Instrucciones principales del agente que conversa con el paciente entre sesiones.',
    },
    allowedTokens: PATIENT_CHAT_SYSTEM_TOKENS,
    defaultContent: {
      pt: `Você acompanha o paciente entre sessões, ajudando-o a registrar relatos do dia a dia que serão úteis na sessão com o psicólogo. Conversa de escuta — sem diagnóstico, sem jargão, sem substituir o psicólogo.

#core_guidance

#context_usage_guidance

#present_moment_guidance

#pacing_guidance

#text_context_label
#psychologist_context

#focus_block

#knowledge_section

#forbidden_line`,
      en: `You accompany the patient between sessions, helping them record day-to-day reports that will be useful in the session with the psychologist. Listening conversation — no diagnosis, no jargon, do not replace the psychologist.

#core_guidance

#context_usage_guidance

#present_moment_guidance

#pacing_guidance

#text_context_label
#psychologist_context

#focus_block

#knowledge_section

#forbidden_line`,
      es: `Acompañas al paciente entre sesiones, ayudándole a registrar relatos del día a día que serán útiles en la sesión con el psicólogo. Conversación de escucha — sin diagnóstico, sin jerga, sin reemplazar al psicólogo.

#core_guidance

#context_usage_guidance

#present_moment_guidance

#pacing_guidance

#text_context_label
#psychologist_context

#focus_block

#knowledge_section

#forbidden_line`,
    },
  },
  {
    key: 'patient_chat.turn_guidance',
    category: 'patient_chat',
    label: {
      pt: 'Chat do paciente — orientação por turno',
      en: 'Patient chat — turn guidance',
      es: 'Chat del paciente — orientación por turno',
    },
    description: {
      pt: 'Instruções dinâmicas adicionadas a cada mensagem do paciente.',
      en: 'Dynamic instructions added on each patient message.',
      es: 'Instrucciones dinámicas añadidas en cada mensaje del paciente.',
    },
    allowedTokens: PATIENT_CHAT_TURN_TOKENS,
    defaultContent: {
      pt: `#retry_guidance

#angle_guidance

#anti_repetition_guidance

Perguntas feitas nesta interação: #question_count

#step_hint

Mensagem atual do paciente: "#user_message"`,
      en: `#retry_guidance

#angle_guidance

#anti_repetition_guidance

Questions asked in this interaction: #question_count

#step_hint

Patient's current message: "#user_message"`,
      es: `#retry_guidance

#angle_guidance

#anti_repetition_guidance

Preguntas hechas en esta interacción: #question_count

#step_hint

Mensaje actual del paciente: "#user_message"`,
    },
  },
  {
    key: 'psychologist_copilot.system',
    category: 'psychologist_copilot',
    label: {
      pt: 'Copiloto do psicólogo — prompt de sistema',
      en: 'Psychologist copilot — system prompt',
      es: 'Copiloto del psicólogo — prompt de sistema',
    },
    description: {
      pt: 'Instruções do assistente usado pelo psicólogo durante sessões ao vivo.',
      en: 'Instructions for the assistant used by the psychologist during live sessions.',
      es: 'Instrucciones del asistente usado por el psicólogo durante sesiones en vivo.',
    },
    allowedTokens: COPILOT_SYSTEM_TOKENS,
    defaultContent: {
      pt: `IDIOMA OBRIGATÓRIO: português do Brasil. Nunca responda em inglês.
Você auxilia um psicólogo durante sessões ao vivo.
FORMATO DA RESPOSTA (escolha conforme o pedido do psicólogo):
- Pedido geral ou orientação pontual: UMA única frase curta (máximo 20 palavras), direta e acionável.
- Pedido quantitativo explícito (ex.: "formule 5 perguntas", "liste 3 hipóteses", "dê 4 sugestões"): entregue exatamente a quantidade pedida em lista numerada (1., 2., 3., ...), sem limite de caracteres por item.
Em pedidos quantitativos, cada item deve ser curto, claro e acionável — sem diagnóstico definitivo.
PROIBIDO em qualquer caso: raciocínio interno, análise, "Thinking Process" ou texto explicativo fora da resposta final.
Proibido: markdown, saudações e parágrafos introdutórios.

Considerações da sessão atual: #session_considerations

Contexto clínico do psicólogo: #clinical_context

#retrieval_context

Lembrete final: responda somente em português do Brasil, no formato adequado ao pedido.`,
      en: `REQUIRED LANGUAGE: English only.
You assist a psychotherapist during live sessions.
RESPONSE FORMAT (choose based on the psychologist request):
- General guidance or a single tip: ONE short sentence (max 20 words), direct and actionable.
- Explicit quantitative request (e.g. "formulate 5 questions", "list 3 hypotheses", "give 4 suggestions"): deliver exactly the requested quantity as a numbered list (1., 2., 3., ...), with no character limit per item.
For quantitative requests, each item must be short, clear, and actionable — no definitive diagnosis.
FORBIDDEN in all cases: internal reasoning, analysis, "Thinking Process", or explanatory text outside the final answer.
No markdown, greetings, or introductory paragraphs.

Current session considerations: #session_considerations

Psychologist clinical context: #clinical_context

#retrieval_context

Final reminder: reply in English only, in the format that matches the request.`,
      es: `IDIOMA OBLIGATORIO: español. Nunca respondas en inglés.
Asistes a un psicólogo durante sesiones en vivo.
FORMATO DE RESPUESTA (elige según la solicitud del psicólogo):
- Solicitud general u orientación puntual: UNA sola frase corta (máximo 20 palabras), directa y accionable.
- Solicitud cuantitativa explícita (ej.: "formula 5 preguntas", "lista 3 hipótesis", "da 4 sugerencias"): entrega exactamente la cantidad pedida en lista numerada (1., 2., 3., ...), sin límite de caracteres por ítem.
En solicitudes cuantitativas, cada ítem debe ser corto, claro y accionable — sin diagnóstico definitivo.
PROHIBIDO en cualquier caso: razonamiento interno, análisis, "Thinking Process" o texto explicativo fuera de la respuesta final.
Prohibido: markdown, saludos y párrafos introductorios.

Consideraciones de la sesión actual: #session_considerations

Contexto clínico del psicólogo: #clinical_context

#retrieval_context

Recordatorio final: responde solo en español, en el formato adecuado a la solicitud.`,
    },
  },
  {
    key: 'response_language.instruction',
    category: 'shared',
    label: {
      pt: 'Instrução de idioma da resposta',
      en: 'Response language instruction',
      es: 'Instrucción de idioma de la respuesta',
    },
    description: {
      pt: 'Frase fixa anexada ao final do prompt de sistema do chat do paciente.',
      en: 'Fixed phrase appended to the end of the patient chat system prompt.',
      es: 'Frase fija añadida al final del prompt de sistema del chat del paciente.',
    },
    allowedTokens: [],
    defaultContent: {
      pt: 'Responda sempre em português do Brasil, de forma clara e empática.',
      en: 'Always respond in English, clearly and empathetically.',
      es: 'Responde siempre en español, de forma clara y empática.',
    },
  },
  {
    key: 'response_language.psychologist_brevity',
    category: 'psychologist_copilot',
    label: {
      pt: 'Copiloto — instrução de brevidade',
      en: 'Copilot — brevity instruction',
      es: 'Copiloto — instrucción de brevedad',
    },
    description: {
      pt: 'Instrução para respostas curtas do copiloto em sessões ao vivo.',
      en: 'Instruction for short copilot replies during live sessions.',
      es: 'Instrucción para respuestas cortas del copiloto en sesiones en vivo.',
    },
    allowedTokens: [],
    defaultContent: {
      pt: 'Responda em UMA única frase curta (máximo 20 palavras). Vá direto ao ponto. Proibido: listas, tópicos, markdown, saudações e explicações longas.',
      en: 'Reply in ONE short sentence only (max 20 words). Be direct. No lists, bullets, markdown, greetings, or long explanations.',
      es: 'Responde en UNA sola frase corta (máximo 20 palabras). Ve al grano. Prohibido: listas, viñetas, markdown, saludos y explicaciones largas.',
    },
  },
];

export const getAiPromptTemplateDefinition = (
  key: string
): AiPromptTemplateDefinition | undefined =>
  AI_PROMPT_TEMPLATE_DEFINITIONS.find((definition) => definition.key === key);

export const listAiPromptTemplateDefinitions = (): AiPromptTemplateDefinition[] =>
  [...AI_PROMPT_TEMPLATE_DEFINITIONS];
