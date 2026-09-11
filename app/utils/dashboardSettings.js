export const dashboardSettingsSections = [
  { key: 'general', section: 'generalSettings', label: 'Store details', group: 'Store', icon: 'lucide:store', description: 'Store name, logo, background and stock rules.' },
  { key: 'homepage-reviews', section: 'homepageReviews', label: 'Homepage reviews', group: 'Homepage', icon: 'lucide:messages-square', description: 'Show customer reviews and the link to all reviews.' },
  { key: 'offers', section: 'offerCards', label: 'Offer cards', group: 'Homepage', icon: 'lucide:ticket-percent', description: 'Add offers with images and product links.' },
  { key: 'announcements', section: 'topBarTexts', label: 'Announcements', group: 'Homepage', icon: 'lucide:megaphone', description: 'Messages at the top of the store.' },
  { key: 'hero', section: 'heroBanners', label: 'Hero banners', group: 'Homepage', icon: 'lucide:panels-top-left', description: 'Main homepage images and their rotation speed.' },
  { key: 'banners', section: 'bannerAds', label: 'Banner ads', group: 'Homepage', icon: 'lucide:rectangle-horizontal', description: 'Images between homepage product sections.' },
  { key: 'header', section: 'headerLinks', label: 'Header links', group: 'Navigation & footer', icon: 'lucide:panel-top', description: 'Links in the main store menu.' },
  { key: 'footer', section: 'footerSettings', label: 'Footer content', group: 'Navigation & footer', icon: 'lucide:panel-bottom', description: 'Contact details, footer heading and button.' },
  { key: 'footer-links', section: 'footerLinks', label: 'Footer links', group: 'Navigation & footer', icon: 'lucide:link', description: 'Group and arrange links at the bottom of the store.' },
  { key: 'layout', section: 'dashboardLayout', label: 'Dashboard layout', group: 'Administration', icon: 'lucide:panel-right', description: 'Choose top navigation or a sidebar.' },
  { key: 'erp', label: 'ERP connection', group: 'Administration', icon: 'lucide:cloud-cog', description: 'Choose built-in ERP or connect Daftra.' },
  { key: 'gallery', label: 'Media library', group: 'Store', icon: 'lucide:images', description: 'Find and manage uploaded images.' },
  { key: 'coupons', label: 'Coupons', group: 'Store', icon: 'lucide:badge-percent', permission: 'settings.coupons', description: 'Discount codes, limits and expiry dates.' },
  { key: 'reset', label: 'Reset system', group: 'Administration', icon: 'lucide:rotate-ccw', role: 'owner', description: 'Reset website data with owner password confirmation.' },
  { key: 'logs', label: 'Activity log', group: 'Administration', icon: 'lucide:scroll-text', description: 'See who changed what and when.' }
].map(item => ({ ...item, permission: item.permission || 'settings.view', to: `/dashboard/settings?tab=${item.key}` }))
