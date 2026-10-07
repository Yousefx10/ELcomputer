<script setup>
import { warrantyEntitlement, warrantyDurationKey } from '~/utils/warranty'
import { formatAccountCalendarDate } from '~/utils/accountOrders'
const props = defineProps({ item: { type: Object, required: true } })
const entitlement = computed(() => warrantyEntitlement(props.item))
const period = computed(() => props.item.after_sales?.warranty?.period)
const hasDates = computed(() => ['active', 'expired'].includes(period.value?.status))
const { locale } = useI18n()
const date = value => formatAccountCalendarDate(value, locale.value === 'ar' ? 'ar-EG' : 'en-GB')
</script>

<template>
  <div class="item-warranty mt-3 flex items-start gap-2 text-xs text-slate-600" data-item-warranty>
    <Icon :name="entitlement.hasWarranty === true ? 'lucide:shield-check' : 'lucide:shield'" size="15" aria-hidden="true" class="mt-0.5 shrink-0" />
    <dl class="min-w-0">
      <dt class="font-semibold text-slate-700">{{ $t('warranty.title') }}</dt>
      <dd v-if="entitlement.duration" class="mt-0.5 font-medium">{{ $t(warrantyDurationKey(entitlement.duration), { value: entitlement.duration.value }) }}</dd>
      <dd v-else class="mt-0.5">{{ $t(entitlement.information === 'none' ? 'warranty.none' : 'warranty.unavailable') }}</dd>
      <template v-if="entitlement.duration && period">
        <dd v-if="hasDates && period.start_date" class="mt-1">{{ $t('warranty.started', { date: date(period.start_date) }) }}</dd>
        <dd v-if="hasDates && period.expiry_date" class="mt-0.5">{{ $t('warranty.ends', { date: date(period.expiry_date) }) }}</dd>
        <dd class="mt-1 font-medium" data-warranty-period>{{ $t(`warranty.period.${period.status === 'unknown' ? (period.reason === 'delivery_date_unavailable' ? 'pending_delivery' : 'unavailable') : period.status}`) }}</dd>
      </template>
    </dl>
  </div>
</template>
