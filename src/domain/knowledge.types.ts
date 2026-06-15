export type KnowledgeDocumentStatus = 'active' | 'archived';

export type KnowledgeDocumentIndexStatus =
  | 'pending'
  | 'indexing'
  | 'indexed'
  | 'failed';

export type KnowledgeDocument = {
  id: string;
  title: string;
  fileName: string;
  uploadedBy: string | null;
  chunkCount: number;
  status: KnowledgeDocumentStatus;
  indexStatus: KnowledgeDocumentIndexStatus;
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
