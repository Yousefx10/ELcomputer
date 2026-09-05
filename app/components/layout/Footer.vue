<template>
  <footer class="store-footer">
    <div class="store-container">
      <div class="store-footer-cta">
        <div><h2>{{ footerCtaTitle }}</h2><p>{{ footerCtaSubtitle }}</p></div>
        <NuxtLink :to="footerCtaButtonUrl" class="store-button">{{ footerCtaButtonLabel }} <Icon name="lucide:arrow-right" size="16" /></NuxtLink>
      </div>
      <div class="store-footer-main">
        <div class="store-footer-brand">
          <img v-if="siteLogoUrl" :src="siteLogoUrl" :alt="siteName" loading="lazy" />
          <p>{{ siteName }}</p>
          <div class="store-footer-contact">
            <a v-if="footerEmail" :href="`mailto:${footerEmail}`"><Icon name="lucide:mail" size="16" />{{ footerEmail }}</a>
            <a v-if="footerPhone" :href="`tel:${footerPhone}`"><Icon name="lucide:phone" size="16" />{{ footerPhone }}</a>
            <p v-if="footerAddress && footerAddress !== 'address address'">{{ footerAddress }}</p>
          </div>
        </div>
        <div class="store-footer-groups">
          <div v-for="group in footerGroups" :key="group.title">
            <h3>{{ group.title }}</h3>
            <ul>
              <li v-for="item in group.items" :key="item.id">
                <a v-if="item.url && isExternalUrl(item.url)" :href="item.url" target="_blank" rel="noreferrer">{{ item.label }}</a>
                <NuxtLink v-else-if="item.url" :to="item.url">{{ item.label }}</NuxtLink>
                <span v-else>{{ item.label }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <p class="store-footer-bottom">{{ copyrightText }}</p>
    </div>
  </footer>
</template>

<script setup>
const { data: siteContent } = await useSiteContent()

const settings = computed(() => siteContent.value?.settings || {})
const footerLinks = computed(() => siteContent.value?.footerLinks || [])

const siteName = computed(() => settings.value.site_name || 'ELcomputer')
const siteLogoUrl = computed(() => settings.value.site_logo_url || '')
const footerCtaTitle = computed(() => settings.value.footer_cta_title === 'What are you waiting for?' ? 'Browse computer accessories' : (settings.value.footer_cta_title || 'Browse computer accessories'))
const footerCtaSubtitle = computed(() => settings.value.footer_cta_subtitle === 'Purchase your fav gear' ? 'Keyboards, mice, headsets and more.' : (settings.value.footer_cta_subtitle || 'Keyboards, mice, headsets and more.'))
const footerCtaButtonLabel = computed(() => settings.value.footer_cta_button_label || 'Shop Now')
const footerCtaButtonUrl = computed(() => settings.value.footer_cta_button_url === '/' ? '/search' : (settings.value.footer_cta_button_url || '/search'))
const footerEmail = computed(() => settings.value.footer_email || '')
const footerPhone = computed(() => settings.value.footer_phone || '')
const footerAddress = computed(() => settings.value.footer_address || '')
const copyrightText = computed(() => {
  return settings.value.copyright_text || '© 2026 All rights reserved by ELCOMPUTER'
})

const footerGroups = computed(() => {
  const groups = new Map()

  footerLinks.value.forEach((item) => {
    const title = item.section_title?.trim() || 'More'

    if (!groups.has(title)) {
      groups.set(title, [])
    }

    groups.get(title).push(item)
  })

  return Array.from(groups, ([title, items]) => ({ title, items }))
})

const isExternalUrl = (value) => {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}
</script>
