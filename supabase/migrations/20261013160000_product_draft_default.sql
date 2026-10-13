-- Product Manager Task 3: omitted publication choices create drafts.
-- Metadata-only change. Existing products, required constraints, RLS, grants,
-- inventory ownership, save transactions and certified installer stay intact.
alter table public.products alter column is_published set default false;
