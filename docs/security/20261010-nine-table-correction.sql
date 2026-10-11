-- REVIEW DRAFT. Production execution is NOT authorized. Only nine tables.
-- Requires explicit future approval, current backup and unchanged checkpoint.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=public,extensions;
DO $guard$ BEGIN IF current_setting('elcomputer.security_remediation_approved',true) IS DISTINCT FROM '20261010-nine-tables' THEN RAISE EXCEPTION 'Explicit security-remediation approval required'; END IF; END $guard$;
LOCK TABLE public."brands",public."categories",public."product_images",public."product_specifications",public."products",public."site_hero_banners",public."site_links",public."site_settings",public."site_top_bar_messages" IN ACCESS EXCLUSIVE MODE;
DO $baseline$ BEGIN IF encode(sha256(convert_to((jsonb_build_object(
 'tables',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'forced',c.relforcerowsecurity,'acl',(SELECT jsonb_agg(item::text ORDER BY item::text) FROM unnest(c.relacl) item),
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',attname,'acl',attacl) ORDER BY attnum) FROM pg_attribute WHERE attrelid=c.oid AND attnum>0 AND NOT attisdropped),
 'policies',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY policyname),'[]'::jsonb) FROM pg_policies p WHERE schemaname='public' AND tablename=c.relname)) ORDER BY c.relname) FROM pg_class c WHERE relnamespace='public'::regnamespace AND relname IN ('site_settings','site_hero_banners','site_links','site_top_bar_messages','products','product_images','product_specifications','brands','categories')),
 'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'super',rolsuper,'bypass',rolbypassrls,'inherit',rolinherit) ORDER BY rolname) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role','authenticator','postgres')),
 'memberships',(SELECT jsonb_agg(jsonb_build_object('role',pg_get_userbyid(roleid),'member',pg_get_userbyid(member),'inherit',inherit_option,'set',set_option,'admin',admin_option) ORDER BY pg_get_userbyid(roleid),pg_get_userbyid(member)) FROM pg_auth_members WHERE member IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role','authenticator'))),
 'staffHelper',(SELECT pg_get_functiondef('public.has_admin_permission(text)'::regprocedure)),
 'migrations',(SELECT jsonb_agg(jsonb_build_object('version',version,'name',name) ORDER BY version) FROM supabase_migrations.schema_migrations)
))::text,'UTF8')),'hex') <> '24d81f61f07293337f3c37497ccb71e0e57e121394edcb203620fba1bda65dee' THEN RAISE EXCEPTION 'Authorization or migration checkpoint changed; repeat read-only audit'; END IF; END $baseline$;
-- brands
ALTER TABLE public."brands" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."brands" FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public."brands" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."brands" TO authenticated;
DROP POLICY "brands_authenticated_full_access" ON public."brands";
DROP POLICY "brands_public_read" ON public."brands";
CREATE POLICY security_public_read ON public."brands" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY security_staff_read ON public."brands" FOR SELECT TO authenticated USING (public.has_admin_permission('brands.view'));
CREATE POLICY security_staff_insert ON public."brands" FOR INSERT TO authenticated WITH CHECK (public.has_admin_permission('brands.view') AND public.has_admin_permission('brands.add'));
CREATE POLICY security_staff_update ON public."brands" FOR UPDATE TO authenticated USING (public.has_admin_permission('brands.view') AND public.has_admin_permission('brands.edit')) WITH CHECK (public.has_admin_permission('brands.view') AND public.has_admin_permission('brands.edit'));
CREATE POLICY security_staff_delete ON public."brands" FOR DELETE TO authenticated USING (public.has_admin_permission('brands.view') AND public.has_admin_permission('brands.edit'));
-- categories
ALTER TABLE public."categories" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."categories" FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public."categories" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."categories" TO authenticated;
DROP POLICY "categories_authenticated_full_access" ON public."categories";
DROP POLICY "categories_public_read" ON public."categories";
CREATE POLICY security_public_read ON public."categories" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY security_staff_read ON public."categories" FOR SELECT TO authenticated USING (public.has_admin_permission('categories.view'));
CREATE POLICY security_staff_insert ON public."categories" FOR INSERT TO authenticated WITH CHECK (public.has_admin_permission('categories.view') AND public.has_admin_permission('categories.add'));
CREATE POLICY security_staff_update ON public."categories" FOR UPDATE TO authenticated USING (public.has_admin_permission('categories.view') AND public.has_admin_permission('categories.edit')) WITH CHECK (public.has_admin_permission('categories.view') AND public.has_admin_permission('categories.edit'));
CREATE POLICY security_staff_delete ON public."categories" FOR DELETE TO authenticated USING (public.has_admin_permission('categories.view') AND public.has_admin_permission('categories.edit'));
-- product_images
ALTER TABLE public."product_images" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."product_images" FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public."product_images" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."product_images" TO authenticated;
DROP POLICY "Public can read images for published products" ON public."product_images";
DROP POLICY "product_images_authenticated_full_access" ON public."product_images";
DROP POLICY "product_images_public_read_published" ON public."product_images";
CREATE POLICY security_public_read ON public."product_images" FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.products p JOIN public.product_variants v ON v.product_id=p.id AND v.id=product_images.variant_id AND v.is_active WHERE p.id=product_images.product_id AND p.is_published = true));
CREATE POLICY security_staff_read ON public."product_images" FOR SELECT TO authenticated USING (public.has_admin_permission('products.view'));
CREATE POLICY security_staff_insert ON public."product_images" FOR INSERT TO authenticated WITH CHECK (public.has_admin_permission('products.view') AND public.has_admin_permission('products.edit'));
CREATE POLICY security_staff_update ON public."product_images" FOR UPDATE TO authenticated USING (public.has_admin_permission('products.view') AND public.has_admin_permission('products.edit')) WITH CHECK (public.has_admin_permission('products.view') AND public.has_admin_permission('products.edit'));
CREATE POLICY security_staff_delete ON public."product_images" FOR DELETE TO authenticated USING (public.has_admin_permission('products.view') AND public.has_admin_permission('products.edit'));
-- product_specifications
ALTER TABLE public."product_specifications" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."product_specifications" FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public."product_specifications" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."product_specifications" TO authenticated;
DROP POLICY "product_specs_authenticated_full_access" ON public."product_specifications";
DROP POLICY "product_specs_public_read_published" ON public."product_specifications";
CREATE POLICY security_public_read ON public."product_specifications" FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_specifications.product_id AND p.is_published = true));
CREATE POLICY security_staff_read ON public."product_specifications" FOR SELECT TO authenticated USING (public.has_admin_permission('products.view'));
CREATE POLICY security_staff_insert ON public."product_specifications" FOR INSERT TO authenticated WITH CHECK (public.has_admin_permission('products.view') AND public.has_admin_permission('products.edit'));
CREATE POLICY security_staff_update ON public."product_specifications" FOR UPDATE TO authenticated USING (public.has_admin_permission('products.view') AND public.has_admin_permission('products.edit')) WITH CHECK (public.has_admin_permission('products.view') AND public.has_admin_permission('products.edit'));
CREATE POLICY security_staff_delete ON public."product_specifications" FOR DELETE TO authenticated USING (public.has_admin_permission('products.view') AND public.has_admin_permission('products.edit'));
-- products
ALTER TABLE public."products" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."products" FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public."products" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."products" TO authenticated;
DROP POLICY "Anyone can read products" ON public."products";
DROP POLICY "Authenticated users can delete products" ON public."products";
DROP POLICY "Authenticated users can insert products" ON public."products";
DROP POLICY "Authenticated users can update products" ON public."products";
DROP POLICY "products_authenticated_full_access" ON public."products";
DROP POLICY "products_public_read_published" ON public."products";
CREATE POLICY security_public_read ON public."products" FOR SELECT TO anon, authenticated USING (is_published = true);
CREATE POLICY security_staff_read ON public."products" FOR SELECT TO authenticated USING (public.has_admin_permission('products.view'));
CREATE POLICY security_staff_insert ON public."products" FOR INSERT TO authenticated WITH CHECK (public.has_admin_permission('products.view') AND public.has_admin_permission('products.add'));
CREATE POLICY security_staff_update ON public."products" FOR UPDATE TO authenticated USING (public.has_admin_permission('products.view') AND public.has_admin_permission('products.edit')) WITH CHECK (public.has_admin_permission('products.view') AND public.has_admin_permission('products.edit'));
CREATE POLICY security_staff_delete ON public."products" FOR DELETE TO authenticated USING (public.has_admin_permission('products.view') AND public.has_admin_permission('products.edit'));
-- site_hero_banners
ALTER TABLE public."site_hero_banners" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."site_hero_banners" FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public."site_hero_banners" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."site_hero_banners" TO authenticated;
CREATE POLICY security_public_read ON public."site_hero_banners" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY security_staff_read ON public."site_hero_banners" FOR SELECT TO authenticated USING (public.has_admin_permission('settings.view'));
CREATE POLICY security_staff_insert ON public."site_hero_banners" FOR INSERT TO authenticated WITH CHECK (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
CREATE POLICY security_staff_update ON public."site_hero_banners" FOR UPDATE TO authenticated USING (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit')) WITH CHECK (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
CREATE POLICY security_staff_delete ON public."site_hero_banners" FOR DELETE TO authenticated USING (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
-- site_links
ALTER TABLE public."site_links" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."site_links" FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public."site_links" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."site_links" TO authenticated;
CREATE POLICY security_public_read ON public."site_links" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY security_staff_read ON public."site_links" FOR SELECT TO authenticated USING (public.has_admin_permission('settings.view'));
CREATE POLICY security_staff_insert ON public."site_links" FOR INSERT TO authenticated WITH CHECK (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
CREATE POLICY security_staff_update ON public."site_links" FOR UPDATE TO authenticated USING (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit')) WITH CHECK (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
CREATE POLICY security_staff_delete ON public."site_links" FOR DELETE TO authenticated USING (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
-- site_settings
ALTER TABLE public."site_settings" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."site_settings" FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public."site_settings" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."site_settings" TO authenticated;
CREATE POLICY security_public_read ON public."site_settings" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY security_staff_read ON public."site_settings" FOR SELECT TO authenticated USING (public.has_admin_permission('settings.view'));
CREATE POLICY security_staff_insert ON public."site_settings" FOR INSERT TO authenticated WITH CHECK (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
CREATE POLICY security_staff_update ON public."site_settings" FOR UPDATE TO authenticated USING (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit')) WITH CHECK (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
CREATE POLICY security_staff_delete ON public."site_settings" FOR DELETE TO authenticated USING (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
-- site_top_bar_messages
ALTER TABLE public."site_top_bar_messages" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."site_top_bar_messages" FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public."site_top_bar_messages" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."site_top_bar_messages" TO authenticated;
CREATE POLICY security_public_read ON public."site_top_bar_messages" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY security_staff_read ON public."site_top_bar_messages" FOR SELECT TO authenticated USING (public.has_admin_permission('settings.view'));
CREATE POLICY security_staff_insert ON public."site_top_bar_messages" FOR INSERT TO authenticated WITH CHECK (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
CREATE POLICY security_staff_update ON public."site_top_bar_messages" FOR UPDATE TO authenticated USING (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit')) WITH CHECK (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
CREATE POLICY security_staff_delete ON public."site_top_bar_messages" FOR DELETE TO authenticated USING (public.has_admin_permission('settings.view') AND public.has_admin_permission('settings.edit'));
NOTIFY pgrst, 'reload schema';
COMMIT;
