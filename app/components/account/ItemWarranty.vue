<script setup>
import { warrantyEntitlement, warrantyDurationKey } from '~/utils/warranty'
const props = defineProps({ item: { type: Object, required: true } })
const entitlement = computed(() => warrantyEntitlement(props.item))
</script>

<template>
  <div class="item-warranty mt-3 flex items-start gap-2 text-xs text-slate-600" data-item-warranty>
    <Icon :name="entitlement.hasWarranty === true ? 'lucide:shield-check' : 'lucide:shield'" size="15" aria-hidden="true" class="mt-0.5 shrink-0" />
    <dl class="min-w-0">
      <dt class="font-semibold text-slate-700">{{ $t('warranty.title') }}</dt>
      <dd v-if="entitlement.duration" class="mt-0.5 font-medium">{{ $t(warrantyDurationKey(entitlement.duration), { value: entitlement.duration.value }) }}</dd>
      <dd v-else class="mt-0.5">{{ $t(entitlement.information === 'none' ? 'warranty.none' : 'warranty.unavailable') }}</dd>
    </dl>
  </div>
</template>
