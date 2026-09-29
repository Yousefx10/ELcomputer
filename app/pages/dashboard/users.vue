<script setup>
const { uiNavigateTo } = useUiNavigation()

definePageMeta({
  layout: 'dashboard'
})

await uiNavigateTo('/dashboard/hr?tab=users', {
  replace: true
})
</script>

<template>
  <div />
</template>
