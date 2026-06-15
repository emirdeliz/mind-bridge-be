-- Scope knowledge documents per psychologist and filter RAG retrieval by owner.

create unique index if not exists knowledge_documents_owner_file_active_uidx
  on public.knowledge_documents (uploaded_by, lower(file_name))
  where status = 'active' and uploaded_by is not null;

create index if not exists knowledge_documents_uploaded_by_status_idx
  on public.knowledge_documents (uploaded_by, status);

drop function if exists public.match_knowledge_chunks(vector, integer);

create or replace function public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_count int default 5,
  psychologist_ids uuid[] default null
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    kc.id,
    kc.document_id,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks kc
  inner join public.knowledge_documents kd on kd.id = kc.document_id
  where kd.status = 'active'
    and (
      psychologist_ids is null
      or cardinality(psychologist_ids) = 0
      or kd.uploaded_by = any(psychologist_ids)
    )
  order by kc.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;
