<template>
  <footer class="mb-0 bg-black pt-10 text-white">
    <div class="container mx-auto p-5">
      <div class="space-y-10 text-center">
        <img
          v-if="siteLogoUrl"
          class="mx-auto max-h-20 w-auto object-contain"
          :src="siteLogoUrl"
          :alt="siteName"
        >

        <p v-else class="text-3xl font-bold md:text-4xl">
          {{ siteName }}
        </p>

        <div class="text-2xl font-bold md:text-4xl">
          <p>{{ footerCtaTitle }}</p>
          <p>{{ footerCtaSubtitle }}</p>
        </div>

        <a
          :href="footerCtaButtonUrl || '/'"
          class="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-blue-600 p-6 font-bold"
        >
          {{ footerCtaButtonLabel }}
          <Icon name="lucide:arrow-right" size="20" />
        </a>
      </div>

      <div class="mt-15 grid grid-cols-2 gap-10 border-t py-5 text-center text-2xl md:grid-cols-3 md:text-start xl:grid-cols-5">
        <div
          v-for="group in footerGroups"
          :key="group.title"
        >
          <h3 class="mb-6 font-bold">{{ group.title }}</h3>

          <ul class="space-y-4 text-gray-400">
            <li
              v-for="item in group.items"
              :key="item.id"
            >
              <a
                v-if="item.url && isExternalUrl(item.url)"
                :href="item.url"
                target="_blank"
                rel="noreferrer"
              >
                {{ item.label }}
              </a>

              <NuxtLink v-else-if="item.url" :to="item.url">
                {{ item.label }}
              </NuxtLink>

              <span v-else>{{ item.label }}</span>
            </li>
          </ul>
        </div>

        <div v-if="footerEmail || footerPhone || footerAddress">
          <h3 class="mb-6 font-bold">Contact</h3>

          <ul class="space-y-4 text-gray-400">
            <li v-if="footerEmail">{{ footerEmail }}</li>
            <li v-if="footerPhone">{{ footerPhone }}</li>
            <li v-if="footerAddress">{{ footerAddress }}</li>
          </ul>
        </div>
      </div>

      <p class="mt-10 border-t py-5 text-center text-lg">
        {{ copyrightText }}
      </p>
    </div>
  </footer>
</template>

<script setup>
const { data: siteContent } = await useSiteContent()

const settings = computed(() => siteContent.value?.settings || {})
const footerLinks = computed(() => siteContent.value?.footerLinks || [])

const siteName = computed(() => settings.value.site_name || 'ELcomputer')
const siteLogoUrl = computed(() => settings.value.site_logo_url || '')
const footerCtaTitle = computed(() => settings.value.footer_cta_title || 'What are you waiting for?')
const footerCtaSubtitle = computed(() => settings.value.footer_cta_subtitle || 'Purchase your fav gear')
const footerCtaButtonLabel = computed(() => settings.value.footer_cta_button_label || 'Shop Now')
const footerCtaButtonUrl = computed(() => settings.value.footer_cta_button_url || '/')
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
