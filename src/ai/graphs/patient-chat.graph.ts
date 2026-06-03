import { END, START, StateGraph } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import type { Env } from "../../config/env.js";
import { createChatModel } from "../llm.js";
import { PatientChatAnnotation, type PatientChatState } from "../state/patient-chat.state.js";

const buildRetrievalContext = (state: PatientChatState): string => {
  if (state.retrievalContext?.trim()) {
    return state.retrievalContext;
  }
  return "No additional retrieved context.";
};

const retrieveNode = async (_state: PatientChatState): Promise<Partial<PatientChatState>> => {
  // Placeholder until pgvector RAG is wired — keeps graph shape stable.
  const retrievalContext = [
    "Retrieved snippets (mock):",
    "- Patient reported work-related anxiety in recent interactions.",
    "- Sleep hygiene discussed in prior sessions.",
  ].join("\n");

  return { retrievalContext };
};

const createRespondNode = (env: Env) => async (state: PatientChatState): Promise<Partial<PatientChatState>> => {
  const model = createChatModel(env);
  const system = new SystemMessage(
    [
      "You are a supportive mental-health companion for a patient between therapy sessions.",
      "Be empathetic, concise, and never provide diagnosis or emergency instructions without urging professional help.",
      `Care plan context: ${state.careContext || "Not provided."}`,
      `Retrieved context:\n${buildRetrievalContext(state)}`,
    ].join("\n\n"),
  );
  const human = new HumanMessage(state.userMessage);
  const response = await model.invoke([system, human]);
  const content = typeof response.content === "string" ? response.content : String(response.content);

  return { assistantMessage: content };
};

export const createPatientChatGraph = (env: Env) => {
  const graph = new StateGraph(PatientChatAnnotation)
    .addNode("retrieve", retrieveNode)
    .addNode("respond", createRespondNode(env))
    .addEdge(START, "retrieve")
    .addEdge("retrieve", "respond")
    .addEdge("respond", END);

  return graph.compile();
};

export const runPatientChatGraph = async (
  env: Env,
  input: {
    patientId: string;
    userMessage: string;
    careContext?: string;
    retrievalContext?: string;
  },
): Promise<string> => {
  const app = createPatientChatGraph(env);
  const result = await app.invoke({
    patientId: input.patientId,
    userMessage: input.userMessage,
    careContext: input.careContext ?? "",
    retrievalContext: input.retrievalContext ?? "",
    assistantMessage: "",
  });

  return result.assistantMessage;
};
