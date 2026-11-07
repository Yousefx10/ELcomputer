<script setup>
import { PRICING_ZONES, courierCost, customerFee } from '~/utils/shippingZonePricing'
const props = defineProps({ modelValue: { type: Object, required: true }, enabled: Boolean, governorates: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue', 'update:enabled'])
const { uiLabel } = useUiLocale()
const update = change => { const next = JSON.parse(JSON.stringify(props.modelValue)); change(next); emit('update:modelValue', next) }
const money = value => value === null ? '—' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
</script>

<template>
  <fieldset class="mt-6 rounded-lg border p-4" data-zone-pricing>
    <legend class="px-1 text-sm font-semibold text-gray-700">{{ $t('shippingPricing.title') }}</legend>
    <label class="flex items-center gap-2 text-sm text-gray-600"><input :checked="enabled" type="checkbox" @change="emit('update:enabled', $event.target.checked)">{{ $t('shippingPricing.enabled') }}</label>
    <template v-if="enabled">
      <p class="mt-2 text-sm text-gray-500">{{ $t('shippingPricing.help') }}</p>
      <div class="mt-4 grid gap-3 sm:grid-cols-3">
        <label class="text-sm text-gray-600">{{ $t('shippingPricing.vat') }}<input :value="modelValue.vat_percent" inputmode="decimal" maxlength="5" class="mt-1 w-full rounded-lg border p-2" @input="update(n => { n.vat_percent = $event.target.value })"></label>
        <label class="text-sm text-gray-600">{{ $t('shippingPricing.roundTo') }}<input :value="modelValue.round_to" inputmode="numeric" maxlength="3" class="mt-1 w-full rounded-lg border p-2" @input="update(n => { n.round_to = $event.target.value })"></label>
        <label class="text-sm text-gray-600">{{ $t('shippingPricing.support') }}<input :value="modelValue.support" inputmode="decimal" maxlength="8" class="mt-1 w-full rounded-lg border p-2" @input="update(n => { n.support = $event.target.value })"></label>
      </div>
      <p class="mt-4 text-sm font-semibold text-gray-700">{{ $t('shippingPricing.zoneRates') }}</p>
      <div class="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-6">
        <label v-for="zone in PRICING_ZONES" :key="zone" class="text-sm text-gray-600">{{ $t('shippingPricing.zone', { value0: zone }) }}<input :value="modelValue.zones[zone]" inputmode="decimal" maxlength="8" class="mt-1 w-full rounded-lg border p-2" @input="update(n => { n.zones[zone] = $event.target.value })"></label>
      </div>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full min-w-[420px] text-sm">
          <thead><tr class="text-start text-gray-500"><th class="py-2 text-start font-medium">{{ $t('shippingPricing.governorate') }}</th><th class="py-2 text-start font-medium">{{ $t('shippingPricing.zoneLabel') }}</th><th class="py-2 text-end font-medium">{{ $t('shippingPricing.cost') }}</th><th class="py-2 text-end font-medium">{{ $t('shippingPricing.customerPays') }}</th></tr></thead>
          <tbody>
            <tr v-for="area in governorates" :key="area" class="border-t">
              <td class="py-2">{{ uiLabel(area) }}</td>
              <td class="py-2"><select :value="modelValue.governorates[area] || ''" class="rounded-lg border bg-white p-1.5" @change="update(n => { n.governorates[area] = $event.target.value })"><option value="">{{ $t('shippingPricing.chooseZone') }}</option><option v-for="zone in PRICING_ZONES" :key="zone" :value="zone">{{ $t('shippingPricing.zone', { value0: zone }) }}</option></select></td>
              <td class="py-2 text-end text-gray-500">{{ money(courierCost(modelValue, modelValue.governorates[area])) }}</td>
              <td class="py-2 text-end font-semibold">{{ money(customerFee(modelValue, modelValue.governorates[area])) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </fieldset>
</template>
