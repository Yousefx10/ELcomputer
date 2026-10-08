<script setup>
import { claimTypes, claimStatuses, claimDate, claimErrorKey } from '~/utils/afterSalesClaims.js'
const props = defineProps({ staff: Boolean })
const { t } = useI18n(), { intlLocale } = useUiLocale(), { uiNavigateTo } = useUiNavigation()
const route = useUiRoute(), { request } = useSupportClient()
const loading = ref(true), error = ref(''), claims = ref([]), purchased = ref([]), total = ref(0), itemTotal = ref(0), page = ref(1), itemPage = ref(1), activeForm = ref(null)
const filters = reactive({ type: '', status: '', search: '' })
const api = props.staff ? '/api/admin-after-sales/claims' : '/api/account/after-sales/claims'
const path = props.staff ? '/dashboard/after-sales' : '/account/after-sales'
let generation = 0
const load = async () => {
  const version = ++generation; loading.value = true; error.value = ''
  try {
    const result = await request(api, { query: { ...filters, page: page.value } })
    if (version !== generation) return
    claims.value = result.items; total.value = result.total
    if (!props.staff) {
      const items = await request('/api/account/after-sales/items', { query: { page: itemPage.value, ...(route.query.order ? { order: route.query.order } : {}) } })
      if (version !== generation) return
      purchased.value = items.items; itemTotal.value = items.total
    }
  } catch (cause) { if (version === generation) error.value = t(claimErrorKey(cause)) }
  finally { if (version === generation) loading.value = false }
}
const search = () => { page.value = 1; load() }
const begin = (item, type) => { activeForm.value = { type, context: item[type] } }
const created = id => uiNavigateTo(`${path}/${id}`)
onMounted(load)
watch([page, itemPage], load)
watch(() => route.query.order, () => { itemPage.value = 1; load() })
onBeforeUnmount(() => { generation++ })
</script>

<template>
  <div data-claims-center class="mx-auto max-w-6xl space-y-5 text-slate-900">
    <header class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-sm font-semibold text-blue-700">{{ $t(staff ? 'claims.staffArea' : 'claims.accountArea') }}</p><h1 class="mt-1 text-2xl font-bold sm:text-3xl">{{ $t(staff ? 'claims.staffTitle' : 'claims.title') }}</h1><p class="mt-2 text-sm text-slate-600">{{ $t(staff ? 'claims.staffIntro' : 'claims.customerIntro') }}</p></div><button type="button" :disabled="loading" class="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold" @click="load">{{ $t('claims.refresh') }}</button></header>
    <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-4 text-sm text-red-700">{{ error }}</p>
    <AfterSalesClaimForm v-if="activeForm" :key="activeForm.context.item.id + activeForm.type" :context="activeForm.context" :claim-type="activeForm.type" @close="activeForm = null" @created="created" />
    <section v-if="!staff && !activeForm" class="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 class="text-lg font-bold">{{ $t('claims.purchasedItems') }}</h2><p class="mt-1 text-sm text-slate-600">{{ $t('claims.purchaseRules') }}</p>
      <p v-if="loading" role="status" class="py-6 text-sm text-slate-600">{{ $t('claims.loading') }}</p>
      <p v-else-if="!purchased.length" class="py-6 text-sm text-slate-600">{{ $t('claims.noItems') }}</p>
      <div v-else class="mt-4 grid gap-4 md:grid-cols-2">
        <article v-for="row in purchased" :key="row.return.item.id" :data-purchased-item="row.return.item.id" class="min-w-0 rounded-xl border border-slate-200 p-4">
          <p class="text-xs font-semibold text-slate-600">{{ row.return.order.order_number }} · {{ row.return.item.quantity }} ×</p><h3 class="mt-1 break-words font-bold">{{ row.return.item.product_title }}</h3><p v-if="row.return.item.variant_sku" class="mt-1 break-all text-xs text-slate-600">{{ row.return.item.variant_sku }}</p>
          <dl class="mt-3 space-y-2 text-sm"><div v-for="type in claimTypes" :key="type" class="flex flex-wrap items-center justify-between gap-2"><dt class="font-semibold">{{ $t(`claims.types.${type}`) }}</dt><dd v-if="row[type].can_start"><button type="button" :data-start-claim="type" class="min-h-10 rounded-lg bg-blue-700 px-3 text-xs font-bold text-white" @click="begin(row, type)">{{ $t('claims.start') }}</button></dd><dd v-else class="text-xs text-slate-600">{{ $t(`claims.availability.${row[type].availability_reason || 'unknown'}`) }}</dd></div></dl>
        </article>
      </div>
      <div v-if="itemTotal > 20" class="mt-4 flex items-center justify-between gap-3 text-sm"><button type="button" :disabled="itemPage === 1 || loading" class="min-h-10 px-3 font-semibold disabled:opacity-40" @click="itemPage--">{{ $t('claims.previous') }}</button><span>{{ itemPage }}</span><button type="button" :disabled="itemPage * 20 >= itemTotal || loading" class="min-h-10 px-3 font-semibold disabled:opacity-40" @click="itemPage++">{{ $t('claims.next') }}</button></div>
    </section>
    <section class="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 class="text-lg font-bold">{{ $t(staff ? 'claims.allClaims' : 'claims.myClaims') }} <span class="text-sm font-normal text-slate-600">({{ total }})</span></h2>
      <form class="mt-4 flex flex-wrap gap-3" @submit.prevent="search">
        <label class="min-w-0 flex-1 text-xs font-semibold text-slate-700">{{ $t('claims.search') }}<input v-model="filters.search" maxlength="100" :placeholder="$t(staff ? 'claims.staffSearchHint' : 'claims.searchHint')" class="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"></label>
        <label class="text-xs font-semibold text-slate-700">{{ $t('claims.type') }}<select v-model="filters.type" class="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"><option value="">{{ $t('claims.allTypes') }}</option><option v-for="type in claimTypes" :key="type" :value="type">{{ $t(`claims.types.${type}`) }}</option></select></label>
        <label class="text-xs font-semibold text-slate-700">{{ $t('claims.status') }}<select v-model="filters.status" class="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"><option value="">{{ $t('claims.allStatuses') }}</option><option v-for="status in claimStatuses" :key="status" :value="status">{{ $t(`claims.statuses.${status}`) }}</option></select></label>
        <button type="submit" class="mt-auto min-h-11 rounded-lg bg-blue-700 px-4 text-sm font-bold text-white">{{ $t('claims.filter') }}</button>
      </form>
      <p v-if="!claims.length && !loading" class="py-8 text-sm text-slate-600">{{ $t('claims.noClaims') }}</p>
      <ul v-else class="mt-4 divide-y divide-slate-200"><li v-for="claim in claims" :key="claim.id"><NuxtLinkLocale :to="`${path}/${claim.id}`" data-claim-row class="flex min-h-20 flex-wrap items-center justify-between gap-3 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"><div class="min-w-0"><p class="break-all text-xs font-bold text-blue-700">{{ claim.reference }}</p><p class="mt-1 break-words font-semibold">{{ claim.product_title }}</p><p class="mt-1 text-xs text-slate-600">{{ claim.order_number }} · {{ $t(`claims.types.${claim.claim_type}`) }} · {{ claimDate(claim.created_at, intlLocale) }}</p><p v-if="staff && claim.customer_name" class="mt-1 text-xs text-slate-600">{{ claim.customer_name }}</p></div><span class="rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">{{ $t(`claims.statuses.${claim.status}`) }}</span></NuxtLinkLocale></li></ul>
      <div v-if="total > 20" class="mt-4 flex items-center justify-between gap-3 text-sm"><button type="button" :disabled="page === 1 || loading" class="min-h-10 px-3 font-semibold disabled:opacity-40" @click="page--">{{ $t('claims.previous') }}</button><span>{{ page }}</span><button type="button" :disabled="page * 20 >= total || loading" class="min-h-10 px-3 font-semibold disabled:opacity-40" @click="page++">{{ $t('claims.next') }}</button></div>
    </section>
  </div>
</template>
