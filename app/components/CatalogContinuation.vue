<template>
  <div ref="sentinel" class="catalog-continuation mt-6 flex flex-wrap items-center justify-center gap-3 border-t pt-5" :aria-busy="loading">
    <p v-if="failed" class="w-full text-center text-sm" role="alert">{{ $t('ownerPhase2.catalogFailed') }}</p>
    <p v-else-if="!hasMore" class="text-sm" role="status">{{ $t('ownerPhase2.catalogEnd') }}</p>
    <button v-if="mounted && enabled && hasMore && !bounded" type="button" :disabled="loading" class="min-h-11 rounded-lg border px-5 py-2 text-sm font-semibold disabled:opacity-50" @click="$emit('load')">{{ $t(loading ? 'ownerPhase2.loadingMore' : 'ownerPhase2.loadMore') }}</button>
    <NuxtLinkLocale v-if="hasMore" :to="next" rel="next" class="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm">{{ $t('ownerPhase2.nextPage') }}</NuxtLinkLocale>
  </div>
</template>
<script setup>
const props = defineProps({ enabled: Boolean, hasMore: Boolean, bounded: Boolean, loading: Boolean, failed: Boolean, next: { type: [String, Object], required: true } })
const emit = defineEmits(['load'])
const sentinel = ref(null), mounted = ref(false)
let observer
onMounted(() => {
  mounted.value = true
  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting) && props.enabled && props.hasMore && !props.bounded && !props.loading && !props.failed) emit('load')
    }, { rootMargin: '100px' })
    observer.observe(sentinel.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())
</script>
