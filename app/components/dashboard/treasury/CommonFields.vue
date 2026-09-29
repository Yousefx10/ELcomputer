<template>
  <div>
    <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.amount') }}</label>
    <input
      :value="amount"
      required
      min="0.01"
      :max="maximumAmount || undefined"
      step="0.01"
      type="number"
      class="w-full rounded-lg border p-3 outline-none focus:border-amber-500"
      @input="$emit('update:amount', $event.target.value)"
    >
  </div>

  <div>
    <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.paymentDate') }}</label>
    <input
      :value="paidAt"
      required
      type="date"
      class="w-full rounded-lg border p-3 outline-none focus:border-amber-500"
      @input="$emit('update:paidAt', $event.target.value)"
    >
  </div>

  <div>
    <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.referenceNumber') }}</label>
    <input
      :value="referenceNumber"
      type="text"
      :placeholder="$t('dashboard.treasury.receiptTransferOrChequeNumber')"
      class="w-full rounded-lg border p-3 outline-none focus:border-amber-500"
      @input="$emit('update:referenceNumber', $event.target.value)"
    >
  </div>

  <div>
    <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.notes') }}</label>
    <input
      :value="notes"
      type="text"
      class="w-full rounded-lg border p-3 outline-none focus:border-amber-500"
      @input="$emit('update:notes', $event.target.value)"
    >
  </div>
</template>

<script setup>
defineProps({
  amount: {
    type: [Number, String],
    default: ''
  },
  paidAt: {
    type: String,
    default: ''
  },
  referenceNumber: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  maximumAmount: {
    type: [Number, String],
    default: null
  }
})

defineEmits([
  'update:amount',
  'update:paidAt',
  'update:referenceNumber',
  'update:notes'
])
</script>
