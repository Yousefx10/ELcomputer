<template>
  <footer v-if="isModern" class="store-footer-modern">
    <LayoutModernFooter :settings="settings" :links="footerLinks" />
  </footer>

  <footer v-else class="store-footer">
    <div class="store-container">
      <div v-if="footerCtaTitle || footerCtaSubtitle || footerCtaButtonLabel" class="store-footer-cta">
        <div><h2>{{ footerCtaTitle }}</h2><p>{{ footerCtaSubtitle }}</p></div>
        <NuxtLinkLocale v-if="footerCtaButtonLabel" :to="footerCtaButtonUrl" class="store-button">{{ footerCtaButtonLabel }} <Icon name="lucide:arrow-right" size="16" class="directional-icon" /></NuxtLinkLocale>
      </div>
      <div class="store-footer-main">
        <div class="store-footer-brand">
          <BrandLogo :settings="siteContent?.settings" :alt="siteName" />
          <div class="store-footer-contact">
            <a v-if="footerEmail" :href="`mailto:${footerEmail}`"><Icon name="lucide:mail" size="16" />{{ footerEmail }}</a>
            <a v-if="footerPhone" :href="`tel:${footerPhone}`"><Icon name="lucide:phone" size="16" />{{ footerPhone }}</a>
            <p v-if="footerAddress && footerAddress !== 'address address'">{{ footerAddress }}</p>
          </div>
        </div>
        <div class="store-footer-groups">
          <div>
            <h3>{{ $t('common.support') }}</h3>
            <ul>
              <li><NuxtLinkLocale to="/help">{{ $t('common.helpCenter') }}</NuxtLinkLocale></li>
              <li><NuxtLinkLocale to="/account/support">{{ $t('common.myTickets') }}</NuxtLinkLocale></li>
            </ul>
          </div>
          <div v-for="group in footerGroups" :key="group.title">
            <h3>{{ group.title }}</h3>
            <ul>
              <li v-for="item in group.items" :key="item.id">
                <a v-if="item.url && isExternalUrl(item.url)" :href="item.url" target="_blank" rel="noreferrer">{{ item.id?.startsWith('default-') ? $uiLabel(item.label) : item.label }}</a>
                <NuxtLinkLocale v-else-if="item.url" :to="item.url">{{ item.id?.startsWith('default-') ? $uiLabel(item.label) : item.label }}</NuxtLinkLocale>
                <span v-else>{{ item.id?.startsWith('default-') ? $uiLabel(item.label) : item.label }}</span>
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
const { uiLabel } = useUiLocale()

import { isExternalStoreLink } from '~/utils/storefront'

const { data: siteContent } = await useSiteContent()

const settings = computed(() => siteContent.value?.settings || {})
const footerLinks = computed(() => siteContent.value?.footerLinks || [])

const isModern = computed(() => settings.value.footer_style === 'modern')
const siteName = computed(() => settings.value.site_name || 'Store')
const footerCtaTitle = computed(() => settings.value.footer_cta_title === 'What are you waiting for?' ? uiLabel('Browse computer accessories') : (settings.value.footer_cta_title || ''))
const footerCtaSubtitle = computed(() => settings.value.footer_cta_subtitle === 'Purchase your fav gear' ? uiLabel('Keyboards, mice, headsets and more.') : (settings.value.footer_cta_subtitle || ''))
const footerCtaButtonLabel = computed(() => settings.value.footer_cta_button_label || '')
const footerCtaButtonUrl = computed(() => settings.value.footer_cta_button_url === '/' ? '/search' : (settings.value.footer_cta_button_url || '/search'))
const footerEmail = computed(() => settings.value.footer_email || '')
const footerPhone = computed(() => settings.value.footer_phone || '')
const footerAddress = computed(() => settings.value.footer_address || '')
const copyrightText = computed(() => settings.value.copyright_text || '')

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

const isExternalUrl = value => isExternalStoreLink(value)
</script>
