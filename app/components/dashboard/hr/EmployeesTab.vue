<template>
  <div class="space-y-6">
    <div class="grid gap-4 sm:grid-cols-2">
      <div class="rounded-2xl bg-white p-5 shadow">
        <p class="text-sm font-semibold text-gray-500">Total Employees</p>
        <p class="mt-2 text-3xl font-bold text-gray-900">{{ totalEmployees }}</p>
      </div>

      <div class="rounded-2xl bg-white p-5 shadow">
        <p class="text-sm font-semibold text-gray-500">Active Employees</p>
        <p class="mt-2 text-3xl font-bold text-green-600">{{ activeEmployees }}</p>
      </div>
    </div>

    <section
      v-if="canEditEmployees"
      ref="employeeFormRef"
      class="overflow-hidden rounded-2xl bg-white shadow"
      :class="editingId ? 'ring-2 ring-blue-200' : ''"
    >
      <button
        type="button"
        class="flex w-full items-start justify-between gap-4 p-6 text-left"
        @click="formOpen = !formOpen"
      >
        <div>
          <h3 class="text-2xl font-bold">{{ editingId ? 'Edit Employee' : 'Add Employee' }}</h3>
          <p class="mt-1 text-sm text-gray-500">
            Store employment, contact, position, and salary information.
          </p>
        </div>

        <Icon
          name="lucide:chevron-down"
          size="20"
          class="transition"
          :class="formOpen ? 'rotate-180' : ''"
        />
      </button>

      <form
        v-if="formOpen"
        class="grid gap-5 border-t p-6 md:grid-cols-2"
        @submit.prevent="saveEmployee"
      >
        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">First Name *</label>
          <input
            ref="firstNameInputRef"
            v-model="form.first_name"
            required
            type="text"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Last Name</label>
          <input v-model="form.last_name" type="text" class="w-full rounded-lg border p-3 outline-none focus:border-blue-500">
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Employee Code</label>
          <input v-model="form.employee_code" type="text" placeholder="EMP-001" class="w-full rounded-lg border p-3 outline-none focus:border-blue-500">
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Position *</label>
          <input v-model="form.position" required type="text" placeholder="Sales Manager" class="w-full rounded-lg border p-3 outline-none focus:border-blue-500">
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Department</label>
          <input v-model="form.department" type="text" placeholder="Sales" class="w-full rounded-lg border p-3 outline-none focus:border-blue-500">
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Hire Date</label>
          <input v-model="form.hire_date" type="date" class="w-full rounded-lg border p-3 outline-none focus:border-blue-500">
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Email</label>
          <input v-model="form.email" type="email" class="w-full rounded-lg border p-3 outline-none focus:border-blue-500">
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Phone</label>
          <input v-model="form.phone" type="tel" class="w-full rounded-lg border p-3 outline-none focus:border-blue-500">
        </div>

        <div class="md:col-span-2">
          <label class="mb-2 block text-sm font-semibold text-gray-700">Address</label>
          <textarea v-model="form.address" rows="3" class="w-full rounded-lg border p-3 outline-none focus:border-blue-500" />
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Employment Status</label>
          <select v-model="form.employment_status" class="w-full rounded-lg border p-3 outline-none focus:border-blue-500">
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="inactive">Inactive</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>

        <div />

        <div class="md:col-span-2 rounded-2xl border bg-gray-50 p-5">
          <h4 class="text-xl font-bold">Salary Details</h4>

          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label class="mb-2 block text-sm font-semibold text-gray-700">Salary Amount</label>
              <input v-model="form.salary_amount" min="0" step="0.01" type="number" class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500">
            </div>

            <div>
              <label class="mb-2 block text-sm font-semibold text-gray-700">Salary Frequency</label>
              <select v-model="form.salary_frequency" class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500">
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
                <option value="hourly">Hourly</option>
              </select>
            </div>

            <div class="md:col-span-2">
              <label class="mb-2 block text-sm font-semibold text-gray-700">Salary Notes</label>
              <textarea v-model="form.salary_notes" rows="2" class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500" />
            </div>
          </div>
        </div>

        <p v-if="formError" class="md:col-span-2 text-sm text-red-600">{{ formError }}</p>

        <div class="md:col-span-2 flex flex-wrap gap-3">
          <button type="submit" :disabled="saving" class="rounded-lg bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-60">
            {{ saving ? 'Saving...' : editingId ? 'Save Employee' : 'Add Employee' }}
          </button>

          <button v-if="editingId" type="button" class="rounded-lg bg-gray-200 px-5 py-3 font-bold text-gray-800" @click="resetForm">
            Cancel
          </button>
        </div>
      </form>
    </section>

    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 class="text-2xl font-bold">Employees</h3>
          <p class="mt-1 text-sm text-gray-500">{{ filteredTotal }} matching employee records</p>
        </div>

        <div class="w-full md:max-w-sm">
          <label class="mb-2 block text-sm font-semibold text-gray-700">Search Employees</label>
          <div class="relative">
            <Icon name="lucide:search" size="18" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input v-model="searchQuery" type="search" placeholder="Name, code, position, or department" class="w-full rounded-lg border py-3 pl-10 pr-3 outline-none focus:border-blue-500">
          </div>
        </div>
      </div>

      <p v-if="pageError" class="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-600">{{ pageError }}</p>
      <p v-else-if="loading" class="mt-5 text-sm text-gray-500">Loading employees...</p>
      <p v-else-if="!employees.length" class="mt-5 text-sm text-gray-500">No employees found.</p>

      <div v-else class="mt-5 space-y-3">
        <article v-for="employee in employees" :key="employee.id" class="rounded-2xl border p-4">
          <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h4 class="font-bold text-gray-900">{{ employee.first_name }} {{ employee.last_name }}</h4>
                <span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="getStatusClass(employee.employment_status)">
                  {{ formatStatus(employee.employment_status) }}
                </span>
              </div>
              <p class="mt-1 text-sm text-gray-600">{{ employee.position }}{{ employee.department ? ` · ${employee.department}` : '' }}</p>
              <p class="mt-1 text-xs text-gray-400">{{ employee.employee_code || 'No employee code' }}</p>
            </div>

            <div class="flex items-center gap-4 md:text-right">
              <div>
                <p class="text-sm font-semibold text-gray-900">{{ formatCurrency(employee.salary_amount) }}</p>
                <p class="text-xs capitalize text-gray-500">{{ employee.salary_frequency }}</p>
              </div>

              <button v-if="canEditEmployees" type="button" class="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white" @click="startEdit(employee)">
                Edit
              </button>
            </div>
          </div>
        </article>

        <div class="flex items-center justify-between border-t pt-4">
          <button type="button" :disabled="currentPage <= 1 || loading" class="rounded-lg border px-4 py-2 text-sm disabled:opacity-50" @click="loadEmployees(currentPage - 1)">Previous</button>
          <p class="text-sm text-gray-500">Page {{ currentPage }} of {{ totalPages }}</p>
          <button type="button" :disabled="currentPage >= totalPages || loading" class="rounded-lg border px-4 py-2 text-sm disabled:opacity-50" @click="loadEmployees(currentPage + 1)">Next</button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
const supabase = useSupabaseClient()
const { adminUser, hasPermission } = useAdminAccess()
const { recordAdminLog } = useAdminLogs()

const employees = ref([])
const loading = ref(true)
const saving = ref(false)
const pageError = ref('')
const formError = ref('')
const formOpen = ref(false)
const editingId = ref('')
const employeeFormRef = ref(null)
const firstNameInputRef = ref(null)
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = 10
const filteredTotal = ref(0)
const totalEmployees = ref(0)
const activeEmployees = ref(0)
let searchTimeoutId

const canEditEmployees = computed(() => hasPermission('hr.edit'))
const totalPages = computed(() => Math.max(1, Math.ceil(filteredTotal.value / pageSize)))

const emptyForm = () => ({
  first_name: '',
  last_name: '',
  employee_code: '',
  email: '',
  phone: '',
  address: '',
  position: '',
  department: '',
  hire_date: '',
  employment_status: 'active',
  salary_amount: '',
  salary_frequency: 'monthly',
  salary_notes: ''
})

const form = reactive(emptyForm())

const resetForm = () => {
  editingId.value = ''
  Object.assign(form, emptyForm())
  formError.value = ''
  formOpen.value = false
}

const buildPayload = () => ({
  first_name: form.first_name.trim(),
  last_name: form.last_name.trim() || null,
  employee_code: form.employee_code.trim() || null,
  email: form.email.trim() || null,
  phone: form.phone.trim() || null,
  address: form.address.trim() || null,
  position: form.position.trim(),
  department: form.department.trim() || null,
  hire_date: form.hire_date || null,
  employment_status: form.employment_status,
  salary_amount: Math.max(0, Number(form.salary_amount || 0)),
  salary_frequency: form.salary_frequency,
  salary_notes: form.salary_notes.trim() || null,
  updated_at: new Date().toISOString()
})

const loadCounts = async () => {
  const [totalResult, activeResult] = await Promise.all([
    supabase.from('hr_employees').select('id', { count: 'exact', head: true }),
    supabase.from('hr_employees').select('id', { count: 'exact', head: true }).eq('employment_status', 'active')
  ])

  if (totalResult.error) throw totalResult.error
  if (activeResult.error) throw activeResult.error

  totalEmployees.value = totalResult.count || 0
  activeEmployees.value = activeResult.count || 0
}

const loadEmployees = async (page = 1) => {
  loading.value = true
  pageError.value = ''
  currentPage.value = page

  try {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    const search = searchQuery.value.trim().replace(/[,()]/g, ' ')
    let query = supabase
      .from('hr_employees')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_code.ilike.%${search}%,position.ilike.%${search}%,department.ilike.%${search}%`)
    }

    const [{ data, count, error }] = await Promise.all([query, loadCounts()])

    if (error) throw error

    employees.value = data || []
    filteredTotal.value = count || 0

    if (currentPage.value > totalPages.value) {
      await loadEmployees(totalPages.value)
    }
  } catch (error) {
    pageError.value = error?.code === '42P01'
      ? 'Run the latest HR and Treasury SQL query, then refresh this page.'
      : error.message || 'Could not load employees.'
  } finally {
    loading.value = false
  }
}

const saveEmployee = async () => {
  formError.value = ''

  if (!form.first_name.trim() || !form.position.trim()) {
    formError.value = 'First name and position are required.'
    return
  }

  saving.value = true

  try {
    const payload = buildPayload()
    const employeeName = `${payload.first_name} ${payload.last_name || ''}`.trim()
    const result = editingId.value
      ? await supabase.from('hr_employees').update(payload).eq('id', editingId.value)
      : await supabase.from('hr_employees').insert({ ...payload, created_by: adminUser.value?.id || null })

    if (result.error) throw result.error

    await recordAdminLog({
      actionKey: editingId.value ? 'hr.employee.updated' : 'hr.employee.created',
      description: `${editingId.value ? 'Updated' : 'Added'} employee ${employeeName}.`,
      metadata: { employee_id: editingId.value || null }
    })

    resetForm()
    await loadEmployees(currentPage.value)
  } catch (error) {
    formError.value = error.message || 'Could not save employee.'
  } finally {
    saving.value = false
  }
}

const startEdit = (employee) => {
  editingId.value = employee.id
  Object.assign(form, {
    first_name: employee.first_name || '',
    last_name: employee.last_name || '',
    employee_code: employee.employee_code || '',
    email: employee.email || '',
    phone: employee.phone || '',
    address: employee.address || '',
    position: employee.position || '',
    department: employee.department || '',
    hire_date: employee.hire_date || '',
    employment_status: employee.employment_status || 'active',
    salary_amount: employee.salary_amount ?? '',
    salary_frequency: employee.salary_frequency || 'monthly',
    salary_notes: employee.salary_notes || ''
  })
  formOpen.value = true

  nextTick(() => {
    employeeFormRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    firstNameInputRef.value?.focus()
  })
}

const formatCurrency = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EGP',
  maximumFractionDigits: 2
}).format(Number(value || 0))

const formatStatus = (status) => String(status || '').replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

const getStatusClass = (status) => {
  if (status === 'active') return 'bg-green-100 text-green-700'
  if (status === 'on_leave') return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-600'
}

watch(searchQuery, () => {
  clearTimeout(searchTimeoutId)
  searchTimeoutId = setTimeout(() => loadEmployees(1), 300)
})

onBeforeUnmount(() => clearTimeout(searchTimeoutId))
onMounted(() => loadEmployees())
</script>
