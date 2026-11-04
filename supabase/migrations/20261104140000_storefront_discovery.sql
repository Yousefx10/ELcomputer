-- 114 candidate. Installed ledger 113 inspected read-only on 4 November 2026.
begin;
set local lock_timeout='5s'; set local statement_timeout='60s';
alter table public.site_settings add column catalog_infinite_scroll_enabled boolean not null default true;
comment on column public.site_settings.catalog_infinite_scroll_enabled is 'Incremental public catalog loading; explicit false is preserved.';
create function public.storefront_ranked_catalog_page(p_query text,p_category uuid,p_brand uuid,p_status text,p_min numeric,p_max numeric,p_matching_categories uuid[],p_matching_brands uuid[],p_page integer)
returns jsonb language plpgsql stable security invoker set search_path='' set statement_timeout='5s' as $$
declare result jsonb;
begin
 if p_query is null or length(p_query) not between 1 and 200 or p_page is null or p_page not between 1 and 10000
   or p_status is null or p_status not in ('','instock','unavailable')
   or coalesce(array_length(p_matching_categories,1),0)>1000 or coalesce(array_length(p_matching_brands,1),0)>1000
   or p_min<0 or p_max<0 then raise exception 'Invalid catalog query.' using errcode='22023'; end if;
 with matched as (
  select p.id,p.created_at,
   (case when lower(p.title)=lower(p_query) then 200 when starts_with(lower(p.title),lower(p_query)) then 140 when strpos(lower(p.title),lower(p_query))>0 then 100 else 0 end
    +case when lower(b.name)=lower(p_query) then 90 when strpos(lower(b.name),lower(p_query))>0 then 60 else 0 end
    +case when lower(c.name)=lower(p_query) then 80 when strpos(lower(c.name),lower(p_query))>0 then 50 else 0 end
    +case when lower(p.sku)=lower(p_query) then 70 when strpos(lower(p.sku),lower(p_query))>0 then 40 else 0 end
    +case when strpos(lower(p.description),lower(p_query))>0 then 25 else 0 end
    +case when strpos(lower(p.long_description),lower(p_query))>0 then 15 else 0 end
    +case when p.stock_quantity>0 then 2 else 0 end) score
  from public.storefront_products p left join public.categories c on c.id=p.category_id left join public.brands b on b.id=p.brand_id
  where p.is_published and (p_category is null or p.category_id=p_category) and (p_brand is null or p.brand_id=p_brand)
   and (p_status='' or p_status='instock' and p.stock_quantity>0 or p_status='unavailable' and p.stock_quantity=0)
   and (p_min is null or p.price>=p_min) and (p_max is null or p.price<=p_max)
   and (strpos(lower(p.title),lower(p_query))>0 or strpos(lower(p.description),lower(p_query))>0 or strpos(lower(p.long_description),lower(p_query))>0
    or strpos(lower(p.sku),lower(p_query))>0 or p.category_id=any(p_matching_categories) or p.brand_id=any(p_matching_brands))
 ), slice as (select * from matched order by score desc,created_at desc,id limit 12 offset (p_page-1)*12)
 select jsonb_build_object('ids',coalesce((select jsonb_agg(id order by score desc,created_at desc,id) from slice),'[]'::jsonb),'count',(select count(*) from matched)) into result;
 return result;
end $$;
revoke all on function public.storefront_ranked_catalog_page(text,uuid,uuid,text,numeric,numeric,uuid[],uuid[],integer) from public;
grant execute on function public.storefront_ranked_catalog_page(text,uuid,uuid,text,numeric,numeric,uuid[],uuid[],integer) to anon,authenticated,service_role;
alter table public.site_settings
 add column hero_layout_mode text not null default 'both' check(hero_layout_mode in ('carousel','banner','both')),
 add column hero_static_banner_id uuid references public.site_hero_banners(id) on delete set null;
alter table public.site_hero_banners add column presentation jsonb not null default '{}'::jsonb
 check(jsonb_typeof(presentation)='object' and octet_length(presentation::text)<=8192);
comment on column public.site_hero_banners.presentation is 'Optional EN/AR copy, mobile public image, fit and focal positions. Existing media reference guard covers the entire row.';
notify pgrst,'reload schema';
commit;
