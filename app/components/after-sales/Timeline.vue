<script setup>
import { claimDate } from '~/utils/afterSalesClaims.js'
defineProps({ events: { type: Array, default: () => [] }, more: Boolean, loading: Boolean })
defineEmits(['older'])
const { intlLocale } = useUiLocale()
</script>
<template>
  <section data-claim-timeline class="rounded-2xl border border-slate-200 bg-white p-5">
    <h2 class="text-lg font-bold text-slate-900">{{ $t('claims.timeline') }}</h2>
    <ol class="mt-4 space-y-4"><li v-for="event in events" :key="event.id" class="border-s-2 border-blue-200 ps-4 text-sm"><div class="flex flex-wrap items-start justify-between gap-2"><p class="font-semibold text-slate-900">{{ $t(`claims.events.${event.event_type}`) }} <span v-if="!event.customer_visible" class="text-xs font-normal text-amber-700">{{ $t('claims.internal') }}</span></p><time class="text-xs text-slate-600">{{ claimDate(event.created_at, intlLocale) }}</time></div><p v-if="event.actor_name" class="mt-1 text-xs text-slate-600">{{ event.actor_name }}</p><p v-if="event.body" class="mt-2 whitespace-pre-wrap break-words text-slate-700">{{ event.body }}</p><p v-if="event.resolution" class="mt-1 text-xs text-slate-600">{{ $t(`claims.resolutions.${event.resolution}`) }}</p></li></ol>
    <button v-if="more" type="button" :disabled="loading" class="mt-4 min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-800" @click="$emit('older')">{{ $t('claims.olderEvents') }}</button>
  </section>
</template>
