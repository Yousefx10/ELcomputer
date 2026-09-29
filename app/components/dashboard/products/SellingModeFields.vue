<template>
  <section class="md:col-span-2 space-y-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-5" aria-labelledby="selling-status-title">
    <div><h3 id="selling-status-title" class="text-lg font-bold text-gray-900">{{ $t('common.sellingStatus') }}</h3><p class="text-sm text-gray-600">{{ $t('dashboard.products.chooseWhenCustomersCanOrderThisProduct') }}</p></div>
    <label class="block text-sm font-semibold text-gray-700">{{ $t('common.status') }}
      <select :value="modelValue.selling_mode" class="mt-2 w-full rounded-lg border bg-white p-3" @change="change('selling_mode', $event.target.value)">
        <option value="normal">{{ $t('common.normal') }}</option><option value="coming_soon">{{ $t('common.comingSoon') }}</option><option value="preorder">{{ $t('common.preOrder') }}</option>
      </select>
    </label>
    <template v-if="modelValue.selling_mode !== 'normal'">
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block text-sm font-semibold text-gray-700">{{ $t('dashboard.products.expectedAvailabilityOptional') }}
          <input :value="modelValue.expected_availability_date" type="date" class="mt-2 w-full rounded-lg border bg-white p-3" @input="change('expected_availability_date', $event.target.value)">
        </label>
        <label class="block text-sm font-semibold text-gray-700">{{ $t('dashboard.products.customerMessageOptional') }}
          <input :value="modelValue.availability_message" maxlength="500" type="text" class="mt-2 w-full rounded-lg border bg-white p-3" :placeholder="$t('common.expectedOctober2026')" @input="change('availability_message', $event.target.value)">
        </label>
      </div>
    </template>
    <template v-if="modelValue.selling_mode === 'preorder'">
      <label class="flex items-center gap-3 text-sm font-semibold text-gray-700"><input :checked="modelValue.preorder_active" type="checkbox" @change="change('preorder_active', $event.target.checked)"> {{ $t('common.acceptPreorders') }}</label>
      <fieldset class="space-y-2"><legend class="text-sm font-semibold text-gray-700">{{ $t('common.paymentRequired') }}</legend>
        <label class="flex items-center gap-2 text-sm"><input :checked="modelValue.preorder_payment_mode === 'full'" name="preorder-payment-mode" type="radio" @change="change('preorder_payment_mode', 'full')"> {{ $t('common.fullPayment') }}</label>
        <label class="flex items-center gap-2 text-sm"><input :checked="modelValue.preorder_payment_mode === 'deposit'" name="preorder-payment-mode" type="radio" @change="change('preorder_payment_mode', 'deposit')"> {{ $t('common.percentageDeposit') }}</label>
      </fieldset>
      <label v-if="modelValue.preorder_payment_mode === 'deposit'" class="block max-w-48 text-sm font-semibold text-gray-700">{{ $t('common.depositPercentage') }}
        <input :value="modelValue.preorder_deposit_percent" type="number" min="0.01" max="99.99" step="0.01" inputmode="decimal" class="mt-2 w-full rounded-lg border bg-white p-3" @input="change('preorder_deposit_percent', $event.target.value)">
      </label>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block text-sm font-semibold text-gray-700">{{ $t('dashboard.products.preordersStartOptional') }}
          <input :value="modelValue.preorder_starts_at" type="datetime-local" class="mt-2 w-full rounded-lg border bg-white p-3" @input="change('preorder_starts_at', $event.target.value)">
        </label>
        <label class="block text-sm font-semibold text-gray-700">{{ $t('dashboard.products.preordersCloseOptional') }}
          <input :value="modelValue.preorder_ends_at" type="datetime-local" class="mt-2 w-full rounded-lg border bg-white p-3" @input="change('preorder_ends_at', $event.target.value)">
        </label>
        <label class="block text-sm font-semibold text-gray-700">{{ $t('dashboard.products.maximumTotalPreordersOptional') }}
          <input :value="modelValue.preorder_total_limit" type="number" min="1" step="1" class="mt-2 w-full rounded-lg border bg-white p-3" @input="change('preorder_total_limit', $event.target.value)">
        </label>
        <label class="block text-sm font-semibold text-gray-700">{{ $t('dashboard.products.maximumPerCustomerOptional') }}
          <input :value="modelValue.preorder_customer_limit" type="number" min="1" step="1" class="mt-2 w-full rounded-lg border bg-white p-3" @input="change('preorder_customer_limit', $event.target.value)">
        </label>
      </div>
      <p class="text-xs text-gray-600">{{ $t('dashboard.products.preordersReserveAnAllocationWarehouseStockRemainsUnchangedUntilFulfillment') }}</p>
    </template>
  </section>
</template>
<script setup>
const props = defineProps({ modelValue: { type: Object, required: true } })
const emit = defineEmits(['update:modelValue'])
const change = (key, value) => emit('update:modelValue', { ...props.modelValue, [key]: value })
</script>
