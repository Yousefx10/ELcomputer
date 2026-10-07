<script setup>
import { MAX_WARRANTY_MONTHS } from '~/utils/warranty'
const props = defineProps({ modelValue: { type: Object, required: true }, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])
const changeStatus = status => emit('update:modelValue', {
  warranty_status: status,
  warranty_duration_value: status === 'included' ? props.modelValue.warranty_duration_value : null,
  warranty_duration_unit: status === 'included' ? (props.modelValue.warranty_duration_unit || 'months') : null
})
const change = (key, value) => emit('update:modelValue', { ...props.modelValue, [key]: value })
</script>

<template>
  <fieldset :disabled="disabled" class="warranty-fields md:col-span-2 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-900">
    <legend class="px-1 text-lg font-bold">{{ $t('warranty.title') }}</legend>
    <p class="text-sm text-slate-600">{{ $t('warranty.productHelp') }}</p>
    <label class="block text-sm font-semibold">{{ $t('warranty.option') }}
      <select :value="modelValue.warranty_status" class="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900" data-warranty-status @change="changeStatus($event.target.value)">
        <option value="unknown">{{ $t('warranty.unconfigured') }}</option>
        <option value="none">{{ $t('warranty.none') }}</option>
        <option value="included">{{ $t('warranty.included') }}</option>
      </select>
    </label>
    <div v-if="modelValue.warranty_status === 'included'" class="grid gap-4 sm:grid-cols-2">
      <label class="block text-sm font-semibold">{{ $t('warranty.duration') }}
        <input :value="modelValue.warranty_duration_value" type="number" required min="1" :max="modelValue.warranty_duration_unit === 'years' ? MAX_WARRANTY_MONTHS / 12 : MAX_WARRANTY_MONTHS" step="1" inputmode="numeric" class="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900" data-warranty-duration @input="change('warranty_duration_value', $event.target.value)">
      </label>
      <label class="block text-sm font-semibold">{{ $t('warranty.unit') }}
        <select :value="modelValue.warranty_duration_unit" class="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900" data-warranty-unit @change="change('warranty_duration_unit', $event.target.value)">
          <option value="months">{{ $t('warranty.monthsUnit') }}</option>
          <option value="years">{{ $t('warranty.yearsUnit') }}</option>
        </select>
      </label>
    </div>
    <p class="text-xs text-slate-600">{{ $t('warranty.specificationHelp') }}</p>
  </fieldset>
</template>
