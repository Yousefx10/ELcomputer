<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div class="rounded-2xl bg-amber-400 p-6 text-amber-950 shadow">
      <div class="flex items-center gap-3">
        <Icon name="lucide:landmark" size="34" />
        <div>
          <h2 class="text-4xl font-bold">Treasury</h2>
          <p class="mt-2 text-sm text-amber-900">
            Record supplier payments, customer receipts, and employee salary payments.
          </p>
        </div>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <button
        v-for="action in actions"
        :key="action.key"
        type="button"
        class="rounded-2xl border-2 p-5 text-left shadow-sm transition"
        :class="activeAction === action.key
          ? 'border-amber-500 bg-amber-100 text-amber-950'
          : 'border-transparent bg-white text-gray-900 hover:border-amber-200'"
        @click="activeAction = action.key"
      >
        <Icon :name="action.icon" size="24" />
        <p class="mt-3 font-bold">{{ action.label }}</p>
        <p class="mt-1 text-sm opacity-70">{{ action.description }}</p>
      </button>
    </div>

    <section class="rounded-2xl bg-white p-6 shadow">
      <div v-if="!canEditTreasury" class="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
        This account can view Treasury records but cannot record transactions.
      </div>

      <form v-else-if="activeAction === 'supplier_payment'" class="grid gap-5 md:grid-cols-2" @submit.prevent="recordSupplierPayment">
        <div class="md:col-span-2">
          <h3 class="text-2xl font-bold">Pay Supplier Invoice</h3>
          <p class="mt-1 text-sm text-gray-500">Select an unpaid or partially paid procurement invoice.</p>
        </div>

        <div class="md:col-span-2">
          <label class="mb-2 block text-sm font-semibold text-gray-700">Supplier Invoice *</label>
          <select v-model="supplierForm.invoice_id" required class="w-full rounded-lg border p-3 outline-none focus:border-amber-500">
            <option value="">Select an outstanding invoice</option>
            <option v-for="invoice in supplierInvoices" :key="invoice.id" :value="invoice.id">
              {{ invoice.account_name }} · {{ invoice.invoice_number || shortId(invoice.id) }} · Due {{ formatCurrency(invoice.due_amount) }}
            </option>
          </select>
        </div>

        <TreasuryCommonFields
          v-model:amount="supplierForm.amount"
          v-model:paid-at="supplierForm.paid_at"
          v-model:reference-number="supplierForm.reference_number"
          v-model:notes="supplierForm.notes"
          :maximum-amount="selectedSupplierInvoice?.due_amount"
        />

        <p v-if="formError" class="md:col-span-2 text-sm text-red-600">{{ formError }}</p>

        <button type="submit" :disabled="saving" class="w-fit rounded-lg bg-amber-500 px-5 py-3 font-bold text-amber-950 hover:bg-amber-400 disabled:opacity-60">
          {{ saving ? 'Recording...' : 'Record Supplier Payment' }}
        </button>
      </form>

      <form v-else-if="activeAction === 'customer_receipt'" class="grid gap-5 md:grid-cols-2" @submit.prevent="recordCustomerReceipt">
        <div class="md:col-span-2">
          <h3 class="text-2xl font-bold">Receive Customer Payment</h3>
          <p class="mt-1 text-sm text-gray-500">Settle an unpaid or partially paid manual sales invoice.</p>
        </div>

        <div class="md:col-span-2">
          <label class="mb-2 block text-sm font-semibold text-gray-700">Customer Invoice *</label>
          <select v-model="customerForm.invoice_id" required class="w-full rounded-lg border p-3 outline-none focus:border-amber-500">
            <option value="">Select an outstanding invoice</option>
            <option v-for="invoice in customerInvoices" :key="invoice.id" :value="invoice.id">
              {{ invoice.account_name }} · {{ invoice.invoice_number || shortId(invoice.id) }} · Due {{ formatCurrency(invoice.due_amount) }}
            </option>
          </select>
        </div>

        <TreasuryCommonFields
          v-model:amount="customerForm.amount"
          v-model:paid-at="customerForm.paid_at"
          v-model:reference-number="customerForm.reference_number"
          v-model:notes="customerForm.notes"
          :maximum-amount="selectedCustomerInvoice?.due_amount"
        />

        <p v-if="formError" class="md:col-span-2 text-sm text-red-600">{{ formError }}</p>

        <button type="submit" :disabled="saving" class="w-fit rounded-lg bg-amber-500 px-5 py-3 font-bold text-amber-950 hover:bg-amber-400 disabled:opacity-60">
          {{ saving ? 'Recording...' : 'Record Customer Receipt' }}
        </button>
      </form>

      <form v-else class="grid gap-5 md:grid-cols-2" @submit.prevent="recordSalaryPayment">
        <div class="md:col-span-2">
          <h3 class="text-2xl font-bold">Pay Employee Salary</h3>
          <p class="mt-1 text-sm text-gray-500">Record a salary payment for an HR employee and period.</p>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Employee *</label>
          <select v-model="salaryForm.employee_id" required class="w-full rounded-lg border p-3 outline-none focus:border-amber-500">
            <option value="">Select an employee</option>
            <option v-for="employee in employees" :key="employee.id" :value="employee.id">
              {{ employee.first_name }} {{ employee.last_name }} · {{ employee.position }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Salary Period *</label>
          <input v-model="salaryForm.salary_period" required type="month" class="w-full rounded-lg border p-3 outline-none focus:border-amber-500">
        </div>

        <TreasuryCommonFields
          v-model:amount="salaryForm.amount"
          v-model:paid-at="salaryForm.paid_at"
          v-model:reference-number="salaryForm.reference_number"
          v-model:notes="salaryForm.notes"
        />

        <p v-if="formError" class="md:col-span-2 text-sm text-red-600">{{ formError }}</p>

        <button type="submit" :disabled="saving" class="w-fit rounded-lg bg-amber-500 px-5 py-3 font-bold text-amber-950 hover:bg-amber-400 disabled:opacity-60">
          {{ saving ? 'Recording...' : 'Record Salary Payment' }}
        </button>
      </form>
    </section>

    <section class="overflow-hidden rounded-2xl bg-white shadow">
      <button type="button" class="flex w-full items-center justify-between p-6 text-left" @click="transactionsOpen = !transactionsOpen">
        <div>
          <h3 class="text-2xl font-bold">Recent Treasury Transactions</h3>
          <p class="mt-1 text-sm text-gray-500">Latest recorded payments and receipts.</p>
        </div>
        <Icon name="lucide:chevron-down" size="20" class="transition" :class="transactionsOpen ? 'rotate-180' : ''" />
      </button>

      <div v-if="transactionsOpen" class="border-t p-6">
        <p v-if="pageError" class="rounded-xl bg-red-50 p-4 text-sm text-red-600">{{ pageError }}</p>
        <p v-else-if="loading" class="text-sm text-gray-500">Loading Treasury records...</p>
        <p v-else-if="!transactions.length" class="text-sm text-gray-500">No Treasury transactions recorded yet.</p>

        <div v-else class="space-y-3">
          <article v-for="transaction in transactions" :key="transaction.id" class="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="transaction.transaction_type === 'customer_receipt' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'">
                  {{ formatTransactionType(transaction.transaction_type) }}
                </span>
                <span class="text-sm text-gray-500">{{ formatDate(transaction.paid_at) }}</span>
              </div>
              <p class="mt-2 font-semibold text-gray-900">{{ getTransactionParty(transaction) }}</p>
              <p class="mt-1 text-sm text-gray-500">{{ transaction.reference_number || 'No payment reference' }}</p>
            </div>

            <p class="text-xl font-bold" :class="transaction.transaction_type === 'customer_receipt' ? 'text-green-600' : 'text-gray-900'">
              {{ transaction.transaction_type === 'customer_receipt' ? '+' : '-' }}{{ formatCurrency(transaction.amount) }}
            </p>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import TreasuryCommonFields from '~/components/dashboard/treasury/CommonFields.vue'
import { formatCommerceCurrency, formatCommerceDate } from '~/utils/commerce'

definePageMeta({
  layout: 'dashboard'
})

const supabase = useSupabaseClient()
const { hasPermission } = useAdminAccess()
const { recordAdminLog } = useAdminLogs()

const actions = [
  { key: 'supplier_payment', label: 'Supplier Payment', description: 'Pay an outstanding procurement invoice.', icon: 'lucide:receipt-text' },
  { key: 'customer_receipt', label: 'Customer Receipt', description: 'Receive money for a credit sale.', icon: 'lucide:hand-coins' },
  { key: 'salary_payment', label: 'Salary Payment', description: 'Record an employee salary payment.', icon: 'lucide:badge-dollar-sign' }
]

const today = new Date().toISOString().slice(0, 10)
const currentMonth = today.slice(0, 7)
const createPaymentForm = () => ({ invoice_id: '', amount: '', paid_at: today, reference_number: '', notes: '' })

const activeAction = ref('supplier_payment')
const supplierInvoices = ref([])
const customerInvoices = ref([])
const employees = ref([])
const transactions = ref([])
const loading = ref(true)
const saving = ref(false)
const pageError = ref('')
const formError = ref('')
const transactionsOpen = ref(true)
const supplierForm = reactive(createPaymentForm())
const customerForm = reactive(createPaymentForm())
const salaryForm = reactive({ employee_id: '', salary_period: currentMonth, amount: '', paid_at: today, reference_number: '', notes: '' })

const canEditTreasury = computed(() => hasPermission('treasury.edit'))
const selectedSupplierInvoice = computed(() => supplierInvoices.value.find((invoice) => invoice.id === supplierForm.invoice_id))
const selectedCustomerInvoice = computed(() => customerInvoices.value.find((invoice) => invoice.id === customerForm.invoice_id))

const loadTreasury = async () => {
  loading.value = true
  pageError.value = ''

  try {
    const [supplierResult, customerResult, employeeResult, transactionResult] = await Promise.all([
      supabase.rpc('treasury_get_outstanding_supplier_invoices'),
      supabase.rpc('treasury_get_outstanding_customer_invoices'),
      supabase.from('hr_employees').select('id, first_name, last_name, position, salary_amount').eq('employment_status', 'active').order('first_name'),
      supabase.from('treasury_transactions').select('*').order('paid_at', { ascending: false }).order('created_at', { ascending: false }).limit(20)
    ])

    const firstError = supplierResult.error || customerResult.error || employeeResult.error || transactionResult.error
    if (firstError) throw firstError

    supplierInvoices.value = supplierResult.data || []
    customerInvoices.value = customerResult.data || []
    employees.value = employeeResult.data || []
    transactions.value = transactionResult.data || []
  } catch (error) {
    pageError.value = ['42P01', '42883'].includes(error?.code)
      ? 'Run the latest HR and Treasury SQL query, then refresh this page.'
      : error.message || 'Could not load Treasury records.'
  } finally {
    loading.value = false
  }
}

const validateAmount = (form, maximumAmount = null) => {
  const amount = Number(form.amount || 0)

  if (amount <= 0) {
    throw new Error('Enter an amount greater than zero.')
  }

  if (maximumAmount !== null && amount > Number(maximumAmount || 0)) {
    throw new Error('The amount cannot be greater than the outstanding balance.')
  }

  return amount
}

const resetPaymentForm = (form) => Object.assign(form, createPaymentForm())

const recordSupplierPayment = async () => {
  if (!supplierForm.invoice_id) return

  let amount

  try {
    amount = validateAmount(supplierForm, selectedSupplierInvoice.value?.due_amount)
  } catch (error) {
    formError.value = error.message
    return
  }

  await recordTransaction({
    rpc: 'treasury_record_supplier_payment',
    params: {
      p_procurement_order_id: supplierForm.invoice_id,
      p_amount: amount,
      p_paid_at: supplierForm.paid_at,
      p_reference_number: supplierForm.reference_number || null,
      p_notes: supplierForm.notes || null
    },
    description: `Recorded supplier payment for ${selectedSupplierInvoice.value?.invoice_number || shortId(supplierForm.invoice_id)}.`,
    actionKey: 'treasury.supplier_payment.created',
    reset: () => resetPaymentForm(supplierForm)
  })
}

const recordCustomerReceipt = async () => {
  if (!customerForm.invoice_id) return

  let amount

  try {
    amount = validateAmount(customerForm, selectedCustomerInvoice.value?.due_amount)
  } catch (error) {
    formError.value = error.message
    return
  }

  await recordTransaction({
    rpc: 'treasury_record_customer_receipt',
    params: {
      p_sales_order_id: customerForm.invoice_id,
      p_amount: amount,
      p_paid_at: customerForm.paid_at,
      p_reference_number: customerForm.reference_number || null,
      p_notes: customerForm.notes || null
    },
    description: `Recorded customer receipt for ${selectedCustomerInvoice.value?.invoice_number || shortId(customerForm.invoice_id)}.`,
    actionKey: 'treasury.customer_receipt.created',
    reset: () => resetPaymentForm(customerForm)
  })
}

const recordSalaryPayment = async () => {
  if (!salaryForm.employee_id || !salaryForm.salary_period) return
  const employee = employees.value.find((item) => item.id === salaryForm.employee_id)

  let amount

  try {
    amount = validateAmount(salaryForm)
  } catch (error) {
    formError.value = error.message
    return
  }

  await recordTransaction({
    rpc: 'treasury_record_salary_payment',
    params: {
      p_employee_id: salaryForm.employee_id,
      p_amount: amount,
      p_salary_period: `${salaryForm.salary_period}-01`,
      p_paid_at: salaryForm.paid_at,
      p_reference_number: salaryForm.reference_number || null,
      p_notes: salaryForm.notes || null
    },
    description: `Recorded salary payment for ${employee ? `${employee.first_name} ${employee.last_name || ''}`.trim() : 'employee'}.`,
    actionKey: 'treasury.salary_payment.created',
    reset: () => Object.assign(salaryForm, { employee_id: '', salary_period: currentMonth, amount: '', paid_at: today, reference_number: '', notes: '' })
  })
}

const recordTransaction = async ({ rpc, params, description, actionKey, reset }) => {
  saving.value = true
  formError.value = ''

  try {
    const { data, error } = await supabase.rpc(rpc, params)
    if (error) throw error

    await recordAdminLog({ actionKey, description, metadata: { treasury_transaction_id: data || null } })
    reset()
    await loadTreasury()
  } catch (error) {
    formError.value = error.message || 'Could not record the Treasury transaction.'
  } finally {
    saving.value = false
  }
}

const formatCurrency = formatCommerceCurrency
const formatDate = formatCommerceDate
const shortId = (value) => `#${String(value || '').slice(0, 8).toUpperCase()}`
const formatTransactionType = (value) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

const getTransactionParty = (transaction) => {
  if (transaction.party_name) {
    return transaction.party_name
  }

  if (transaction.transaction_type === 'salary_payment') {
    const employee = employees.value.find((item) => item.id === transaction.employee_id)
    return employee ? `${employee.first_name} ${employee.last_name || ''}`.trim() : 'Employee salary'
  }

  if (transaction.transaction_type === 'supplier_payment') {
    return supplierInvoices.value.find((invoice) => invoice.id === transaction.procurement_order_id)?.account_name || 'Supplier payment'
  }

  return customerInvoices.value.find((invoice) => invoice.id === transaction.sales_order_id)?.account_name || 'Customer receipt'
}

watch(activeAction, () => {
  formError.value = ''
})

onMounted(() => loadTreasury())
</script>
