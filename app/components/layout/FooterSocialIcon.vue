<template>
  <svg v-if="platform === 'x'" viewBox="0 0 24 24" width="21" height="21" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23 22h-6.3l-4.9-7.4L5.3 22H2.1l7.9-9.1L1 2h6.5l4.4 6.7L18.9 2ZM17.8 20h1.7L6.5 4H4.7l13.1 16Z"/></svg>
  <svg v-else-if="platform === 'whatsapp'" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.7 18.5 3 22l4.3-1.2A10 10 0 1 0 4.7 18.5Z"/><path d="M8 7c-1 1-1 3 1 5s4 3 6 3l1-2-3-1-1 1c-2-1-3-2-3-3l1-1-1-2Z"/></svg>
  <Icon v-else :name="footerSocialIcons[platform] || footerSocialIcons.other" size="21" aria-hidden="true" />
</template>
<script setup>
import { footerSocialIcons } from '~/utils/modernFooter'
defineProps({ platform: { type: String, required: true } })
</script>
