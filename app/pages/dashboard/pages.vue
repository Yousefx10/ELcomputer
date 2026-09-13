<template>
  <div class="mx-auto max-w-[1500px] pb-8 text-gray-900">
    <header class="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between lg:p-6">
      <div><h1 class="text-2xl font-bold tracking-tight">Pages</h1><p class="mt-1 text-sm text-gray-500">Create pages for your website.</p></div>
      <button v-if="canEdit" type="button" class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700" @click="startNewPage"><Icon name="lucide:plus" size="18" /> New page</button>
    </header>

    <div v-if="pageError" class="mt-4 flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700" role="alert"><Icon name="lucide:circle-alert" size="18" /><p class="flex-1">{{ pageError }}</p><button type="button" class="font-bold" @click="loadPages">Retry</button></div>
    <p v-if="!canEdit" class="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-700">You can view pages but cannot edit them.</p>

    <section class="mt-5 grid min-h-[720px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:grid-cols-[290px_minmax(0,1fr)]">
      <aside class="border-b border-gray-200 bg-gray-50 lg:border-b-0 lg:border-e">
        <div class="border-b border-gray-200 p-4"><label class="relative block"><span class="sr-only">Search pages</span><Icon name="lucide:search" size="16" class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" /><input v-model="searchQuery" type="search" placeholder="Search pages" class="w-full rounded-xl border border-gray-200 bg-white py-2.5 ps-9 pe-3 text-sm outline-none focus:border-blue-500" /></label></div>
        <div v-if="loading" class="grid min-h-48 place-items-center"><Icon name="lucide:loader-circle" size="24" class="animate-spin text-gray-400" /></div>
        <div v-else-if="filteredPages.length" class="max-h-80 overflow-y-auto p-2 lg:max-h-[650px]">
          <button v-for="item in filteredPages" :key="item.id" type="button" class="mb-1 flex w-full items-start gap-3 rounded-xl p-3 text-left transition" :class="draft.id === item.id ? 'bg-white shadow-sm ring-1 ring-gray-200' : 'hover:bg-white'" @click="selectPage(item)"><span class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" :class="item.is_published ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-200 text-gray-500'"><Icon :name="item.is_published ? 'lucide:file-check-2' : 'lucide:file-pen-line'" size="17" /></span><span class="min-w-0 flex-1"><span class="block truncate text-sm font-bold">{{ item.title }}</span><span class="mt-1 block truncate text-xs text-gray-400">/{{ item.path }}</span><span class="mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold" :class="item.is_published ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-200 text-gray-600'">{{ item.is_published ? 'Published' : 'Draft' }}</span></span></button>
        </div>
        <div v-else class="grid min-h-48 place-items-center px-5 text-center"><div><Icon name="lucide:files" size="25" class="mx-auto text-gray-300" /><p class="mt-2 text-sm font-semibold">No pages found</p><p class="mt-1 text-xs text-gray-400">Create your first page.</p></div></div>
      </aside>

      <main class="min-w-0">
        <form class="flex min-h-full flex-col" @submit.prevent="savePage">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 lg:px-6">
            <div><h2 class="text-base font-bold">{{ draft.id ? 'Edit page' : 'New page' }}</h2><p class="mt-1 text-xs text-gray-400">{{ draft.id ? `Updated ${formatDate(draft.updated_at)}` : 'Not saved yet' }}</p></div>
            <div class="flex items-center gap-2"><a v-if="draft.id && draft.is_published" :href="`/${draft.path}`" target="_blank" rel="noreferrer" class="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 px-3 text-xs font-bold text-gray-600 hover:bg-gray-50"><Icon name="lucide:external-link" size="15" /> View</a><button v-if="draft.id && canEdit" type="button" class="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold text-red-600 hover:bg-red-50" @click="deletePage"><Icon name="lucide:trash-2" size="15" /> Delete</button><button v-if="canEdit" type="submit" :disabled="saving || !hasChanges" class="inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold text-white" :class="hasChanges && !saving ? 'bg-blue-600 hover:bg-blue-700' : 'cursor-not-allowed bg-gray-300'"><Icon :name="saving ? 'lucide:loader-circle' : 'lucide:save'" size="15" :class="{ 'animate-spin': saving }" />{{ saving ? 'Saving...' : 'Save page' }}</button></div>
          </div>

          <fieldset :disabled="!canEdit" class="min-w-0 flex-1 disabled:opacity-70">
            <div class="grid min-h-full xl:grid-cols-2">
              <div class="min-w-0 border-b border-gray-200 p-5 xl:border-b-0 xl:border-e lg:p-6">
                <div class="grid gap-5 sm:grid-cols-2">
                  <label class="sm:col-span-2"><span class="mb-2 block text-xs font-bold text-gray-600">Page title</span><input v-model="draft.title" required maxlength="120" type="text" placeholder="Shipping policy" class="page-form-input" /></label>
                  <label class="sm:col-span-2"><span class="mb-2 block text-xs font-bold text-gray-600">Page URL</span><div class="flex overflow-hidden rounded-xl border border-gray-200 bg-white focus-within:border-blue-500"><span class="flex items-center border-e bg-gray-50 px-3 text-sm text-gray-400">/</span><input v-model="draft.path" required maxlength="160" type="text" placeholder="shipping-policy" class="min-w-0 flex-1 px-3 py-3 text-sm outline-none" @input="pathEdited = true" /></div><p class="mt-1.5 text-[11px] text-gray-400">Use lowercase words and hyphens.</p></label>
                  <label class="page-toggle-card"><span><strong>Published</strong><small>Visitors can open this page.</small></span><input v-model="draft.is_published" type="checkbox" /></label>
                  <label class="page-toggle-card"><span><strong>Show in navbar</strong><small>Add the title to navigation.</small></span><input v-model="draft.show_in_navbar" type="checkbox" /></label>
                </div>

                <div class="mt-6"><div class="mb-2 flex flex-wrap items-center justify-between gap-2"><span class="text-xs font-bold text-gray-600">Markdown content</span><a href="https://www.markdownguide.org/basic-syntax/" target="_blank" rel="noreferrer" class="text-xs font-semibold text-blue-600">Markdown help</a></div><div class="flex flex-wrap gap-1 rounded-t-xl border border-b-0 border-gray-200 bg-gray-50 p-2" role="toolbar" aria-label="Markdown formatting"><button v-for="tool in markdownTools" :key="tool.label" type="button" class="inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-bold text-gray-500 hover:bg-white hover:text-gray-900" :title="tool.label" @click="insertMarkdown(tool)"><Icon :name="tool.icon" size="15" /><span class="sr-only">{{ tool.label }}</span></button></div><textarea ref="contentInput" v-model="draft.content_markdown" rows="18" placeholder="# Shipping policy&#10;&#10;Write your page here." class="min-h-[430px] w-full resize-y rounded-b-xl border border-gray-200 p-4 font-mono text-sm leading-6 outline-none focus:border-blue-500" /></div>
              </div>

              <div class="min-w-0 bg-gray-50 p-5 lg:p-6"><div class="mb-4 flex items-center justify-between"><div><p class="text-sm font-bold">Preview</p><p class="mt-1 text-xs text-gray-400">Updates while you type.</p></div><span class="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-gray-500 ring-1 ring-gray-200">Markdown</span></div><article class="min-h-[540px] rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><h1 class="break-words text-3xl font-bold tracking-tight">{{ draft.title || 'Untitled page' }}</h1><div v-if="draft.content_markdown" class="page-markdown-preview mt-8" v-html="previewHtml" /><p v-else class="mt-8 text-sm text-gray-400">Your content will appear here.</p></article></div>
            </div>
          </fieldset>
        </form>
      </main>
    </section>
  </div>
</template>

<script setup>
import { renderSafeMarkdown } from '~/utils/markdown'

definePageMeta({ layout: 'dashboard' })

const supabase = useSupabaseClient()
const { hasPermission } = useAdminAccess()
const canEdit = computed(() => hasPermission('pages.edit'))
const pages = ref([])
const loading = ref(true)
const saving = ref(false)
const pageError = ref('')
const searchQuery = ref('')
const contentInput = ref(null)
const pathEdited = ref(false)
const emptyDraft = () => ({ id: '', title: '', path: '', content_markdown: '', is_published: false, show_in_navbar: false, created_at: '', updated_at: '' })
const draft = reactive(emptyDraft())
const original = ref(JSON.stringify(emptyDraft()))

const markdownTools = [
  { label: 'Heading', icon: 'lucide:heading-2', prefix: '## ', suffix: '', placeholder: 'Heading' },
  { label: 'Bold', icon: 'lucide:bold', prefix: '**', suffix: '**', placeholder: 'bold text' },
  { label: 'Italic', icon: 'lucide:italic', prefix: '*', suffix: '*', placeholder: 'italic text' },
  { label: 'Link', icon: 'lucide:link', prefix: '[', suffix: '](https://)', placeholder: 'link text' },
  { label: 'List', icon: 'lucide:list', prefix: '- ', suffix: '', placeholder: 'List item' },
  { label: 'Quote', icon: 'lucide:quote', prefix: '> ', suffix: '', placeholder: 'Quote' },
  { label: 'Code', icon: 'lucide:code-2', prefix: '`', suffix: '`', placeholder: 'code' }
]

const filteredPages = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return pages.value.filter((page) => !query || `${page.title} ${page.path}`.toLowerCase().includes(query))
})
const previewHtml = computed(() => renderSafeMarkdown(draft.content_markdown))
const normalizedDraft = computed(() => JSON.stringify({
  id: draft.id,
  title: draft.title,
  path: draft.path,
  content_markdown: draft.content_markdown,
  is_published: draft.is_published,
  show_in_navbar: draft.show_in_navbar,
  created_at: draft.created_at,
  updated_at: draft.updated_at
}))
const hasChanges = computed(() => normalizedDraft.value !== original.value)

const getAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('Your session expired.')
  return { authorization: `Bearer ${data.session.access_token}` }
}
const getErrorMessage = (error, fallback) => error?.data?.statusMessage || error?.statusMessage || error?.message || fallback
const applyDraft = (page) => {
  Object.assign(draft, emptyDraft(), page || {})
  original.value = normalizedDraft.value
  pathEdited.value = Boolean(page?.id)
}

const loadPages = async (selectedId = draft.id) => {
  loading.value = true
  pageError.value = ''
  try {
    const response = await $fetch('/api/admin-pages', { headers: await getAuthHeaders() })
    pages.value = response.items || []
    const selected = pages.value.find((page) => page.id === selectedId)
    if (selected) applyDraft(selected)
    else if (pages.value.length) applyDraft(pages.value[0])
    else applyDraft()
  } catch (error) {
    pageError.value = getErrorMessage(error, 'Could not load pages.')
  } finally {
    loading.value = false
  }
}

const confirmDiscard = () => !hasChanges.value || confirm('Discard unsaved changes?')
const selectPage = (page) => {
  if (!confirmDiscard()) return
  applyDraft(page)
}
const startNewPage = () => {
  if (!confirmDiscard()) return
  applyDraft()
  pathEdited.value = false
}

const toPagePath = (title) => String(title || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 160)

watch(() => draft.title, (title) => {
  if (!draft.id && !pathEdited.value) draft.path = toPagePath(title)
})

const savePage = async () => {
  if (!canEdit.value || saving.value) return
  saving.value = true
  pageError.value = ''
  try {
    const endpoint = draft.id ? `/api/admin-pages/${draft.id}` : '/api/admin-pages'
    const response = await $fetch(endpoint, {
      method: draft.id ? 'PATCH' : 'POST',
      headers: await getAuthHeaders(),
      body: {
        title: draft.title,
        path: draft.path,
        content_markdown: draft.content_markdown,
        is_published: draft.is_published,
        show_in_navbar: draft.show_in_navbar
      }
    })
    await loadPages(response.item.id)
    await refreshNuxtData('site-content')
  } catch (error) {
    pageError.value = getErrorMessage(error, 'Could not save the page.')
  } finally {
    saving.value = false
  }
}

const deletePage = async () => {
  if (!draft.id || !canEdit.value || !confirm(`Delete “${draft.title}”?`)) return
  saving.value = true
  pageError.value = ''
  try {
    await $fetch(`/api/admin-pages/${draft.id}`, { method: 'DELETE', headers: await getAuthHeaders() })
    await loadPages('')
    await refreshNuxtData('site-content')
  } catch (error) {
    pageError.value = getErrorMessage(error, 'Could not delete the page.')
  } finally {
    saving.value = false
  }
}

const insertMarkdown = async (tool) => {
  const textarea = contentInput.value
  if (!textarea) return
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = draft.content_markdown.slice(start, end) || tool.placeholder
  draft.content_markdown = `${draft.content_markdown.slice(0, start)}${tool.prefix}${selected}${tool.suffix}${draft.content_markdown.slice(end)}`
  await nextTick()
  textarea.focus()
  textarea.setSelectionRange(start + tool.prefix.length, start + tool.prefix.length + selected.length)
}

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—'

onMounted(loadPages)
</script>

<style scoped>
.page-form-input { width: 100%; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 0.75rem; font-size: 0.875rem; outline: none; }
.page-form-input:focus { border-color: #3b82f6; }
.page-toggle-card { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 0.9rem; cursor: pointer; }
.page-toggle-card strong { display: block; font-size: 0.75rem; color: #374151; }
.page-toggle-card small { display: block; margin-top: 0.2rem; color: #9ca3af; font-size: 0.68rem; }
.page-toggle-card input { width: 1rem; height: 1rem; accent-color: #2563eb; }
.page-markdown-preview { color: #374151; font-size: 0.9rem; line-height: 1.75; }
.page-markdown-preview :deep(h1), .page-markdown-preview :deep(h2), .page-markdown-preview :deep(h3), .page-markdown-preview :deep(h4) { margin: 1.5em 0 0.5em; color: #111827; font-weight: 750; line-height: 1.25; }
.page-markdown-preview :deep(h1) { font-size: 1.8rem; }
.page-markdown-preview :deep(h2) { font-size: 1.4rem; }
.page-markdown-preview :deep(h3) { font-size: 1.15rem; }
.page-markdown-preview :deep(p) { margin-bottom: 0.9rem; }
.page-markdown-preview :deep(ul), .page-markdown-preview :deep(ol) { margin-bottom: 1rem; padding-inline-start: 1.4rem; }
.page-markdown-preview :deep(ul) { list-style: disc; }
.page-markdown-preview :deep(ol) { list-style: decimal; }
.page-markdown-preview :deep(a) { color: #1d4ed8; text-decoration: underline; }
.page-markdown-preview :deep(blockquote) { margin: 1rem 0; border-inline-start: 3px solid #60a5fa; background: #eff6ff; padding: 0.8rem; }
.page-markdown-preview :deep(code) { border-radius: 0.3rem; background: #f3f4f6; padding: 0.1rem 0.3rem; color: #be123c; }
.page-markdown-preview :deep(pre) { overflow-x: auto; border-radius: 0.7rem; background: #111827; padding: 1rem; color: white; }
.page-markdown-preview :deep(pre code) { background: transparent; padding: 0; color: inherit; }
</style>
