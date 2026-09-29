<script setup>
const { uiNavigateTo } = useUiNavigation()

definePageMeta({
  layout: 'dashboard'
})

await uiNavigateTo('/dashboard/catalog', {
  replace: true
})
</script>

<template>
  <div />
</template>
