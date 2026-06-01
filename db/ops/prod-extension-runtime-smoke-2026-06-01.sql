-- Rollback-only runtime smoke for the 2026-06-01 production extension move.
-- Verifies search-vector triggers, pgvector function resolution, and pg_trgm
-- operator resolution after vector/pg_trgm live in the extensions schema.

BEGIN;

SET LOCAL search_path = public, extensions, pg_temp;

DO $do$
DECLARE
  v_source_id text := 'advisor-prod-smoke-20260601';
  v_page_id integer;
  v_chunk_id integer;
  v_page_sv text;
  v_chunk_sv text;
BEGIN
  INSERT INTO public.sources (id, name)
  VALUES (v_source_id, 'advisor-prod-smoke-20260601');

  INSERT INTO public.pages (
    source_id,
    slug,
    type,
    page_kind,
    title,
    compiled_truth,
    timeline,
    frontmatter
  ) VALUES (
    v_source_id,
    'advisor-prod-smoke-20260601',
    'note',
    'markdown',
    'Advisor Prod Smoke Title',
    'runtime trigger compiled truth parsley',
    'timeline direct dill',
    '{}'::jsonb
  ) RETURNING id INTO v_page_id;

  INSERT INTO public.timeline_entries (page_id, date, summary, detail)
  VALUES (v_page_id, current_date, 'timeline summary rosemary', 'timeline detail thyme');

  UPDATE public.pages
  SET compiled_truth = compiled_truth || ' refreshed'
  WHERE id = v_page_id
  RETURNING search_vector::text INTO v_page_sv;

  IF v_page_sv IS NULL OR v_page_sv !~ 'rosemari|parsley|dill' THEN
    RAISE EXCEPTION 'page search_vector smoke failed: %', v_page_sv;
  END IF;

  INSERT INTO public.content_chunks (
    page_id,
    chunk_index,
    chunk_text,
    chunk_source,
    doc_comment,
    symbol_name_qualified,
    language,
    modality
  ) VALUES (
    v_page_id,
    1,
    'chunk text oregano',
    'advisor_smoke',
    'doc comment basil',
    'Smoke.Symbol.Sage',
    'en',
    'text'
  ) RETURNING id, search_vector::text INTO v_chunk_id, v_chunk_sv;

  IF v_chunk_sv IS NULL OR v_chunk_sv !~ 'oregano|basil|sage' THEN
    RAISE EXCEPTION 'chunk search_vector smoke failed: %', v_chunk_sv;
  END IF;

  IF extensions.vector_dims('[1,2,3]'::extensions.vector) <> 3 THEN
    RAISE EXCEPTION 'vector extension smoke failed';
  END IF;

  IF NOT ('recipe planner' % 'recipe plan') THEN
    RAISE EXCEPTION 'pg_trgm operator smoke failed';
  END IF;

  RAISE NOTICE 'prod_extension_runtime_smoke_ok page_id=% chunk_id=%', v_page_id, v_chunk_id;
END
$do$;

ROLLBACK;
