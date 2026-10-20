<template>
  <section class="rounded-2xl border p-5">
    <h4 class="text-lg font-bold text-gray-900">{{ $t('codCash.title') }}</h4>
    <p class="mt-2 text-sm text-gray-600">{{ $t('codCash.separate') }}</p>
    <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-2">
      <div v-for="field in ['received', 'outstanding', 'reconciled', 'awaiting_reconciliation']" :key="field">
        <dt>{{ $t(`codCash.${field}`) }}</dt><dd class="font-bold">{{ formatCurrency(cash[field]) }}</dd>
      </div>
    </dl>
    <p v-if="!cash.history_consistent" class="mt-3 text-sm text-red-700">{{ $t('codCash.history') }}</p>
    <p v-if="externalErp || order.erp_owner !== 'built_in'" class="mt-3 text-sm text-amber-800">{{ $t('codCash.external') }}</p>
    <p v-else-if="!delivered" class="mt-3 text-sm text-gray-600">{{ $t('codCash.deliveryRequired') }}</p>
    <ul class="mt-4 space-y-3 text-sm">
      <li v-for="receipt in cash.collections" :key="receipt.id" class="border-t pt-3">
        <p>{{ formatCurrency(receipt.amount) }} · {{ receipt.reference }} · {{ receipt.received_on }}</p>
        <p class="mt-1 text-xs text-gray-500">{{ $t('codCash.confirmedBy') }} {{ receipt.confirmed_by }} · {{ formatDate(receipt.recorded_at) }}</p>
        <p v-if="reconciliation(receipt.id)" class="mt-1 text-xs text-gray-500">
          {{ $t('codCash.reconciled') }} · {{ reconciliation(receipt.id).reference }} · {{ reconciliation(receipt.id).reconciled_by }} · {{ formatDate(reconciliation(receipt.id).recorded_at) }}
        </p>
        <p v-else class="mt-1 text-xs text-amber-800">{{ $t('codCash.awaiting_reconciliation') }}</p>
      </li>
    </ul>
    <form v-if="eligible || cashCommand.command.value" class="mt-5 space-y-3 border-t pt-4" @submit.prevent="cashCommand.submit">
      <fieldset :disabled="cashCommand.locked.value" class="grid gap-3 sm:grid-cols-2">
        <label class="text-sm">{{ $t('codCash.action') }}
          <select v-model="form.action" class="mt-1 min-h-11 w-full rounded-lg border px-3">
            <option value="receive">{{ $t('codCash.receive') }}</option>
            <option v-if="canReconcile" value="reconcile">{{ $t('codCash.reconcile') }}</option>
          </select>
        </label>
        <label v-if="form.action === 'reconcile'" class="text-sm">{{ $t('codCash.receipt') }}
          <select v-model="form.collection_id" required class="mt-1 min-h-11 w-full rounded-lg border px-3">
            <option value="">{{ $t('codCash.chooseReceipt') }}</option>
            <option v-for="receipt in unreconciled" :key="receipt.id" :value="receipt.id">{{ receipt.reference }} · {{ formatCurrency(receipt.amount) }}</option>
          </select>
        </label>
        <label class="text-sm">{{ $t('codCash.amount') }}<input v-model="form.amount" type="number" min="0.01" step="0.01" required class="mt-1 min-h-11 w-full rounded-lg border px-3"></label>
        <label class="text-sm">{{ $t('codCash.reference') }}<input v-model="form.reference" required minlength="3" maxlength="120" class="mt-1 min-h-11 w-full rounded-lg border px-3"></label>
        <label class="text-sm">{{ $t(form.action === 'receive' ? 'codCash.receivedOn' : 'codCash.reconciledOn') }}<input v-model="form.received_on" type="date" required class="mt-1 min-h-11 w-full rounded-lg border px-3"></label>
        <label class="flex items-center gap-2 text-sm sm:col-span-2"><input v-model="form.confirmed" type="checkbox" required>{{ $t(form.action === 'receive' ? 'codCash.confirmReceipt' : 'codCash.confirmReconciliation') }}</label>
      </fieldset>
      <p v-if="cashCommand.error.value" role="alert" class="text-sm text-red-700">{{ $t(`codCash.errors.${cashCommand.error.value}`) }}</p>
      <p v-if="cashCommand.outcome.value" role="status" class="text-sm text-green-700">{{ $t('codCash.saved') }}</p>
      <button v-if="!cashCommand.outcome.value" type="submit" :disabled="cashCommand.busy.value || !canSubmit" class="min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {{ $t(cashCommand.busy.value ? 'codCash.saving' : cashCommand.command.value ? 'codCash.retry' : 'codCash.confirm') }}
      </button>
      <button v-if="cashCommand.outcome.value || cashCommand.error.value && !['unknown', 'storage'].includes(cashCommand.error.value)" type="button" :disabled="cashCommand.busy.value" class="min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold" @click="cashCommand.clear">{{ $t('codCash.newEntry') }}</button>
    </form>
  </section>
</template>

<script setup>
import { formatCommerceCurrency, formatCommerceDate } from '~/utils/commerce'
const props = defineProps({ order: { type: Object, required: true }, cash: { type: Object, required: true }, externalErp: Boolean })
const emit = defineEmits(['updated'])
const { hasPermission } = useAdminAccess()
const { intlLocale } = useUiLocale()
const formatCurrency = value => formatCommerceCurrency(value, intlLocale.value)
const formatDate = value => formatCommerceDate(value, intlLocale.value)
const form = reactive({ action: 'receive', collection_id: '', amount: '', reference: '', received_on: '', confirmed: false })
const delivered = computed(() => ['delivered', 'completed'].includes(props.order.status))
const eligible = computed(() => delivered.value && props.cash.history_consistent && !props.externalErp && props.order.erp_owner === 'built_in' && !['refunded', 'failed'].includes(props.order.payment_status))
const canReconcile = computed(() => hasPermission('treasury.view') && hasPermission('treasury.edit'))
const canSubmit = computed(() => hasPermission('dashboard.orders') && (form.action === 'receive' || canReconcile.value))
const reconciliation = id => props.cash.reconciliations.find(item => item.collection_id === id)
const unreconciled = computed(() => props.cash.collections.filter(item => !reconciliation(item.id)))
const cashCommand = useCodCash({ orderId: computed(() => props.order.id), form, canSubmit, onCommitted: async () => emit('updated') })
watch(() => form.collection_id, id => {
  if (!cashCommand.locked.value) form.amount = props.cash.collections.find(item => item.id === id)?.amount || ''
})
</script>
