<template>
  <section class="md:col-span-2 space-y-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-5" aria-labelledby="selling-status-title">
    <div><h3 id="selling-status-title" class="text-lg font-bold text-gray-900">Selling status</h3><p class="text-sm text-gray-600">Choose when customers can order this product.</p></div>
    <label class="block text-sm font-semibold text-gray-700">Status
      <select :value="modelValue.selling_mode" class="mt-2 w-full rounded-lg border bg-white p-3" @change="change('selling_mode', $event.target.value)">
        <option value="normal">Normal</option><option value="coming_soon">Coming Soon</option><option value="preorder">Pre-order</option>
      </select>
    </label>
    <template v-if="modelValue.selling_mode !== 'normal'">
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block text-sm font-semibold text-gray-700">Expected availability (optional)
          <input :value="modelValue.expected_availability_date" type="date" class="mt-2 w-full rounded-lg border bg-white p-3" @input="change('expected_availability_date', $event.target.value)">
        </label>
        <label class="block text-sm font-semibold text-gray-700">Customer message (optional)
          <input :value="modelValue.availability_message" maxlength="500" type="text" class="mt-2 w-full rounded-lg border bg-white p-3" placeholder="Expected October 2026" @input="change('availability_message', $event.target.value)">
        </label>
      </div>
    </template>
    <template v-if="modelValue.selling_mode === 'preorder'">
      <label class="flex items-center gap-3 text-sm font-semibold text-gray-700"><input :checked="modelValue.preorder_active" type="checkbox" @change="change('preorder_active', $event.target.checked)"> Accept preorders</label>
      <fieldset class="space-y-2"><legend class="text-sm font-semibold text-gray-700">Payment required</legend>
        <label class="flex items-center gap-2 text-sm"><input :checked="modelValue.preorder_payment_mode === 'full'" name="preorder-payment-mode" type="radio" @change="change('preorder_payment_mode', 'full')"> Full payment</label>
        <label class="flex items-center gap-2 text-sm"><input :checked="modelValue.preorder_payment_mode === 'deposit'" name="preorder-payment-mode" type="radio" @change="change('preorder_payment_mode', 'deposit')"> Percentage deposit</label>
      </fieldset>
      <label v-if="modelValue.preorder_payment_mode === 'deposit'" class="block max-w-48 text-sm font-semibold text-gray-700">Deposit percentage
        <input :value="modelValue.preorder_deposit_percent" type="number" min="0.01" max="99.99" step="0.01" inputmode="decimal" class="mt-2 w-full rounded-lg border bg-white p-3" @input="change('preorder_deposit_percent', $event.target.value)">
      </label>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block text-sm font-semibold text-gray-700">Preorders start (optional)
          <input :value="modelValue.preorder_starts_at" type="datetime-local" class="mt-2 w-full rounded-lg border bg-white p-3" @input="change('preorder_starts_at', $event.target.value)">
        </label>
        <label class="block text-sm font-semibold text-gray-700">Preorders close (optional)
          <input :value="modelValue.preorder_ends_at" type="datetime-local" class="mt-2 w-full rounded-lg border bg-white p-3" @input="change('preorder_ends_at', $event.target.value)">
        </label>
        <label class="block text-sm font-semibold text-gray-700">Maximum total preorders (optional)
          <input :value="modelValue.preorder_total_limit" type="number" min="1" step="1" class="mt-2 w-full rounded-lg border bg-white p-3" @input="change('preorder_total_limit', $event.target.value)">
        </label>
        <label class="block text-sm font-semibold text-gray-700">Maximum per customer (optional)
          <input :value="modelValue.preorder_customer_limit" type="number" min="1" step="1" class="mt-2 w-full rounded-lg border bg-white p-3" @input="change('preorder_customer_limit', $event.target.value)">
        </label>
      </div>
      <p class="text-xs text-gray-600">Preorders reserve an allocation. Warehouse stock remains unchanged until fulfillment.</p>
    </template>
  </section>
</template>
<script setup>
const props = defineProps({ modelValue: { type: Object, required: true } })
const emit = defineEmits(['update:modelValue'])
const change = (key, value) => emit('update:modelValue', { ...props.modelValue, [key]: value })
</script>
