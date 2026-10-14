<template>
  <div class="mx-auto max-w-7xl">
    <DashboardPageIntro
      :title="$t('catalogTransfer.title')"
      container-class="mb-4 rounded-2xl bg-white p-5 shadow"
      title-class="text-2xl font-bold text-gray-900"
    />
    <DashboardSecondaryNav class="mb-4" />
    <div class="overflow-hidden rounded-2xl bg-white shadow">
      <p v-if="loadError" role="alert" class="px-4 pt-3 text-sm text-red-600">
        {{ $t('productList.loadFailed') }}
        <button type="button" class="underline" @click="load">{{ $t('productList.retry') }}</button>
      </p>
      <CatalogTransfer
        working
        :selected="selected"
        :filters="filters"
        :total="total"
        :loading="loading || loadError"
      />
    </div>
  </div>
</template>
<script setup>
import CatalogTransfer from '~/components/dashboard/products/CatalogTransfer.vue'
import { productListState } from '~/utils/productList.js'
definePageMeta({ layout: 'dashboard' })
const route = useUiRoute(),
  { getAdminAuthHeaders } = useAdminLogs()
const filters = computed(() => productListState(route.query))
const selected = computed(() => {
  const ids = typeof route.query.ids === 'string' ? route.query.ids.split(',') : []
  return ids.length <= 25 &&
    ids.every((id) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) &&
    new Set(ids).size === ids.length
    ? ids.map((id) => ({ id }))
    : []
})
const { adminUser } = useAdminAccess()
const total = ref(0),
  loading = ref(true),
  loadError = ref(false)
let generation = 0,
  controller
const load = async () => {
  const id = ++generation,
    query = { ...filters.value, page: 1 }
  controller?.abort()
  controller = new AbortController()
  const signal = controller.signal
  total.value = 0
  loading.value = true
  loadError.value = false
  try {
    const headers = await getAdminAuthHeaders()
    if (id !== generation) return
    const data = await $fetch('/api/admin-products/list', {
      headers,
      query,
      signal,
      retry: 0,
      timeout: 15000,
    })
    if (id !== generation) return
    if (!Number.isSafeInteger(data?.total) || data.total < 0) throw Error('Invalid count')
    total.value = data.total
  } catch {
    if (id === generation) loadError.value = true
  } finally {
    if (id === generation) loading.value = false
  }
}
watch(() => JSON.stringify([filters.value, adminUser.value?.id]), load)
onMounted(load)
onBeforeUnmount(() => {
  generation++
  controller?.abort()
})
</script>
