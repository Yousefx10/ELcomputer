<template>
  <div class="min-h-screen" :style="layoutStyle">
    <LayoutTopBar/>
    <LayoutNavBar/>

    <main class="">
        <slot />
    </main>


    <LayoutFooter/>
  </div>
</template>

<script setup>
const route = useRoute()
const { data: siteContent } = await useSiteContent()

const layoutStyle = computed(() => {
  if (route.path !== '/') {
    return {
      backgroundColor: '#f3f4f6'
    }
  }

  return {
    backgroundColor: siteContent.value?.settings?.site_background_color || '#f3f4f6'
  }
})
</script>

<style>

</style>
