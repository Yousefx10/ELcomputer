BEGIN;

-- Presentation only. Existing deployments stay Classic until an editor selects Modern.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS checkout_style text NOT NULL DEFAULT 'classic';

ALTER TABLE public.site_settings
  ADD CONSTRAINT site_settings_checkout_style_check CHECK (checkout_style IN ('classic', 'modern'));

COMMENT ON COLUMN public.site_settings.checkout_style IS
  'Global checkout layout. Classic preserves the original UI; selection never changes ordering or payment.';

NOTIFY pgrst, 'reload schema';

COMMIT;
