<template>
  <div class="min-h-screen bg-gray-100 p-6">
    <div class="mx-auto max-w-6xl space-y-6">
      <div class="rounded-2xl bg-white p-6 shadow">
        <h2 class="text-4xl font-bold">Users</h2>
        <p class="mt-2 text-sm text-gray-500">
          Create admin accounts, review them, and control dashboard permissions.
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
            <option value="owner">Owner</option>
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
                    :checked="form.permissions[permission.key]"
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
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  adminPermissionGroups,
  adminPermissionDependencies,
  adminPermissionKeys,
  createEmptyAdminPermissions,
  normalizeAdminPermissions
} from '~/utils/adminPermissions'

definePageMeta({
  layout: 'dashboard'
})

const supabase = useSupabaseClient()
const { adminUser: currentAdminUser, loadAdminAccess } = useAdminAccess()

await loadAdminAccess()

const adminUsers = ref([])
const loading = ref(false)
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
let searchTimeoutId = null

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

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(totalUsers.value / pageSize))
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

const isEditingOwner = computed(() => {
  return Boolean(editingId.value) && form.role === 'owner'
})

const isDeleteDisabled = computed(() => {
  return deleting.value || (isEditingOwner.value && activeOwnerCount.value <= 1)
})

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

const getAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession()

  if (!data.session?.access_token) {
    throw new Error('Your session expired. Please log in again.')
  }

  return {
    authorization: `Bearer ${data.session.access_token}`
  }
}

const getAdminUsersList = async (page = currentPage.value) => {
  loading.value = true
  pageError.value = ''
  currentPage.value = page

  try {
    const response = await $fetch('/api/admin-users', {
      query: {
        page,
        pageSize,
        search: trimmedSearchQuery.value || undefined
      },
      headers: await getAuthHeaders()
    })

    totalUsers.value = response.total || 0
    activeOwnerCount.value = response.activeOwnerCount || 0

    if (currentPage.value > totalPages.value) {
      loading.value = false
      await getAdminUsersList(totalPages.value)
      return
    }

    adminUsers.value = response.items || []
  } catch (error) {
    pageError.value = error?.data?.statusMessage || error?.message || 'Could not load admin users.'
  } finally {
    loading.value = false
  }
}

const buildPayload = () => {
  return {
    email: form.email,
    password: form.password,
    full_name: form.full_name,
    role: form.role,
    is_active: form.is_active,
    permissions: normalizeAdminPermissions(form.permissions)
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
    await getAdminUsersList(currentPage.value)
  } catch (error) {
    formError.value = error?.data?.statusMessage || error?.message || 'Could not save the admin user.'
  } finally {
    saving.value = false
  }
}

const startEdit = (user) => {
  editingId.value = user.id
  form.email = user.email || ''
  form.password = ''
  form.full_name = user.full_name || ''
  form.role = user.role || 'admin'
  form.is_active = user.is_active ?? true
  form.permissions = normalizeAdminPermissions(user.permissions)
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
  const requiredViewPermission = getRequiredViewPermission(permissionKey)

  if (!requiredViewPermission) {
    return false
  }

  return !form.permissions[requiredViewPermission]
}

const updatePermission = (permissionKey, isEnabled) => {
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
    await getAdminUsersList(currentPage.value)

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

const clearSearch = () => {
  searchQuery.value = ''
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

const formatDate = (value) => {
  if (!value) {
    return 'recently'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

watch(searchQuery, () => {
  if (searchTimeoutId) {
    clearTimeout(searchTimeoutId)
  }

  searchTimeoutId = setTimeout(() => {
    getAdminUsersList(1)
  }, 300)
})

watch(
  () => ({ ...form.permissions }),
  (value) => {
    const normalizedPermissions = normalizeAdminPermissions(value)

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

onBeforeUnmount(() => {
  if (searchTimeoutId) {
    clearTimeout(searchTimeoutId)
  }
})

await getAdminUsersList()
</script>
