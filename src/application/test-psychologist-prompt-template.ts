import type { SupabaseClient } from '@supabase/supabase-js';

import { runPsychologistCopilotGraph } from '@ai/graphs/psychologist-copilot.graph.js';
import { runPatientChatGraph } from '@ai/graphs/patient-chat.graph.js';
import { extractPromptTokens } from '@ai/prompts/apply-prompt-tokens.js';
import { getAiPromptTemplateDefinition } from '@ai/prompts/ai-prompt-registry.js';
import { buildPatientChatSystemContent } from '@ai/prompts/patient-chat-messages.js';
import { buildPsychologistCopilotSystemPrompt } from '@ai/prompts/psychologist-copilot-system.js';
import { resolvePsychologistBrevityInstruction } from '@ai/prompts/response-language.js';
import { ensureAiPromptTemplateCache } from '@application/ai-prompt-template-cache.js';
import {
  runWithPsychologistPromptTemplateResolver,
  type PromptTemplateDraftOverride,
} from '@application/ai-prompt-template-resolver.js';
import { NotFoundError } from '@application/authorization.js';
import type { Env } from '@config/env.js';
import type { AppLanguage } from '@domain/types.js';
import { validateAllowedPromptTokens } from '@infrastructure/supabase/ai-prompt-template.shared.js';

export type TestAiPromptTemplateInput = {
  key: string;
  content: string;
  sourceLanguage: AppLanguage;
  testMessage: string;
  psychologistContext?: string;
  sessionConsiderations?: string;
  clinicalContext?: string;
};

export type TestAiPromptTemplateResult = {
  reply: string;
  resolvedPrompt: string;
};

export type TestPsychologistPromptTemplateInput = TestAiPromptTemplateInput;
export type TestPsychologistPromptTemplateResult = TestAiPromptTemplateResult;

const DEFAULT_PSYCHOLOGIST_CONTEXT: Record<AppLanguage, string> = {
  pt: 'Paciente em acompanhamento por ansiedade social. Foco em situações de evitação no trabalho.',
  en: 'Patient in treatment for social anxiety. Focus on workplace avoidance situations.',
  es: 'Paciente en seguimiento por ansiedad social. Enfoque en situaciones de evitación laboral.',
};

const DEFAULT_SESSION_CONSIDERATIONS: Record<AppLanguage, string> = {
  pt: 'Foco em técnicas de grounding nesta sessão.',
  en: 'Focus on grounding techniques in this session.',
  es: 'Enfoque en técnicas de grounding en esta sesión.',
};

const DEFAULT_CLINICAL_CONTEXT: Record<AppLanguage, string> = {
  pt: 'Humor médio estável. Aderência ao diário em 72%.',
  en: 'Average mood stable. Diary adherence at 72%.',
  es: 'Humor promedio estable. Adherencia al diario en 72%.',
};

const PROMPT_TEST_PATIENT_ID = '00000000-0000-4000-8000-000000000001';
const PROMPT_TEST_PSYCHOLOGIST_ID = '00000000-0000-4000-8000-000000000002';

const isPatientChatTemplateKey = (key: string): boolean =>
  key.startsWith('patient_chat.') || key === 'response_language.instruction';

const isCopilotTemplateKey = (key: string): boolean =>
  key.startsWith('psychologist_copilot.') ||
  key === 'response_language.psychologist_brevity';

const assertDraftTokens = (key: string, content: string): void => {
  const definition = getAiPromptTemplateDefinition(key);
  if (!definition) {
    return;
  }

  const tokens = extractPromptTokens(content);
  const invalid = tokens.filter(
    (token) => !definition.allowedTokens.includes(token)
  );

  if (invalid.length) {
    throw new Error(`Invalid prompt tokens: ${invalid.join(', ')}`);
  }

  validateAllowedPromptTokens(definition.allowedTokens, { pt: content });
};

export const testAiPromptTemplate = async (
  env: Env,
  admin: SupabaseClient,
  psychologistId: string | undefined,
  input: TestAiPromptTemplateInput
): Promise<TestAiPromptTemplateResult> => {
  const definition = getAiPromptTemplateDefinition(input.key);
  if (!definition) {
    throw new NotFoundError('Prompt template not found');
  }

  assertDraftTokens(input.key, input.content);

  await ensureAiPromptTemplateCache(admin);

  const draftOverride: PromptTemplateDraftOverride = {
    key: input.key,
    content: input.content,
    language: input.sourceLanguage,
  };

  return runWithPsychologistPromptTemplateResolver(
    admin,
    psychologistId,
    async () => {
      const language = input.sourceLanguage;

      if (isPatientChatTemplateKey(input.key)) {
        const psychologistContext =
          input.psychologistContext?.trim() ||
          DEFAULT_PSYCHOLOGIST_CONTEXT[language];
        const generationContext = {
          language,
          userMessage: input.testMessage,
          psychologistContext,
          chatHistory: [],
          retrievalContext: '',
        };

        const reply = await runPatientChatGraph(env, {
          patientId: PROMPT_TEST_PATIENT_ID,
          userMessage: input.testMessage,
          psychologistContext,
          chatHistory: [],
          language,
          retrievalContext: '',
        });

        return {
          reply,
          resolvedPrompt: buildPatientChatSystemContent(generationContext),
        };
      }

      if (isCopilotTemplateKey(input.key)) {
        const sessionConsiderations =
          input.sessionConsiderations?.trim() ||
          DEFAULT_SESSION_CONSIDERATIONS[language];
        const clinicalContext =
          input.clinicalContext?.trim() || DEFAULT_CLINICAL_CONTEXT[language];

        const reply = await runPsychologistCopilotGraph(env, {
          psychologistId: psychologistId ?? PROMPT_TEST_PSYCHOLOGIST_ID,
          patientId: PROMPT_TEST_PATIENT_ID,
          userMessage: input.testMessage,
          sessionConsiderations,
          clinicalContext,
          language,
          retrievalContext: '',
          chatHistory: [],
        });

        let resolvedPrompt = buildPsychologistCopilotSystemPrompt(language, {
          sessionConsiderations,
          clinicalContext,
          retrievalContext: '',
        });

        if (input.key === 'response_language.psychologist_brevity') {
          resolvedPrompt = [
            resolvedPrompt,
            resolvePsychologistBrevityInstruction(language),
          ]
            .filter(Boolean)
            .join('\n\n');
        }

        return { reply, resolvedPrompt };
      }

      return {
        reply: '',
        resolvedPrompt: input.content,
      };
    },
    draftOverride
  );
};

export const testPsychologistPromptTemplate = async (
  env: Env,
  admin: SupabaseClient,
  psychologistId: string,
  input: TestPsychologistPromptTemplateInput
): Promise<TestPsychologistPromptTemplateResult> =>
  testAiPromptTemplate(env, admin, psychologistId, input);
