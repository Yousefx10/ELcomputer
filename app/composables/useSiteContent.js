import { defaultSiteSettings, siteContentRows } from '~/utils/siteContentDefaults'
import { buildOrderedHeaderLinks } from '~/utils/siteLinks'


const isMissingTableError = (error) => error?.code === '42P01'

export const useSiteContent = () => {
  const supabase = useSupabaseClient()

  return useAsyncData('site-content', async () => {
    const [settingsResult, heroBannersResult, topBarMessagesResult, siteLinksResult, offerCardsResult, sitePagesResult, categoriesResult] = import.meta.server
      ? await $fetch('/api/storefront/content')
      : await Promise.all([
          supabase
            .from('site_settings')
            .select('*')
            .eq('key', 'default')
            .maybeSingle(),
          supabase
            .from('site_hero_banners')
            .select('*')
            .order('sort_order')
            .order('created_at'),
          supabase
            .from('site_top_bar_messages')
            .select('*')
            .order('sort_order')
            .order('created_at'),
          supabase
            .from('site_links')
            .select('*')
            .order('location')
            .order('section_title')
            .order('sort_order')
            .order('created_at'),
          supabase
            .from('site_offer_cards')
            .select('*')
            .order('sort_order')
            .order('created_at'),
          supabase
            .from('site_pages')
            .select('id, title, path')
            .eq('is_published', true)
            .eq('show_in_navbar', true)
            .order('created_at'),
          supabase
            .from('categories')
            .select('id, name, name_ar, slug')
            .order('name')
        ])

    const settings = !settingsResult.error || isMissingTableError(settingsResult.error)
      ? {
          ...defaultSiteSettings,
          ...(settingsResult.data || {})
        }
      : defaultSiteSettings

    const heroBanners = siteContentRows(heroBannersResult)
    const topBarMessages = siteContentRows(topBarMessagesResult)
    const siteLinks = siteContentRows(siteLinksResult)
    const offerCards = siteContentRows(offerCardsResult)

    const customPages = sitePagesResult.error
      ? []
      : (sitePagesResult.data || [])

    const orderedHeaderLinks = (siteLinks.length ? buildOrderedHeaderLinks(siteLinks) : [])
      .filter((link) => link.is_enabled ?? true)

    return {
      settings,
      heroBanners: heroBanners.filter((banner) => banner.is_enabled ?? true),
      topBarMessages: topBarMessages.filter((message) => message.is_enabled ?? true),
      offerCards: offerCards.filter((offerCard) => offerCard.is_enabled ?? true),
      headerLinks: orderedHeaderLinks,
      customPages,
      navbarCategories: categoriesResult.error ? [] : (categoriesResult.data || []),
      footerLinks: siteLinks.filter((link) => link.location === 'footer' && (link.is_enabled ?? true))
    }
  })
}
