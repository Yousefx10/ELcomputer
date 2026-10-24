<script setup>
const { uiLabel } = useUiLocale()

import { resolveAccountUser } from '~/utils/accountSession'

definePageMeta({ layout: 'account', middleware: 'customer-auth' })
useHead(() => ({ title: uiLabel('Your Profile') }))

const supabase = useSupabaseClient()
const user = useCustomerIdentity().user
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const form = reactive({ full_name: '', phone: '', address_line_1: '', address_line_2: '', city: '', state: '', country: '' })
let loadVersion = 0
const loadedCustomerId = ref('')

const load = async () => {
  const version = ++loadVersion
  loadedCustomerId.value = ''
  for (const field of Object.keys(form)) form[field] = ''
  loading.value = true
  saving.value = false
  error.value = ''
  notice.value = ''
  try {
    const currentUser = await resolveAccountUser(supabase, user.value)
    if (version !== loadVersion) return
    if (!currentUser) throw new Error('No customer session')
    const result = await supabase.from('customer_profiles')
      .select('full_name, phone, address_line_1, address_line_2, city, state, country')
      .eq('id', currentUser.id).maybeSingle().abortSignal(AbortSignal.timeout(20000))
    if (result.error) throw result.error
    if (version === loadVersion) {
      for (const field of Object.keys(form)) form[field] = result.data?.[field] || ''
      loadedCustomerId.value = currentUser.id
    }
  } catch {
    if (version === loadVersion) error.value = 'Could not load your profile. Please try again.'
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

const save = async () => {
  if (saving.value || loading.value || !loadedCustomerId.value) return
  const version = loadVersion
  const customerId = loadedCustomerId.value
  const values = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim() || null]))
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    const currentUser = await resolveAccountUser(supabase, user.value)
    if (!currentUser) throw new Error('No customer session')
    if (version !== loadVersion || currentUser.id !== customerId) return
    const { error: saveError } = await supabase.from('customer_profiles').upsert({
      id: currentUser.id,
      email: currentUser.email || '',
      ...values
    }).abortSignal(AbortSignal.timeout(20000))
    if (version !== loadVersion) return
    if (saveError) throw saveError
    notice.value = 'Profile saved.'
    window.dispatchEvent(new Event('account:profile-updated'))
  } catch {
    if (version === loadVersion) error.value = 'Could not save your profile. Please try again.'
  } finally {
    if (version === loadVersion) saving.value = false
  }
}

onMounted(load)
onBeforeUnmount(() => { ++loadVersion })
watch(() => user.value?.sub || user.value?.id, load, { flush: 'sync' })
</script>

<template>
  <div class="space-y-5">
    <header><p class="text-sm font-semibold text-blue-700">{{ $t('common.yourAccount') }}</p><h1 class="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{{ $t('common.profile') }}</h1><p class="mt-1 text-sm text-slate-600">{{ $t('account.profile.keepYourContactAndAddressDetailsUpToDate') }}</p></header>
    <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-4 text-sm text-red-700">{{ $uiMessage(error) }}</p>
    <p v-if="notice" role="status" class="rounded-xl bg-green-50 p-4 text-sm text-green-800">{{ $uiLabel(notice) }}</p>
    <form class="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" @submit.prevent="save">
      <p v-if="loading" role="status" class="text-sm text-slate-600">{{ $t('common.loadingProfile') }}</p>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block text-sm font-semibold text-slate-700">{{ $t('common.fullName') }}<input v-model="form.full_name" maxlength="160" autocomplete="name" :disabled="loading || saving" class="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" /></label>
        <label class="block text-sm font-semibold text-slate-700">{{ $t('common.phone') }}<input v-model="form.phone" maxlength="40" autocomplete="tel" :disabled="loading || saving" class="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" /></label>
        <label class="block text-sm font-semibold text-slate-700 sm:col-span-2">{{ $t('common.email') }}<input :value="user?.email || ''" type="email" autocomplete="email" disabled class="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-normal text-slate-600" /><span class="mt-1 block text-xs font-normal text-slate-500">{{ $t('account.profile.emailChangesAreManagedThroughYourSignInAccount') }}</span></label>
        <label class="block text-sm font-semibold text-slate-700 sm:col-span-2">{{ $t('common.addressLine1') }}<input v-model="form.address_line_1" maxlength="200" autocomplete="address-line1" :disabled="loading || saving" class="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" /></label>
        <label class="block text-sm font-semibold text-slate-700 sm:col-span-2">{{ $t('common.addressLine2') }}<input v-model="form.address_line_2" maxlength="200" autocomplete="address-line2" :disabled="loading || saving" class="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" /></label>
        <label v-for="field in [{ key: 'city', label: 'City' }, { key: 'state', label: 'State or governorate' }, { key: 'country', label: 'Country' }]" :key="field.key" class="block text-sm font-semibold text-slate-700">{{ $uiLabel(field.label) }}<input v-model="form[field.key]" maxlength="100" :disabled="loading || saving" class="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" /></label>
      </div>
      <div class="flex justify-end"><button type="submit" :disabled="loading || saving || !loadedCustomerId" class="min-h-11 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{{ saving ? $t('common.saving') : $t('common.saveProfile') }}</button></div>
    </form>
  </div>
</template>
