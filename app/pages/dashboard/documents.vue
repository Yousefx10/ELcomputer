<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <section class="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 p-6 text-white shadow">
      <div class="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div class="flex items-center gap-4">
          <span class="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Icon name="lucide:folder-closed" size="30" />
          </span>
          <div>
            <h2 class="text-3xl font-bold sm:text-4xl">Documents</h2>
            <p class="mt-1 text-sm text-blue-50">
              Organize files and set folder access.
            </p>
          </div>
        </div>

        <div v-if="access.can_edit" class="flex flex-wrap gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/25 hover:bg-white/25"
            @click="openCreateFolder"
          >
            <Icon name="lucide:folder-plus" size="18" />
            New folder
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50"
            :disabled="uploading"
            @click="fileInput?.click()"
          >
            <Icon name="lucide:upload" size="18" />
            {{ uploading ? 'Uploading...' : 'Upload files' }}
          </button>
        </div>
      </div>
    </section>

    <div v-if="pageError" class="flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700 shadow-sm">
      <Icon name="lucide:circle-alert" size="20" class="mt-0.5 shrink-0" />
      <div class="min-w-0 flex-1">
        <p class="font-semibold">Documents could not be loaded</p>
        <p class="mt-1">{{ pageError }}</p>
      </div>
      <button type="button" class="font-bold hover:underline" @click="loadDocuments">Retry</button>
    </div>

    <div
      v-if="loaded && !access.can_edit"
      class="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
    >
      <Icon name="lucide:eye" size="20" class="mt-0.5 shrink-0" />
      <div>
        <p class="font-bold">View-only access</p>
        <p class="mt-0.5">You can open and download files. Editing is disabled.</p>
      </div>
    </div>

    <section class="overflow-hidden rounded-2xl bg-white shadow">
      <div class="border-b p-4 sm:p-5">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <nav class="flex min-w-0 flex-wrap items-center gap-1 text-sm" aria-label="Folder breadcrumb">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 font-semibold transition"
              :class="!currentFolderId ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950'"
              @click="goToFolder(null)"
            >
              <Icon name="lucide:hard-drive" size="16" />
              All documents
            </button>

            <template v-for="crumb in breadcrumbs" :key="crumb.id">
              <Icon name="lucide:chevron-right" size="15" class="shrink-0 text-gray-300" />
              <button
                type="button"
                class="max-w-48 truncate rounded-lg px-2.5 py-2 font-semibold transition"
                :class="crumb.id === currentFolderId ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950'"
                @click="goToFolder(crumb.id)"
              >
                {{ crumb.name }}
              </button>
            </template>
          </nav>

          <div class="flex items-center gap-2">
            <label class="relative min-w-0 flex-1 lg:w-72">
              <Icon name="lucide:search" size="17" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                v-model="searchQuery"
                type="search"
                placeholder="Search this folder"
                class="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
            </label>
            <div class="flex rounded-xl bg-gray-100 p-1">
              <button
                type="button"
                aria-label="Grid view"
                class="inline-flex h-9 w-9 items-center justify-center rounded-lg"
                :class="viewMode === 'grid' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'"
                @click="viewMode = 'grid'"
              >
                <Icon name="lucide:grid-2x2" size="17" />
              </button>
              <button
                type="button"
                aria-label="List view"
                class="inline-flex h-9 w-9 items-center justify-center rounded-lg"
                :class="viewMode === 'list' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'"
                @click="viewMode = 'list'"
              >
                <Icon name="lucide:list" size="18" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="access.can_edit"
        class="m-4 flex min-h-24 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed px-4 text-center transition sm:m-5"
        :class="dragActive ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-blue-300 hover:bg-blue-50/40'"
        @click="fileInput?.click()"
        @dragenter.prevent="dragActive = true"
        @dragover.prevent="dragActive = true"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
      >
        <div class="flex flex-col items-center gap-1 sm:flex-row sm:gap-3">
          <Icon :name="uploading ? 'lucide:loader-circle' : 'lucide:cloud-upload'" size="25" :class="uploading ? 'animate-spin' : ''" />
          <div class="text-sm">
            <span class="font-bold">{{ uploading ? uploadStatus : 'Drop files here or click to browse' }}</span>
            <span v-if="!uploading" class="ml-1 text-gray-400">Up to 25 MB each</span>
          </div>
        </div>
      </div>

      <input
        ref="fileInput"
        type="file"
        class="hidden"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.text,.rtf,.csv,.json,.xml,.md,.odt,.ods,.jpg,.jpeg,.png,.webp,.gif,.avif,.svg,.bmp,.tif,.tiff,.heic,.zip,.rar,.7z"
        @change="handleFileSelection"
      >

      <div class="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 text-xs text-gray-500 sm:px-5">
        <p>
          {{ summary.folders }} {{ summary.folders === 1 ? 'folder' : 'folders' }} ·
          {{ summary.files }} {{ summary.files === 1 ? 'file' : 'files' }} ·
          {{ formatBytes(summary.size_bytes) }}
        </p>
        <div v-if="currentFolder" class="flex items-center gap-2">
          <span v-if="currentFolder.is_restricted" class="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 font-semibold text-violet-700">
            <Icon name="lucide:lock-keyhole" size="13" /> Restricted
          </span>
          <button
            v-if="currentFolder.can_manage_access"
            type="button"
            class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 font-semibold text-gray-700 hover:bg-gray-200"
            @click="openPermissions(currentFolder)"
          >
            <Icon name="lucide:users" size="13" /> Manage access
          </button>
        </div>
      </div>

      <div v-if="loading" class="grid min-h-64 place-items-center border-t p-8 text-gray-500">
        <div class="text-center">
          <Icon name="lucide:loader-circle" size="30" class="mx-auto animate-spin text-blue-600" />
          <p class="mt-3 text-sm font-medium">Loading documents...</p>
        </div>
      </div>

      <div v-else-if="!items.length" class="grid min-h-64 place-items-center border-t p-8 text-center">
        <div>
          <span class="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
            <Icon :name="searchQuery.trim() ? 'lucide:search-x' : 'lucide:folder-open'" size="30" />
          </span>
          <h3 class="mt-4 text-lg font-bold text-gray-900">
            {{ searchQuery.trim() ? 'Nothing matched your search' : 'This folder is empty' }}
          </h3>
          <p class="mt-1 text-sm text-gray-500">
            {{ searchQuery.trim()
              ? 'Try another file or folder name.'
              : access.can_edit ? 'Upload a file or create a folder to get started.' : 'There are no files available here yet.' }}
          </p>
        </div>
      </div>

      <div v-else-if="viewMode === 'grid'" class="grid gap-4 border-t p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3 xl:grid-cols-4">
        <article
          v-for="item in items"
          :key="`${item.type}-${item.id}`"
          class="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
        >
          <button
            type="button"
            class="flex w-full items-center gap-3 p-4 text-left"
            @dblclick="activateItem(item)"
            @click="selectedItemId = item.id"
          >
            <span
              class="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
              :class="item.type === 'folder' ? 'bg-amber-50 text-amber-500' : getFileColor(item)"
            >
              <Icon :name="item.type === 'folder' ? 'lucide:folder' : getFileIcon(item)" size="25" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-bold text-gray-900" :title="item.name">{{ item.name }}</p>
              <p class="mt-1 truncate text-xs text-gray-500">
                {{ item.type === 'folder' ? getFolderAccessLabel(item) : formatBytes(item.size_bytes) }}
              </p>
            </div>
          </button>

          <div class="flex items-center gap-1 border-t bg-gray-50/70 px-3 py-2">
            <button
              type="button"
              class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold text-gray-600 hover:bg-white hover:text-blue-700"
              @click="activateItem(item)"
            >
              <Icon :name="item.type === 'folder' ? 'lucide:folder-open' : 'lucide:eye'" size="15" />
              {{ item.type === 'folder' ? 'Open' : 'View' }}
            </button>
            <button
              v-if="item.type === 'file'"
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-white hover:text-blue-700"
              aria-label="Download file"
              @click="downloadDocument(item)"
            >
              <Icon name="lucide:download" size="15" />
            </button>
            <button
              v-if="item.type === 'folder' && item.can_manage_access"
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-white hover:text-violet-700"
              aria-label="Manage folder access"
              @click="openPermissions(item)"
            >
              <Icon name="lucide:user-round-cog" size="15" />
            </button>
            <button
              v-if="item.can_edit"
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-white hover:text-gray-950"
              :aria-label="`Rename ${item.name}`"
              @click="openRename(item)"
            >
              <Icon name="lucide:pencil" size="15" />
            </button>
            <button
              v-if="item.can_edit"
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600"
              :aria-label="`Delete ${item.name}`"
              @click="deleteItem(item)"
            >
              <Icon name="lucide:trash-2" size="15" />
            </button>
          </div>
        </article>
      </div>

      <div v-else class="overflow-x-auto border-t">
        <table class="w-full min-w-[720px] text-left text-sm">
          <thead class="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th class="px-5 py-3">Name</th>
              <th class="px-5 py-3">Access / type</th>
              <th class="px-5 py-3">Size</th>
              <th class="px-5 py-3">Modified</th>
              <th class="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="item in items" :key="`${item.type}-${item.id}`" class="hover:bg-gray-50">
              <td class="px-5 py-3.5">
                <button type="button" class="flex max-w-sm items-center gap-3 text-left" @click="activateItem(item)">
                  <span :class="item.type === 'folder' ? 'text-amber-500' : 'text-blue-600'">
                    <Icon :name="item.type === 'folder' ? 'lucide:folder' : getFileIcon(item)" size="21" />
                  </span>
                  <span class="truncate font-semibold text-gray-900">{{ item.name }}</span>
                </button>
              </td>
              <td class="px-5 py-3.5 text-gray-500">
                <span v-if="item.type === 'folder'" class="inline-flex items-center gap-1.5">
                  <Icon :name="item.is_restricted ? 'lucide:lock-keyhole' : 'lucide:users'" size="14" />
                  {{ getFolderAccessLabel(item) }}
                </span>
                <span v-else>{{ getFileType(item) }}</span>
              </td>
              <td class="px-5 py-3.5 text-gray-500">{{ item.type === 'file' ? formatBytes(item.size_bytes) : '—' }}</td>
              <td class="px-5 py-3.5 text-gray-500">{{ formatDate(item.updated_at) }}</td>
              <td class="px-5 py-3.5">
                <div class="flex justify-end gap-1">
                  <button type="button" class="icon-action" :aria-label="item.type === 'folder' ? 'Open folder' : 'View file'" @click="activateItem(item)">
                    <Icon :name="item.type === 'folder' ? 'lucide:folder-open' : 'lucide:eye'" size="16" />
                  </button>
                  <button v-if="item.type === 'file'" type="button" class="icon-action" aria-label="Download file" @click="downloadDocument(item)">
                    <Icon name="lucide:download" size="16" />
                  </button>
                  <button v-if="item.type === 'folder' && item.can_manage_access" type="button" class="icon-action" aria-label="Manage folder access" @click="openPermissions(item)">
                    <Icon name="lucide:user-round-cog" size="16" />
                  </button>
                  <button v-if="item.can_edit" type="button" class="icon-action" :aria-label="`Rename ${item.name}`" @click="openRename(item)">
                    <Icon name="lucide:pencil" size="16" />
                  </button>
                  <button v-if="item.can_edit" type="button" class="icon-action hover:!bg-red-50 hover:!text-red-600" :aria-label="`Delete ${item.name}`" @click="deleteItem(item)">
                    <Icon name="lucide:trash-2" size="16" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="createFolderOpen" class="modal-backdrop" @mousedown.self="closeCreateFolder">
        <form class="modal-panel" @submit.prevent="createFolder">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-2xl font-bold text-gray-950">New folder</h3>
              <p class="mt-1 text-sm text-gray-500">Create it inside {{ currentFolder?.name || 'All documents' }}.</p>
            </div>
            <button type="button" class="modal-close" aria-label="Close" @click="closeCreateFolder">
              <Icon name="lucide:x" size="20" />
            </button>
          </div>

          <label class="mt-6 block">
            <span class="mb-2 block text-sm font-bold text-gray-700">Folder name</span>
            <input ref="folderNameInput" v-model="newFolderName" maxlength="120" required type="text" placeholder="e.g. Supplier contracts" class="form-input">
          </label>

          <label class="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border p-4">
            <input v-model="newFolderRestricted" type="checkbox" class="mt-1">
            <span>
              <span class="block font-bold text-gray-900">Restrict this folder</span>
              <span class="mt-1 block text-sm text-gray-500">Only selected admins and owners will be able to open it.</span>
            </span>
          </label>

          <div v-if="newFolderRestricted" class="mt-5">
            <div class="mb-2 flex items-center justify-between">
              <p class="text-sm font-bold text-gray-700">Admin access</p>
              <p class="text-xs text-gray-400">Owners always have access</p>
            </div>
            <div v-if="accessOptionsLoading" class="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">Loading admins...</div>
            <div v-else class="max-h-64 space-y-2 overflow-y-auto rounded-2xl border p-2">
              <div v-for="user in selectableAccessUsers" :key="user.id" class="flex items-center gap-3 rounded-xl p-2.5 hover:bg-gray-50">
                <span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xs font-bold text-gray-700">
                  {{ getInitials(user) }}
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-bold text-gray-900">{{ user.full_name || user.email }}</p>
                  <p class="truncate text-xs text-gray-500">{{ user.email }}</p>
                </div>
                <select v-model="newFolderAccess[user.id]" :disabled="user.id === adminUser?.id && adminUser?.role !== 'owner'" class="rounded-lg border bg-white px-2 py-1.5 text-xs font-semibold">
                  <option value="none">No access</option>
                  <option value="viewer">Can view</option>
                  <option value="editor" :disabled="!user.can_manage">Can edit</option>
                </select>
              </div>
              <p v-if="!selectableAccessUsers.length" class="p-3 text-center text-sm text-gray-500">No document-enabled admins found.</p>
            </div>
          </div>

          <p v-if="modalError" class="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{{ modalError }}</p>

          <div class="mt-6 flex justify-end gap-3">
            <button type="button" class="secondary-button" @click="closeCreateFolder">Cancel</button>
            <button type="submit" class="primary-button" :disabled="savingModal">
              {{ savingModal ? 'Creating...' : 'Create folder' }}
            </button>
          </div>
        </form>
      </div>

      <div v-if="renameOpen" class="modal-backdrop" @mousedown.self="closeRename">
        <form class="modal-panel max-w-md" @submit.prevent="renameItem">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-2xl font-bold text-gray-950">Rename {{ renameTarget?.type }}</h3>
              <p class="mt-1 text-sm text-gray-500">Enter a new name below.</p>
            </div>
            <button type="button" class="modal-close" aria-label="Close" @click="closeRename"><Icon name="lucide:x" size="20" /></button>
          </div>
          <input ref="renameInput" v-model="renameName" required maxlength="240" type="text" class="form-input mt-6">
          <p v-if="modalError" class="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{{ modalError }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <button type="button" class="secondary-button" @click="closeRename">Cancel</button>
            <button type="submit" class="primary-button" :disabled="savingModal">{{ savingModal ? 'Saving...' : 'Save name' }}</button>
          </div>
        </form>
      </div>

      <div v-if="permissionsOpen" class="modal-backdrop" @mousedown.self="closePermissions">
        <form class="modal-panel" @submit.prevent="savePermissions">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-2xl font-bold text-gray-950">Folder access</h3>
              <p class="mt-1 text-sm text-gray-500">{{ permissionFolder?.name }}</p>
            </div>
            <button type="button" class="modal-close" aria-label="Close" @click="closePermissions"><Icon name="lucide:x" size="20" /></button>
          </div>

          <div v-if="permissionsLoading" class="grid min-h-48 place-items-center text-gray-500">
            <Icon name="lucide:loader-circle" size="28" class="animate-spin text-blue-600" />
          </div>
          <template v-else>
            <div class="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1.5">
              <button
                type="button"
                class="rounded-xl px-3 py-3 text-sm font-bold transition"
                :class="!permissionRestricted ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500'"
                @click="permissionRestricted = false"
              >
                Everyone with Documents access
              </button>
              <button
                type="button"
                class="rounded-xl px-3 py-3 text-sm font-bold transition"
                :class="permissionRestricted ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500'"
                @click="permissionRestricted = true"
              >
                Selected admins only
              </button>
            </div>

            <div v-if="permissionRestricted" class="mt-5">
              <div class="mb-2 flex items-center justify-between gap-3">
                <p class="text-sm font-bold text-gray-700">People with access</p>
                <p class="text-xs text-gray-400">Owners always have full access</p>
              </div>
              <div class="max-h-72 space-y-2 overflow-y-auto rounded-2xl border p-2">
                <div v-for="user in permissionSelectableUsers" :key="user.id" class="flex items-center gap-3 rounded-xl p-2.5 hover:bg-gray-50">
                  <span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xs font-bold text-gray-700">{{ getInitials(user) }}</span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-bold text-gray-900">{{ user.full_name || user.email }}</p>
                    <p class="truncate text-xs text-gray-500">{{ user.email }}</p>
                  </div>
                  <select v-model="user.access_level" :disabled="user.id === adminUser?.id && adminUser?.role !== 'owner'" class="rounded-lg border bg-white px-2 py-1.5 text-xs font-semibold">
                    <option value="none">No access</option>
                    <option value="viewer">Can view</option>
                    <option value="editor" :disabled="!user.can_manage">Can edit</option>
                  </select>
                </div>
                <p v-if="!permissionSelectableUsers.length" class="p-3 text-center text-sm text-gray-500">No document-enabled admins found.</p>
              </div>
            </div>
          </template>

          <p v-if="modalError" class="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{{ modalError }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <button type="button" class="secondary-button" @click="closePermissions">Cancel</button>
            <button type="submit" class="primary-button" :disabled="savingModal || permissionsLoading">{{ savingModal ? 'Saving...' : 'Save access' }}</button>
          </div>
        </form>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'dashboard'
})

const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()
const { adminUser } = useAdminAccess()

const items = ref([])
const breadcrumbs = ref([])
const currentFolder = ref(null)
const summary = reactive({ folders: 0, files: 0, size_bytes: 0 })
const access = reactive({ level: 'viewer', can_edit: false })
const loading = ref(true)
const loaded = ref(false)
const pageError = ref('')
const searchQuery = ref('')
const viewMode = ref('grid')
const selectedItemId = ref('')
const fileInput = ref(null)
const uploading = ref(false)
const uploadStatus = ref('Uploading...')
const dragActive = ref(false)

const createFolderOpen = ref(false)
const folderNameInput = ref(null)
const newFolderName = ref('')
const newFolderRestricted = ref(false)
const newFolderAccess = ref({})
const accessOptions = ref([])
const accessOptionsLoading = ref(false)

const renameOpen = ref(false)
const renameInput = ref(null)
const renameTarget = ref(null)
const renameName = ref('')

const permissionsOpen = ref(false)
const permissionsLoading = ref(false)
const permissionFolder = ref(null)
const permissionRestricted = ref(false)
const permissionUsers = ref([])

const savingModal = ref(false)
const modalError = ref('')
let searchTimeoutId

const currentFolderId = computed(() => {
  const folderValue = Array.isArray(route.query.folder) ? route.query.folder[0] : route.query.folder
  return String(folderValue || '').trim() || null
})

const selectableAccessUsers = computed(() => accessOptions.value.filter((user) => user.role !== 'owner'))
const permissionSelectableUsers = computed(() => permissionUsers.value.filter((user) => user.role !== 'owner'))

const getAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession()

  if (!data.session?.access_token) {
    throw new Error('Your session expired. Please log in again.')
  }

  return {
    authorization: `Bearer ${data.session.access_token}`
  }
}

const getErrorMessage = (error, fallback) => {
  return error?.data?.statusMessage || error?.statusMessage || error?.message || fallback
}

const applySnapshot = (response) => {
  items.value = response.items || []
  breadcrumbs.value = response.breadcrumbs || []
  currentFolder.value = response.currentFolder || null
  access.level = response.access?.level || 'viewer'
  access.can_edit = Boolean(response.access?.can_edit)
  summary.folders = response.summary?.folders || 0
  summary.files = response.summary?.files || 0
  summary.size_bytes = response.summary?.size_bytes || 0
}

const loadDocuments = async () => {
  loading.value = true
  pageError.value = ''

  try {
    const response = await $fetch('/api/admin-documents', {
      query: {
        folderId: currentFolderId.value || undefined,
        search: searchQuery.value.trim() || undefined
      },
      headers: await getAuthHeaders()
    })

    applySnapshot(response)
  } catch (error) {
    items.value = []
    pageError.value = getErrorMessage(error, 'Could not load documents.')
  } finally {
    loading.value = false
    loaded.value = true
  }
}

const goToFolder = async (folderId) => {
  searchQuery.value = ''
  selectedItemId.value = ''
  await router.push({
    path: '/dashboard/documents',
    query: folderId ? { folder: folderId } : {}
  })
}

const activateItem = (item) => {
  if (item.type === 'folder') {
    goToFolder(item.id)
    return
  }

  viewDocument(item)
}

const loadAccessOptions = async () => {
  if (accessOptions.value.length || accessOptionsLoading.value) {
    return
  }

  accessOptionsLoading.value = true

  try {
    const response = await $fetch('/api/admin-documents/access-options', {
      headers: await getAuthHeaders()
    })
    accessOptions.value = response.items || []
  } catch (error) {
    modalError.value = getErrorMessage(error, 'Could not load admin access options.')
  } finally {
    accessOptionsLoading.value = false
  }
}

const openCreateFolder = async () => {
  modalError.value = ''
  newFolderName.value = ''
  newFolderRestricted.value = false
  newFolderAccess.value = {}
  createFolderOpen.value = true
  await loadAccessOptions()

  selectableAccessUsers.value.forEach((user) => {
    newFolderAccess.value[user.id] = user.id === adminUser.value?.id ? 'editor' : 'none'
  })

  await nextTick()
  folderNameInput.value?.focus()
}

const closeCreateFolder = () => {
  if (savingModal.value) return
  createFolderOpen.value = false
  modalError.value = ''
}

const createFolder = async () => {
  savingModal.value = true
  modalError.value = ''

  try {
    await $fetch('/api/admin-documents/folders', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: {
        parent_id: currentFolderId.value,
        name: newFolderName.value,
        is_restricted: newFolderRestricted.value,
        members: Object.entries(newFolderAccess.value)
          .filter(([, level]) => level !== 'none')
          .map(([adminUserId, accessLevel]) => ({
            admin_user_id: adminUserId,
            access_level: accessLevel
          }))
      }
    })

    createFolderOpen.value = false
    await loadDocuments()
  } catch (error) {
    modalError.value = getErrorMessage(error, 'Could not create the folder.')
  } finally {
    savingModal.value = false
  }
}

const openRename = async (item) => {
  modalError.value = ''
  renameTarget.value = item
  renameName.value = item.name
  renameOpen.value = true
  await nextTick()
  renameInput.value?.focus()
  renameInput.value?.select()
}

const closeRename = () => {
  if (savingModal.value) return
  renameOpen.value = false
  renameTarget.value = null
  modalError.value = ''
}

const renameItem = async () => {
  if (!renameTarget.value) return

  savingModal.value = true
  modalError.value = ''

  try {
    const endpoint = renameTarget.value.type === 'folder'
      ? `/api/admin-documents/folders/${renameTarget.value.id}`
      : `/api/admin-documents/files/${renameTarget.value.id}`

    await $fetch(endpoint, {
      method: 'PATCH',
      headers: await getAuthHeaders(),
      body: { name: renameName.value }
    })

    renameOpen.value = false
    renameTarget.value = null
    await loadDocuments()
  } catch (error) {
    modalError.value = getErrorMessage(error, 'Could not rename this item.')
  } finally {
    savingModal.value = false
  }
}

const openPermissions = async (folder) => {
  modalError.value = ''
  permissionFolder.value = folder
  permissionsOpen.value = true
  permissionsLoading.value = true

  try {
    const response = await $fetch(`/api/admin-documents/folders/${folder.id}/permissions`, {
      headers: await getAuthHeaders()
    })

    permissionRestricted.value = Boolean(response.folder?.is_restricted)
    permissionUsers.value = response.users || []

    const currentUser = permissionUsers.value.find((user) => user.id === adminUser.value?.id)
    if (currentUser && adminUser.value?.role !== 'owner') {
      currentUser.access_level = 'editor'
    }
  } catch (error) {
    modalError.value = getErrorMessage(error, 'Could not load folder access.')
  } finally {
    permissionsLoading.value = false
  }
}

const closePermissions = () => {
  if (savingModal.value) return
  permissionsOpen.value = false
  permissionFolder.value = null
  permissionUsers.value = []
  modalError.value = ''
}

const savePermissions = async () => {
  if (!permissionFolder.value) return

  savingModal.value = true
  modalError.value = ''

  try {
    await $fetch(`/api/admin-documents/folders/${permissionFolder.value.id}/permissions`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: {
        is_restricted: permissionRestricted.value,
        members: permissionUsers.value
          .filter((user) => user.role !== 'owner' && user.access_level !== 'none')
          .map((user) => ({
            admin_user_id: user.id,
            access_level: user.access_level
          }))
      }
    })

    permissionsOpen.value = false
    permissionFolder.value = null
    await loadDocuments()
  } catch (error) {
    modalError.value = getErrorMessage(error, 'Could not save folder access.')
  } finally {
    savingModal.value = false
  }
}

const uploadFiles = async (files) => {
  const selectedFiles = [...files]
  if (!selectedFiles.length || uploading.value) return

  uploading.value = true
  pageError.value = ''
  let uploadedCount = 0

  try {
    const headers = await getAuthHeaders()

    for (const [index, file] of selectedFiles.entries()) {
      uploadStatus.value = selectedFiles.length > 1
        ? `Uploading ${index + 1} of ${selectedFiles.length}...`
        : `Uploading ${file.name}...`
      const formData = new FormData()
      formData.append('folder_id', currentFolderId.value || '')
      formData.append('file', file)

      await $fetch('/api/admin-documents/files', {
        method: 'POST',
        headers,
        body: formData
      })
      uploadedCount += 1
    }
  } catch (error) {
    pageError.value = getErrorMessage(error, 'Could not upload the selected files.')
  } finally {
    if (uploadedCount) {
      await loadDocuments()
    }

    uploading.value = false
    uploadStatus.value = 'Uploading...'
    dragActive.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

const handleFileSelection = (event) => {
  uploadFiles(event.target.files || [])
}

const handleDrop = (event) => {
  dragActive.value = false
  uploadFiles(event.dataTransfer?.files || [])
}

const handleDragLeave = (event) => {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    dragActive.value = false
  }
}

const getDocumentBlob = async (item) => {
  const response = await fetch(`/api/admin-documents/files/${item.id}/download`, {
    headers: await getAuthHeaders()
  })

  if (!response.ok) {
    let message = 'Could not open the document.'
    try {
      const errorBody = await response.json()
      message = errorBody.statusMessage || errorBody.message || message
    } catch {
      // Keep the fallback for non-JSON errors.
    }
    throw new Error(message)
  }

  return await response.blob()
}

const viewDocument = async (item) => {
  pageError.value = ''

  if (!canPreviewDocument(item)) {
    await downloadDocument(item)
    return
  }

  const previewWindow = window.open('about:blank', '_blank')

  try {
    const blob = await getDocumentBlob(item)
    const objectUrl = URL.createObjectURL(blob)
    if (previewWindow) {
      previewWindow.opener = null
      previewWindow.location.href = objectUrl
    } else {
      throw new Error('Your browser blocked the document preview. Allow pop-ups and try again.')
    }
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  } catch (error) {
    previewWindow?.close()
    pageError.value = getErrorMessage(error, 'Could not open the document.')
  }
}

const downloadDocument = async (item) => {
  pageError.value = ''

  try {
    const blob = await getDocumentBlob(item)
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = item.name
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
  } catch (error) {
    pageError.value = getErrorMessage(error, 'Could not download the document.')
  }
}

const deleteItem = async (item) => {
  const itemLabel = item.type === 'folder' ? 'folder' : 'file'
  const confirmed = confirm(`Delete the ${itemLabel} “${item.name}”? This cannot be undone.`)
  if (!confirmed) return

  pageError.value = ''

  try {
    const endpoint = item.type === 'folder'
      ? `/api/admin-documents/folders/${item.id}`
      : `/api/admin-documents/files/${item.id}`

    await $fetch(endpoint, {
      method: 'DELETE',
      headers: await getAuthHeaders()
    })

    await loadDocuments()
  } catch (error) {
    pageError.value = getErrorMessage(error, `Could not delete the ${itemLabel}.`)
  }
}

const formatBytes = (value) => {
  const bytes = Number(value || 0)
  if (bytes < 1024) return `${bytes} B`

  const units = ['KB', 'MB', 'GB', 'TB']
  let unitIndex = -1
  let size = bytes

  do {
    size /= 1024
    unitIndex += 1
  } while (size >= 1024 && unitIndex < units.length - 1)

  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`
}

const formatDate = (value) => {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value))
}

const getFileType = (item) => {
  const extension = String(item.name || '').split('.').pop()
  return extension && extension !== item.name ? extension.toUpperCase() : 'File'
}

const canPreviewDocument = (item) => {
  const type = String(item.mime_type || '').toLowerCase()
  const extension = String(item.name || '').split('.').pop()?.toLowerCase()
  return extension !== 'svg' && (
    type === 'application/pdf'
    || type.startsWith('image/')
    || type.startsWith('text/')
    || ['application/json', 'application/xml'].includes(type)
  )
}

const getFileIcon = (item) => {
  const type = String(item.mime_type || '')
  const extension = String(item.name || '').split('.').pop()?.toLowerCase()
  if (type.includes('pdf') || extension === 'pdf') return 'lucide:file-text'
  if (type.startsWith('image/')) return 'lucide:file-image'
  if (['xls', 'xlsx', 'csv', 'ods'].includes(extension)) return 'lucide:sheet'
  if (['ppt', 'pptx'].includes(extension)) return 'lucide:presentation'
  if (['zip', 'rar', '7z'].includes(extension)) return 'lucide:file-archive'
  if (['doc', 'docx', 'odt', 'rtf'].includes(extension)) return 'lucide:file-type-2'
  return 'lucide:file'
}

const getFileColor = (item) => {
  const extension = String(item.name || '').split('.').pop()?.toLowerCase()
  if (extension === 'pdf') return 'bg-red-50 text-red-600'
  if (['xls', 'xlsx', 'csv', 'ods'].includes(extension)) return 'bg-emerald-50 text-emerald-600'
  if (['ppt', 'pptx'].includes(extension)) return 'bg-orange-50 text-orange-600'
  if (String(item.mime_type || '').startsWith('image/')) return 'bg-violet-50 text-violet-600'
  return 'bg-blue-50 text-blue-600'
}

const getFolderAccessLabel = (folder) => {
  if (!folder.is_restricted) return 'All document users'
  return folder.access_level === 'editor' ? 'Restricted · Can edit' : 'Restricted · View only'
}

const getInitials = (user) => {
  const name = String(user.full_name || user.email || 'A').trim()
  const words = name.split(/\s+/).filter(Boolean)
  return (words.length > 1 ? `${words[0][0]}${words.at(-1)[0]}` : name.slice(0, 2)).toUpperCase()
}

const closeOpenModal = () => {
  if (createFolderOpen.value) closeCreateFolder()
  else if (renameOpen.value) closeRename()
  else if (permissionsOpen.value) closePermissions()
}

const handleKeydown = (event) => {
  if (event.key === 'Escape') closeOpenModal()
}

watch(
  () => route.query.folder,
  () => loadDocuments()
)

watch(searchQuery, () => {
  window.clearTimeout(searchTimeoutId)
  searchTimeoutId = window.setTimeout(() => loadDocuments(), 300)
})

watch([createFolderOpen, renameOpen, permissionsOpen], ([createOpen, renameIsOpen, permissionsIsOpen]) => {
  if (!import.meta.client) return
  document.body.style.overflow = createOpen || renameIsOpen || permissionsIsOpen ? 'hidden' : ''
})

onMounted(() => {
  loadDocuments()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.clearTimeout(searchTimeoutId)
  window.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.icon-action {
  display: inline-flex;
  width: 2.25rem;
  height: 2.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  color: rgb(107 114 128);
}

.icon-action:hover {
  background: white;
  color: rgb(29 78 216);
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  overflow-y: auto;
  background: rgb(17 24 39 / 0.55);
  padding: 1rem;
}

.modal-panel {
  width: 100%;
  max-width: 36rem;
  border-radius: 1.5rem;
  background: white;
  padding: 1.5rem;
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
}

.modal-close {
  display: inline-flex;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.75rem;
  color: rgb(107 114 128);
}

.modal-close:hover {
  background: rgb(243 244 246);
  color: rgb(17 24 39);
}

.form-input {
  width: 100%;
  border: 1px solid rgb(209 213 219);
  border-radius: 0.75rem;
  padding: 0.75rem 0.875rem;
  outline: none;
}

.form-input:focus {
  border-color: rgb(59 130 246);
  box-shadow: 0 0 0 3px rgb(219 234 254);
}

.primary-button,
.secondary-button {
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  font-weight: 700;
}

.primary-button {
  background: rgb(37 99 235);
  color: white;
}

.primary-button:hover:not(:disabled) {
  background: rgb(29 78 216);
}

.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.secondary-button {
  background: rgb(243 244 246);
  color: rgb(55 65 81);
}

.secondary-button:hover {
  background: rgb(229 231 235);
}
</style>
