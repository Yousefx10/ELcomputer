<template>
  <section class="space-y-6 rounded-2xl bg-white p-6 shadow" data-order-flow>
    <div>
      <h3 class="text-2xl font-bold">{{ $t('orderFlow.title') }}</h3>
      <p class="mt-1 text-sm text-gray-500">{{ $t('orderFlow.help') }}</p>
    </div>
    <p v-if="loading" class="text-sm text-gray-500">{{ $t('common.loading') }}</p>
    <template v-else-if="loaded">
      <fieldset v-for="kind in KINDS" :key="kind" class="space-y-3 rounded-2xl border border-gray-200 p-5" :disabled="!canEdit || saving">
        <legend class="px-1 font-bold">{{ $t(`orderFlow.${kind}Title`) }}</legend>
        <p class="text-sm text-gray-500">{{ $t(`orderFlow.${kind}Help`) }}</p>
        <div class="grid gap-3 md:grid-cols-2">
          <label v-for="mode in MODES" :key="mode" class="flex cursor-pointer items-start gap-3 rounded-xl border p-4" :class="form[kind] === mode ? 'border-blue-600 bg-blue-50' : 'border-gray-200'">
            <input v-model="form[kind]" type="radio" :name="`order-flow-${kind}`" :value="mode" class="mt-1">
            <span><span class="block font-semibold">{{ $t(`orderFlow.mode_${mode}`) }}</span><span class="mt-1 block text-sm text-gray-500">{{ $t(`orderFlow.mode_${mode}Help`) }}</span></span>
          </label>
        </div>
        <p v-if="since(kind)" class="text-xs text-gray-500">{{ $t('orderFlow.since', { value0: formatDate(since(kind)) }) }}</p>
      </fieldset>

      <label class="block max-w-xs"><span class="mb-2 block text-sm font-semibold">{{ $t('orderFlow.weight') }}</span>
        <input v-model="form.parcelWeightKg" type="number" min="0.001" step="0.001" inputmode="decimal" class="w-full rounded-xl border border-gray-200 p-3" :disabled="!canEdit || saving">
      </label>
      <p v-if="!state.courierReady" class="text-sm text-amber-700">{{ $t('orderFlow.courierOff') }}</p>

      <div v-if="state.waiting.length" class="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p class="font-semibold text-amber-900">{{ $t('orderFlow.waiting') }}</p>
        <ul class="mt-2 space-y-1 text-sm text-amber-900">
          <li v-for="item in state.waiting" :key="item.orderId"><NuxtLinkLocale :to="`/dashboard/orders?order=${item.orderId}`" class="font-semibold underline">{{ item.orderNumber }}</NuxtLinkLocale> · {{ $uiMessage(item.error) }}</li>
        </ul>
      </div>

      <div class="flex justify-end">
        <button type="button" class="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-40" :disabled="!canEdit || saving || !dirty" @click="save">{{ $t(saving ? 'common.saving' : 'orderFlow.save') }}</button>
      </div>
    </template>
    <p v-if="message" class="text-sm text-green-700" role="status">{{ $t(message) }}</p>
    <p v-if="errorMessage" class="text-sm text-red-700" role="alert">{{ $uiMessage(errorMessage) }}</p>
  </section>
</template>

<script setup>
const props = defineProps({ canEdit: { type: Boolean, default: false } })
const { intlLocale } = useUiLocale()
const supabase = useSupabaseClient()
const KINDS = ['paidOrders', 'codOrders'], MODES = ['auto', 'review']
const loading = ref(true), loaded = ref(false), saving = ref(false), message = ref(''), errorMessage = ref('')
const state = reactive({ paidOrders: 'review', codOrders: 'review', parcelWeightKg: 1, paidSince: null, codSince: null, courierReady: true, waiting: [] })
const form = reactive({ paidOrders: 'review', codOrders: 'review', parcelWeightKg: '1' })
const dirty = computed(() => form.paidOrders !== state.paidOrders || form.codOrders !== state.codOrders || Number(form.parcelWeightKg) !== state.parcelWeightKg)
const since = kind => state[kind] === 'auto' ? state[kind === 'paidOrders' ? 'paidSince' : 'codSince'] : null
const formatDate = value => new Intl.DateTimeFormat(intlLocale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
async function headers() {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('Your session expired. Sign in again.')
  return { authorization: `Bearer ${data.session.access_token}` }
}
function apply(result) {
  Object.assign(state, result)
  Object.assign(form, { paidOrders: state.paidOrders, codOrders: state.codOrders, parcelWeightKg: String(state.parcelWeightKg) })
}
async function load() {
  loading.value = true
  try { apply(await $fetch('/api/admin-order-flow', { headers: await headers() })); loaded.value = true }
  catch (error) { errorMessage.value = error?.data?.statusMessage || 'Order flow is unavailable.' }
  finally { loading.value = false }
}
async function save() {
  saving.value = true; message.value = ''; errorMessage.value = ''
  try {
    apply(await $fetch('/api/admin-order-flow', { method: 'PATCH', headers: await headers(), body: { paidOrders: form.paidOrders, codOrders: form.codOrders, parcelWeightKg: Number(form.parcelWeightKg) } }))
    message.value = 'orderFlow.saved'
  } catch (error) { errorMessage.value = error?.data?.statusMessage || 'Choose a valid order flow and parcel weight.' }
  finally { saving.value = false }
}
onMounted(load)
</script>
