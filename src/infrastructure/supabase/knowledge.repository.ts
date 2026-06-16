import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  KnowledgeChunkMatch,
  KnowledgeDocument,
  KnowledgeDocumentIndexStatus,
} from '@domain/knowledge.types.js';
import { ForbiddenError, NotFoundError } from '@application/authorization.js';

type KnowledgeDocumentRow = {
  id: string;
  title: string;
  file_name: string;
  uploaded_by: string | null;
  chunk_count: number;
  status: 'active' | 'archived';
  index_status: KnowledgeDocumentIndexStatus;
  created_at: string;
  updated_at: string;
};

type KnowledgeChunkMatchRow = {
  id: string;
  document_id: string;
  content: string;
  metadata: Record<string, unknown> | null;
  similarity: number;
};

const mapDocument = (row: KnowledgeDocumentRow): KnowledgeDocument => ({
  id: row.id,
  title: row.title,
  fileName: row.file_name,
  uploadedBy: row.uploaded_by,
  chunkCount: row.chunk_count,
  status: row.status,
  indexStatus: row.index_status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const knowledgeDocumentSelect =
  'id, title, file_name, uploaded_by, chunk_count, status, index_status, created_at, updated_at';

const normalizeFileName = (fileName: string): string =>
  fileName.trim().toLowerCase();

export const formatEmbeddingForPgvector = (embedding: number[]): string =>
  `[${embedding.join(',')}]`;

export const listActiveKnowledgeDocumentsByPsychologist = async (
  client: SupabaseClient,
  psychologistId: string
): Promise<KnowledgeDocument[]> => {
  const { data, error } = await client
    .from('knowledge_documents')
    .select(knowledgeDocumentSelect)
    .eq('status', 'active')
    .eq('uploaded_by', psychologistId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list knowledge documents: ${error.message}`);
  }

  return (data as KnowledgeDocumentRow[]).map(mapDocument);
};

export const findActiveKnowledgeDocumentByFileName = async (
  client: SupabaseClient,
  psychologistId: string,
  fileName: string
): Promise<KnowledgeDocument | null> => {
  const normalized = normalizeFileName(fileName);
  const documents = await listActiveKnowledgeDocumentsByPsychologist(
    client,
    psychologistId
  );

  return (
    documents.find(
      (document) => normalizeFileName(document.fileName) === normalized
    ) ?? null
  );
};

export const getKnowledgeDocumentById = async (
  client: SupabaseClient,
  documentId: string
): Promise<KnowledgeDocument | null> => {
  const { data, error } = await client
    .from('knowledge_documents')
    .select(knowledgeDocumentSelect)
    .eq('id', documentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load knowledge document: ${error.message}`);
  }

  return data ? mapDocument(data as KnowledgeDocumentRow) : null;
};

export const insertKnowledgeDocument = async (
  client: SupabaseClient,
  input: {
    title: string;
    fileName: string;
    uploadedBy: string | null;
    chunkCount?: number;
    indexStatus?: KnowledgeDocumentIndexStatus;
  }
): Promise<KnowledgeDocument> => {
  const { data, error } = await client
    .from('knowledge_documents')
    .insert({
      title: input.title,
      file_name: input.fileName,
      uploaded_by: input.uploadedBy,
      chunk_count: input.chunkCount ?? 0,
      index_status: input.indexStatus ?? 'pending',
      status: 'active',
    })
    .select(knowledgeDocumentSelect)
    .single();

  if (error || !data) {
    throw new Error(`Failed to insert knowledge document: ${error?.message}`);
  }

  return mapDocument(data as KnowledgeDocumentRow);
};

export const updateKnowledgeDocumentIndexStatus = async (
  client: SupabaseClient,
  documentId: string,
  input: {
    indexStatus: KnowledgeDocumentIndexStatus;
    chunkCount?: number;
  }
): Promise<KnowledgeDocument> => {
  const payload: Record<string, unknown> = {
    index_status: input.indexStatus,
    updated_at: new Date().toISOString(),
  };

  if (input.chunkCount !== undefined) {
    payload.chunk_count = input.chunkCount;
  }

  const { data, error } = await client
    .from('knowledge_documents')
    .update(payload)
    .eq('id', documentId)
    .eq('status', 'active')
    .select(knowledgeDocumentSelect)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to update knowledge document index status: ${error.message}`
    );
  }

  if (!data) {
    throw new NotFoundError('Knowledge document not found');
  }

  return mapDocument(data as KnowledgeDocumentRow);
};

export const insertKnowledgeChunks = async (
  client: SupabaseClient,
  rows: Array<{
    documentId: string;
    chunkIndex: number;
    content: string;
    metadata: Record<string, unknown>;
    embedding: number[];
  }>,
  options?: {
    batchSize?: number;
  }
): Promise<void> => {
  if (!rows.length) {
    return;
  }

  const batchSize = options?.batchSize ?? 40;

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const payload = batch.map((row) => ({
      document_id: row.documentId,
      chunk_index: row.chunkIndex,
      content: row.content,
      metadata: row.metadata,
      embedding: formatEmbeddingForPgvector(row.embedding),
    }));

    const { error } = await client.from('knowledge_chunks').insert(payload);
    if (error) {
      throw new Error(
        `Failed to insert knowledge chunks (batch ${Math.floor(index / batchSize) + 1}): ${error.message}`
      );
    }
  }
};

export const archiveKnowledgeDocument = async (
  client: SupabaseClient,
  documentId: string,
  psychologistId?: string
): Promise<KnowledgeDocument> => {
  let query = client
    .from('knowledge_documents')
    .update({
      status: 'archived',
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .eq('status', 'active');

  if (psychologistId) {
    query = query.eq('uploaded_by', psychologistId);
  }

  const { data, error } = await query
    .select(knowledgeDocumentSelect)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to archive knowledge document: ${error.message}`);
  }

  if (!data) {
    if (psychologistId) {
      throw new ForbiddenError(
        'Knowledge document not found or not owned by you'
      );
    }
    throw new NotFoundError('Knowledge document not found');
  }

  return mapDocument(data as KnowledgeDocumentRow);
};

export const matchKnowledgeChunks = async (
  client: SupabaseClient,
  input: {
    queryEmbedding: number[];
    matchCount: number;
    psychologistIds?: string[];
  }
): Promise<KnowledgeChunkMatch[]> => {
  const { data, error } = await client.rpc('match_knowledge_chunks', {
    query_embedding: formatEmbeddingForPgvector(input.queryEmbedding),
    match_count: input.matchCount,
    psychologist_ids: input.psychologistIds?.length
      ? input.psychologistIds
      : null,
  });

  if (error) {
    throw new Error(`Failed to match knowledge chunks: ${error.message}`);
  }

  return ((data ?? []) as KnowledgeChunkMatchRow[]).map((row) => ({
    id: row.id,
    documentId: row.document_id,
    content: row.content,
    metadata: row.metadata ?? {},
    similarity: row.similarity,
  }));
};
