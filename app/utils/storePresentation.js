import presentation from '../../config/storefront-presentation.json' with { type: 'json' }

// Reviewed deployment content. Changing a Dashboard image/link invalidates its copy.
export function mobileHeroPresentation(banner, locale) {
  const entry = presentation.mobileHeroes.find(item => item.image === banner?.image_url && item.link === (banner?.link_url || ''))
  return entry ? { ...entry[locale === 'ar' ? 'ar' : 'en'], artSide: entry.artSide, artWidthPercent: entry.artWidthPercent, artVerticalPercent: entry.artVerticalPercent } : null
}

export function homepagePresentation(settings, locale) {
  const copy = presentation.homepage[locale === 'ar' ? 'ar' : 'en']
  return { title: settings?.seo_site_title || copy.title, description: settings?.seo_default_description || copy.description.replaceAll('{store}', settings?.site_name || 'Store') }
}
