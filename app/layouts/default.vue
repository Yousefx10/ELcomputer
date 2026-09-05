<template>
  <div class="storefront" :style="layoutStyle">
    <NuxtLoadingIndicator color="#ffd54f" :height="3" :throttle="0" />
    <a class="store-skip-link" href="#main-content">Skip to content</a>
    <LayoutTopBar />
    <LayoutNavBar />
    <main id="main-content" tabindex="-1">
      <slot />
    </main>
    <LayoutFooter />
  </div>
</template>

<script setup>
import '~/assets/css/storefront.css'

const { data: siteContent } = await useSiteContent()
const layoutStyle = computed(() => {
  const background = siteContent.value?.settings?.site_background_color
  return { '--store-page-background': !background || background === '#f3f4f6' ? '#ffffff' : background }
})
</script>
