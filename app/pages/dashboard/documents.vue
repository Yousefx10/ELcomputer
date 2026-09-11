<template>
  <div class="file-workspace mx-auto max-w-6xl pb-6">
    <header class="file-hero flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
      <div class="flex items-center gap-4">
        <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-blue-200"><Icon name="lucide:folder-kanban" size="24" /></span>
        <div>
          <h2 class="text-3xl font-bold tracking-tight text-white">File manager</h2>
          <p class="mt-1.5 text-sm text-slate-300">Find, share, and manage company files.</p>
        </div>
      </div>
      <div v-if="access.can_edit" class="flex flex-wrap gap-2">
        <button type="button" class="file-button !border-white/15 !bg-white/10 !text-white hover:!bg-white/15" @click="openCreateFolder"><Icon name="lucide:folder-plus" size="17" /> New folder</button>
        <button type="button" class="file-button !border-blue-500 !bg-blue-600 !text-white hover:!bg-blue-500" :disabled="uploading" @click="fileInput?.click()"><Icon name="lucide:upload" size="17" /> {{ uploading ? 'Uploading…' : 'Upload files' }}</button>
      </div>
    </header>

    <DashboardFileWorkspaceOverview
      :quick-access="quickAccess"
      :recent-files="recentFiles"
      :loading="workspaceLoading"
      @activate="activateItem"
      @toggle-pin="toggleQuickAccess"
    />

    <div class="grid gap-3 sm:grid-cols-3" aria-label="Current folder summary">
      <div class="file-stat !border-gray-950 !bg-gray-950 text-white">
        <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-gray-300"><Icon name="lucide:hard-drive" size="21" /></span>
        <div><p class="text-xs text-gray-400">{{ searchQuery.trim() ? 'Matching file size' : 'Files in this folder' }}</p><p class="mt-1 text-2xl font-semibold tracking-tight">{{ loaded ? formatBytes(summary.size_bytes) : '—' }}</p></div>
      </div>
      <div v-for="metric in folderMetrics" :key="metric.key" class="file-stat">
        <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500"><Icon :name="metric.icon" size="21" /></span>
        <div><p class="file-label">{{ metric.label }}</p><p class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{{ loaded ? summary[metric.key] : '—' }}</p></div>
      </div>
    </div>

    <div v-if="pageError" role="alert" class="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
      <Icon name="lucide:circle-alert" size="18" class="shrink-0" /><p class="min-w-0 flex-1">{{ pageError }}</p>
      <button type="button" class="font-semibold" @click="refreshFileManager">Retry</button>
    </div>
    <p v-if="loaded && !access.can_edit" class="flex items-center gap-2 text-xs text-gray-500"><Icon name="lucide:eye" size="15" /> View-only access. Open or download available files.</p>

    <section class="file-surface" aria-label="Browse documents" :aria-busy="loading">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <nav class="flex min-w-0 flex-wrap items-center gap-1 text-sm" aria-label="Folder breadcrumb">
          <button type="button" class="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 font-semibold" :class="!currentFolderId ? 'text-gray-950' : 'text-gray-500 hover:bg-gray-100'" :aria-current="!currentFolderId ? 'location' : undefined" @click="goToFolder(null)"><Icon name="lucide:folder-open" size="17" /> All documents</button>
          <template v-for="crumb in breadcrumbs" :key="crumb.id">
            <Icon name="lucide:chevron-right" size="14" class="text-gray-300" />
            <button type="button" class="max-w-40 truncate rounded-lg px-2 py-1.5 font-semibold" :class="crumb.id === currentFolderId ? 'text-gray-950' : 'text-gray-500 hover:bg-gray-100'" :aria-current="crumb.id === currentFolderId ? 'location' : undefined" :title="crumb.name" @click="goToFolder(crumb.id)">{{ crumb.name }}</button>
          </template>
        </nav>
        <div class="flex items-center gap-2">
          <button v-if="currentFolder?.can_manage_access" type="button" class="file-button" @click="openPermissions(currentFolder)"><Icon name="lucide:users" size="15" /> Folder access</button>
          <DashboardFileViewToggle v-model="viewMode" />
        </div>
      </div>

      <div class="flex flex-wrap gap-3 border-b border-gray-100 px-5 py-4">
        <label class="relative min-w-0 flex-[1_1_220px]">
          <span class="sr-only">Search this folder</span><Icon name="lucide:search" size="17" class="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input v-model="searchQuery" type="search" placeholder="Search this folder…" class="file-search" />
        </label>
        <label class="file-button !py-0">
          <Icon name="lucide:arrow-down-wide-narrow" size="16" /><span class="sr-only">Sort documents</span>
          <select v-model="sortBy" class="min-h-10 max-w-40 bg-transparent text-xs outline-none"><option value="modified">Last modified</option><option value="name">Name, A–Z</option><option value="size">Largest first</option></select>
        </label>
        <button type="button" class="file-button" :disabled="loading" aria-label="Refresh documents" @click="refreshFileManager"><Icon name="lucide:refresh-cw" size="16" :class="{ 'motion-safe:animate-spin': loading }" /></button>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/50 px-5 py-2.5">
        <div class="flex gap-1" role="group" aria-label="File type">
          <button v-for="filter in itemFilters" :key="filter.key" type="button" class="file-chip" :aria-pressed="itemFilter === filter.key" @click="itemFilter = filter.key">{{ filter.label }} <span class="opacity-60">{{ filter.count }}</span></button>
        </div>
        <span v-if="searchQuery.trim()" class="file-label">Search results in this folder</span>
        <span v-else-if="currentFolder?.is_restricted" class="inline-flex items-center gap-1 text-xs text-gray-500"><Icon name="lucide:lock-keyhole" size="13" /> Restricted folder</span>
      </div>

      <div class="file-content" :class="{ 'has-selection': selectedItem }">
        <div class="min-w-0">
          <div v-if="loading" class="file-empty" role="status"><Icon name="lucide:loader-circle" size="26" class="motion-safe:animate-spin text-gray-400" /><p class="mt-2 text-sm text-gray-500">Loading documents…</p></div>
          <div v-else-if="!visibleItems.length" class="file-empty">
            <span class="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400"><Icon :name="pageError ? 'lucide:cloud-off' : 'lucide:folder-search'" size="27" /></span>
            <h3 class="text-sm font-semibold">{{ pageError ? 'Documents could not load' : searchQuery.trim() ? 'No matching files or folders' : 'Nothing here yet' }}</h3>
            <p class="text-sm text-gray-500">{{ pageError ? 'Try refreshing the folder.' : searchQuery.trim() ? 'Try another name.' : itemFilter === 'all' ? 'Files and folders will appear here.' : 'Try viewing all items.' }}</p>
            <button v-if="searchQuery || itemFilter !== 'all'" type="button" class="file-button mt-3" @click="searchQuery = ''; itemFilter = 'all'">Reset filters</button>
          </div>

          <div v-else-if="viewMode === 'grid'" class="space-y-6 p-5">
            <section v-if="visibleFolders.length" aria-label="Folders">
              <div class="mb-3 flex items-center gap-2"><h3 class="text-sm font-semibold">Folders</h3><span class="file-label">{{ visibleFolders.length }}</span></div>
              <div class="file-item-grid">
                <article v-for="item in visibleFolders" :key="item.id" class="file-card group" :class="{ '!border-gray-900 ring-1 ring-gray-900': selectedItemId === item.id }">
                  <button type="button" class="block w-full p-4 text-left" :aria-pressed="selectedItemId === item.id" :aria-label="`Details for ${item.name}`" @click="selectedItemId = item.id" @dblclick="activateItem(item)">
                    <div class="mb-4 flex items-start justify-between"><Icon name="lucide:folder" size="34" class="fill-amber-100 text-amber-400" /><Icon v-if="item.is_restricted" name="lucide:lock-keyhole" size="13" class="text-gray-400" /></div>
                    <p class="truncate text-sm font-semibold" :title="item.name">{{ item.name }}</p><p class="mt-1.5 truncate text-xs text-gray-500">{{ getFolderAccessLabel(item) }}</p>
                  </button>
                  <button type="button" class="flex w-full items-center justify-between border-t border-gray-100 px-4 py-2.5 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900" @click="activateItem(item)">Open folder <Icon name="lucide:arrow-up-right" size="14" /></button>
                </article>
              </div>
            </section>
            <section v-if="visibleFiles.length" aria-label="Files">
              <div class="mb-3 flex items-center gap-2"><h3 class="text-sm font-semibold">Files</h3><span class="file-label">{{ visibleFiles.length }}</span></div>
              <div class="file-item-grid">
                <button v-for="item in visibleFiles" :key="item.id" type="button" class="file-card group" :aria-pressed="selectedItemId === item.id" :aria-label="`Details for ${item.name}`" @click="selectedItemId = item.id" @dblclick="activateItem(item)">
                  <div class="file-thumbnail"><span class="flex h-20 w-16 items-center justify-center rounded-xl border border-white bg-white shadow-sm" :class="getFileColor(item)"><Icon :name="getFileIcon(item)" size="33" /></span></div>
                  <div class="border-t border-gray-100 p-3.5"><p class="truncate text-xs font-semibold" :title="item.name">{{ item.name }}</p><div class="mt-2 flex items-center justify-between gap-1 text-[11px] text-gray-500"><span>{{ formatBytes(item.size_bytes) }}</span><span class="rounded bg-gray-100 px-1.5 py-0.5">{{ getFileType(item) }}</span></div></div>
                </button>
              </div>
            </section>
          </div>

          <div v-else class="overflow-x-auto">
            <table class="file-table">
              <caption class="sr-only">Documents in this folder. Select a name to view details.</caption>
              <thead><tr><th scope="col">Name</th><th scope="col">Access / type</th><th scope="col">Size</th><th scope="col">Modified</th><th scope="col"><span class="sr-only">Open</span></th></tr></thead>
              <tbody>
                <tr v-for="item in visibleItems" :key="`${item.type}-${item.id}`" :aria-selected="selectedItemId === item.id">
                  <td><button type="button" class="flex w-full max-w-60 items-center gap-3 rounded text-left" :aria-label="`Details for ${item.name}`" @click="selectedItemId = item.id"><span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" :class="item.type === 'folder' ? 'bg-amber-50 text-amber-500' : getFileColor(item)"><Icon :name="item.type === 'folder' ? 'lucide:folder' : getFileIcon(item)" size="20" /></span><span class="truncate text-xs font-semibold" :title="item.name">{{ item.name }}</span></button></td>
                  <td class="whitespace-nowrap text-xs text-gray-500">{{ item.type === 'folder' ? getFolderAccessLabel(item) : getFileType(item) }}</td>
                  <td class="whitespace-nowrap text-xs tabular-nums text-gray-500">{{ item.type === 'file' ? formatBytes(item.size_bytes) : '—' }}</td>
                  <td class="whitespace-nowrap text-xs text-gray-500">{{ formatDate(item.updated_at) }}</td>
                  <td><button type="button" class="file-button !min-h-8 !p-2" :aria-label="`Open ${item.name}`" @click="activateItem(item)"><Icon name="lucide:arrow-up-right" size="15" /></button></td>
                </tr>
              </tbody>
            </table>
          </div>

          <button v-if="access.can_edit" type="button" class="m-5 flex w-[calc(100%-2.5rem)] flex-wrap items-center justify-center gap-3 rounded-xl border border-dashed p-5 transition disabled:cursor-wait" :class="dragActive ? 'border-gray-700 bg-gray-100' : 'border-gray-300 bg-gray-50/50 hover:bg-gray-100'" :disabled="uploading" @click="fileInput?.click()" @dragenter.prevent="dragActive = true" @dragover.prevent="dragActive = true" @dragleave.prevent="handleDragLeave" @drop.prevent="handleDrop">
            <Icon :name="uploading ? 'lucide:loader-circle' : 'lucide:cloud-upload'" size="22" class="text-gray-400" :class="{ 'motion-safe:animate-spin': uploading }" /><span class="text-xs font-medium text-gray-600" role="status">{{ uploading ? uploadStatus : 'Drop files here or browse' }}</span><span v-if="!uploading" class="text-xs text-gray-400">25 MB per file</span>
          </button>
        </div>

        <DashboardFileDetailsPanel v-if="selectedItem" :key="selectedItem.id" title="File details" @close="selectedItemId = ''">
          <div class="flex items-start gap-3">
            <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" :class="selectedItem.type === 'folder' ? 'bg-blue-600 text-white' : getFileColor(selectedItem)"><Icon :name="selectedItem.type === 'folder' ? 'lucide:folder' : getFileIcon(selectedItem)" size="24" /></span>
            <div class="min-w-0 flex-1"><h4 class="break-words text-sm font-bold">{{ selectedItem.name }}</h4><p class="mt-1 text-xs text-gray-500">{{ selectedItem.type === 'folder' ? 'Folder' : getFileType(selectedItem) + ' file' }}</p></div>
            <button type="button" class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white transition hover:border-blue-200 hover:text-blue-700" :class="selectedItem.is_pinned ? 'text-blue-700' : 'text-gray-400'" :aria-label="selectedItem.is_pinned ? 'Remove from quick access' : 'Add to quick access'" @click="toggleQuickAccess(selectedItem)"><Icon :name="selectedItem.is_pinned ? 'lucide:pin-off' : 'lucide:pin'" size="16" /></button>
          </div>

          <div class="mt-5 grid grid-cols-2 rounded-xl bg-gray-200/70 p-1" role="tablist" aria-label="Item details">
            <button v-for="tab in detailTabs" :key="tab.key" type="button" role="tab" class="rounded-lg px-3 py-2 text-xs font-bold transition" :class="detailsTab === tab.key ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500'" :aria-selected="detailsTab === tab.key" @click="detailsTab = tab.key"><Icon :name="tab.icon" size="14" class="me-1 inline" />{{ tab.label }}</button>
          </div>

          <div v-if="detailsTab === 'properties'" class="mt-5">
            <dl class="space-y-3 text-xs">
              <div v-if="selectedItem.type === 'file'" class="file-property"><dt>Size</dt><dd>{{ formatBytes(selectedItem.size_bytes) }}</dd></div>
              <div v-if="selectedItem.type === 'file'" class="file-property"><dt>Format</dt><dd>{{ getFileType(selectedItem) }}</dd></div>
              <div class="file-property"><dt>Owner</dt><dd>{{ selectedItem.created_by_name || 'Unknown admin' }}</dd></div>
              <div class="file-property"><dt>Created</dt><dd>{{ formatDate(selectedItem.created_at) }}</dd></div>
              <div class="file-property"><dt>Modified</dt><dd>{{ formatDate(selectedItem.updated_at) }}</dd></div>
              <div class="file-property"><dt>Location</dt><dd class="max-w-36 truncate" :title="selectedLocation">{{ selectedLocation }}</dd></div>
              <div class="file-property"><dt>Access</dt><dd>{{ selectedItem.can_edit ? 'Can edit' : 'View only' }}</dd></div>
            </dl>
          </div>

          <div v-else class="mt-5">
            <div v-if="activityLoading" class="flex min-h-40 items-center justify-center"><Icon name="lucide:loader-circle" size="22" class="animate-spin text-gray-400" /></div>
            <div v-else-if="itemActivity.length" class="relative space-y-5 before:absolute before:bottom-2 before:start-[7px] before:top-2 before:w-px before:bg-gray-200">
              <article v-for="activity in itemActivity" :key="activity.id" class="relative flex gap-3">
                <span class="relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-4 border-white bg-blue-600 ring-1 ring-blue-100" />
                <div class="min-w-0"><p class="text-xs font-semibold leading-5 text-gray-800">{{ activity.description }}</p><p class="mt-1 text-[11px] text-gray-500">{{ activity.author }} · {{ formatDateTime(activity.createdAt) }}</p></div>
              </article>
            </div>
            <div v-else class="flex min-h-40 items-center justify-center text-center"><div><Icon name="lucide:history" size="22" class="mx-auto text-gray-300" /><p class="mt-2 text-xs text-gray-500">No changes recorded yet.</p></div></div>
          </div>

          <div class="mt-5 flex flex-col gap-2 border-t border-gray-200 pt-5">
            <button type="button" class="file-button file-button-primary" @click="activateItem(selectedItem)"><Icon :name="selectedItem.type === 'folder' ? 'lucide:folder-open' : 'lucide:eye'" size="16" />{{ selectedItem.type === 'folder' ? 'Open folder' : canPreviewDocument(selectedItem) ? 'Preview file' : 'Download file' }}</button>
            <button v-if="selectedItem.type === 'file' && canPreviewDocument(selectedItem)" type="button" class="file-button" @click="downloadDocument(selectedItem)"><Icon name="lucide:download" size="16" /> Download</button>
            <button v-if="selectedItem.type === 'folder' && selectedItem.can_manage_access" type="button" class="file-button" @click="openPermissions(selectedItem)"><Icon name="lucide:users" size="16" /> Manage access</button>
            <button v-if="selectedItem.can_edit" type="button" class="file-button" @click="openRename(selectedItem)"><Icon name="lucide:pencil" size="15" /> Rename</button>
            <button v-if="selectedItem.can_edit" type="button" class="file-button !border-transparent !bg-transparent !text-red-600 hover:!bg-red-50" @click="deleteItem(selectedItem)"><Icon name="lucide:trash-2" size="15" /> Delete {{ selectedItem.type }}</button>
          </div>
        </DashboardFileDetailsPanel>
      </div>
      <footer class="flex flex-wrap justify-between gap-2 border-t border-gray-100 px-5 py-3.5 text-xs text-gray-500"><span>{{ visibleItems.length }} items{{ searchQuery.trim() ? ' matching your search' : ' in this folder' }}</span><span>Select an item for details</span></footer>
    </section>

    <input ref="fileInput" type="file" class="hidden" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.text,.rtf,.csv,.json,.xml,.md,.odt,.ods,.jpg,.jpeg,.png,.webp,.gif,.avif,.svg,.bmp,.tif,.tiff,.heic,.zip,.rar,.7z" @change="handleFileSelection" >

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
const quickAccess = ref([])
const recentFiles = ref([])
const workspaceLoading = ref(true)
const summary = reactive({ folders: 0, files: 0, size_bytes: 0 })
const access = reactive({ level: 'viewer', can_edit: false })
const loading = ref(true)
const loaded = ref(false)
const pageError = ref('')
const searchQuery = ref('')
const viewMode = ref('grid')
const selectedItemId = ref('')
const itemFilter = ref('all')
const sortBy = ref('modified')
const detailsTab = ref('properties')
const itemActivity = ref([])
const activityLoading = ref(false)
const detailTabs = [
  { key: 'properties', label: 'Properties', icon: 'lucide:info' },
  { key: 'activity', label: 'Activity', icon: 'lucide:history' }
]
const folderMetrics = [
  { key: 'folders', label: 'Folders', icon: 'lucide:folders' },
  { key: 'files', label: 'Documents', icon: 'lucide:files' }
]
const pinnedItemKeys = computed(() => new Set(
  quickAccess.value.map((item) => `${item.type}:${item.id}`)
))
const selectedItem = computed(() => {
  const item = items.value.find((entry) => entry.id === selectedItemId.value)
  return item ? { ...item, is_pinned: pinnedItemKeys.value.has(`${item.type}:${item.id}`) } : null
})
const selectedLocation = computed(() => {
  return breadcrumbs.value.map((folder) => folder.name).join(' / ') || 'All documents'
})
const itemFilters = computed(() => [
  { key: 'all', label: 'All items', count: items.value.length },
  { key: 'folder', label: 'Folders', count: summary.folders },
  { key: 'file', label: 'Files', count: summary.files }
])
const visibleItems = computed(() => {
  return items.value.filter((item) => itemFilter.value === 'all' || item.type === itemFilter.value).sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    if (sortBy.value === 'name') return a.name.localeCompare(b.name, undefined, { numeric: true })
    if (sortBy.value === 'size') return Number(b.size_bytes || 0) - Number(a.size_bytes || 0)
    return new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
  })
})
const visibleFolders = computed(() => visibleItems.value.filter((item) => item.type === 'folder'))
const visibleFiles = computed(() => visibleItems.value.filter((item) => item.type === 'file'))
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

const loadWorkspace = async () => {
  workspaceLoading.value = true

  try {
    const response = await $fetch('/api/admin-documents/workspace', {
      headers: await getAuthHeaders()
    })
    quickAccess.value = response.quickAccess || []
    recentFiles.value = response.recentFiles || []
  } catch (error) {
    pageError.value = getErrorMessage(error, 'Could not load file shortcuts.')
  } finally {
    workspaceLoading.value = false
  }
}

const refreshFileManager = async () => {
  await Promise.all([loadDocuments(), loadWorkspace()])
}

const toggleQuickAccess = async (item) => {
  const wasPinned = pinnedItemKeys.value.has(`${item.type}:${item.id}`)
  pageError.value = ''

  try {
    await $fetch('/api/admin-documents/quick-access', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: {
        type: item.type,
        id: item.id,
        pinned: !wasPinned
      }
    })
    await loadWorkspace()
  } catch (error) {
    pageError.value = getErrorMessage(error, 'Could not update quick access.')
  }
}

const loadItemActivity = async () => {
  if (!selectedItem.value || detailsTab.value !== 'activity') return

  activityLoading.value = true
  itemActivity.value = []

  try {
    const response = await $fetch('/api/admin-documents/activity', {
      headers: await getAuthHeaders(),
      query: {
        type: selectedItem.value.type,
        id: selectedItem.value.id
      }
    })
    itemActivity.value = response.items || []
  } catch (error) {
    pageError.value = getErrorMessage(error, 'Could not load item activity.')
  } finally {
    activityLoading.value = false
  }
}

const goToFolder = async (folderId) => {
  searchQuery.value = ''
  selectedItemId.value = ''
  itemFilter.value = 'all'
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
    await loadWorkspace()
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
    await loadWorkspace()
  } catch (error) {
    modalError.value = getErrorMessage(error, 'Could not save folder access.')
  } finally {
    savingModal.value = false
  }
}

const uploadFiles = async (files) => {
  if (!access.can_edit) return
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
    await loadWorkspace()
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
    await loadWorkspace()
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
    await loadWorkspace()
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

const formatDateTime = (value) => {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
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
  if (!folder.is_restricted) return 'Shared with admins'
  return 'Restricted access'
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

watch(selectedItemId, () => {
  detailsTab.value = 'properties'
  itemActivity.value = []
})

watch(detailsTab, () => loadItemActivity())

watch([createFolderOpen, renameOpen, permissionsOpen], ([createOpen, renameIsOpen, permissionsIsOpen]) => {
  if (!import.meta.client) return
  document.body.style.overflow = createOpen || renameIsOpen || permissionsIsOpen ? 'hidden' : ''
})

onMounted(() => {
  refreshFileManager()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.clearTimeout(searchTimeoutId)
  window.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
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
  border-color: rgb(107 114 128);
  box-shadow: 0 0 0 3px rgb(243 244 246);
}

.primary-button,
.secondary-button {
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  font-weight: 700;
}

.primary-button {
  background: rgb(3 7 18);
  color: white;
}

.primary-button:hover:not(:disabled) {
  background: rgb(31 41 55);
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
