-- Track asynchronous PDF indexing for knowledge RAG.

alter table public.knowledge_documents
  add column if not exists index_status text not null default 'pending'
    check (index_status in ('pending', 'indexing', 'indexed', 'failed'));

update public.knowledge_documents
set index_status = 'indexed'
where chunk_count > 0;

create index if not exists knowledge_documents_index_status_idx
  on public.knowledge_documents (index_status)
  where status = 'active';

drop function if exists public.match_knowledge_chunks(vector, integer, uuid[]);

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
    and kd.index_status = 'indexed'
    and (
      psychologist_ids is null
      or cardinality(psychologist_ids) = 0
      or kd.uploaded_by = any(psychologist_ids)
    )
  order by kc.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;
