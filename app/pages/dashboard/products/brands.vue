<script setup>
const { uiNavigateTo } = useUiNavigation()

definePageMeta({
  layout: 'dashboard'
})

await uiNavigateTo('/dashboard/catalog?tab=brands', {
  replace: true
})
</script>

<template>
  <div />
</template>
