export const dashboardSettingsSections = [
  { key: 'general', section: 'generalSettings', label: 'Store details', group: 'Store', icon: 'lucide:store', description: 'Store name, logo, colors and stock settings.' },
  { key: 'homepage-reviews', section: 'homepageReviews', label: 'Homepage reviews', group: 'Homepage', icon: 'lucide:messages-square', description: 'Choose whether reviews appear on the home page.' },
  { key: 'offers', section: 'offerCards', label: 'Offer cards', group: 'Homepage', icon: 'lucide:ticket-percent', description: 'Create promotional cards with images and links.' },
  { key: 'announcements', section: 'topBarTexts', label: 'Announcements', group: 'Homepage', icon: 'lucide:megaphone', description: 'Edit the messages shown above the store header.' },
  { key: 'hero', section: 'heroBanners', label: 'Hero banners', group: 'Homepage', icon: 'lucide:panels-top-left', description: 'Upload and arrange the main home-page banners.' },
  { key: 'banners', section: 'bannerAds', label: 'Banner ads', group: 'Homepage', icon: 'lucide:rectangle-horizontal', description: 'Add promotions between the main home-page sections.' },
  { key: 'header', section: 'headerLinks', label: 'Header links', group: 'Navigation & footer', icon: 'lucide:panel-top', description: 'Choose the links shown in the store header.' },
  { key: 'footer', section: 'footerSettings', label: 'Footer content', group: 'Navigation & footer', icon: 'lucide:panel-bottom', description: 'Edit contact details and the footer call to action.' },
  { key: 'footer-links', section: 'footerLinks', label: 'Footer links', group: 'Navigation & footer', icon: 'lucide:link', description: 'Organize the links at the bottom of the store.' },
  { key: 'layout', section: 'dashboardLayout', label: 'Dashboard appearance', group: 'Administration', icon: 'lucide:panel-right', description: 'Switch between the Classic and Modern dashboard.' },
  { key: 'account-dashboard', section: 'accountDashboard', label: 'Customer account', group: 'Store', icon: 'lucide:user-round-cog', description: 'Choose the customer account layout.' },
  { key: 'erp', label: 'ERP connection', group: 'Administration', icon: 'lucide:cloud-cog', description: 'Use the built-in tools or connect Daftra.' },
  { key: 'gallery', label: 'Media library', group: 'Store', icon: 'lucide:images', description: 'Browse and remove uploaded images.' },
  { key: 'coupons', label: 'Coupons', group: 'Store', icon: 'lucide:badge-percent', permission: 'settings.coupons', description: 'Manage discount codes and expiry dates.' },
  { key: 'reset', label: 'Reset system', group: 'Administration', icon: 'lucide:rotate-ccw', role: 'owner', description: 'Clear selected website data. Owner confirmation is required.' },
  { key: 'logs', label: 'Activity log', group: 'Administration', icon: 'lucide:scroll-text', description: 'Review changes made by dashboard users.' }
].map(item => ({ ...item, permission: item.permission || 'settings.view', to: `/dashboard/settings?tab=${item.key}` }))
