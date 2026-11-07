BEGIN;

-- Presentation only. The current selection is unchanged; Modern is opt-in.
ALTER TABLE public.site_settings DROP CONSTRAINT site_settings_product_page_style_check;
ALTER TABLE public.site_settings
  ADD CONSTRAINT site_settings_product_page_style_check
    CHECK (product_page_style IN ('classic', 'premium', 'modern'));

COMMENT ON COLUMN public.site_settings.product_page_style IS
  'Global product presentation: classic, premium or modern. Selection never activates commerce.';

NOTIFY pgrst, 'reload schema';

COMMIT;
