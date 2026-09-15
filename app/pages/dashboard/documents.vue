<template>
  <div class="file-workspace documents-workspace pb-6">
    <section class="documents-shell">
      <header class="documents-topbar">
        <div class="flex min-w-0 items-center gap-3">
          <button
            type="button"
            class="documents-panel-toggle"
            :aria-label="navigationOpen ? 'Hide file views' : 'Show file views'"
            aria-controls="documents-file-views"
            :aria-expanded="navigationOpen"
            @click="navigationOpen = !navigationOpen"
          >
            <Icon :name="navigationOpen ? 'lucide:panel-left-close' : 'lucide:panel-left-open'" size="18" />
          </button>
          <span class="documents-logo"><Icon name="lucide:folder-kanban" size="22" /></span>
          <div class="min-w-0"><h2 class="truncate text-lg font-bold">Documents</h2><p class="text-xs text-gray-500">Company files in one place.</p></div>
        </div>
        <nav class="documents-topnav" aria-label="Document sections">
          <button type="button" :aria-current="topView === 'files' ? 'page' : undefined" @click="setTopView('files')"><Icon name="lucide:folder" size="16" /> Files</button>
          <button type="button" :aria-current="topView === 'activity' ? 'page' : undefined" @click="setTopView('activity')"><Icon name="lucide:activity" size="16" /> Activity</button>
        </nav>
        <div class="flex min-w-0 items-center gap-2">
          <label class="relative hidden min-w-0 sm:block">
            <span class="sr-only">Search documents</span><Icon name="lucide:search" size="16" class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input v-model="searchQuery" type="search" placeholder="Search files..." class="file-search w-48 lg:w-64" />
          </label>
          <button v-if="access.can_edit" type="button" class="file-button file-button-primary" :disabled="uploading" @click="fileInput?.click()"><Icon name="lucide:plus" size="17" /> Add new</button>
        </div>
      </header>

      <div v-if="pageError" role="alert" class="mx-4 mt-4 flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
        <Icon name="lucide:circle-alert" size="17" /><p class="min-w-0 flex-1">{{ pageError }}</p><button type="button" class="font-semibold" @click="refreshFileManager">Retry</button>
      </div>

      <div
        class="documents-layout"
        :class="{
          'has-navigation': navigationOpen,
          'has-details': detailsOpen && selectedItem
        }"
      >
        <aside v-if="navigationOpen" id="documents-file-views" class="documents-sidebar">
          <nav class="space-y-1" aria-label="File views">
            <button v-for="entry in workspaceViews" :key="entry.key" type="button" class="documents-side-link" :aria-current="topView === 'files' && workspaceView === entry.key ? 'page' : undefined" @click="selectWorkspaceView(entry.key)"><Icon :name="entry.icon" size="17" /> <span>{{ entry.label }}</span><span v-if="entry.count !== null" class="ms-auto text-[11px] text-gray-400">{{ entry.count }}</span></button>
          </nav>
          <div v-if="tags.length" class="mt-7 hidden lg:block">
            <p class="px-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Tags</p>
            <button v-for="tag in tags.slice(0, 6)" :key="tag.id" type="button" class="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-gray-600 hover:bg-gray-100" @click="openTag(tag)"><span class="h-2.5 w-2.5 rounded-full" :class="tagDotClass(tag.color)" /> <span class="truncate">{{ tag.name }}</span></button>
          </div>
          <div class="mt-auto hidden rounded-xl border border-gray-200 p-3 lg:block"><div class="flex items-center justify-between text-xs"><span class="text-gray-500">Current folder</span><strong>{{ summary.files + summary.folders }}</strong></div><div class="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"><span class="block h-full w-2/3 rounded-full bg-blue-600" /></div><p class="mt-2 text-[11px] text-gray-400">{{ formatBytes(summary.size_bytes) }} in files</p></div>
        </aside>

        <main class="min-w-0 bg-white">
          <template v-if="topView === 'files'">
            <section v-if="workspaceView === 'all' && !currentFolderId" class="documents-quick-access">
              <div class="mb-3 flex items-center justify-between"><h3 class="text-sm font-bold">Quick access</h3><button type="button" class="text-xs text-gray-400 hover:text-gray-900" @click="selectWorkspaceView('favorites')">View all</button></div>
              <div v-if="workspaceLoading" class="grid grid-cols-2 gap-3 xl:grid-cols-4"><div v-for="index in 4" :key="index" class="h-24 animate-pulse rounded-xl bg-gray-100" /></div>
              <div v-else-if="quickAccess.length" class="documents-quick-grid">
                <article v-for="item in quickAccess.slice(0, 4)" :key="`${item.type}-${item.id}`" class="documents-quick-card relative">
                  <button type="button" class="block w-full text-left" @click="selectItem(item)" @dblclick="activateItem(item)"><Icon :name="item.type === 'folder' ? 'lucide:folder' : getFileIcon(item)" size="25" :class="item.type === 'folder' ? 'fill-blue-100 text-blue-600' : getFileColor(item)" /><p class="mt-3 truncate pe-8 text-xs font-bold">{{ item.name }}</p><p class="mt-1 truncate text-[11px] text-gray-500">{{ item.type === 'file' ? formatBytes(item.size_bytes) : 'Folder' }}</p></button>
                  <button type="button" class="absolute end-2.5 top-2.5 rounded-lg p-2 text-gray-400 transition hover:bg-blue-50 hover:text-blue-700" :aria-label="`Show information for ${item.name}`" @click.stop="openDetails(item)"><Icon name="lucide:info" size="16" /></button>
                </article>
              </div>
              <button v-else type="button" class="flex min-h-24 w-full items-center justify-center rounded-xl border border-dashed text-xs text-gray-500" @click="selectWorkspaceView('favorites')">Add favorites for quick access.</button>
            </section>

            <section v-if="workspaceView === 'tags' && !activeTag" class="p-5 lg:p-6">
              <div class="mb-5 flex items-center justify-between gap-3"><div><h3 class="text-base font-bold">Tags</h3><p class="mt-1 text-xs text-gray-500">Group related files and folders.</p></div><button v-if="access.can_edit" type="button" class="file-button" @click="showTagCreator = !showTagCreator"><Icon name="lucide:plus" size="15" /> New tag</button></div>
              <form v-if="showTagCreator" class="mb-5 flex flex-wrap gap-2 rounded-xl bg-gray-50 p-3" @submit.prevent="createTag"><input v-model="newTagName" maxlength="32" required class="form-input min-w-44 flex-1 !py-2" placeholder="Tag name"><select v-model="newTagColor" class="rounded-xl border border-gray-200 bg-white px-3 text-xs"><option v-for="color in tagColors" :key="color" :value="color">{{ color }}</option></select><button class="file-button file-button-primary" :disabled="savingTag">Create</button></form>
              <div v-if="tagsLoading" class="file-empty"><Icon name="lucide:loader-circle" size="24" class="animate-spin text-gray-400" /></div>
              <div v-else-if="tags.length" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><button v-for="tag in tags" :key="tag.id" type="button" class="rounded-xl border border-gray-200 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/30" @click="openTag(tag)"><span class="flex h-9 w-9 items-center justify-center rounded-lg" :class="tagSoftClass(tag.color)"><Icon name="lucide:tag" size="17" /></span><p class="mt-3 truncate text-sm font-bold">{{ tag.name }}</p><p class="mt-1 text-xs text-gray-500">Open tagged items</p></button></div>
              <div v-else class="file-empty"><Icon name="lucide:tags" size="28" class="text-gray-300" /><h3 class="text-sm font-semibold">No tags yet</h3><p class="text-xs text-gray-500">Create a tag to get started.</p></div>
            </section>

            <section v-else class="documents-files">
              <div class="documents-files-head">
                <div class="min-w-0"><nav v-if="workspaceView === 'all'" class="flex min-w-0 items-center gap-1 text-sm" aria-label="Folder breadcrumb"><button type="button" class="rounded-lg px-1.5 py-1 font-semibold" @click="goToFolder(null)">Home</button><template v-for="crumb in breadcrumbs" :key="crumb.id"><Icon name="lucide:chevron-right" size="13" class="text-gray-300" /><button type="button" class="max-w-36 truncate rounded-lg px-1.5 py-1 font-semibold text-gray-500 hover:bg-gray-100" @click="goToFolder(crumb.id)">{{ crumb.name }}</button></template></nav><div v-else class="flex items-center gap-2"><button v-if="activeTag" type="button" class="text-gray-400 hover:text-gray-900" aria-label="Back to tags" @click="activeTag = null; taggedItems = []"><Icon name="lucide:arrow-left" size="17" /></button><h3 class="text-sm font-bold">{{ sectionTitle }}</h3></div></div>
                <div class="flex items-center gap-2"><button v-if="workspaceView === 'all' && currentFolder?.can_manage_access" type="button" class="file-button" @click="openPermissions(currentFolder)"><Icon name="lucide:users" size="15" /> Access</button><button v-if="workspaceView === 'all' && access.can_edit" type="button" class="file-button" @click="openCreateFolder"><Icon name="lucide:folder-plus" size="15" /> New folder</button><label class="file-button !py-0"><Icon name="lucide:arrow-down-wide-narrow" size="15" /><select v-model="sortBy" class="min-h-9 max-w-28 bg-transparent text-xs outline-none"><option value="modified">Modified</option><option value="name">Name</option><option value="size">Size</option></select></label><button type="button" class="file-button !p-2.5" :disabled="loading" aria-label="Refresh" @click="refreshFileManager"><Icon name="lucide:refresh-cw" size="15" :class="{ 'animate-spin': loading }" /></button></div>
              </div>
              <label class="relative mx-5 mt-4 block sm:hidden"><span class="sr-only">Search documents</span><Icon name="lucide:search" size="16" class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" /><input v-model="searchQuery" type="search" placeholder="Search files..." class="file-search" /></label>
              <div v-if="loading || taggedLoading" class="file-empty"><Icon name="lucide:loader-circle" size="25" class="animate-spin text-gray-400" /><p class="text-xs text-gray-500">Loading files...</p></div>
              <div v-else-if="!visibleItems.length" class="file-empty"><span class="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-400"><Icon name="lucide:folder-search" size="24" /></span><h3 class="text-sm font-semibold">Nothing to show</h3><p class="text-xs text-gray-500">Try another view or search.</p></div>
              <div v-else class="overflow-x-auto">
                <table class="file-table"><caption class="sr-only">Document list</caption><thead><tr><th>Name</th><th>Tags</th><th>Size</th><th>Modified</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody><tr v-for="item in visibleItems" :key="`${item.type}-${item.id}`" :aria-selected="selectedItemKey === `${item.type}:${item.id}`"><td><button type="button" class="flex w-full max-w-72 items-center gap-3 text-left" @click="selectItem(item)" @dblclick="activateItem(item)"><span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" :class="item.type === 'folder' ? 'bg-blue-50 text-blue-600' : getFileColor(item)"><Icon :name="item.type === 'folder' ? 'lucide:folder' : getFileIcon(item)" size="19" /></span><span class="min-w-0"><span class="block truncate text-xs font-semibold">{{ item.name }}</span><span class="mt-0.5 block truncate text-[11px] text-gray-400">{{ item.location || (item.type === 'folder' ? getFolderAccessLabel(item) : getFileType(item)) }}</span></span></button></td><td><div class="flex max-w-40 flex-wrap gap-1"><span v-for="tag in (item.tags || []).slice(0, 2)" :key="tag.id" class="rounded px-1.5 py-1 text-[10px] font-semibold" :class="tagSoftClass(tag.color)">{{ tag.name }}</span><span v-if="(item.tags || []).length > 2" class="text-[10px] text-gray-400">+{{ item.tags.length - 2 }}</span><span v-if="!(item.tags || []).length" class="text-xs text-gray-300">—</span></div></td><td class="whitespace-nowrap text-xs text-gray-500">{{ item.type === 'file' ? formatBytes(item.size_bytes) : '—' }}</td><td class="whitespace-nowrap text-xs text-gray-500">{{ formatDate(item.updated_at || item.last_opened_at) }}</td><td><div class="flex items-center justify-end gap-1"><button type="button" class="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-700" :aria-label="`Show information for ${item.name}`" @click.stop="openDetails(item)"><Icon name="lucide:info" size="16" /></button><button type="button" class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900" :aria-label="`Open ${item.name}`" @click="activateItem(item)"><Icon name="lucide:arrow-up-right" size="15" /></button></div></td></tr></tbody></table>
              </div>
              <button v-if="workspaceView === 'all' && access.can_edit" type="button" class="documents-dropzone" :class="{ '!border-blue-500 !bg-blue-50': dragActive }" :disabled="uploading" @click="fileInput?.click()" @dragenter.prevent="dragActive = true" @dragover.prevent="dragActive = true" @dragleave.prevent="handleDragLeave" @drop.prevent="handleDrop"><Icon :name="uploading ? 'lucide:loader-circle' : 'lucide:cloud-upload'" size="19" :class="{ 'animate-spin': uploading }" /> {{ uploading ? uploadStatus : 'Drop files here or browse' }}</button>
            </section>
          </template>

          <section v-else class="p-5 lg:p-6">
            <div class="mb-6"><h3 class="text-base font-bold">Activity</h3><p class="mt-1 text-xs text-gray-500">Recent document changes.</p></div>
            <div v-if="globalActivityLoading" class="file-empty"><Icon name="lucide:loader-circle" size="25" class="animate-spin text-gray-400" /></div>
            <div v-else-if="globalActivity.length" class="relative max-w-2xl space-y-6 before:absolute before:bottom-2 before:start-[7px] before:top-2 before:w-px before:bg-gray-200"><article v-for="activity in globalActivity" :key="activity.id" class="relative flex gap-4"><span class="relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-4 border-white bg-blue-600 ring-1 ring-blue-100" /><div><p class="text-sm font-semibold text-gray-800">{{ activity.description }}</p><p class="mt-1 text-xs text-gray-500">{{ activity.author }} · {{ formatDateTime(activity.createdAt) }}</p></div></article></div>
            <div v-else class="file-empty"><Icon name="lucide:activity" size="27" class="text-gray-300" /><p class="text-sm text-gray-500">No activity yet.</p></div>
          </section>
        </main>

        <aside v-if="detailsOpen && selectedItem" class="documents-details" aria-label="File or folder information">
          <template v-if="selectedItem">
            <div class="flex items-start gap-3"><span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" :class="selectedItem.type === 'folder' ? 'bg-blue-600 text-white' : getFileColor(selectedItem)"><Icon :name="selectedItem.type === 'folder' ? 'lucide:folder' : getFileIcon(selectedItem)" size="21" /></span><div class="min-w-0 flex-1"><h4 class="break-words text-sm font-bold">{{ selectedItem.name }}</h4><p class="mt-1 text-xs text-gray-500">{{ selectedItem.type === 'folder' ? 'Folder' : `${getFileType(selectedItem)} · ${formatBytes(selectedItem.size_bytes)}` }}</p></div><button type="button" class="rounded-lg p-2 text-gray-400 hover:bg-gray-100" aria-label="Close details" @click="closeDetails"><Icon name="lucide:x" size="17" /></button></div>
            <div class="mt-5 flex items-center justify-between border-y border-gray-100 py-3"><span class="text-xs font-semibold text-gray-500">Favorite</span><button type="button" class="rounded-lg p-2" :class="selectedItem.is_pinned ? 'bg-rose-50 text-rose-600' : 'text-gray-400 hover:bg-gray-100'" :aria-label="selectedItem.is_pinned ? 'Remove favorite' : 'Add favorite'" @click="toggleQuickAccess(selectedItem)"><Icon :name="selectedItem.is_pinned ? 'lucide:heart-off' : 'lucide:heart'" size="17" /></button></div>
            <div class="mt-5"><div class="flex items-center justify-between"><p class="text-xs font-bold text-gray-500">Tags</p><button v-if="selectedItem.can_edit" type="button" class="text-xs font-semibold text-blue-600" @click="beginTagEdit">{{ editingTags ? 'Cancel' : 'Edit' }}</button></div><div v-if="!editingTags" class="mt-2 flex flex-wrap gap-1.5"><span v-for="tag in selectedItem.tags || []" :key="tag.id" class="rounded-md px-2 py-1 text-[11px] font-semibold" :class="tagSoftClass(tag.color)">{{ tag.name }}</span><span v-if="!(selectedItem.tags || []).length" class="text-xs text-gray-400">No tags</span></div><form v-else class="mt-3 rounded-xl bg-gray-50 p-3" @submit.prevent="saveItemTags"><label v-for="tag in tags" :key="tag.id" class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-white"><input v-model="selectedTagIds" type="checkbox" :value="tag.id"><span class="h-2.5 w-2.5 rounded-full" :class="tagDotClass(tag.color)" />{{ tag.name }}</label><p v-if="!tags.length" class="text-xs text-gray-400">Create a tag first.</p><button class="file-button file-button-primary mt-3 w-full" :disabled="savingItemTags">{{ savingItemTags ? 'Saving...' : 'Save tags' }}</button></form></div>
            <div class="mt-5 grid grid-cols-2 rounded-xl bg-gray-100 p-1" role="tablist"><button v-for="tab in detailTabs" :key="tab.key" type="button" role="tab" class="rounded-lg px-2 py-2 text-xs font-bold" :class="detailsTab === tab.key ? 'bg-white shadow-sm' : 'text-gray-500'" @click="detailsTab = tab.key">{{ tab.label }}</button></div>
            <dl v-if="detailsTab === 'properties'" class="mt-5 space-y-3 text-xs"><div class="file-property"><dt>Owner</dt><dd>{{ selectedItem.created_by_name || 'Unknown admin' }}</dd></div><div class="file-property"><dt>Created</dt><dd>{{ formatDate(selectedItem.created_at) }}</dd></div><div class="file-property"><dt>Modified</dt><dd>{{ formatDate(selectedItem.updated_at) }}</dd></div><div class="file-property"><dt>Location</dt><dd class="max-w-32 truncate" :title="selectedLocation">{{ selectedLocation }}</dd></div><div class="file-property"><dt>Access</dt><dd>{{ selectedItem.can_edit ? 'Can edit' : 'View only' }}</dd></div></dl>
            <div v-else class="mt-5"><div v-if="activityLoading" class="grid min-h-32 place-items-center"><Icon name="lucide:loader-circle" size="20" class="animate-spin text-gray-400" /></div><div v-else-if="itemActivity.length" class="space-y-4"><article v-for="activity in itemActivity" :key="activity.id"><p class="text-xs font-semibold leading-5">{{ activity.description }}</p><p class="mt-1 text-[11px] text-gray-400">{{ activity.author }} · {{ formatDateTime(activity.createdAt) }}</p></article></div><p v-else class="py-10 text-center text-xs text-gray-400">No activity yet.</p></div>
            <div class="mt-5 flex flex-col gap-2 border-t border-gray-100 pt-5"><button type="button" class="file-button file-button-primary" @click="activateItem(selectedItem)"><Icon :name="selectedItem.type === 'folder' ? 'lucide:folder-open' : 'lucide:eye'" size="15" /> {{ selectedItem.type === 'folder' ? 'Open folder' : canPreviewDocument(selectedItem) ? 'Preview file' : 'Download file' }}</button><button v-if="selectedItem.type === 'file' && canPreviewDocument(selectedItem)" type="button" class="file-button" @click="downloadDocument(selectedItem)"><Icon name="lucide:download" size="15" /> Download</button><button v-if="selectedItem.type === 'folder' && selectedItem.can_manage_access" type="button" class="file-button" @click="openPermissions(selectedItem)"><Icon name="lucide:users" size="15" /> Manage access</button><button v-if="selectedItem.can_edit" type="button" class="file-button" @click="openRename(selectedItem)"><Icon name="lucide:pencil" size="15" /> Rename</button><button v-if="selectedItem.can_edit" type="button" class="file-button !border-transparent !text-red-600" @click="deleteItem(selectedItem)"><Icon name="lucide:trash-2" size="15" /> Delete</button></div>
          </template>
        </aside>
      </div>
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
const topView = ref('files')
const workspaceView = ref('all')
const selectedItemKey = ref('')
const navigationOpen = ref(false)
const detailsOpen = ref(false)
const tags = ref([])
const tagsLoading = ref(true)
const activeTag = ref(null)
const taggedItems = ref([])
const taggedLoading = ref(false)
const showTagCreator = ref(false)
const newTagName = ref('')
const newTagColor = ref('blue')
const savingTag = ref(false)
const editingTags = ref(false)
const selectedTagIds = ref([])
const savingItemTags = ref(false)
const globalActivity = ref([])
const globalActivityLoading = ref(false)
const tagColors = ['blue', 'violet', 'emerald', 'amber', 'rose', 'slate']
const summary = reactive({ folders: 0, files: 0, size_bytes: 0 })
const access = reactive({ level: 'viewer', can_edit: false })
const loading = ref(true)
const pageError = ref('')
const searchQuery = ref('')
const sortBy = ref('modified')
const detailsTab = ref('properties')
const itemActivity = ref([])
const activityLoading = ref(false)
const detailTabs = [
  { key: 'properties', label: 'Properties', icon: 'lucide:info' },
  { key: 'activity', label: 'Activity', icon: 'lucide:history' }
]
const pinnedItemKeys = computed(() => new Set(
  quickAccess.value.map((item) => `${item.type}:${item.id}`)
))
const workspaceViews = computed(() => [
  { key: 'all', label: 'All files', icon: 'lucide:folder', count: summary.files + summary.folders },
  { key: 'recent', label: 'Recent', icon: 'lucide:clock-3', count: recentFiles.value.length },
  { key: 'favorites', label: 'Favorites', icon: 'lucide:heart', count: quickAccess.value.length },
  { key: 'tags', label: 'Tags', icon: 'lucide:tag', count: tags.value.length }
])
const sourceItems = computed(() => {
  if (workspaceView.value === 'recent') return recentFiles.value
  if (workspaceView.value === 'favorites') return quickAccess.value
  if (workspaceView.value === 'tags') return taggedItems.value
  return items.value
})
const selectableItems = computed(() => {
  const entries = [...items.value, ...quickAccess.value, ...recentFiles.value, ...taggedItems.value]
  return [...new Map(entries.map((item) => [`${item.type}:${item.id}`, item])).values()]
})
const selectedItem = computed(() => {
  const item = selectableItems.value.find((entry) => `${entry.type}:${entry.id}` === selectedItemKey.value)
  return item ? { ...item, is_pinned: pinnedItemKeys.value.has(`${item.type}:${item.id}`) } : null
})
const selectedLocation = computed(() => {
  return selectedItem.value?.location || breadcrumbs.value.map((folder) => folder.name).join(' / ') || 'All documents'
})
const sectionTitle = computed(() => {
  if (activeTag.value) return activeTag.value.name
  if (workspaceView.value === 'recent') return 'Recent files'
  if (workspaceView.value === 'favorites') return 'Favorites'
  return 'All files'
})
const visibleItems = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  return sourceItems.value.filter((item) => !query || item.name.toLocaleLowerCase().includes(query)).sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    if (sortBy.value === 'name') return a.name.localeCompare(b.name, undefined, { numeric: true })
    if (sortBy.value === 'size') return Number(b.size_bytes || 0) - Number(a.size_bytes || 0)
    return new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
  })
})
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

const loadTags = async () => {
  tagsLoading.value = true
  try {
    const response = await $fetch('/api/admin-documents/tags', { headers: await getAuthHeaders() })
    tags.value = response.items || []
  } catch (error) {
    pageError.value = getErrorMessage(error, 'Could not load tags.')
  } finally {
    tagsLoading.value = false
  }
}

const loadGlobalActivity = async () => {
  globalActivityLoading.value = true
  try {
    const response = await $fetch('/api/admin-documents/activity', { headers: await getAuthHeaders() })
    globalActivity.value = response.items || []
  } catch (error) {
    pageError.value = getErrorMessage(error, 'Could not load activity.')
  } finally {
    globalActivityLoading.value = false
  }
}

const setTopView = (view) => {
  topView.value = view
  selectedItemKey.value = ''
  detailsOpen.value = false
  if (view === 'activity') loadGlobalActivity()
}

const selectWorkspaceView = (view) => {
  topView.value = 'files'
  workspaceView.value = view
  selectedItemKey.value = ''
  detailsOpen.value = false
  activeTag.value = null
  taggedItems.value = []
  searchQuery.value = ''
}

const openTag = async (tag) => {
  topView.value = 'files'
  workspaceView.value = 'tags'
  activeTag.value = tag
  taggedLoading.value = true
  selectedItemKey.value = ''
  detailsOpen.value = false
  try {
    const response = await $fetch('/api/admin-documents/tagged', {
      headers: await getAuthHeaders(),
      query: { tagId: tag.id }
    })
    taggedItems.value = response.items || []
  } catch (error) {
    pageError.value = getErrorMessage(error, 'Could not load tagged items.')
  } finally {
    taggedLoading.value = false
  }
}

const createTag = async () => {
  savingTag.value = true
  pageError.value = ''
  try {
    await $fetch('/api/admin-documents/tags', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: { name: newTagName.value, color: newTagColor.value }
    })
    newTagName.value = ''
    showTagCreator.value = false
    await loadTags()
  } catch (error) {
    pageError.value = getErrorMessage(error, 'Could not create the tag.')
  } finally {
    savingTag.value = false
  }
}

const beginTagEdit = () => {
  if (editingTags.value) {
    editingTags.value = false
    return
  }
  selectedTagIds.value = (selectedItem.value?.tags || []).map((tag) => tag.id)
  editingTags.value = true
}

const saveItemTags = async () => {
  if (!selectedItem.value) return
  const item = selectedItem.value
  savingItemTags.value = true
  pageError.value = ''
  try {
    await $fetch('/api/admin-documents/item-tags', {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: { type: item.type, id: item.id, tag_ids: selectedTagIds.value }
    })
    editingTags.value = false
    await Promise.all([loadDocuments(), loadWorkspace()])
    if (activeTag.value) await openTag(activeTag.value)
  } catch (error) {
    pageError.value = getErrorMessage(error, 'Could not save tags.')
  } finally {
    savingItemTags.value = false
  }
}

const refreshFileManager = async () => {
  await Promise.all([loadDocuments(), loadWorkspace(), loadTags()])
  if (topView.value === 'activity') await loadGlobalActivity()
  if (activeTag.value) await openTag(activeTag.value)
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
    pageError.value = getErrorMessage(error, 'Could not update favorites.')
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
  selectedItemKey.value = ''
  detailsOpen.value = false
  workspaceView.value = 'all'
  topView.value = 'files'
  await router.push({
    path: '/dashboard/documents',
    query: folderId ? { folder: folderId } : {}
  })
}

const selectItem = (item) => {
  selectedItemKey.value = `${item.type}:${item.id}`
  detailsOpen.value = false
}

const openDetails = (item) => {
  selectedItemKey.value = `${item.type}:${item.id}`
  detailsTab.value = 'properties'
  detailsOpen.value = true
}

const closeDetails = () => {
  detailsOpen.value = false
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
    selectedItemKey.value = ''
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

const tagSoftClass = (color) => ({
  blue: 'bg-blue-50 text-blue-700',
  violet: 'bg-violet-50 text-violet-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-rose-700',
  slate: 'bg-slate-100 text-slate-700'
}[color] || 'bg-blue-50 text-blue-700')

const tagDotClass = (color) => ({
  blue: 'bg-blue-500',
  violet: 'bg-violet-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-500'
}[color] || 'bg-blue-500')

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
  () => {
    workspaceView.value = 'all'
    loadDocuments()
  }
)

watch(searchQuery, () => {
  window.clearTimeout(searchTimeoutId)
  if (topView.value === 'files' && workspaceView.value === 'all') {
    searchTimeoutId = window.setTimeout(() => loadDocuments(), 300)
  }
})

watch(selectedItemKey, () => {
  detailsTab.value = 'properties'
  itemActivity.value = []
  editingTags.value = false
})

watch(selectedItem, (item) => {
  if (!item) detailsOpen.value = false
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
