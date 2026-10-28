<script setup>
import { deliveryLocationReference as reference, findDeliveryLocation } from '~/utils/deliveryLocationReference'

const props = defineProps({ modelValue: { type: Object, required: true }, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()
const selected = computed(() => findDeliveryLocation(props.modelValue.governorate, props.modelValue.city))
const selectedGovernorate = computed(() => selected.value?.governorate || reference.governorates.find(row => row.checkout_name === props.modelValue.governorate))
const cities = computed(() => reference.cities.filter(row => row.governorate_id === selectedGovernorate.value?.id))
const governorate = id => {
  const row = reference.governorates.find(option => option.id === id)
  if (row && !props.disabled && row.id !== selectedGovernorate.value?.id) emit('update:modelValue', { ...props.modelValue, governorate: row.checkout_name, city: '' })
}
const city = id => {
  const row = cities.value.find(option => option.id === id)
  if (row && !props.disabled) emit('update:modelValue', { ...props.modelValue, governorate: selectedGovernorate.value.checkout_name, city: row.name_en })
}
</script>

<template>
  <div class="grid min-w-0 gap-4 sm:col-span-2 sm:grid-cols-2 md:col-span-2">
    <AddressLocationSearchSelect :model-value="selectedGovernorate?.id || ''" :label="t('common.governorate')"
      :options="reference.governorates" :disabled="disabled" @update:model-value="governorate" />
    <AddressLocationSearchSelect :model-value="selected?.city.id || ''" :label="t('common.cityVariant2')"
      :options="cities" :disabled="disabled || !selectedGovernorate" @update:model-value="city" />
    <p v-if="!selected && modelValue.city" role="status" class="text-sm text-slate-500 sm:col-span-2">
      {{ t('deliveryLocations.saved') }} <bdi>{{ [modelValue.city, modelValue.governorate].filter(Boolean).join(', ') }}</bdi>
      <span class="block">{{ t('deliveryLocations.legacy') }}</span>
    </p>
  </div>
</template>
