<template>
  <div class="">
    <div class="mx-auto max-w-6xl space-y-6">
      <div class="rounded-2xl bg-white p-6 shadow">
        <h2 class="text-4xl font-bold">Users</h2>
        <p class="mt-2 text-sm text-gray-500">
          Create admin accounts, review them, control dashboard permissions, and manage store customers.
        </p>
      </div>

      <div v-if="pageError" class="rounded-2xl bg-red-50 p-4 text-red-600 shadow">
        {{ pageError }}
      </div>

      <form
        ref="userFormRef"
        @submit.prevent="saveAdminUser"
        class="grid gap-5 rounded-2xl bg-white p-6 shadow transition md:grid-cols-2"
        :class="editingId ? 'ring-2 ring-blue-200' : ''"
      >
        <div class="md:col-span-2 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 class="text-2xl font-bold">
              {{ editingId ? 'Edit Admin User' : 'Create Admin User' }}
            </h3>
            <p class="mt-1 text-sm text-gray-500">
              Owner accounts always have full access. Admin accounts follow the permissions you select.
            </p>
          </div>

          <button
            v-if="editingId"
            type="button"
            @click="resetForm"
            class="rounded-lg bg-gray-200 px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-300"
          >
            Cancel Edit
          </button>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Email</label>
          <input
            ref="emailInputRef"
            v-model="form.email"
            type="email"
            placeholder="admin@example.com"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">
            {{ editingId ? 'New Password' : 'Password' }}
          </label>
          <input
            v-model="form.password"
            type="password"
            :placeholder="editingId ? 'Leave empty to keep current password' : 'At least 6 characters'"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Full Name</label>
          <input
            v-model="form.full_name"
            type="text"
            placeholder="Admin name"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Role</label>
          <select
            v-model="form.role"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option value="admin">Admin</option>
            <option v-if="currentAdminUser?.role === 'owner'" value="owner">Owner</option>
          </select>
        </div>

        <div class="md:col-span-2">
          <div class="flex items-center justify-between rounded-2xl border bg-gray-50 p-4">
            <div>
              <p class="text-sm font-semibold text-gray-700">Account Status</p>
              <p class="text-sm text-gray-500">
                Disable the account to block dashboard access without deleting the user.
              </p>
            </div>

            <div class="flex items-center gap-3">
              <span class="text-sm font-semibold" :class="form.is_active ? 'text-green-600' : 'text-gray-500'">
                {{ form.is_active ? 'ACTIVE' : 'INACTIVE' }}
              </span>

              <button
                type="button"
                :aria-pressed="form.is_active"
                @click="form.is_active = !form.is_active"
                class="relative inline-flex h-7 w-14 items-center rounded-full transition"
                :class="form.is_active ? 'bg-green-600' : 'bg-gray-300'"
              >
                <span
                  class="inline-block h-5 w-5 rounded-full bg-white transition"
                  :class="form.is_active ? 'translate-x-8' : 'translate-x-1'"
                />
              </button>
            </div>
          </div>
        </div>

        <div class="md:col-span-2">
          <h4 class="text-xl font-bold">Permissions</h4>
          <p class="mt-1 text-sm text-gray-500">
            These permissions apply to admin accounts. Owner accounts ignore these switches and always have full access.
          </p>

          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <div
              v-for="group in adminPermissionGroups"
              :key="group.key"
              class="rounded-2xl border bg-gray-50 p-4"
            >
              <h5 class="font-bold text-gray-900">{{ group.title }}</h5>

              <div class="mt-3 space-y-3">
                <label
                  v-for="permission in group.permissions"
                  :key="permission.key"
                  class="flex items-center gap-3 text-sm text-gray-700"
                >
                  <input
                    :checked="getPermissionValue(permission.key)"
                    type="checkbox"
                    :disabled="isPermissionDisabled(permission.key)"
                    @change="updatePermission(permission.key, $event.target.checked)"
                  >
                  <span>{{ permission.label }}</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <p v-if="formError" class="md:col-span-2 text-sm text-red-600">
          {{ formError }}
        </p>

        <div class="md:col-span-2 flex flex-wrap gap-3">
          <button
            type="submit"
            :disabled="saving"
            class="rounded-lg bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {{ saving ? 'Saving...' : editingId ? 'Save Admin User' : 'Create Admin User' }}
          </button>

          <button
            v-if="editingId"
            type="button"
            @click="resetForm"
            class="rounded-lg bg-gray-200 px-5 py-3 font-bold text-gray-800 hover:bg-gray-300"
          >
            Cancel
          </button>

          <button
            v-if="editingId"
            type="button"
            :disabled="isDeleteDisabled"
            @click="deleteAdminUser"
            class="rounded-lg px-5 py-3 font-bold text-white"
            :class="isDeleteDisabled
              ? 'cursor-not-allowed bg-red-300'
              : 'bg-red-600 hover:bg-red-700'"
          >
            {{ deleting ? 'Deleting...' : 'Delete User' }}
          </button>
        </div>
      </form>

      <div class="rounded-2xl bg-white p-5 shadow">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h3 class="text-2xl font-bold">Admin Users</h3>

          <p class="text-sm text-gray-500">
            {{ totalUsers }} {{ hasActiveSearch ? 'matching' : 'total' }}
          </p>
        </div>

        <div class="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="flex-1">
            <label for="admin-user-search" class="mb-2 block text-sm font-semibold text-gray-700">
              Search Admin Users
            </label>
            <input
              id="admin-user-search"
              v-model="searchQuery"
              type="text"
              placeholder="Search by email or full name"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <button
            v-if="searchQuery"
            type="button"
            @click="clearSearch"
            class="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700"
          >
            Clear
          </button>
        </div>

        <p v-if="loading" class="text-gray-500">
          Loading users...
        </p>

        <p v-else-if="!adminUsers.length" class="text-gray-500">
          {{ hasActiveSearch ? 'No matching admin users found.' : 'No admin users found yet.' }}
        </p>

        <div v-else>
          <div class="mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
            <p class="text-sm text-gray-500">
              Showing {{ pageStart }}-{{ pageEnd }} of {{ totalUsers }} {{ hasActiveSearch ? 'matching admin users' : 'admin users' }}
            </p>

            <p class="text-sm font-medium text-gray-600">
              Page {{ currentPage }} of {{ totalPages }}
            </p>
          </div>

          <div class="space-y-3">
            <div
              v-for="user in adminUsers"
              :key="user.id"
              class="flex flex-col gap-4 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
            >
              <div class="space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="font-bold text-gray-900">
                    {{ user.full_name || 'No name set' }}
                  </p>

                  <span
                    class="rounded-full px-3 py-1 text-xs font-semibold uppercase"
                    :class="user.role === 'owner' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'"
                  >
                    {{ user.role }}
                  </span>

                  <span
                    class="rounded-full px-3 py-1 text-xs font-semibold uppercase"
                    :class="user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'"
                  >
                    {{ user.is_active ? 'Active' : 'Inactive' }}
                  </span>
                </div>

                <p class="text-sm text-gray-600">
                  {{ user.email }}
                </p>

                <p class="text-sm text-gray-500">
                  {{ user.role === 'owner' ? 'Full owner access' : `${user.granted_permissions_count} permissions granted` }}
                </p>

                <p class="text-xs text-gray-400">
                  Updated {{ formatDate(user.updated_at || user.created_at) }}
                  <span v-if="currentAdminUser?.id === user.id">(You)</span>
                </p>
              </div>

              <div class="flex gap-2">
                <button
                  v-if="canEditAdminUser(user)"
                  type="button"
                  @click="startEdit(user)"
                  class="rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>

          <div class="mt-4 flex items-center justify-between rounded-xl border px-4 py-3">
            <button
              type="button"
              :disabled="currentPage === 1 || loading"
              @click="goToPreviousPage"
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <p class="text-sm text-gray-500">
              Page {{ currentPage }} of {{ totalPages }}
            </p>

            <button
              type="button"
              :disabled="currentPage === totalPages || loading"
              @click="goToNextPage"
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        <div class="mt-6 border-t pt-6">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-3 rounded-2xl bg-gray-50 px-5 py-4 text-left"
            @click="toggleCustomerSection"
          >
            <div>
              <h3 class="text-2xl font-bold text-gray-900">Store Customers</h3>
              <p class="mt-1 text-sm text-gray-500">
                Review customer accounts, recent order activity, and account status.
              </p>
            </div>

            <div class="flex items-center gap-3">
              <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-600 shadow-sm">
                {{ customerTotalUsers }} total
              </span>

              <Icon
                name="lucide:chevron-down"
                size="20"
                class="transition"
                :class="customerSectionOpen ? 'rotate-180' : ''"
              />
            </div>
          </button>

          <div v-if="customerSectionOpen" class="mt-6 space-y-6">
            <div v-if="customerSectionError" class="rounded-2xl bg-red-50 p-4 text-red-600 shadow-sm">
              {{ customerSectionError }}
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <div class="rounded-2xl border bg-white p-5">
                <p class="text-sm text-gray-500">Current Users Total</p>
                <p class="mt-2 text-3xl font-bold text-gray-900">{{ customerTotalUsers }}</p>
              </div>

              <div class="rounded-2xl border bg-white p-5">
                <p class="text-sm text-gray-500">Active Users Total</p>
                <p class="mt-2 text-3xl font-bold text-green-600">{{ customerActiveUsers }}</p>
              </div>
            </div>

            <div class="rounded-2xl border bg-white p-5">
              <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div class="flex-1">
                  <label for="customer-user-search" class="mb-2 block text-sm font-semibold text-gray-700">
                    Search Store Customers
                  </label>
                  <input
                    id="customer-user-search"
                    v-model="customerSearchQuery"
                    type="text"
                    placeholder="Search by email or full name"
                    class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                  >
                </div>

                <button
                  v-if="customerSearchQuery"
                  type="button"
                  @click="clearCustomerSearch"
                  class="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700"
                >
                  Clear
                </button>
              </div>
            </div>

            <div class="rounded-2xl border bg-white p-5">
              <div class="mb-4 flex items-center justify-between gap-3">
                <p class="text-sm text-gray-500">
                  Showing {{ customerPageStart }}-{{ customerPageEnd }} of {{ customerFilteredTotal }} {{ customerHasActiveSearch ? 'matching customers' : 'customers' }}
                </p>

                <p class="text-sm font-medium text-gray-600">
                  Page {{ customerCurrentPage }} of {{ customerTotalPages }}
                </p>
              </div>

              <p v-if="customerUsersLoading" class="text-gray-500">
                Loading store customers...
              </p>

              <p v-else-if="!customerUsers.length" class="text-gray-500">
                {{ customerHasActiveSearch ? 'No matching store customers found.' : 'No store customers found yet.' }}
              </p>

              <div v-else class="space-y-3">
                <div
                  v-for="customer in customerUsers"
                  :key="customer.id"
                  class="flex flex-col gap-4 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div class="space-y-2">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="font-bold text-gray-900">
                        {{ customer.full_name || customer.email || 'No name set' }}
                      </p>

                      <span
                        class="rounded-full px-3 py-1 text-xs font-semibold uppercase"
                        :class="customer.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'"
                      >
                        {{ customer.is_active ? 'Active' : 'Inactive' }}
                      </span>
                    </div>

                    <p class="text-sm text-gray-600">
                      {{ customer.email || 'No email available' }}
                    </p>

                    <p class="text-sm text-gray-500">
                      Wallet {{ formatCurrency(customer.wallet_balance) }}
                    </p>

                    <p class="text-xs text-gray-400">
                      Joined {{ formatDate(customer.created_at) }}
                    </p>
                  </div>

                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
                      @click="toggleCustomerDetails(customer)"
                    >
                      {{ selectedCustomerId === customer.id ? 'Hide Details' : 'View Details' }}
                    </button>
                  </div>
                </div>
              </div>

              <div class="mt-4 flex items-center justify-between rounded-xl border px-4 py-3">
                <button
                  type="button"
                  :disabled="customerCurrentPage === 1 || customerUsersLoading"
                  @click="goToPreviousCustomerPage"
                  class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>

                <p class="text-sm text-gray-500">
                  Page {{ customerCurrentPage }} of {{ customerTotalPages }}
                </p>

                <button
                  type="button"
                  :disabled="customerCurrentPage === customerTotalPages || customerUsersLoading"
                  @click="goToNextCustomerPage"
                  class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>

            <div v-if="selectedCustomerId" class="rounded-2xl border bg-white p-6 shadow-sm">
              <div v-if="customerDetailLoading" class="text-gray-500">
                Loading customer details...
              </div>

              <div v-else-if="customerDetail" class="space-y-6">
                <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <h4 class="text-2xl font-bold text-gray-900">
                        {{ customerDetail.full_name || customerDetail.email || 'Store Customer' }}
                      </h4>

                      <span
                        class="rounded-full px-3 py-1 text-xs font-semibold uppercase"
                        :class="customerDetail.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'"
                      >
                        {{ customerDetail.is_active ? 'Active' : 'Inactive' }}
                      </span>
                    </div>

                    <p class="mt-2 text-sm text-gray-600">
                      {{ customerDetail.email || 'No email available' }}
                    </p>

                    <p class="mt-1 text-sm text-gray-500">
                      Joined {{ formatDate(customerDetail.created_at) }}
                    </p>
                  </div>

                  <div class="flex flex-wrap gap-3">
                    <button
                      type="button"
                      :disabled="customerActionLoading"
                      class="rounded-lg px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
                      :class="customerDetail.is_active ? 'bg-gray-700 hover:bg-gray-800' : 'bg-green-600 hover:bg-green-700'"
                      @click="updateCustomerStatus(!customerDetail.is_active)"
                    >
                      {{ customerActionLoading
                        ? 'Saving...'
                        : customerDetail.is_active ? 'Disable User' : 'Enable User' }}
                    </button>

                    <button
                      type="button"
                      :disabled="customerActionLoading"
                      class="rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                      @click="deleteCustomerUser"
                    >
                      {{ customerActionLoading ? 'Please wait...' : 'Delete User' }}
                    </button>
                  </div>
                </div>

                <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                  <div class="space-y-4">
                    <div class="rounded-2xl bg-gray-50 p-4">
                      <p class="text-sm font-semibold text-gray-700">Contact</p>
                      <p class="mt-2 text-sm text-gray-600">
                        {{ customerDetail.phone || 'No phone saved yet.' }}
                      </p>
                    </div>

                    <div class="rounded-2xl bg-gray-50 p-4">
                      <p class="text-sm font-semibold text-gray-700">Address</p>
                      <p class="mt-2 whitespace-pre-line text-sm text-gray-600">
                        {{ getCustomerAddress(customerDetail) }}
                      </p>
                    </div>

                    <div class="rounded-2xl bg-gray-50 p-4">
                      <p class="text-sm font-semibold text-gray-700">Wallet</p>
                      <p class="mt-2 text-2xl font-bold text-gray-900">
                        {{ formatCurrency(customerDetail.wallet_balance) }}
                      </p>
                    </div>
                  </div>

                  <div class="space-y-4">
                    <div class="grid gap-4 sm:grid-cols-3">
                      <div class="rounded-2xl bg-gray-50 p-4">
                        <p class="text-sm text-gray-500">Total Orders</p>
                        <p class="mt-2 text-2xl font-bold text-gray-900">{{ customerDetailStats.totalOrders }}</p>
                      </div>

                      <div class="rounded-2xl bg-gray-50 p-4">
                        <p class="text-sm text-gray-500">Completed</p>
                        <p class="mt-2 text-2xl font-bold text-green-600">{{ customerDetailStats.completed }}</p>
                      </div>

                      <div class="rounded-2xl bg-gray-50 p-4">
                        <p class="text-sm text-gray-500">Open Orders</p>
                        <p class="mt-2 text-2xl font-bold text-amber-600">{{ customerDetailStats.open }}</p>
                      </div>
                    </div>

                    <div class="rounded-2xl bg-gray-50 p-4">
                      <div class="mb-4 flex items-center justify-between gap-3">
                        <p class="text-sm font-semibold text-gray-700">Recent Orders</p>
                        <span class="text-xs text-gray-400">{{ customerDetailStats.totalOrders }} total</span>
                      </div>

                      <p v-if="!customerRecentOrders.length" class="text-sm text-gray-500">
                        No orders for this customer yet.
                      </p>

                      <div v-else class="space-y-3">
                        <div
                          v-for="order in customerRecentOrders"
                          :key="order.id"
                          class="rounded-xl border bg-white p-3 transition hover:border-gray-300 hover:bg-gray-50"
                        >
                          <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p class="font-semibold text-gray-900">
                                {{ order.order_number || `Order #${order.id.slice(0, 8)}` }}
                              </p>
                              <p class="text-xs text-gray-400">
                                {{ formatDate(order.created_at) }}
                              </p>
                            </div>

                            <div class="flex items-center gap-3">
                              <span
                                class="rounded-full px-3 py-1 text-xs font-semibold uppercase"
                                :class="getOrderStatusClass(order.status)"
                              >
                                {{ formatOrderStatus(order.status) }}
                              </span>

                              <p class="font-semibold text-gray-900">
                                {{ formatCurrency(order.total_amount) }}
                              </p>

                              <button
                                v-if="canSeeOrders"
                                type="button"
                                class="rounded-lg bg-black px-3 py-2 text-xs font-medium text-white hover:bg-gray-800"
                                @click="openOrderDialog(order.id)"
                              >
                                Open
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <DashboardOrderDetailsDialog
      v-model:open="isOrderDialogOpen"
      :order-id="selectedOrderId"
      @updated="handleOrderUpdated"
    />
  </div>
</template>

<script setup>
import {
  adminPermissionGroups,
  adminPermissionDependencies,
  adminPermissionKeys,
  createEmptyAdminPermissions,
  createFullAdminPermissions,
  normalizeAdminPermissions
} from '~/utils/adminPermissions'
import {
  formatCustomerOrderStatus,
  getCustomerOrderStatusClass
} from '~/utils/orderStatus'

definePageMeta({
  layout: 'dashboard'
})

const supabase = useSupabaseClient()
const {
  getSnapshot,
  invalidate,
  isFresh,
  setSnapshot
} = useDashboardCache()
const {
  adminUser: currentAdminUser,
  hasPermission
} = useAdminAccess()

const adminUsers = ref([])
const loading = ref(true)
const saving = ref(false)
const deleting = ref(false)
const pageError = ref('')
const formError = ref('')
const currentPage = ref(1)
const pageSize = 10
const totalUsers = ref(0)
const activeOwnerCount = ref(0)
const searchQuery = ref('')
const editingId = ref('')
const userFormRef = ref(null)
const emailInputRef = ref(null)
const customerSectionOpen = ref(false)
const customerSectionLoaded = ref(false)
const customerUsers = ref([])
const customerUsersLoading = ref(false)
const customerSectionError = ref('')
const customerCurrentPage = ref(1)
const customerPageSize = 10
const customerTotalUsers = ref(0)
const customerActiveUsers = ref(0)
const customerFilteredTotal = ref(0)
const customerSearchQuery = ref('')
const selectedCustomerId = ref('')
const customerDetail = ref(null)
const customerDetailLoading = ref(false)
const customerActionLoading = ref(false)
const customerRecentOrders = ref([])
const customerDetailStats = reactive({
  totalOrders: 0,
  completed: 0,
  open: 0
})
const isOrderDialogOpen = ref(false)
const selectedOrderId = ref('')
let searchTimeoutId = null
let customerSearchTimeoutId = null

const form = reactive({
  email: '',
  password: '',
  full_name: '',
  role: 'admin',
  is_active: true,
  permissions: createEmptyAdminPermissions()
})

const trimmedSearchQuery = computed(() => searchQuery.value.trim())
const hasActiveSearch = computed(() => Boolean(trimmedSearchQuery.value))
const trimmedCustomerSearchQuery = computed(() => customerSearchQuery.value.trim())
const customerHasActiveSearch = computed(() => Boolean(trimmedCustomerSearchQuery.value))
const canSeeOrders = computed(() => hasPermission('dashboard.orders'))

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(totalUsers.value / pageSize))
})

const customerTotalPages = computed(() => {
  return Math.max(1, Math.ceil(customerFilteredTotal.value / customerPageSize))
})

const pageStart = computed(() => {
  if (!totalUsers.value) {
    return 0
  }

  return (currentPage.value - 1) * pageSize + 1
})

const pageEnd = computed(() => {
  return Math.min(currentPage.value * pageSize, totalUsers.value)
})

const customerPageStart = computed(() => {
  if (!customerFilteredTotal.value) {
    return 0
  }

  return (customerCurrentPage.value - 1) * customerPageSize + 1
})

const customerPageEnd = computed(() => {
  return Math.min(customerCurrentPage.value * customerPageSize, customerFilteredTotal.value)
})

const isEditingOwner = computed(() => {
  return Boolean(editingId.value) && form.role === 'owner'
})

const isDeleteDisabled = computed(() => {
  return deleting.value || (isEditingOwner.value && activeOwnerCount.value <= 1)
})

const canEditAdminUser = (user) => {
  if (!user) {
    return false
  }

  if (user.role === 'owner') {
    return currentAdminUser.value?.role === 'owner'
  }

  return true
}

const resetForm = () => {
  editingId.value = ''
  form.email = ''
  form.password = ''
  form.full_name = ''
  form.role = 'admin'
  form.is_active = true
  form.permissions = createEmptyAdminPermissions()
  formError.value = ''
}

const buildAdminUsersCacheKey = (page = currentPage.value) => {
  return `dashboard:users:admins:${page}:${trimmedSearchQuery.value.toLowerCase()}`
}

const buildCustomerUsersCacheKey = (page = customerCurrentPage.value) => {
  return `dashboard:users:customers:${page}:${trimmedCustomerSearchQuery.value.toLowerCase()}`
}

const buildCustomerDetailCacheKey = (customerId) => {
  return `dashboard:users:customer:${customerId}`
}

const getAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession()

  if (!data.session?.access_token) {
    throw new Error('Your session expired. Please log in again.')
  }

  return {
    authorization: `Bearer ${data.session.access_token}`
  }
}

const applyAdminUsersSnapshot = (snapshot) => {
  currentPage.value = snapshot?.page || 1
  totalUsers.value = snapshot?.totalUsers || 0
  activeOwnerCount.value = snapshot?.activeOwnerCount || 0
  adminUsers.value = snapshot?.items || []
}

const getAdminUsersList = async (page = currentPage.value, { force = false } = {}) => {
  currentPage.value = page
  const cacheKey = buildAdminUsersCacheKey(page)
  const cachedSnapshot = getSnapshot(cacheKey)

  if (cachedSnapshot) {
    applyAdminUsersSnapshot(cachedSnapshot)
  }

  if (!force && cachedSnapshot && isFresh(cacheKey)) {
    loading.value = false
    return
  }

  loading.value = true
  pageError.value = ''

  try {
    const response = await $fetch('/api/admin-users', {
      query: {
        page,
        pageSize,
        search: trimmedSearchQuery.value || undefined
      },
      headers: await getAuthHeaders()
    })

    const snapshot = {
      page,
      totalUsers: response.total || 0,
      activeOwnerCount: response.activeOwnerCount || 0,
      items: response.items || []
    }

    applyAdminUsersSnapshot(snapshot)
    setSnapshot(cacheKey, snapshot)

    if (currentPage.value > totalPages.value) {
      loading.value = false
      await getAdminUsersList(totalPages.value, { force })
      return
    }
  } catch (error) {
    pageError.value = error?.data?.statusMessage || error?.message || 'Could not load admin users.'
  } finally {
    loading.value = false
  }
}

const resetCustomerDetail = () => {
  selectedCustomerId.value = ''
  customerDetail.value = null
  customerRecentOrders.value = []
  customerDetailStats.totalOrders = 0
  customerDetailStats.completed = 0
  customerDetailStats.open = 0
}

const applyCustomerUsersSnapshot = (snapshot) => {
  customerCurrentPage.value = snapshot?.page || 1
  customerTotalUsers.value = snapshot?.totalUsers || 0
  customerActiveUsers.value = snapshot?.activeUsers || 0
  customerFilteredTotal.value = snapshot?.filteredTotal || 0
  customerUsers.value = snapshot?.items || []
  customerSectionLoaded.value = true
}

const getCustomerUsersList = async (page = customerCurrentPage.value, { force = false } = {}) => {
  customerCurrentPage.value = page
  const cacheKey = buildCustomerUsersCacheKey(page)
  const cachedSnapshot = getSnapshot(cacheKey)

  if (cachedSnapshot) {
    applyCustomerUsersSnapshot(cachedSnapshot)
  }

  if (!force && cachedSnapshot && isFresh(cacheKey)) {
    customerUsersLoading.value = false
    return
  }

  customerUsersLoading.value = true
  customerSectionError.value = ''

  try {
    const response = await $fetch('/api/customer-users', {
      query: {
        page,
        pageSize: customerPageSize,
        search: trimmedCustomerSearchQuery.value || undefined
      },
      headers: await getAuthHeaders()
    })

    const snapshot = {
      page,
      totalUsers: response.total || 0,
      activeUsers: response.activeTotal || 0,
      filteredTotal: response.filteredTotal || 0,
      items: response.items || []
    }

    applyCustomerUsersSnapshot(snapshot)
    setSnapshot(cacheKey, snapshot)

    if (customerCurrentPage.value > customerTotalPages.value) {
      customerUsersLoading.value = false
      await getCustomerUsersList(customerTotalPages.value, { force })
      return
    }

    if (selectedCustomerId.value && !customerUsers.value.some((customer) => customer.id === selectedCustomerId.value)) {
      resetCustomerDetail()
    }
  } catch (error) {
    customerSectionError.value = error?.data?.statusMessage || error?.message || 'Could not load store customers.'
  } finally {
    customerUsersLoading.value = false
  }
}

const applyCustomerDetailSnapshot = (customerId, snapshot) => {
  selectedCustomerId.value = customerId
  customerDetail.value = snapshot?.item || null
  customerRecentOrders.value = snapshot?.recentOrders || []
  customerDetailStats.totalOrders = snapshot?.stats?.totalOrders || 0
  customerDetailStats.completed = snapshot?.stats?.completed || 0
  customerDetailStats.open = snapshot?.stats?.open || 0
}

const getCustomerUserDetails = async (customerId, { force = false } = {}) => {
  const cacheKey = buildCustomerDetailCacheKey(customerId)
  const cachedSnapshot = getSnapshot(cacheKey)

  if (cachedSnapshot) {
    applyCustomerDetailSnapshot(customerId, cachedSnapshot)
  }

  if (!force && cachedSnapshot && isFresh(cacheKey)) {
    customerDetailLoading.value = false
    return
  }

  customerDetailLoading.value = true
  customerSectionError.value = ''

  try {
    const response = await $fetch(`/api/customer-users/${customerId}`, {
      headers: await getAuthHeaders()
    })

    const snapshot = {
      item: response.item || null,
      recentOrders: response.recentOrders || [],
      stats: {
        totalOrders: response.stats?.totalOrders || 0,
        completed: response.stats?.completed || 0,
        open: response.stats?.open || 0
      }
    }

    applyCustomerDetailSnapshot(customerId, snapshot)
    setSnapshot(cacheKey, snapshot)
  } catch (error) {
    customerSectionError.value = error?.data?.statusMessage || error?.message || 'Could not load customer details.'
  } finally {
    customerDetailLoading.value = false
  }
}

const toggleCustomerSection = async () => {
  customerSectionOpen.value = !customerSectionOpen.value

  if (customerSectionOpen.value && !customerSectionLoaded.value) {
    await getCustomerUsersList(1)
  }
}

const toggleCustomerDetails = async (customer) => {
  if (selectedCustomerId.value === customer.id) {
    resetCustomerDetail()
    return
  }

  await getCustomerUserDetails(customer.id)
}

const buildPayload = () => {
  return {
    email: form.email,
    password: form.password,
    full_name: form.full_name,
    role: form.role,
    is_active: form.is_active,
    permissions: normalizeAdminPermissions(form.permissions, form.role)
  }
}

const saveAdminUser = async () => {
  formError.value = ''
  saving.value = true

  try {
    const headers = await getAuthHeaders()

    if (editingId.value) {
      await $fetch(`/api/admin-users/${editingId.value}`, {
        method: 'PATCH',
        body: buildPayload(),
        headers
      })
    } else {
      await $fetch('/api/admin-users', {
        method: 'POST',
        body: buildPayload(),
        headers
      })
    }

    resetForm()
    invalidate('dashboard:users:admins:')
    await getAdminUsersList(currentPage.value, { force: true })
  } catch (error) {
    formError.value = error?.data?.statusMessage || error?.message || 'Could not save the admin user.'
  } finally {
    saving.value = false
  }
}

const startEdit = (user) => {
  if (!canEditAdminUser(user)) {
    return
  }

  editingId.value = user.id
  form.email = user.email || ''
  form.password = ''
  form.full_name = user.full_name || ''
  form.role = user.role || 'admin'
  form.is_active = user.is_active ?? true
  form.permissions = normalizeAdminPermissions(user.permissions, user.role)
  formError.value = ''

  nextTick(() => {
    userFormRef.value?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })

    emailInputRef.value?.focus()
  })
}

const getRequiredViewPermission = (permissionKey) => {
  const dependencyEntry = Object.entries(adminPermissionDependencies).find(([, dependentPermissionKeys]) => {
    return dependentPermissionKeys.includes(permissionKey)
  })

  return dependencyEntry?.[0] || ''
}

const isPermissionDisabled = (permissionKey) => {
  if (form.role === 'owner') {
    return true
  }

  const requiredViewPermission = getRequiredViewPermission(permissionKey)

  if (!requiredViewPermission) {
    return false
  }

  return !form.permissions[requiredViewPermission]
}

const getPermissionValue = (permissionKey) => {
  if (form.role === 'owner') {
    return true
  }

  return Boolean(form.permissions[permissionKey])
}

const updatePermission = (permissionKey, isEnabled) => {
  if (form.role === 'owner') {
    return
  }

  form.permissions[permissionKey] = Boolean(isEnabled)
}

const deleteAdminUser = async () => {
  formError.value = ''

  if (!editingId.value) {
    return
  }

  if (isEditingOwner.value && activeOwnerCount.value <= 1) {
    formError.value = 'At least one active owner must remain.'
    return
  }

  const confirmDelete = confirm('Are you sure you want to delete this admin user?')

  if (!confirmDelete) {
    return
  }

  deleting.value = true

  try {
    const deletingCurrentUser = editingId.value === currentAdminUser.value?.id

    await $fetch(`/api/admin-users/${editingId.value}`, {
      method: 'DELETE',
      headers: await getAuthHeaders()
    })

    resetForm()
    invalidate('dashboard:users:admins:')
    await getAdminUsersList(currentPage.value, { force: true })

    if (deletingCurrentUser) {
      await supabase.auth.signOut()
      await navigateTo('/dashboard/login')
    }
  } catch (error) {
    formError.value = error?.data?.statusMessage || error?.message || 'Could not delete the admin user.'
  } finally {
    deleting.value = false
  }
}

const updateCustomerStatus = async (isActive) => {
  if (!selectedCustomerId.value) {
    return
  }

  customerActionLoading.value = true
  customerSectionError.value = ''

  try {
    await $fetch(`/api/customer-users/${selectedCustomerId.value}`, {
      method: 'PATCH',
      body: {
        is_active: isActive
      },
      headers: await getAuthHeaders()
    })

    invalidate('dashboard:users:customers:')
    invalidate(buildCustomerDetailCacheKey(selectedCustomerId.value))
    await getCustomerUsersList(customerCurrentPage.value, { force: true })
    await getCustomerUserDetails(selectedCustomerId.value, { force: true })
  } catch (error) {
    customerSectionError.value = error?.data?.statusMessage || error?.message || 'Could not update the customer account.'
  } finally {
    customerActionLoading.value = false
  }
}

const deleteCustomerUser = async () => {
  if (!selectedCustomerId.value) {
    return
  }

  const confirmDelete = confirm('Are you sure you want to delete this customer account?')

  if (!confirmDelete) {
    return
  }

  customerActionLoading.value = true
  customerSectionError.value = ''

  try {
    await $fetch(`/api/customer-users/${selectedCustomerId.value}`, {
      method: 'DELETE',
      headers: await getAuthHeaders()
    })

    resetCustomerDetail()
    invalidate('dashboard:users:customers:')
    await getCustomerUsersList(customerCurrentPage.value, { force: true })
  } catch (error) {
    customerSectionError.value = error?.data?.statusMessage || error?.message || 'Could not delete the customer account.'
  } finally {
    customerActionLoading.value = false
  }
}

const clearSearch = () => {
  searchQuery.value = ''
}

const clearCustomerSearch = () => {
  customerSearchQuery.value = ''
}

const goToPreviousPage = async () => {
  if (currentPage.value === 1) {
    return
  }

  await getAdminUsersList(currentPage.value - 1)
}

const goToNextPage = async () => {
  if (currentPage.value === totalPages.value) {
    return
  }

  await getAdminUsersList(currentPage.value + 1)
}

const goToPreviousCustomerPage = async () => {
  if (customerCurrentPage.value === 1) {
    return
  }

  await getCustomerUsersList(customerCurrentPage.value - 1)
}

const goToNextCustomerPage = async () => {
  if (customerCurrentPage.value === customerTotalPages.value) {
    return
  }

  await getCustomerUsersList(customerCurrentPage.value + 1)
}

const openOrderDialog = (orderId) => {
  selectedOrderId.value = orderId
  isOrderDialogOpen.value = true
}

const handleOrderUpdated = async (updatedOrder) => {
  if (!updatedOrder?.id) {
    return
  }

  customerRecentOrders.value = customerRecentOrders.value.map((order) => {
    if (order.id !== updatedOrder.id) {
      return order
    }

    return {
      ...order,
      ...updatedOrder
    }
  })

  if (selectedCustomerId.value) {
    invalidate('dashboard:orders:')
    invalidate(buildCustomerDetailCacheKey(selectedCustomerId.value))
    await getCustomerUserDetails(selectedCustomerId.value, { force: true })
  }
}

const formatDate = (value) => {
  if (!value) {
    return 'recently'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 2
  }).format(Number(value || 0))
}

const getCustomerAddress = (customer) => {
  const addressParts = [
    customer?.address_line_1,
    customer?.address_line_2,
    customer?.city,
    customer?.state,
    customer?.country
  ].filter(Boolean)

  return addressParts.length ? addressParts.join('\n') : 'No address saved yet.'
}

const formatOrderStatus = (value) => {
  return formatCustomerOrderStatus(value)
}

const getOrderStatusClass = (value) => {
  return getCustomerOrderStatusClass(value)
}

watch(searchQuery, () => {
  if (searchTimeoutId) {
    clearTimeout(searchTimeoutId)
  }

  searchTimeoutId = setTimeout(() => {
    getAdminUsersList(1)
  }, 300)
})

watch(customerSearchQuery, () => {
  if (customerSearchTimeoutId) {
    clearTimeout(customerSearchTimeoutId)
  }

  customerSearchTimeoutId = setTimeout(() => {
    if (customerSectionOpen.value) {
      getCustomerUsersList(1)
    }
  }, 300)
})

watch(
  () => ({ ...form.permissions }),
  (value) => {
    const normalizedPermissions = normalizeAdminPermissions(value, form.role)

    adminPermissionKeys.forEach((permissionKey) => {
      if (form.permissions[permissionKey] !== normalizedPermissions[permissionKey]) {
        form.permissions[permissionKey] = normalizedPermissions[permissionKey]
      }
    })
  },
  {
    deep: true
  }
)

watch(() => form.role, (role) => {
  const normalizedPermissions = role === 'owner'
    ? createFullAdminPermissions()
    : normalizeAdminPermissions(form.permissions, role)

  adminPermissionKeys.forEach((permissionKey) => {
    if (form.permissions[permissionKey] !== normalizedPermissions[permissionKey]) {
      form.permissions[permissionKey] = normalizedPermissions[permissionKey]
    }
  })
})

onBeforeUnmount(() => {
  if (searchTimeoutId) {
    clearTimeout(searchTimeoutId)
  }

  if (customerSearchTimeoutId) {
    clearTimeout(customerSearchTimeoutId)
  }
})

onMounted(async () => {
  await getAdminUsersList()
})
</script>
