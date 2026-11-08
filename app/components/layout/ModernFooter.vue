<template>
  <div v-if="mainSections" class="store-footer-modern-upper">
    <div class="store-container store-footer-modern-main" :data-sections="mainSections" :class="{ 'has-brand': config.brand.enabled, 'has-navigation': columns.length, 'has-newsletter': hasNewsletter }">
      <section v-if="config.brand.enabled" class="store-footer-modern-brand" :aria-label="siteName">
        <NuxtLinkLocale to="/" class="store-footer-modern-logo" :aria-label="siteName"><BrandLogo :settings="logos" :alt="siteName" /></NuxtLinkLocale>
        <div class="store-footer-modern-brand-copy">
          <p v-if="copy(config.brand, 'description')" class="store-footer-modern-description">{{ copy(config.brand, 'description') }}</p>
          <div v-if="config.brand.social_enabled && socials.length" class="store-footer-modern-socials">
            <p v-if="copy(config.brand, 'social_heading')">{{ copy(config.brand, 'social_heading') }}</p>
            <ul><li v-for="item in socials" :key="item.id"><a :href="footerUrl(item.url, 'external')" :aria-label="item.label" target="_blank" rel="noopener noreferrer"><LayoutFooterSocialIcon :platform="item.platform" /></a></li></ul>
          </div>
          <div class="store-footer-contact">
            <a v-if="footerUrl(`mailto:${settings.footer_email || ''}`, 'contact')" :href="`mailto:${settings.footer_email}`"><Icon name="lucide:mail" size="16" />{{ settings.footer_email }}</a>
            <a v-if="footerUrl(`tel:${String(settings.footer_phone || '').replace(/[^+\d]/g, '')}`, 'contact')" :href="`tel:${String(settings.footer_phone).replace(/[^+\d]/g, '')}`"><Icon name="lucide:phone" size="16" />{{ settings.footer_phone }}</a>
          </div>
        </div>
      </section>
      <div v-if="columns.length" class="store-footer-modern-navigation" :style="{ '--footer-nav-count': columns.length }">
        <nav v-for="(column, index) in columns" :key="index" class="store-footer-modern-group" :aria-label="copy(column, 'title') || $t('modernFooter.navigation')">
          <h2 v-if="copy(column, 'title')">{{ copy(column, 'title') }}</h2>
          <ul><li v-for="item in column.links" :key="item.id"><LayoutFooterLink :url="item.url" :label="copy(item, 'label')" :badge="copy(item, 'badge')" /></li></ul>
        </nav>
      </div>
      <section v-if="hasNewsletter" class="store-footer-modern-newsletter" aria-labelledby="footer-newsletter-heading">
        <h2 id="footer-newsletter-heading">{{ copy(config.newsletter, 'title') || $t('modernFooter.newsletter') }}</h2>
        <p v-if="copy(config.newsletter, 'description')">{{ copy(config.newsletter, 'description') }}</p>
        <p id="footer-newsletter-status" class="store-footer-modern-unavailable">{{ $t('modernFooter.newsletterUnavailable') }}</p>
      </section>
    </div>
  </div>
  <div v-if="utilityCount || hasBottom" class="store-footer-modern-lower" :data-utilities="utilityCount" :class="{ 'has-bottom': hasBottom }">
    <div class="store-container store-footer-modern-lower-inner">
  <div v-if="utilityCount" class="store-footer-modern-utility">
    <div class="store-footer-modern-utility-grid" :class="{ 'store-footer-modern-utility-three': hasSupport && apps.length && payments.length }" :style="{ '--footer-utility-count': Number(hasSupport) + Number(!!apps.length) + Number(!!payments.length) }">
      <section v-if="hasSupport" class="store-footer-modern-support" :aria-label="$t('modernFooter.support')">
        <span class="store-footer-modern-support-icon"><Icon name="lucide:headset" size="24" aria-hidden="true" /></span>
        <div><p v-if="copy(config.support, 'hours')">{{ copy(config.support, 'hours') }}</p><LayoutFooterLink v-if="copy(config.support, 'label')" :url="config.support.url" :label="copy(config.support, 'label')" /></div>
      </section>
      <section v-if="apps.length" class="store-footer-modern-apps" :aria-label="$t('modernFooter.appDownloads')">
        <div><h2 v-if="copy(config.apps, 'title')">{{ copy(config.apps, 'title') }}</h2><p v-if="copy(config.apps, 'description')">{{ copy(config.apps, 'description') }}</p></div>
        <div class="store-footer-modern-app-badges"><a v-for="item in apps" :key="item.id" :href="footerUrl(item.url, 'external')" target="_blank" rel="noopener noreferrer"><img :src="footerUrl(item.image_url)" :alt="item.platform === 'apple' ? $t('modernFooter.appStore') : $t('modernFooter.googlePlay')" loading="lazy" width="136" height="42"></a></div>
      </section>
      <LayoutFooterPayments v-if="payments.length" :settings="settings" />
    </div>
  </div>
  <div v-if="hasBottom" class="store-footer-modern-bottom">
    <div class="store-footer-modern-bottom-inner">
      <p v-if="copyright">{{ copyright }}</p>
      <ClientOnly><PrivacyPreferencesLink /></ClientOnly>
      <nav v-if="legalLinks.length" :aria-label="$t('modernFooter.legalLinks')"><ul><li v-for="item in legalLinks" :key="item.id"><LayoutFooterLink :url="item.url" :label="copy(item, 'label')" /></li></ul></nav>
    </div>
  </div>
    </div>
  </div>
</template>

<script setup>
import { resolveModernFooter, footerText, footerUrl, footerSocialIcons, visibleFooterPayments } from '~/utils/modernFooter'
const props = defineProps({ settings: { type: Object, required: true }, links: { type: Array, default: () => [] } })
const { locale } = useI18n()
const year = useState('footer-current-year', () => new Date().getUTCFullYear())
const config = computed(() => resolveModernFooter(props.settings, props.links))
const copy = (source, key) => footerText(source, key, locale.value)
const siteName = computed(() => props.settings.site_name || 'Store')
const logos = computed(() => config.value.brand.logo_url || config.value.brand.logo_dark_url ? { site_logo_url: footerUrl(config.value.brand.logo_url), site_logo_light_url: footerUrl(config.value.brand.logo_url), site_logo_dark_url: footerUrl(config.value.brand.logo_dark_url) } : props.settings)
const visibleLinks = links => links.filter(item => item.enabled && footerUrl(item.url) && copy(item, 'label'))
const columns = computed(() => config.value.columns.filter(column => column.enabled).map(column => ({ ...column, links: visibleLinks(column.links) })).filter(column => column.links.length))
const hasNewsletter = computed(() => config.value.newsletter.state === 'disabled')
const mainSections = computed(() => Number(config.value.brand.enabled) + Number(!!columns.value.length) + Number(hasNewsletter.value))
const socials = computed(() => config.value.brand.socials.filter(item => item.enabled && item.label && footerUrl(item.url, 'external')))
const hasSupport = computed(() => config.value.support.enabled && !!(copy(config.value.support, 'hours') || copy(config.value.support, 'label')))
const apps = computed(() => config.value.apps.enabled ? config.value.apps.items.filter(item => item.enabled && footerUrl(item.url, 'external') && footerUrl(item.image_url)) : [])
const { capabilities, purchasingEnabled, refresh } = usePurchaseAccess()
onMounted(refresh)
const payments = computed(() => purchasingEnabled.value ? visibleFooterPayments(config.value, props.settings, capabilities.value) : [])
const legalLinks = computed(() => visibleLinks(config.value.bottom.links))
const utilityCount = computed(() => Number(hasSupport.value) + Number(!!apps.value.length) + Number(!!payments.value.length))
const hasBottom = computed(() => config.value.bottom.enabled && !!(copyright.value || legalLinks.value.length))
const copyright = computed(() => [copy(config.value.bottom, 'copyright'), config.value.bottom.show_year ? year.value : ''].filter(Boolean).join(' '))
</script>
