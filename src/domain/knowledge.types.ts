export type KnowledgeDocumentStatus = 'active' | 'archived';

export type KnowledgeDocument = {
  id: string;
  title: string;
  fileName: string;
  uploadedBy: string | null;
  chunkCount: number;
  status: KnowledgeDocumentStatus;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeChunkMatch = {
  id: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};
