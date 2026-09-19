<script setup>
import { renderSafeMarkdown } from '~/utils/markdown'

definePageMeta({ layout: 'dashboard' })
const { hasPermission } = useAdminAccess()
const canEdit = computed(() => hasPermission('help.edit'))
const { request, errorText } = useSupportClient()
const tab = ref('articles')
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const categories = ref([])
const articles = ref([])
const search = ref('')
const statusFilter = ref('')
const categoryFilter = ref('')
const draft = reactive({ id: '', category_id: '', title: '', slug: '', summary: '', content_markdown: '', status: 'draft', is_featured: false, sort_position: 0, published_at: null })
const categoryDraft = reactive({ id: '', name: '', slug: '', description: '', sort_position: 0, is_active: true })
const previewHtml = computed(() => renderSafeMarkdown(draft.content_markdown))
const slugify = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const newArticle = () => Object.assign(draft, { id: '', category_id: categories.value[0]?.id || '', title: '', slug: '', summary: '', content_markdown: '', status: 'draft', is_featured: false, sort_position: 0, published_at: null })
const newCategory = () => Object.assign(categoryDraft, { id: '', name: '', slug: '', description: '', sort_position: categories.value.length * 10, is_active: true })
const selectArticle = item => Object.assign(draft, item)
const selectCategory = item => Object.assign(categoryDraft, item)
const loadCategories = async () => { const result = await request('/api/admin-help/categories'); categories.value = result.items || [] }
const loadArticles = async () => {
  const result = await request('/api/admin-help/articles', { query: { q: search.value || undefined, status: statusFilter.value || undefined, category: categoryFilter.value || undefined } })
  articles.value = result.items || []
}
const load = async () => {
  loading.value = true; error.value = ''
  try { await Promise.all([loadCategories(), loadArticles()]); if (!draft.id) newArticle(); if (!categoryDraft.id) newCategory() }
  catch (cause) { error.value = errorText(cause, 'Could not load Help Center.') }
  finally { loading.value = false }
}
const saveArticle = async () => {
  if (!canEdit.value || saving.value) return
  saving.value = true; error.value = ''; notice.value = ''
  try {
    const result = await request(draft.id ? `/api/admin-help/articles/${draft.id}` : '/api/admin-help/articles', {
      method: draft.id ? 'PATCH' : 'POST', body: { ...draft }
    })
    await loadArticles(); selectArticle(result.item)
    notice.value = result.item.status === 'published' ? 'Article published.' : 'Article saved.'
  } catch (cause) { error.value = errorText(cause, 'Could not save article.') }
  finally { saving.value = false }
}
const archiveArticle = async () => {
  if (!draft.id || !canEdit.value || !confirm(`Archive “${draft.title}”?`)) return
  saving.value = true; error.value = ''
  try { const result = await request(`/api/admin-help/articles/${draft.id}`, { method: 'DELETE' }); selectArticle(result.item); await loadArticles(); notice.value = 'Article archived.' }
  catch (cause) { error.value = errorText(cause, 'Could not archive article.') }
  finally { saving.value = false }
}
const saveCategory = async () => {
  if (!canEdit.value || saving.value) return
  saving.value = true; error.value = ''; notice.value = ''
  try {
    const result = await request(categoryDraft.id ? `/api/admin-help/categories/${categoryDraft.id}` : '/api/admin-help/categories', {
      method: categoryDraft.id ? 'PATCH' : 'POST', body: { ...categoryDraft }
    })
    await loadCategories(); selectCategory(result.item); notice.value = 'Category saved.'
  } catch (cause) { error.value = errorText(cause, 'Could not save category.') }
  finally { saving.value = false }
}
const publicUrl = computed(() => {
  const category = categories.value.find(item => item.id === draft.category_id)
  return category ? `/help/${category.slug}/${draft.slug}` : ''
})
onMounted(load)
watch([statusFilter, categoryFilter], loadArticles)
</script>

<template>
  <div class="mx-auto max-w-[1500px] space-y-5 pb-8 text-gray-900">
    <DashboardPageIntro title="Help Center" description="Write answers customers can find themselves." />
    <div class="flex flex-wrap gap-2"><button v-for="item in [{ key: 'articles', label: 'Articles' }, { key: 'categories', label: 'Categories' }]" :key="item.key" type="button" class="min-h-10 rounded-xl px-4 text-sm font-bold" :class="tab === item.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'" @click="tab = item.key">{{ item.label }}</button></div>
    <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-4 text-sm text-red-700">{{ error }}</p>
    <p v-if="notice" role="status" class="rounded-xl bg-green-50 p-4 text-sm text-green-700">{{ notice }}</p>
    <p v-if="!canEdit" class="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">You can view content but cannot edit it.</p>

    <div v-if="tab === 'articles'" class="grid min-h-[720px] gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><div class="flex items-center justify-between gap-2"><h2 class="font-bold">Articles</h2><button v-if="canEdit" type="button" class="text-sm font-bold text-blue-700" @click="newArticle">New</button></div><form class="mt-4 flex gap-2" @submit.prevent="loadArticles"><label class="min-w-0 flex-1"><span class="sr-only">Search articles</span><input v-model="search" type="search" placeholder="Search articles" class="min-h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" /></label><button type="submit" class="rounded-xl bg-gray-100 px-3" aria-label="Search"><Icon name="lucide:search" size="17" /></button></form><div class="mt-3 grid gap-2"><label><span class="sr-only">Filter by status</span><select v-model="statusFilter" class="min-h-10 w-full rounded-xl border border-gray-200 px-3 text-sm"><option value="">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label><label><span class="sr-only">Filter by category</span><select v-model="categoryFilter" class="min-h-10 w-full rounded-xl border border-gray-200 px-3 text-sm"><option value="">All categories</option><option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option></select></label></div><p v-if="loading" class="mt-5 text-sm text-gray-500">Loading...</p><ul v-else class="mt-4 max-h-[650px] space-y-1 overflow-y-auto"><li v-for="item in articles" :key="item.id"><button type="button" class="w-full rounded-xl p-3 text-left hover:bg-blue-50" :class="draft.id === item.id ? 'bg-blue-50' : ''" @click="selectArticle(item)"><span class="block truncate text-sm font-semibold">{{ item.title }}</span><span class="mt-1 block text-xs capitalize text-gray-500">{{ item.status }}</span></button></li></ul><p v-if="!loading && !articles.length" class="mt-5 text-sm text-gray-500">No articles found.</p></aside>
      <section class="min-w-0 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"><div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-lg font-bold">{{ draft.id ? 'Edit article' : 'New article' }}</h2><p class="text-xs text-gray-500">{{ draft.status === 'published' ? 'Published' : draft.status === 'archived' ? 'Archived' : 'Draft' }}</p></div><div class="flex flex-wrap gap-2"><a v-if="draft.status === 'published' && publicUrl" :href="publicUrl" target="_blank" rel="noreferrer" class="min-h-10 rounded-xl border px-3 py-2 text-sm font-semibold">Open article</a><button v-if="draft.id && canEdit && draft.status !== 'archived'" type="button" class="min-h-10 rounded-xl px-3 text-sm font-semibold text-red-700" @click="archiveArticle">Archive</button></div></div>
        <form class="mt-5 space-y-4" @submit.prevent="saveArticle"><fieldset :disabled="!canEdit || saving" class="space-y-4 disabled:opacity-70"><div class="grid gap-4 sm:grid-cols-2"><label class="text-sm font-semibold">Title<input v-model="draft.title" required maxlength="160" class="mt-1 w-full rounded-xl border border-gray-200 p-3" @blur="!draft.slug && (draft.slug = slugify(draft.title))" /></label><label class="text-sm font-semibold">Slug<input v-model="draft.slug" required maxlength="160" pattern="[a-z0-9]+(-[a-z0-9]+)*" class="mt-1 w-full rounded-xl border border-gray-200 p-3" /></label><label class="text-sm font-semibold">Category<select v-model="draft.category_id" required class="mt-1 w-full rounded-xl border border-gray-200 p-3"><option value="">Choose category</option><option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option></select></label><label class="text-sm font-semibold">Status<select v-model="draft.status" class="mt-1 w-full rounded-xl border border-gray-200 p-3"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label></div><label class="block text-sm font-semibold">Summary<textarea v-model="draft.summary" maxlength="500" rows="2" class="mt-1 w-full rounded-xl border border-gray-200 p-3" /></label><div class="grid gap-4 sm:grid-cols-2"><label class="inline-flex items-center gap-2 text-sm font-semibold"><input v-model="draft.is_featured" type="checkbox" /> Featured article</label><label class="text-sm font-semibold">Position<input v-model.number="draft.sort_position" type="number" min="-100000" max="100000" class="mt-1 w-full rounded-xl border border-gray-200 p-3" /></label></div><div class="grid gap-4 xl:grid-cols-2"><label class="block text-sm font-semibold">Markdown content<textarea v-model="draft.content_markdown" maxlength="100000" rows="18" class="mt-1 min-h-[400px] w-full rounded-xl border border-gray-200 p-3 font-mono text-sm" /></label><div><p class="mb-1 text-sm font-semibold">Preview</p><div class="min-h-[400px] overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4"><h3 class="text-xl font-bold">{{ draft.title || 'Article title' }}</h3><p class="mt-2 text-sm text-gray-500">{{ draft.summary }}</p><div class="mt-5 space-y-3 text-sm leading-6" v-html="previewHtml" /></div></div></div><button type="submit" class="min-h-11 rounded-xl bg-blue-600 px-5 font-bold text-white">{{ saving ? 'Saving...' : 'Save article' }}</button></fieldset></form>
      </section>
    </div>

    <div v-else class="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]"><aside class="rounded-2xl border border-gray-200 bg-white p-4"><div class="flex items-center justify-between"><h2 class="font-bold">Categories</h2><button v-if="canEdit" type="button" class="text-sm font-bold text-blue-700" @click="newCategory">New</button></div><ul class="mt-4 space-y-1"><li v-for="category in categories" :key="category.id"><button type="button" class="w-full rounded-xl p-3 text-left text-sm hover:bg-blue-50" :class="categoryDraft.id === category.id ? 'bg-blue-50' : ''" @click="selectCategory(category)"><span class="block font-semibold">{{ category.name }}</span><span class="text-xs text-gray-500">{{ category.is_active ? 'Active' : 'Hidden' }} · {{ category.sort_position }}</span></button></li></ul></aside><section class="rounded-2xl border border-gray-200 bg-white p-6"><h2 class="text-lg font-bold">{{ categoryDraft.id ? 'Edit category' : 'New category' }}</h2><form class="mt-5 space-y-4" @submit.prevent="saveCategory"><fieldset :disabled="!canEdit || saving" class="space-y-4 disabled:opacity-70"><label class="block text-sm font-semibold">Name<input v-model="categoryDraft.name" required maxlength="80" class="mt-1 w-full rounded-xl border border-gray-200 p-3" @blur="!categoryDraft.slug && (categoryDraft.slug = slugify(categoryDraft.name))" /></label><label class="block text-sm font-semibold">Slug<input v-model="categoryDraft.slug" required maxlength="80" pattern="[a-z0-9]+(-[a-z0-9]+)*" class="mt-1 w-full rounded-xl border border-gray-200 p-3" /></label><label class="block text-sm font-semibold">Description<textarea v-model="categoryDraft.description" maxlength="300" rows="3" class="mt-1 w-full rounded-xl border border-gray-200 p-3" /></label><label class="block text-sm font-semibold">Position<input v-model.number="categoryDraft.sort_position" type="number" min="-100000" max="100000" class="mt-1 w-full rounded-xl border border-gray-200 p-3" /></label><label class="inline-flex items-center gap-2 text-sm font-semibold"><input v-model="categoryDraft.is_active" type="checkbox" /> Visible to customers</label><div><button type="submit" class="min-h-11 rounded-xl bg-blue-600 px-5 font-bold text-white">{{ saving ? 'Saving...' : 'Save category' }}</button></div></fieldset></form></section></div>
  </div>
</template>
