<template>
  <div class="space-y-6">
    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div class="dashboard-page-summary-copy">
          <h3 class="text-2xl font-bold">{{ $t('common.shippingCompanies') }}</h3>
          <p class="mt-1 text-sm text-gray-500">
            {{ $t('dashboard.commerce.addAndManageDeliveryCompanies') }}
          </p>
        </div>

        <div class="rounded-2xl bg-gray-100 px-4 py-3">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{{ $t('common.companies') }}</p>
          <p class="mt-2 text-2xl font-bold text-gray-900">{{ companies.length }}</p>
        </div>
      </div>
    </section>

    <section v-if="canConfigureShipping" class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 class="text-2xl font-bold">{{ $t('common.pdcApi') }}</h3>
          <p class="mt-1 text-sm text-gray-500">{{ $t('shipment.settingsIntro') }}</p>
        </div>

        <div class="flex flex-wrap gap-2 text-xs font-semibold">
          <span
            class="rounded-full px-3 py-1"
            :class="pdcSettings.live_requests_enabled ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
          >
            {{ pdcSettings.live_requests_enabled ? $t('common.liveServerReady') : $t('common.liveCallsOff') }}
          </span>
          <span
            class="rounded-full px-3 py-1"
            :class="pdcSettings.access_token_configured ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'"
          >
            {{ pdcSettings.access_token_configured ? $t('common.tokenSaved') : $t('common.tokenMissing') }}
          </span>
          <span class="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
            {{ $t('common.valueCities', { value0: (pdcSettings.city_mapping_count) }) }}
          </span>
          <span v-if="pdcSettings.pending_job_count" class="rounded-full bg-purple-100 px-3 py-1 text-purple-700">
            {{ $t('common.valuePending', { value0: (pdcSettings.pending_job_count) }) }}
          </span>
        </div>
      </div>

      <p v-if="pdcLoading" class="mt-5 text-sm text-gray-500">{{ $t('common.loadingPdcSettings') }}</p>
      <p v-else-if="pdcPageError" class="mt-5 text-sm text-red-600">{{ $uiMessage(pdcPageError) }}</p>

      <form v-else class="mt-6 space-y-5" @submit.prevent="savePdcSettings">
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label class="block text-sm font-semibold text-gray-700">{{ $t('shipment.mode') }}
            <select v-model="pdcSettings.api_mode" class="mt-2 w-full rounded-lg border bg-white p-3">
              <option value="production">{{ $t('shipment.production') }}</option><option value="test">{{ $t('shipment.test') }}</option>
            </select>
          </label>
          <label class="block text-sm font-semibold text-gray-700">{{ $t('shipment.timezone') }}
            <input v-model="pdcSettings.status_timezone" type="text" class="mt-2 w-full rounded-lg border p-3" placeholder="Africa/Cairo">
          </label>
          <div>
            <label for="pdc-api-url" class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.apiUrl') }}</label>
            <input
              id="pdc-api-url"
              v-model="pdcSettings.base_url"
              type="url"
              dir="ltr"
              class="w-full rounded-lg border bg-white p-3 text-sm text-gray-700"
            >
          </div>

          <div>
            <label for="pdc-company-id" class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.companyId') }}</label>
            <input
              id="pdc-company-id"
              inputmode="numeric"
              dir="ltr"
              v-model="pdcSettings.company_id"
              type="text"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <div>
            <label for="pdc-product" class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.productId') }}</label>
            <select v-if="pdcSettings.products_cache.length" id="pdc-product" v-model="pdcSettings.product_id" class="w-full rounded-lg border bg-white p-3" :aria-label="$t('common.productId')">
              <option v-if="!pdcSettings.products_cache.some(item => item.id === Number(pdcSettings.product_id))" :value="pdcSettings.product_id">{{ pdcSettings.product_id }} — {{ $t('shipment.savedProduct') }}</option>
              <option v-for="product in pdcSettings.products_cache" :key="product.id" :value="product.id">{{ product.name }} ({{ product.id }})</option>
            </select>
            <input v-else id="pdc-product" v-model="pdcSettings.product_id" type="number" min="1" class="w-full rounded-lg border p-3 outline-none focus:border-blue-500">
          </div>

          <div>
            <label for="pdc-pickup-city" class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.pickupCityId') }}</label>
            <input
              id="pdc-pickup-city"
              v-model="pdcSettings.origin_city_id"
              list="pdc-city-options"
              type="number"
              min="1"
              :placeholder="$t('common.requiredBeforeLaunch')"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <div>
            <label for="pdc-pickup-contact" class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.pickupContact') }}</label>
            <input
              id="pdc-pickup-contact"
              v-model="pdcSettings.origin_contact_name"
              type="text"
              :placeholder="$t('common.storeName')"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <div>
            <label for="pdc-pickup-phone" class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.pickupPhone') }}</label>
            <input
              id="pdc-pickup-phone"
              v-model="pdcSettings.origin_phone"
              type="tel"
              inputmode="numeric"
              :placeholder="$t('common.01xxxxxxxxx')"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <div class="md:col-span-2 xl:col-span-3">
            <label for="pdc-pickup-address" class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.pickupAddress') }}</label>
            <input
              id="pdc-pickup-address"
              v-model="pdcSettings.origin_address"
              type="text"
              :placeholder="$t('common.fullPickupAddress')"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <div>
            <label for="pdc-weight" class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.defaultWeightKg') }}</label>
            <input
              id="pdc-weight"
              v-model="pdcSettings.default_weight_kg"
              type="number"
              min="0.001"
              step="0.001"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <div>
            <label for="pdc-shipment-type" class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.shipmentType') }}</label>
            <select
              id="pdc-shipment-type"
              v-model="pdcSettings.shipment_type_id"
              class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
            >
              <option :value="1">{{ $t('common.general') }}</option>
              <option :value="3">{{ $t('common.reverse') }}</option>
              <option :value="5">{{ $t('common.exchange') }}</option>
            </select>
          </div>

          <div>
            <label for="pdc-label-template" class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.labelTemplateId') }}</label>
            <input
              id="pdc-label-template"
              v-model="pdcSettings.label_template_id"
              type="number"
              min="1"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <div>
            <label for="pdc-access-token" class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.accessToken') }}</label>
            <input
              id="pdc-access-token"
              dir="ltr"
              v-model="pdcSettings.access_token"
              type="password"
              autocomplete="new-password"
              :placeholder="pdcSettings.access_token_configured ? $t('dashboard.commerce.savedLeaveBlankToKeep') : $t('common.enterAtLaunch')"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <div class="md:col-span-2">
            <label for="pdc-webhook-secret" class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.webhookSecret') }}</label>
            <input
              id="pdc-webhook-secret"
              dir="ltr"
              v-model="pdcSettings.webhook_secret"
              type="password"
              autocomplete="new-password"
              :placeholder="pdcSettings.webhook_secret_configured ? $t('dashboard.commerce.savedLeaveBlankToKeep') : $t('common.atLeast32Characters')"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label class="flex items-center gap-2 text-sm text-gray-700">
            <input v-model="pdcSettings.auto_create_labels" type="checkbox">
            {{ $t('common.autoCreatePaidLabels') }}
          </label>
          <label class="flex items-center gap-2 text-sm text-gray-700">
            <input v-model="pdcSettings.all_must_valid" type="checkbox">
            {{ $t('common.rejectInvalidBatches') }}
          </label>
          <label class="flex items-center gap-2 text-sm text-gray-700">
            <input v-model="pdcSettings.allow_open_shipment" type="checkbox">
            {{ $t('common.allowPackageOpening') }}
          </label>
          <label class="flex items-center gap-2 text-sm text-gray-700">
            <input v-model="pdcSettings.is_enabled" type="checkbox">
            {{ $t('common.enableLiveRequests') }}
          </label>
        </div>

        <p v-if="!pdcSettings.encryption_ready" class="text-sm text-amber-700">
          {{ $t('dashboard.commerce.addTheEncryptionKeyBeforeSavingSecrets') }}
        </p>
        <p v-if="pdcFormError" class="text-sm text-red-600">{{ $uiMessage(pdcFormError) }}</p>
        <p v-if="pdcSavedMessage" class="text-sm text-green-700">{{ $uiLabel(pdcSavedMessage) }}</p>

        <button
          type="submit"
          :disabled="pdcSaving"
          class="rounded-lg bg-black px-5 py-3 font-bold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {{ pdcSaving ? $t('common.saving') : $t('common.savePdcSettings') }}
        </button>
      </form>
      <datalist id="pdc-city-options"><option v-for="city in pdcSettings.cities_cache" :key="city.id" :value="city.id">{{ city.name }}</option></datalist>
      <div v-if="!pdcPageError && !pdcLoading" class="mt-6 space-y-4 border-t pt-5">
        <p class="text-sm text-gray-600">{{ $t('shipment.lookupCounts', { value0: pdcSettings.cities_cache.length, value1: pdcSettings.products_cache.length }) }}</p>
        <p v-if="pdcSettings.cities_synced_at" class="text-xs text-gray-500">{{ $t('shipment.citiesSynced') }} {{ formatCommerceDate(pdcSettings.cities_synced_at) }}</p>
        <p v-if="pdcSettings.products_synced_at" class="text-xs text-gray-500">{{ $t('shipment.productsSynced') }} {{ formatCommerceDate(pdcSettings.products_synced_at) }}</p>
        <div class="flex flex-wrap gap-3">
          <button type="button" :disabled="pdcActionBusy || !pdcSettings.live_requests_enabled || !pdcSettings.is_enabled || !pdcSettings.access_token_configured" class="min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50" @click="runPdcLookup('test')">{{ $t('shipment.testConnection') }}</button>
          <button type="button" :disabled="pdcActionBusy || !pdcSettings.live_requests_enabled || !pdcSettings.is_enabled || !pdcSettings.access_token_configured" class="min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50" @click="runPdcLookup('sync')">{{ $t('shipment.syncLookups') }}</button>
        </div>
        <p v-if="pdcActionMessage" role="status" class="text-sm text-green-700">{{ $t(pdcActionMessage) }}</p>
        <p v-if="pdcActionError" role="alert" class="text-sm text-red-700">{{ $t('shipment.actionFailed') }}</p>
        <details class="rounded-xl border p-4">
          <summary class="flex min-h-11 cursor-pointer items-center text-sm font-semibold">{{ $t('shipment.statusMappings') }}</summary>
          <p class="mt-3 text-sm text-gray-600">{{ $t('shipment.mappingNote') }}</p>
          <p class="mt-2 text-sm text-amber-800">{{ $t('shipment.ambiguous97') }}</p>
          <div class="mt-4 space-y-3">
            <div v-for="mapping in pdcMappings" :key="mapping.provider_status_id" class="flex flex-wrap items-end gap-3 rounded-lg bg-gray-50 p-3">
              <p class="w-full text-sm font-semibold">{{ mapping.provider_status_id }} · {{ mapping.provider_label }}</p>
              <label class="min-w-0 flex-1 text-xs font-semibold">{{ $t('shipment.customerState') }}
                <select v-model="mapping.normalized_state" class="mt-1 min-h-11 w-full rounded-lg border bg-white p-2"><option v-for="state in shippingStates" :key="state" :value="state">{{ $t(shipmentStateKey(state)) }}</option></select>
              </label>
              <label class="w-full text-xs font-semibold">{{ $t('shipment.aliases') }}<input :value="mapping.provider_aliases.join('|')" type="text" class="mt-1 w-full rounded-lg border p-2" @input="mapping.provider_aliases = $event.target.value.split('|').map(a => a.trim()).filter(Boolean)"></label>
              <button type="button" :disabled="pdcActionBusy" class="min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50" @click="savePdcMapping(mapping)">{{ $t('shipment.saveMapping') }}</button>
            </div>
          </div>
          <form class="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2" @submit.prevent="savePdcMapping(pdcNewMapping)">
            <label class="text-sm font-semibold">{{ $t('shipment.statusId') }}<input v-model="pdcNewMapping.provider_status_id" type="number" min="1" required class="mt-1 w-full rounded-lg border p-3"></label>
            <label class="text-sm font-semibold">{{ $t('shipment.providerLabel') }}<input v-model="pdcNewMapping.provider_label" type="text" maxlength="200" required class="mt-1 w-full rounded-lg border p-3"></label>
            <label class="text-sm font-semibold">{{ $t('shipment.customerState') }}<select v-model="pdcNewMapping.normalized_state" class="mt-1 w-full rounded-lg border bg-white p-3"><option v-for="state in shippingStates" :key="state" :value="state">{{ $t(shipmentStateKey(state)) }}</option></select></label>
            <label class="text-sm font-semibold">{{ $t('shipment.aliases') }}<input v-model="pdcNewAliases" type="text" class="mt-1 w-full rounded-lg border p-3"></label>
            <button type="submit" :disabled="pdcActionBusy" class="min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">{{ $t('shipment.saveMapping') }}</button>
          </form>
        </details>
      </div>

    </section>

    <section class="rounded-2xl bg-white p-6 shadow">
      <button
        type="button"
        class="flex w-full items-start justify-between gap-4 text-start"
        @click="isFormOpen = !isFormOpen"
      >
        <div>
          <h3 class="text-2xl font-bold">
            {{ editingId ? $t('common.editShippingCompany') : $t('common.addShippingCompany') }}
          </h3>
          <p class="mt-1 text-sm text-gray-500">
            {{ $t('dashboard.commerce.setCarrierPricesAndNotes') }}
          </p>
        </div>

        <div class="flex items-center gap-2 pt-1 text-sm font-medium text-gray-500">
          <span>{{ isFormOpen ? $t('common.collapse') : $t('common.expand') }}</span>
          <Icon
            name="lucide:chevron-down"
            size="18"
            class="transition-transform"
            :class="isFormOpen ? 'rotate-180' : ''"
          />
        </div>
      </button>

      <div v-if="isFormOpen" class="mt-6">
        <div class="flex justify-end">
          <button
            v-if="editingId"
            type="button"
            class="rounded-lg bg-gray-200 px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-300"
            @click="resetForm"
          >
            {{ $t('common.cancelEdit') }}
          </button>
        </div>

        <div class="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.companyName') }}</label>
          <input
            v-model="form.name"
            type="text"
            :placeholder="$t('common.shippingCompanyName')"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.code') }}</label>
          <input
            v-model="form.code"
            type="text"
            :placeholder="$t('common.optionalCode')"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.shippingCost') }}</label>
          <input
            v-model="form.shipping_cost"
            type="number"
            min="0"
            step="0.01"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.returnCost') }}</label>
          <input
            v-model="form.return_cost"
            type="number"
            min="0"
            step="0.01"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('dashboard.commerce.shippingPriceForClient') }}</label>
          <input
            v-model="form.client_shipping_price"
            type="number"
            min="0"
            step="0.01"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.notes') }}</label>
          <textarea
            v-model="form.notes"
            rows="3"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            :placeholder="$t('common.optionalNotes')"
          />
        </div>
        </div>

        <label class="mt-4 flex items-center gap-2 text-sm text-gray-600">
          <input v-model="form.is_active" type="checkbox">
          {{ $t('common.active') }}
        </label>

        <p v-if="formError" class="mt-4 text-sm text-red-600">
          {{ $uiMessage(formError) }}
        </p>

        <div class="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            :disabled="saving"
            class="rounded-lg bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            @click="saveCompany"
          >
            {{ saving ? $t('common.saving') : editingId ? $t('common.saveCompany') : $t('common.addCompany') }}
          </button>

          <button
            v-if="editingId"
            type="button"
            :disabled="deleting"
            class="rounded-lg bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
            @click="deleteCompany"
          >
            {{ deleting ? $t('common.deleting') : $t('common.delete') }}
          </button>
        </div>
      </div>
    </section>

    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 class="text-2xl font-bold">{{ $t('common.companyList') }}</h3>
          <p class="mt-1 text-sm text-gray-500">
            {{ $t('dashboard.commerce.manageActiveAndInactiveCarriers') }}
          </p>
        </div>

        <div class="w-full md:max-w-md">
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.search') }}</label>
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="$t('common.searchByName')"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>
      </div>

      <p v-if="pageError" class="mt-5 text-sm text-red-600">
        {{ $uiMessage(pageError) }}
      </p>

      <p v-else-if="loading" class="mt-5 text-sm text-gray-500">
        {{ $t('dashboard.commerce.loadingShippingCompanies') }}
      </p>

      <p v-else-if="!companies.length" class="mt-5 text-sm text-gray-500">
        {{ $t('dashboard.commerce.noShippingCompaniesFoundYet') }}
      </p>

      <div v-else class="mt-6 space-y-3">
        <div
          v-for="company in companies"
          :key="company.id"
          class="rounded-2xl border p-4"
        >
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-bold text-gray-900">{{ company.name }}</p>

                <span
                  class="rounded-full px-3 py-1 text-xs font-semibold uppercase"
                  :class="company.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'"
                >
                  {{ company.is_active ? $t('common.active') : $t('common.inactive') }}
                </span>
              </div>

              <p class="text-sm text-gray-600">
                {{ $t('dashboard.commerce.shippingValueReturnValue', { value0: (formatCommerceCurrency(company.shipping_cost)), value1: (formatCommerceCurrency(company.return_cost)) }) }}
              </p>

              <p class="text-sm text-gray-500">
                {{ $t('common.clientPaysValue', { value0: (formatCommerceCurrency(company.client_shipping_price)) }) }}
              </p>

              <p class="text-xs text-gray-400">
                {{ formatCommerceDate(company.updated_at || company.created_at) }}
              </p>
            </div>

            <div class="flex gap-2">
              <button
                type="button"
                class="rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
                @click="startEdit(company)"
              >
                {{ $t('common.edit') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
const { uiLabel } = useUiLocale()

const { intlLocale } = useUiLocale()
const formatCommerceCurrency = value => baseFormatCommerceCurrency(value, intlLocale.value)
const formatCommerceDate = value => baseFormatCommerceDate(value, intlLocale.value)

import { shippingStates, shipmentStateKey } from '~/utils/shipmentTracking'
import { formatCommerceCurrency as baseFormatCommerceCurrency, formatCommerceDate as baseFormatCommerceDate } from '~/utils/commerce'

const supabase = useSupabaseClient()
const { recordAdminLog } = useAdminLogs()
const { hasPermission, loadAdminAccess } = useAdminAccess()

const companies = ref([])
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const pageError = ref('')
const formError = ref('')
const searchQuery = ref('')
const editingId = ref('')
const isFormOpen = ref(false)
const pdcLoading = ref(false)
const pdcSaving = ref(false)
const pdcPageError = ref('')
const pdcFormError = ref('')
const pdcSavedMessage = ref('')
let searchTimeoutId = null

const canConfigureShipping = computed(() => hasPermission('settings.edit'))

const createEmptyPdcSettings = () => ({
  display_name: 'PDC Courier',
  base_url: 'https://clientsapi.pdc-eg.com/api/ClientUsers/V6/',
  api_mode: 'production',
  status_timezone: 'Africa/Cairo',
  cities_cache: [],
  products_cache: [],
  cities_synced_at: null,
  products_synced_at: null,
  company_id: '',
  product_id: '',
  origin_city_id: '',
  origin_address: '',
  origin_phone: '',
  origin_contact_name: '',
  default_weight_kg: 1,
  shipment_type_id: 1,
  label_template_id: 1,
  allow_open_shipment: false,
  all_must_valid: true,
  is_enabled: false,
  auto_create_labels: false,
  access_token: '',
  webhook_secret: '',
  access_token_configured: false,
  webhook_secret_configured: false,
  encryption_ready: false,
  live_requests_enabled: false,
  city_mapping_count: 0,
  pending_job_count: 0
})

const pdcMappings = ref([])
const pdcActionBusy = ref(false)
const pdcActionError = ref('')
const pdcActionMessage = ref('')
const pdcNewMapping = reactive({ provider_status_id: '', provider_label: '', normalized_state: 'unknown', provider_aliases: [] })
const pdcNewAliases = ref('')

const pdcSettings = reactive(createEmptyPdcSettings())

const getAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession()

  if (!data.session?.access_token) {
    throw new Error('Your session expired. Please log in again.')
  }

  return {
    authorization: `Bearer ${data.session.access_token}`
  }
}

const loadPdcSettings = async () => {
  if (!canConfigureShipping.value) {
    return
  }

  pdcLoading.value = true
  pdcPageError.value = ''

  try {
    const response = await $fetch('/api/admin-shipping/settings', {
      headers: await getAuthHeaders()
    })

    Object.assign(pdcSettings, createEmptyPdcSettings(), response.settings || {})
    pdcMappings.value = response.mappings || []
  } catch (error) {
    pdcPageError.value = error?.data?.statusMessage || error?.message || 'Could not load PDC settings.'
  } finally {
    pdcLoading.value = false
  }
}

const runPdcLookup = async action => {
  if (pdcActionBusy.value) return
  pdcActionBusy.value = true; pdcActionError.value = ''; pdcActionMessage.value = ''
  try {
    await $fetch('/api/admin-shipping/lookups', { method: 'POST', headers: await getAuthHeaders(), body: { action } })
    if (action === 'sync') await loadPdcSettings()
    pdcActionMessage.value = action === 'sync' ? 'shipment.lookupsSynced' : 'shipment.connected'
  } catch { pdcActionError.value = 'failed' } finally { pdcActionBusy.value = false }
}

const savePdcMapping = async mapping => {
  if (pdcActionBusy.value) return
  pdcActionBusy.value = true; pdcActionError.value = ''; pdcActionMessage.value = ''
  try {
    await $fetch('/api/admin-shipping/mappings', { method: 'PATCH', headers: await getAuthHeaders(), body: {
      ...mapping, provider_aliases: mapping === pdcNewMapping ? pdcNewAliases.value.split('|').map(a => a.trim()).filter(Boolean) : mapping.provider_aliases
    } })
    await loadPdcSettings()
    pdcActionMessage.value = 'shipment.mappingSaved'
  } catch { pdcActionError.value = 'failed' } finally { pdcActionBusy.value = false }
}

const savePdcSettings = async () => {
  pdcSaving.value = true
  pdcFormError.value = ''
  pdcSavedMessage.value = ''

  try {
    await $fetch('/api/admin-shipping/settings', {
      method: 'PATCH',
      headers: await getAuthHeaders(),
      body: {
        display_name: pdcSettings.display_name,
        base_url: pdcSettings.base_url,
        api_mode: pdcSettings.api_mode,
        status_timezone: pdcSettings.status_timezone,
        company_id: pdcSettings.company_id,
        product_id: pdcSettings.product_id,
        origin_city_id: pdcSettings.origin_city_id,
        origin_address: pdcSettings.origin_address,
        origin_phone: pdcSettings.origin_phone,
        origin_contact_name: pdcSettings.origin_contact_name,
        default_weight_kg: pdcSettings.default_weight_kg,
        shipment_type_id: pdcSettings.shipment_type_id,
        label_template_id: pdcSettings.label_template_id,
        allow_open_shipment: pdcSettings.allow_open_shipment,
        all_must_valid: pdcSettings.all_must_valid,
        is_enabled: pdcSettings.is_enabled,
        auto_create_labels: pdcSettings.auto_create_labels,
        access_token: pdcSettings.access_token,
        webhook_secret: pdcSettings.webhook_secret
      }
    })

    pdcSettings.access_token = ''
    pdcSettings.webhook_secret = ''
    const liveCallsOff = !pdcSettings.live_requests_enabled
    await loadPdcSettings()
    pdcSavedMessage.value = liveCallsOff
      ? 'Settings saved. Live calls remain off.'
      : 'Settings saved.'
  } catch (error) {
    pdcFormError.value = error?.data?.statusMessage || error?.message || 'Could not save PDC settings.'
  } finally {
    pdcSaving.value = false
  }
}

const createEmptyForm = () => ({
  name: '',
  code: '',
  shipping_cost: '',
  return_cost: '',
  client_shipping_price: '',
  notes: '',
  is_active: true
})

const form = reactive(createEmptyForm())

const isMissingSchemaError = (error) => {
  return error?.code === '42P01' || error?.code === '42703'
}

const resetForm = () => {
  editingId.value = ''
  Object.assign(form, createEmptyForm())
  formError.value = ''
}

const loadCompanies = async () => {
  loading.value = true
  pageError.value = ''

  try {
    let query = supabase
      .from('commerce_shipping_companies')
      .select('*')
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })

    const searchValue = String(searchQuery.value || '').trim()
    if (searchValue) {
      query = query.ilike('name', `%${searchValue}%`)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    companies.value = data || []
  } catch (error) {
    pageError.value = isMissingSchemaError(error)
      ? 'Run the new commerce SQL first, then refresh this page.'
      : error.message || 'Could not load shipping companies.'
  } finally {
    loading.value = false
  }
}

const mapPayload = () => ({
  name: String(form.name || '').trim(),
  code: String(form.code || '').trim() || null,
  shipping_cost: Number(form.shipping_cost || 0),
  return_cost: Number(form.return_cost || 0),
  client_shipping_price: Number(form.client_shipping_price || 0),
  notes: String(form.notes || '').trim() || null,
  is_active: Boolean(form.is_active),
  updated_at: new Date().toISOString()
})

const startEdit = (company) => {
  isFormOpen.value = true
  editingId.value = company.id
  Object.assign(form, {
    name: company.name || '',
    code: company.code || '',
    shipping_cost: String(Number(company.shipping_cost || 0)),
    return_cost: String(Number(company.return_cost || 0)),
    client_shipping_price: String(Number(company.client_shipping_price || 0)),
    notes: company.notes || '',
    is_active: company.is_active ?? true
  })
  formError.value = ''
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
}

const saveCompany = async () => {
  formError.value = ''
  const payload = mapPayload()

  if (!payload.name) {
    formError.value = 'Company name is required.'
    return
  }

  saving.value = true

  try {
    if (editingId.value) {
      const { error } = await supabase
        .from('commerce_shipping_companies')
        .update(payload)
        .eq('id', editingId.value)

      if (error) {
        throw error
      }

      await recordAdminLog({
        actionKey: 'commerce.shipping.update',
        description: `Updated shipping company ${payload.name}.`,
        metadata: {
          shipping_company_id: editingId.value
        }
      })
    } else {
      const { data, error } = await supabase
        .from('commerce_shipping_companies')
        .insert(payload)
        .select('id')
        .single()

      if (error) {
        throw error
      }

      await recordAdminLog({
        actionKey: 'commerce.shipping.create',
        description: `Added shipping company ${payload.name}.`,
        metadata: {
          shipping_company_id: data?.id || null
        }
      })
    }

    resetForm()
    await loadCompanies()
  } catch (error) {
    formError.value = isMissingSchemaError(error)
      ? 'Run the new commerce SQL first, then refresh this page.'
      : error.message || 'Could not save this shipping company.'
  } finally {
    saving.value = false
  }
}

const deleteCompany = async () => {
  if (!editingId.value) {
    return
  }

  const confirmed = confirm(uiLabel('Delete this shipping company?'))
  if (!confirmed) {
    return
  }

  deleting.value = true

  try {
    const companyName = form.name
    const companyId = editingId.value
    const { error } = await supabase
      .from('commerce_shipping_companies')
      .delete()
      .eq('id', companyId)

    if (error) {
      throw error
    }

    await recordAdminLog({
      actionKey: 'commerce.shipping.delete',
      description: `Deleted shipping company ${companyName}.`,
      metadata: {
        shipping_company_id: companyId
      }
    })

    resetForm()
    await loadCompanies()
  } catch (error) {
    formError.value = error.message || 'Could not delete this shipping company.'
  } finally {
    deleting.value = false
  }
}

watch(searchQuery, () => {
  if (searchTimeoutId) {
    clearTimeout(searchTimeoutId)
  }

  searchTimeoutId = setTimeout(() => {
    loadCompanies()
  }, 300)
})

onBeforeUnmount(() => {
  if (searchTimeoutId) {
    clearTimeout(searchTimeoutId)
  }
})

onMounted(async () => {
  await loadAdminAccess()
  await Promise.all([
    loadCompanies(),
    loadPdcSettings()
  ])
})
</script>
