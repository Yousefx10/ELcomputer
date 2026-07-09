const defaultSiteSettings = {
  key: 'default',
  site_name: 'ELcomputer',
  site_logo_url: '',
  hero_enabled: true,
  top_bar_rotation_seconds: 3,
  banner_ad_1_image_url: '',
  banner_ad_1_link_url: '',
  banner_ad_2_image_url: '',
  banner_ad_2_link_url: '',
  footer_cta_title: 'What are you waiting for?',
  footer_cta_subtitle: 'Purchase your fav gear',
  footer_cta_button_label: 'Shop Now',
  footer_cta_button_url: '/',
  footer_email: 'info@elcomputer.net',
  footer_phone: '01505121684',
  footer_address: 'address address',
  copyright_text: '© 2026 All rights reserved by ELCOMPUTER'
}

const defaultHeroBanners = [
  {
    id: 'default-hero-banner',
    image_url: 'https://placehold.co/1000x250',
    link_url: null,
    is_enabled: true
  }
]

const defaultTopBarMessages = [
  {
    id: 'default-top-bar-message',
    text: 'Pretty Cool Text Around',
    is_enabled: true
  }
]

const defaultSiteLinks = [
  { id: 'header-home', location: 'header', section_title: null, label: 'Home', url: '/', is_enabled: true },
  { id: 'header-shop-category', location: 'header', section_title: null, label: 'Shop Category', url: '/', is_enabled: true },
  { id: 'header-return-policy', location: 'header', section_title: null, label: 'Return Policy', url: '/', is_enabled: true },
  { id: 'header-request-refund', location: 'header', section_title: null, label: 'Request Refund', url: '/', is_enabled: true },
  { id: 'header-tool-kit', location: 'header', section_title: null, label: 'Tool Kit', url: '/', is_enabled: true },
  { id: 'footer-shop-browse', location: 'footer', section_title: 'Shop', label: 'Browse', url: '/', is_enabled: true },
  { id: 'footer-shop-keyboards', location: 'footer', section_title: 'Shop', label: 'Keyboards', url: '/', is_enabled: true },
  { id: 'footer-shop-mice', location: 'footer', section_title: 'Shop', label: 'Mice', url: '/', is_enabled: true },
  { id: 'footer-support-contact', location: 'footer', section_title: 'Support', label: 'Contact us', url: '/', is_enabled: true },
  { id: 'footer-support-track', location: 'footer', section_title: 'Support', label: 'Track Order', url: '/', is_enabled: true },
  { id: 'footer-connect-instagram', location: 'footer', section_title: 'Connect', label: 'Instagram', url: '/', is_enabled: true },
  { id: 'footer-connect-youtube', location: 'footer', section_title: 'Connect', label: 'YouTube', url: '/', is_enabled: true }
]

const isMissingTableError = (error) => error?.code === '42P01'

export const useSiteContent = () => {
  const supabase = useSupabaseClient()

  return useAsyncData('site-content', async () => {
    const [settingsResult, heroBannersResult, topBarMessagesResult, siteLinksResult] = await Promise.all([
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
        .order('created_at')
    ])

    const settings = !settingsResult.error || isMissingTableError(settingsResult.error)
      ? {
          ...defaultSiteSettings,
          ...(settingsResult.data || {})
        }
      : defaultSiteSettings

    const heroBanners = heroBannersResult.error && !isMissingTableError(heroBannersResult.error)
      ? defaultHeroBanners
      : (heroBannersResult.data?.length ? heroBannersResult.data : defaultHeroBanners)

    const topBarMessages = topBarMessagesResult.error && !isMissingTableError(topBarMessagesResult.error)
      ? defaultTopBarMessages
      : (topBarMessagesResult.data?.length ? topBarMessagesResult.data : defaultTopBarMessages)

    const siteLinks = siteLinksResult.error && !isMissingTableError(siteLinksResult.error)
      ? defaultSiteLinks
      : (siteLinksResult.data?.length ? siteLinksResult.data : defaultSiteLinks)

    return {
      settings,
      heroBanners: heroBanners.filter((banner) => banner.is_enabled ?? true),
      topBarMessages: topBarMessages.filter((message) => message.is_enabled ?? true),
      headerLinks: siteLinks.filter((link) => link.location === 'header' && (link.is_enabled ?? true)),
      footerLinks: siteLinks.filter((link) => link.location === 'footer' && (link.is_enabled ?? true))
    }
  })
}
