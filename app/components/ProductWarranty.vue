<script setup>
import { normalizeProductWarranty, warrantyDurationKey } from '~/utils/warranty'
const props = defineProps({ product: { type: Object, required: true } })
const terms = computed(() => normalizeProductWarranty(props.product))
</script>
<template>
  <div class="my-4 flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700" data-product-warranty>
    <Icon name="lucide:shield-check" size="18" aria-hidden="true" class="shrink-0" />
    <div><p class="font-semibold">{{ $t('warranty.title') }}</p><p>{{ terms.warranty_status === 'included' ? $t(warrantyDurationKey({ value: terms.warranty_duration_value, unit: terms.warranty_duration_unit }), { value: terms.warranty_duration_value }) : $t(terms.warranty_status === 'none' ? 'warranty.none' : 'warranty.unavailable') }}</p></div>
  </div>
</template>
