<template>
  <footer v-if="isModern" class="store-footer-modern">
    <div class="store-container store-footer-modern-shell">
      <div class="store-footer-modern-main">
        <section class="store-footer-modern-card" aria-label="Footer promotion">
          <img
            v-if="modernCardImageUrl"
            :src="modernCardImageUrl"
            alt=""
            class="store-footer-modern-card-image"
            loading="lazy"
          >

          <div class="store-footer-modern-card-copy">
            <h2 v-if="modernCardTitle">{{ modernCardTitle }}</h2>
            <p v-if="modernCardText">{{ modernCardText }}</p>

            <a
              v-if="modernCardButtonLabel && isExternalUrl(modernCardButtonUrl)"
              :href="modernCardButtonUrl"
              class="store-footer-modern-card-button"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ modernCardButtonLabel }}
            </a>
            <NuxtLink
              v-else-if="modernCardButtonLabel && modernCardButtonUrl"
              :to="modernCardButtonUrl"
              class="store-footer-modern-card-button"
            >
              {{ modernCardButtonLabel }}
            </NuxtLink>
          </div>
        </section>

        <nav v-if="footerGroups.length" class="store-footer-modern-groups" aria-label="Footer links">
          <div v-for="group in footerGroups" :key="group.title" class="store-footer-modern-group">
            <h2>{{ group.title }}</h2>
            <ul>
              <li v-for="item in group.items" :key="item.id">
                <a v-if="resolvedLink(item.url) && isExternalUrl(item.url)" :href="resolvedLink(item.url)" target="_blank" rel="noopener noreferrer">{{ item.label }}</a>
                <NuxtLink v-else-if="resolvedLink(item.url)" :to="resolvedLink(item.url)">{{ item.label }}</NuxtLink>
                <span v-else>{{ item.label }}</span>
              </li>
            </ul>
          </div>
        </nav>

        <aside v-if="modernCommunityText" class="store-footer-modern-community" aria-label="Community">
          <p>Connect</p>
          <a
            v-if="isExternalUrl(modernCommunityUrl)"
            :href="modernCommunityUrl"
            class="store-footer-modern-community-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img v-if="modernCommunityImageUrl" :src="modernCommunityImageUrl" alt="" loading="lazy">
            <Icon v-else name="lucide:messages-square" size="28" aria-hidden="true" />
            <span>{{ modernCommunityText }}</span>
          </a>
          <NuxtLink
            v-else-if="modernCommunityUrl"
            :to="modernCommunityUrl"
            class="store-footer-modern-community-link"
          >
            <img v-if="modernCommunityImageUrl" :src="modernCommunityImageUrl" alt="" loading="lazy">
            <Icon v-else name="lucide:messages-square" size="28" aria-hidden="true" />
            <span>{{ modernCommunityText }}</span>
          </NuxtLink>
          <div v-else class="store-footer-modern-community-link">
            <img v-if="modernCommunityImageUrl" :src="modernCommunityImageUrl" alt="" loading="lazy">
            <Icon v-else name="lucide:messages-square" size="28" aria-hidden="true" />
            <span>{{ modernCommunityText }}</span>
          </div>
        </aside>
      </div>

      <div v-if="modernBannerImageUrl" class="store-footer-modern-banner">
        <a v-if="isExternalUrl(modernBannerUrl)" :href="modernBannerUrl" target="_blank" rel="noopener noreferrer">
          <img :src="modernBannerImageUrl" :alt="modernBannerAlt" loading="lazy">
        </a>
        <NuxtLink v-else-if="modernBannerUrl" :to="modernBannerUrl">
          <img :src="modernBannerImageUrl" :alt="modernBannerAlt" loading="lazy">
        </NuxtLink>
        <img v-else :src="modernBannerImageUrl" :alt="modernBannerAlt" loading="lazy">
      </div>

      <div class="store-footer-modern-bottom">
        <a
          v-if="modernBottomLeftText && isExternalUrl(modernBottomLeftUrl)"
          :href="modernBottomLeftUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ modernBottomLeftText }}
        </a>
        <NuxtLink v-else-if="modernBottomLeftText && modernBottomLeftUrl" :to="modernBottomLeftUrl">
          {{ modernBottomLeftText }}
        </NuxtLink>
        <p v-else class="store-footer-modern-bottom-left">{{ modernBottomLeftText }}</p>

        <p class="store-footer-modern-bottom-center">{{ modernBottomCenterText }}</p>

        <div class="store-footer-modern-bottom-right">
          <strong v-if="modernBottomRightTitle">{{ modernBottomRightTitle }}</strong>
          <span v-if="modernBottomRightText">{{ modernBottomRightText }}</span>
        </div>
      </div>
    </div>
  </footer>

  <footer v-else class="store-footer">
    <div class="store-container">
      <div class="store-footer-cta">
        <div><h2>{{ footerCtaTitle }}</h2><p>{{ footerCtaSubtitle }}</p></div>
        <NuxtLink :to="footerCtaButtonUrl" class="store-button">{{ footerCtaButtonLabel }} <Icon name="lucide:arrow-right" size="16" /></NuxtLink>
      </div>
      <div class="store-footer-main">
        <div class="store-footer-brand">
          <img :src="siteLogoUrl" :class="{ 'store-footer-custom-logo': siteLogoUrl !== '/images/dashboard-logo.png' }" :alt="siteName" loading="lazy" />
          <div class="store-footer-contact">
            <a v-if="footerEmail" :href="`mailto:${footerEmail}`"><Icon name="lucide:mail" size="16" />{{ footerEmail }}</a>
            <a v-if="footerPhone" :href="`tel:${footerPhone}`"><Icon name="lucide:phone" size="16" />{{ footerPhone }}</a>
            <p v-if="footerAddress && footerAddress !== 'address address'">{{ footerAddress }}</p>
          </div>
        </div>
        <div class="store-footer-groups">
          <div>
            <h3>Support</h3>
            <ul>
              <li><NuxtLink to="/help">Help Center</NuxtLink></li>
              <li><NuxtLink to="/account/support">My tickets</NuxtLink></li>
            </ul>
          </div>
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
import { getConfiguredStoreImageUrl, getStoreImageUrl, getStoreLinkUrl, isExternalStoreLink } from '~/utils/storefront'

const { data: siteContent } = await useSiteContent()

const settings = computed(() => siteContent.value?.settings || {})
const footerLinks = computed(() => siteContent.value?.footerLinks || [])

const isModern = computed(() => settings.value.footer_style === 'modern')
const siteName = computed(() => settings.value.site_name || 'ELcomputer')
const siteLogoUrl = computed(() => getStoreImageUrl(settings.value.site_logo_url) || '/images/dashboard-logo.png')
const footerCtaTitle = computed(() => settings.value.footer_cta_title === 'What are you waiting for?' ? 'Browse computer accessories' : (settings.value.footer_cta_title || 'Browse computer accessories'))
const footerCtaSubtitle = computed(() => settings.value.footer_cta_subtitle === 'Purchase your fav gear' ? 'Keyboards, mice, headsets and more.' : (settings.value.footer_cta_subtitle || 'Keyboards, mice, headsets and more.'))
const footerCtaButtonLabel = computed(() => settings.value.footer_cta_button_label || 'Shop Now')
const footerCtaButtonUrl = computed(() => settings.value.footer_cta_button_url === '/' ? '/search' : (settings.value.footer_cta_button_url || '/search'))
const footerEmail = computed(() => settings.value.footer_email || '')
const footerPhone = computed(() => settings.value.footer_phone || '')
const footerAddress = computed(() => settings.value.footer_address || '')
const copyrightText = computed(() => settings.value.copyright_text || '© 2026 All rights reserved by ELCOMPUTER')

const modernCardImageUrl = computed(() => getConfiguredStoreImageUrl(settings.value.footer_modern_card_image_url))
const modernCardTitle = computed(() => settings.value.footer_modern_card_title || '')
const modernCardText = computed(() => settings.value.footer_modern_card_text || '')
const modernCardButtonLabel = computed(() => settings.value.footer_modern_card_button_label || '')
const modernCardButtonUrl = computed(() => getStoreLinkUrl(settings.value.footer_modern_card_button_url))
const modernCommunityImageUrl = computed(() => getConfiguredStoreImageUrl(settings.value.footer_modern_community_image_url))
const modernCommunityText = computed(() => settings.value.footer_modern_community_text || '')
const modernCommunityUrl = computed(() => getStoreLinkUrl(settings.value.footer_modern_community_url))
const modernBannerImageUrl = computed(() => getConfiguredStoreImageUrl(settings.value.footer_modern_banner_image_url))
const modernBannerAlt = computed(() => settings.value.footer_modern_banner_alt || '')
const modernBannerUrl = computed(() => getStoreLinkUrl(settings.value.footer_modern_banner_url))
const modernBottomLeftText = computed(() => settings.value.footer_modern_bottom_left_text || '')
const modernBottomLeftUrl = computed(() => getStoreLinkUrl(settings.value.footer_modern_bottom_left_url))
const modernBottomCenterText = computed(() => settings.value.footer_modern_bottom_center_text || '')
const modernBottomRightTitle = computed(() => settings.value.footer_modern_bottom_right_title || '')
const modernBottomRightText = computed(() => settings.value.footer_modern_bottom_right_text || '')

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

const resolvedLink = value => getStoreLinkUrl(value)
const isExternalUrl = value => isExternalStoreLink(value)
</script>
