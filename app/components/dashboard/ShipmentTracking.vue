<template>
 <div class="mt-3 space-y-2 text-sm" data-shipment-tracking>
  <p class="font-semibold" style="color:var(--text-primary,#172842)">{{ $t(shipmentStateKey(shipping.normalized_state)) }}</p>
  <p v-if="shipping.tracking?.last_success_at" class="text-xs" style="color:var(--text-secondary,#526174)">{{ $t('shipment.checkedAt') }} <time :datetime="shipping.tracking.last_success_at">{{ formatDate(shipping.tracking.last_success_at) }}</time></p>
  <p v-if="shipping.tracking?.latest_update_at" class="text-xs" style="color:var(--text-secondary,#526174)">{{ $t('shipment.lastUpdate') }} <time :datetime="shipping.tracking.latest_update_at">{{ formatDate(shipping.tracking.latest_update_at) }}</time></p>
  <p v-if="!shipping.tracking?.booking_verified" role="status">{{ $t('shipment.unverifiedBooking') }}</p>
  <p v-else-if="shipping.tracking?.stale" role="status">{{ $t('shipment.stale') }}</p>
  <p v-if="shipping.tracking?.error_code" class="text-xs" role="status">{{ $t('shipment.trackingError') }} <span dir="ltr">{{ shipping.tracking.error_code }}</span></p>
  <p v-if="shipping.tracking?.automatic_paused" class="text-xs">{{ $t('shipment.pollingPaused') }}</p>
  <p v-if="shipping.tracking?.next_attempt_at" class="text-xs" style="color:var(--text-secondary,#526174)">{{ $t('shipment.nextCheck') }} <time :datetime="shipping.tracking.next_attempt_at">{{ formatDate(shipping.tracking.next_attempt_at) }}</time></p>
  <details v-if="shipping.events?.length" class="rounded-lg border p-3">
   <summary class="cursor-pointer font-semibold">{{ $t('shipment.history') }}</summary>
   <ol class="mt-3 space-y-3"><li v-for="event in shipping.events" :key="event.id" class="break-words">
    <p class="font-semibold">{{ $t(shipmentStateKey(event.normalized_state)) }} <span v-if="event.provider_status_id" dir="ltr">({{ event.provider_status_id }})</span></p>
    <p v-if="event.provider_status_name">{{ event.provider_status_name }}</p><p v-if="event.reason_name">{{ event.reason_name }}</p>
    <p class="text-xs" style="color:var(--text-secondary,#526174)"><time :datetime="event.status_date||event.received_at">{{ formatDate(event.status_date||event.received_at) }}</time> · {{ event.source }}</p>
    <p v-if="['regression','conflict'].includes(event.projection_disposition)" class="text-xs">{{ $t('shipment.withheldConflict') }}</p>
   </li></ol>
  </details>
 </div>
</template>
<script setup>
import {shipmentStateKey} from '../../utils/shipmentTracking.js'
defineProps({shipping:{type:Object,required:true},formatDate:{type:Function,required:true}})
</script>
