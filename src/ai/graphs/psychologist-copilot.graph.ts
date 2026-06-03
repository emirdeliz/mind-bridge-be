import { END, START, StateGraph } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";

import type { Env } from "../../config/env.js";
import { createChatModel } from "../llm.js";

const PsychologistCopilotAnnotation = Annotation.Root({
  psychologistId: Annotation<string>,
  patientId: Annotation<string>,
  userMessage: Annotation<string>,
  clinicalContext: Annotation<string>,
  retrievalContext: Annotation<string>,
  assistantMessage: Annotation<string>,
});

type PsychologistCopilotState = typeof PsychologistCopilotAnnotation.State;

const retrieveNode = async (state: PsychologistCopilotState): Promise<Partial<PsychologistCopilotState>> => ({
  retrievalContext: [
    "Retrieved clinical notes (mock):",
    `- Patient ${state.patientId}: mood avg 4.2/10 last 7 days.`,
    "- Diary adherence below target.",
  ].join("\n"),
});

const createRespondNode = (env: Env) => async (state: PsychologistCopilotState): Promise<Partial<PsychologistCopilotState>> => {
  const model = createChatModel(env);
  const system = new SystemMessage(
    [
      "You assist a licensed psychotherapist during sessions.",
      "Provide structured clinical insights, patterns, and session focus — not definitive diagnoses.",
      `Psychologist context: ${state.clinicalContext || "Not provided."}`,
      `Retrieved data:\n${state.retrievalContext}`,
    ].join("\n\n"),
  );
  const human = new HumanMessage(state.userMessage);
  const response = await model.invoke([system, human]);
  const content = typeof response.content === "string" ? response.content : String(response.content);

  return { assistantMessage: content };
};

export const createPsychologistCopilotGraph = (env: Env) => {
  const graph = new StateGraph(PsychologistCopilotAnnotation)
    .addNode("retrieve", retrieveNode)
    .addNode("respond", createRespondNode(env))
    .addEdge(START, "retrieve")
    .addEdge("retrieve", "respond")
    .addEdge("respond", END);

  return graph.compile();
};

export const runPsychologistCopilotGraph = async (
  env: Env,
  input: {
    psychologistId: string;
    patientId: string;
    userMessage: string;
    clinicalContext?: string;
  },
): Promise<string> => {
  const app = createPsychologistCopilotGraph(env);
  const result = await app.invoke({
    psychologistId: input.psychologistId,
    patientId: input.patientId,
    userMessage: input.userMessage,
    clinicalContext: input.clinicalContext ?? "",
    retrievalContext: "",
    assistantMessage: "",
  });

  return result.assistantMessage;
};
