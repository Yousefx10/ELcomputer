begin;

-- Public presentation only. Existing identities, relationships and RLS stay intact.
alter table public.brands add column if not exists brand_page jsonb not null default '{}'::jsonb;
comment on column public.brands.brand_page is 'Public brand landing content. Versioned hero/background/story and ordered media rows with stable IDs. No private media metadata.';

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.brands'::regclass and conname='brands_page_document_check') then
    alter table public.brands add constraint brands_page_document_check check (
      jsonb_typeof(brand_page) = 'object' and octet_length(brand_page::text) <= 150000
      and (not (brand_page ? 'rows') or case when jsonb_typeof(brand_page->'rows') = 'array' then jsonb_array_length(brand_page->'rows') <= 30 else false end)
    );
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
