<template>
  <div class="store-footer-modern-upper">
    <div class="store-container store-footer-modern-main">
      <section v-if="config.brand.enabled" class="store-footer-modern-brand" :aria-label="siteName">
        <NuxtLinkLocale to="/" class="store-footer-modern-logo" :aria-label="siteName"><BrandLogo :settings="logos" :alt="siteName" /></NuxtLinkLocale>
        <p v-if="copy(config.brand, 'description')" class="store-footer-modern-description">{{ copy(config.brand, 'description') }}</p>
        <div v-if="config.brand.social_enabled && socials.length" class="store-footer-modern-socials">
          <p v-if="copy(config.brand, 'social_heading')">{{ copy(config.brand, 'social_heading') }}</p>
          <ul><li v-for="item in socials" :key="item.id"><a :href="footerUrl(item.url, 'external')" :aria-label="item.label" target="_blank" rel="noopener noreferrer"><Icon :name="footerSocialIcons[item.platform]" size="21" aria-hidden="true" /></a></li></ul>
        </div>
      </section>
      <template v-for="(column, index) in config.columns" :key="index">
        <nav v-if="column.enabled && (copy(column, 'title') || column.links.length)" class="store-footer-modern-group" :aria-label="copy(column, 'title') || $t('modernFooter.navigation')">
          <h2 v-if="copy(column, 'title')">{{ copy(column, 'title') }}</h2>
          <ul><li v-for="item in visibleLinks(column.links)" :key="item.id"><LayoutFooterLink :url="item.url" :label="copy(item, 'label')" :badge="copy(item, 'badge')" /></li></ul>
        </nav>
      </template>
      <section v-if="config.newsletter.state === 'disabled'" class="store-footer-modern-newsletter" aria-labelledby="footer-newsletter-heading">
        <h2 id="footer-newsletter-heading">{{ copy(config.newsletter, 'title') || $t('modernFooter.newsletter') }}</h2>
        <p v-if="copy(config.newsletter, 'description')">{{ copy(config.newsletter, 'description') }}</p>
        <p id="footer-newsletter-status" class="store-footer-modern-unavailable">{{ $t('modernFooter.newsletterUnavailable') }}</p>
        <form aria-describedby="footer-newsletter-status" @submit.prevent>
          <fieldset disabled>
            <label class="sr-only" for="footer-newsletter-email">{{ $t('modernFooter.email') }}</label>
            <input id="footer-newsletter-email" type="email" :placeholder="copy(config.newsletter, 'placeholder') || $t('modernFooter.email')" autocomplete="off">
            <button type="submit">{{ copy(config.newsletter, 'button') || $t('modernFooter.subscribe') }}</button>
          </fieldset>
        </form>
      </section>
    </div>
  </div>
  <div v-if="hasSupport || apps.length || payments.length" class="store-footer-modern-utility">
    <div class="store-container store-footer-modern-utility-grid" :class="{ 'store-footer-modern-utility-three': hasSupport && apps.length && payments.length }" :style="{ '--footer-utility-count': Number(hasSupport) + Number(!!apps.length) + Number(!!payments.length) }">
      <section v-if="hasSupport" class="store-footer-modern-support" :aria-label="$t('modernFooter.support')">
        <span class="store-footer-modern-support-icon"><Icon name="lucide:headset" size="24" aria-hidden="true" /></span>
        <div><p v-if="copy(config.support, 'hours')">{{ copy(config.support, 'hours') }}</p><LayoutFooterLink v-if="copy(config.support, 'label')" :url="config.support.url" :label="copy(config.support, 'label')" /></div>
      </section>
      <section v-if="apps.length" class="store-footer-modern-apps" :aria-label="$t('modernFooter.appDownloads')">
        <div><h2 v-if="copy(config.apps, 'title')">{{ copy(config.apps, 'title') }}</h2><p v-if="copy(config.apps, 'description')">{{ copy(config.apps, 'description') }}</p></div>
        <div class="store-footer-modern-app-badges"><a v-for="item in apps" :key="item.id" :href="footerUrl(item.url, 'external')" target="_blank" rel="noopener noreferrer"><img :src="footerUrl(item.image_url)" :alt="item.platform === 'apple' ? $t('modernFooter.appStore') : $t('modernFooter.googlePlay')" loading="lazy" width="136" height="42"></a></div>
      </section>
      <section v-if="payments.length" class="store-footer-modern-payments" :aria-label="copy(config.payments, 'title') || $t('modernFooter.paymentMethods')">
        <h2 v-if="copy(config.payments, 'title')">{{ copy(config.payments, 'title') }}</h2>
        <ul><li v-for="item in payments" :key="item.id"><img :src="footerUrl(item.image_url)" :alt="item.label" loading="lazy" width="52" height="26"></li></ul>
      </section>
    </div>
  </div>
  <div v-if="config.bottom.enabled && (copyright || legalLinks.length)" class="store-footer-modern-bottom">
    <div class="store-container store-footer-modern-bottom-inner">
      <p v-if="copyright">{{ copyright }}</p>
      <nav v-if="legalLinks.length" :aria-label="$t('modernFooter.legalLinks')"><ul><li v-for="item in legalLinks" :key="item.id"><LayoutFooterLink :url="item.url" :label="copy(item, 'label')" /></li></ul></nav>
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
const socials = computed(() => config.value.brand.socials.filter(item => item.enabled && item.label && footerUrl(item.url, 'external')))
const hasSupport = computed(() => config.value.support.enabled && !!(copy(config.value.support, 'hours') || copy(config.value.support, 'label')))
const apps = computed(() => config.value.apps.enabled ? config.value.apps.items.filter(item => item.enabled && footerUrl(item.url, 'external') && footerUrl(item.image_url)) : [])
const payments = computed(() => visibleFooterPayments(config.value, props.settings))
const legalLinks = computed(() => visibleLinks(config.value.bottom.links))
const copyright = computed(() => [copy(config.value.bottom, 'copyright'), config.value.bottom.show_year ? year.value : ''].filter(Boolean).join(' '))
</script>
