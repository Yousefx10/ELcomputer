<template>
  <div>
    <label class="mb-2 block text-sm font-semibold text-gray-700">Amount *</label>
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
    <label class="mb-2 block text-sm font-semibold text-gray-700">Payment Date *</label>
    <input
      :value="paidAt"
      required
      type="date"
      class="w-full rounded-lg border p-3 outline-none focus:border-amber-500"
      @input="$emit('update:paidAt', $event.target.value)"
    >
  </div>

  <div>
    <label class="mb-2 block text-sm font-semibold text-gray-700">Reference Number</label>
    <input
      :value="referenceNumber"
      type="text"
      placeholder="Receipt, transfer, or cheque number"
      class="w-full rounded-lg border p-3 outline-none focus:border-amber-500"
      @input="$emit('update:referenceNumber', $event.target.value)"
    >
  </div>

  <div>
    <label class="mb-2 block text-sm font-semibold text-gray-700">Notes</label>
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
