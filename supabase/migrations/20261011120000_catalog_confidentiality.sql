-- Catalog confidentiality, migration 68. Earlier migration identities stay intact.
-- Reconcile only the checked canonical policies; already-corrected policies remain untouched.
-- No data writes, provider changes, role changes or migration-history repair.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
LOCK TABLE public.brands, public.categories, public.product_images,
  public.product_specifications, public.products, public.site_hero_banners,
  public.site_links, public.site_settings, public.site_top_bar_messages,
  public.product_variants IN ACCESS EXCLUSIVE MODE;

DO $reconcile$
DECLARE
  baseline jsonb;
  expected constant jsonb := '{"brands":["680ded28c313b1304533ef0afdc58bb5","675c674aeaf869e0923c638643b9920c"],"categories":["723f6028cac541c7678923b5ecbbc462","264aa1f15b28e01c179667e7cdba8606"],"product_images":["8354b3bc00e9cbdbbd099e24eef129ce","f3a0cb1a6f59c89bef4fc94d8f6f3890"],"product_specifications":["bcd4db16e01c4b8e108eebc767202feb","26dab36a83ea5c6ddea3c5a541031dd1"],"products":["d9b3335e9dd6eae3e2bf77a994e87e81","cde9ed11ff95be1b030c91635dd61d39"],"site_hero_banners":["0de1ca45b044b54b2c66de8fe5030422","bda398deabdfb10e55254eb8c6ce9057"],"site_links":["e8fc2a035a6f1326c5597b8aa8d908b8","a4c75a697875f26db5c4c8b2452ce9f5"],"site_settings":["06c27f10dad631e2f8c39dedf83c1d81","bbee350eeddc025cb511cab941750e42"],"site_top_bar_messages":["557e4424c8c17801dceb5bd32bda05fe","c622ddcca6be37cead5d45cbfc8a6ba9"]}'::jsonb;
  t text;
BEGIN
  SELECT jsonb_object_agg(tablename, hash) INTO baseline FROM (
    SELECT tablename, md5(jsonb_agg(to_jsonb(p) ORDER BY policyname)::text) hash
    FROM pg_catalog.pg_policies p WHERE schemaname='public'
      AND tablename IN ('brands','categories','product_images','product_specifications',
        'products','site_hero_banners','site_links','site_settings','site_top_bar_messages')
    GROUP BY tablename
  ) policies;
  -- Validate every table before changing any policy. Unknown drift requires review.
  FOR t IN SELECT jsonb_object_keys(expected) LOOP
    IF NOT coalesce(expected->t ? (baseline->>t),false) THEN
      RAISE EXCEPTION 'Unexpected authorization policies on %. Stop for review.',t;
    END IF;
  END LOOP;
  IF baseline->>'brands' = '680ded28c313b1304533ef0afdc58bb5' THEN
    DROP POLICY "Admins can add brands" ON public."brands";
    DROP POLICY "Admins can delete brands" ON public."brands";
    DROP POLICY "Admins can edit brands" ON public."brands";
    DROP POLICY "Public can read brands" ON public."brands";
    CREATE POLICY security_public_read ON public."brands" FOR SELECT TO anon, authenticated USING (true);
    CREATE POLICY security_staff_read ON public."brands" FOR SELECT TO authenticated USING (public.has_admin_permission('brands.view'));
    CREATE POLICY security_staff_insert ON public."brands" FOR INSERT TO authenticated WITH CHECK (public.has_admin_permission('brands.view') AND public.has_admin_permission('brands.add'));
    CREATE POLICY security_staff_update ON public."brands" FOR UPDATE TO authenticated USING (public.has_admin_permission('brands.view') AND public.has_admin_permission('brands.edit')) WITH CHECK (public.has_admin_permission('brands.view') AND public.has_admin_permission('brands.edit'));
    CREATE POLICY security_staff_delete ON public."brands" FOR DELETE TO authenticated USING (public.has_admin_permission('brands.view') AND public.has_admin_permission('brands.edit'));
  END IF;
  IF baseline->>'categories' = '723f6028cac541c7678923b5ecbbc462' THEN
    DROP POLICY "Admins can add categories" ON public."categories";
    DROP POLICY "Admins can delete categories" ON public."categories";
    DROP POLICY "Admins can edit categories" ON public."categories";
    DROP POLICY "Public can read categories" ON public."categories";
    CREATE POLICY security_public_read ON public."categories" FOR SELECT TO anon, authenticated USING (true);
    CREATE POLICY security_staff_read ON public."categories" FOR SELECT TO authenticated USING (public.has_admin_permission('categories.view'));
    CREATE POLICY security_staff_insert ON public."categories" FOR INSERT TO authenticated WITH CHECK (public.has_admin_permission('categories.view') AND public.has_admin_permission('categories.add'));
    CREATE POLICY security_staff_update ON public."categories" FOR UPDATE TO authenticated USING (public.has_admin_permission('categories.view') AND public.has_admin_permission('categories.edit')) WITH CHECK (public.has_admin_permission('categories.view') AND public.has_admin_permission('categories.edit'));
    CREATE POLICY security_staff_delete ON public."categories" FOR DELETE TO authenticated USING (public.has_admin_permission('categories.view') AND public.has_admin_permission('categories.edit'));
  END IF;
  IF baseline->>'product_images' = '8354b3bc00e9cbdbbd099e24eef129ce' THEN
    DROP POLICY "Admins can manage product images" ON public."product_images";
    DROP POLICY "Public can read images for published products" ON public."product_images";
    CREATE POLICY security_public_read ON public."product_images" FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.products p JOIN public.product_variants v ON v.product_id=p.id AND v.id=product_images.variant_id AND v.is_active WHERE p.id=product_images.product_id AND p.is_published = true));
    CREATE POLICY security_staff_read ON public."product_images" FOR SELECT TO authenticated USING (public.has_admin_permission('products.view'));
    CREATE POLICY security_staff_insert ON public."product_images" FOR INSERT TO authenticated WITH CHECK (public.has_admin_permission('products.view') AND public.has_admin_permission('products.edit'));
    CREATE POLICY security_staff_update ON public."product_images" FOR UPDATE TO authenticated USING (public.has_admin_permission('products.view') AND public.has_admin_permission('products.edit')) WITH CHECK (public.has_admin_permission('products.view') AND public.has_admin_permission('products.edit'));
    CREATE POLICY security_staff_delete ON public."product_images" FOR DELETE TO authenticated USING (public.has_admin_permission('products.view') AND public.has_admin_permission('products.edit'));
  END IF;
  IF baseline->>'product_specifications' = 'bcd4db16e01c4b8e108eebc767202feb' THEN
    DROP POLICY "Admins can manage product specifications" ON public."product_specifications";
    DROP POLICY "Public can read specifications for published products" ON public."product_specifications";
    CREATE POLICY security_public_read ON public."product_specifications" FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_specifications.product_id AND p.is_published = true));
    CREATE POLICY security_staff_read ON public."product_specifications" FOR SELECT TO authenticated USING (public.has_admin_permission('products.view'));
    CREATE POLICY security_staff_insert ON public."product_specifications" FOR INSERT TO authenticated WITH CHECK (public.has_admin_permission('products.view') AND public.has_admin_permission('products.edit'));
    CREATE POLICY security_staff_update ON public."product_specifications" FOR UPDATE TO authenticated USING (public.has_admin_permission('products.view') AND public.has_admin_permission('products.edit')) WITH CHECK (public.has_admin_permission('products.view') AND public.has_admin_permission('products.edit'));
    CREATE POLICY security_staff_delete ON public."product_specifications" FOR DELETE TO authenticated USING (public.has_admin_permission('products.view') AND public.has_admin_permission('products.edit'));
  END IF;
  IF baseline->>'products' = 'd9b3335e9dd6eae3e2bf77a994e87e81' THEN
    DROP POLICY "Admins can add products" ON public."products";
    DROP POLICY "Admins can delete products" ON public."products";
    DROP POLICY "Admins can edit products" ON public."products";
    DROP POLICY "Admins can read dashboard products" ON public."products";
    DROP POLICY "Public can read published products" ON public."products";
    CREATE POLICY security_public_read ON public."products" FOR SELECT TO anon, authenticated USING (is_published = true);
    CREATE POLICY security_staff_read ON public."products" FOR SELECT TO authenticated USING (public.has_admin_permission('products.view'));
    CREATE POLICY security_staff_insert ON public."products" FOR INSERT TO authenticated WITH CHECK (public.has_admin_permission('products.view') AND public.has_admin_permission('products.add'));
    CREATE POLICY security_staff_update ON public."products" FOR UPDATE TO authenticated USING (public.has_admin_permission('products.view') AND public.has_admin_permission('products.edit')) WITH CHECK (public.has_admin_permission('products.view') AND public.has_admin_permission('products.edit'));
    CREATE POLICY security_staff_delete ON public."products" FOR DELETE TO authenticated USING (public.has_admin_permission('products.view') AND public.has_admin_permission('products.edit'));
  END IF;
  IF baseline->>'site_hero_banners' = '0de1ca45b044b54b2c66de8fe5030422' THEN
    DROP POLICY "Admins can manage hero banners" ON public."site_hero_banners";
    DROP POLICY "Public can read hero banners" ON public."site_hero_banners";
    CREATE POLICY security_public_read ON public."site_hero_banners" FOR SELECT TO anon, authenticated USING (true);
    CREATE POLICY security_staff_read ON public."site_hero_banners" FOR SELECT TO authenticated USING (public.has_admin_permission('settings.view'));
    CREATE POLICY security_staff_insert ON public."site_hero_banners" FOR INSERT TO authenticated WITH CHECK (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
    CREATE POLICY security_staff_update ON public."site_hero_banners" FOR UPDATE TO authenticated USING (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit')) WITH CHECK (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
    CREATE POLICY security_staff_delete ON public."site_hero_banners" FOR DELETE TO authenticated USING (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
  END IF;
  IF baseline->>'site_links' = 'e8fc2a035a6f1326c5597b8aa8d908b8' THEN
    DROP POLICY "Admins can manage site links" ON public."site_links";
    DROP POLICY "Public can read site links" ON public."site_links";
    CREATE POLICY security_public_read ON public."site_links" FOR SELECT TO anon, authenticated USING (true);
    CREATE POLICY security_staff_read ON public."site_links" FOR SELECT TO authenticated USING (public.has_admin_permission('settings.view'));
    CREATE POLICY security_staff_insert ON public."site_links" FOR INSERT TO authenticated WITH CHECK (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
    CREATE POLICY security_staff_update ON public."site_links" FOR UPDATE TO authenticated USING (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit')) WITH CHECK (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
    CREATE POLICY security_staff_delete ON public."site_links" FOR DELETE TO authenticated USING (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
  END IF;
  IF baseline->>'site_settings' = '06c27f10dad631e2f8c39dedf83c1d81' THEN
    DROP POLICY "Admins can manage site settings" ON public."site_settings";
    DROP POLICY "Public can read site settings" ON public."site_settings";
    CREATE POLICY security_public_read ON public."site_settings" FOR SELECT TO anon, authenticated USING (true);
    CREATE POLICY security_staff_read ON public."site_settings" FOR SELECT TO authenticated USING (public.has_admin_permission('settings.view'));
    CREATE POLICY security_staff_insert ON public."site_settings" FOR INSERT TO authenticated WITH CHECK (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
    CREATE POLICY security_staff_update ON public."site_settings" FOR UPDATE TO authenticated USING (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit')) WITH CHECK (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
    CREATE POLICY security_staff_delete ON public."site_settings" FOR DELETE TO authenticated USING (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
  END IF;
  IF baseline->>'site_top_bar_messages' = '557e4424c8c17801dceb5bd32bda05fe' THEN
    DROP POLICY "Admins can manage top bar messages" ON public."site_top_bar_messages";
    DROP POLICY "Public can read top bar messages" ON public."site_top_bar_messages";
    CREATE POLICY security_public_read ON public."site_top_bar_messages" FOR SELECT TO anon, authenticated USING (true);
    CREATE POLICY security_staff_read ON public."site_top_bar_messages" FOR SELECT TO authenticated USING (public.has_admin_permission('settings.view'));
    CREATE POLICY security_staff_insert ON public."site_top_bar_messages" FOR INSERT TO authenticated WITH CHECK (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
    CREATE POLICY security_staff_update ON public."site_top_bar_messages" FOR UPDATE TO authenticated USING (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit')) WITH CHECK (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
    CREATE POLICY security_staff_delete ON public."site_top_bar_messages" FOR DELETE TO authenticated USING (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
  END IF;
END $reconcile$;

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.brands FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.brands TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.brands TO authenticated;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.categories FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.categories TO authenticated;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.product_images FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.product_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.product_images TO authenticated;
ALTER TABLE public.product_specifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.product_specifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.product_specifications TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.product_specifications TO authenticated;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.products FROM PUBLIC, anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.products TO authenticated;
ALTER TABLE public.site_hero_banners ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.site_hero_banners FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.site_hero_banners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.site_hero_banners TO authenticated;
ALTER TABLE public.site_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.site_links FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.site_links TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.site_links TO authenticated;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.site_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.site_settings TO authenticated;
ALTER TABLE public.site_top_bar_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.site_top_bar_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.site_top_bar_messages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.site_top_bar_messages TO authenticated;
REVOKE SELECT (id, title, description, price, old_price, image_url, is_top_seller, is_featured, created_at, category_id, slug, brand_id, default_supplier_id, primary_warehouse_id, long_description, color_name, color_hex, stock_quantity, cost_price, is_published, sku, popularity_score, average_rating, is_serialized, selling_mode, expected_availability_date, availability_message, preorder_active, preorder_starts_at, preorder_ends_at, preorder_payment_mode, preorder_deposit_percent, preorder_total_limit, preorder_customer_limit, seo_title, seo_description, seo_image_url, warranty_status, warranty_duration_value, warranty_duration_unit) ON TABLE public.products FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, title, description, price, old_price, image_url, is_top_seller, is_featured, created_at, category_id, slug, brand_id, long_description, color_name, color_hex, stock_quantity, is_published, sku, popularity_score, average_rating, is_serialized, selling_mode, expected_availability_date, availability_message, preorder_active, preorder_starts_at, preorder_ends_at, preorder_payment_mode, preorder_deposit_percent, preorder_total_limit, preorder_customer_limit, seo_title, seo_description, seo_image_url, warranty_status, warranty_duration_value, warranty_duration_unit) ON TABLE public.products TO anon, authenticated;
REVOKE SELECT (id, product_id, name, code, sku, color_name, color_hex, price, cost_price, stock_quantity, is_active, created_at, updated_at) ON TABLE public.product_variants FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON TABLE public.product_variants FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, product_id, name, code, sku, color_name, color_hex, price, stock_quantity, is_active, created_at, updated_at) ON TABLE public.product_variants TO anon, authenticated;

-- DROP without CASCADE deliberately stops on unexpected dependencies.
DROP VIEW public.storefront_products;
CREATE VIEW public.storefront_products WITH (security_invoker=true) AS
SELECT p.id,
  p.title,
  p.description,
  p.price,
  p.old_price,
  p.image_url,
  p.is_top_seller,
  p.is_featured,
  p.created_at,
  p.category_id,
  p.slug,
  p.brand_id,
  p.long_description,
  p.color_name,
  p.color_hex,
  public.erp_storefront_stock('product', p.id, p.stock_quantity) AS stock_quantity,
  p.is_published,
  p.sku,
  p.popularity_score,
  p.average_rating,
  p.is_serialized,
  p.selling_mode,
  p.expected_availability_date,
  p.availability_message,
  p.preorder_active,
  p.preorder_starts_at,
  p.preorder_ends_at,
  p.preorder_payment_mode,
  p.preorder_deposit_percent,
  p.preorder_total_limit,
  p.preorder_customer_limit,
  p.seo_title,
  p.seo_description,
  p.seo_image_url,
  p.warranty_status,
  p.warranty_duration_value,
  p.warranty_duration_unit
FROM public.products p;
REVOKE ALL ON public.storefront_products FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.storefront_products TO anon, authenticated, service_role;

-- DROP without CASCADE deliberately stops on unexpected dependencies.
DROP VIEW public.storefront_product_variants;
CREATE VIEW public.storefront_product_variants WITH (security_invoker=true) AS
SELECT p.id,
  p.product_id,
  p.name,
  p.code,
  p.sku,
  p.color_name,
  p.color_hex,
  p.price,
  public.erp_storefront_stock('product_variant', p.id, p.stock_quantity) AS stock_quantity,
  p.is_active,
  p.created_at,
  p.updated_at
FROM public.product_variants p;
REVOKE ALL ON public.storefront_product_variants FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.storefront_product_variants TO anon, authenticated, service_role;

-- Browser staff and customers share authenticated. Privileged reads therefore
-- re-check the current JWT identity; there is no caller-supplied actor or SQL.
-- Published rows retain the existing active-commerce-staff access. Draft product
-- access still requires products.view, exactly like security_staff_read.
CREATE FUNCTION public.catalog_staff_products() RETURNS SETOF public.products
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND public.is_active_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Staff catalog access required.' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT p.* FROM public.products p
    WHERE auth.role()='service_role' OR p.is_published
      OR public.has_admin_permission('products.view');
END $$;
CREATE FUNCTION public.catalog_staff_product_variants() RETURNS SETOF public.product_variants
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND public.is_active_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Staff catalog access required.' USING ERRCODE='42501';
  END IF;
  -- Existing product_variants_admin_read permits active staff, including inactive variants.
  RETURN QUERY SELECT v.* FROM public.product_variants v;
END $$;
REVOKE ALL ON FUNCTION public.catalog_staff_products(), public.catalog_staff_product_variants()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_staff_products(), public.catalog_staff_product_variants()
  TO authenticated, service_role;
COMMENT ON FUNCTION public.catalog_staff_products() IS 'Staff-only internal catalog read. JWT identity and existing published/draft permission scope; never grant to anon.';
COMMENT ON FUNCTION public.catalog_staff_product_variants() IS 'Staff-only costs/variant read; matches existing active staff variant policy.';

DO $verify$ DECLARE r text; t text; c text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH t IN ARRAY ARRAY['products','product_variants'] LOOP
      FOREACH c IN ARRAY CASE WHEN t='products'
        THEN ARRAY['cost_price','default_supplier_id','primary_warehouse_id']
        ELSE ARRAY['cost_price'] END LOOP
        IF has_column_privilege(r,'public.'||t,c,'SELECT') THEN
          RAISE EXCEPTION 'Inherited or unexpected confidential SELECT privilege: %.%.%',r,t,c;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $verify$;
NOTIFY pgrst, 'reload schema';
COMMIT;
