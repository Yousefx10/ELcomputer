<template>
  <div class="mx-auto max-w-7xl">
    <DashboardPageIntro :title="$t('productList.title')" :show-actions="canAdd" container-class="mb-4 rounded-2xl bg-white p-5 shadow" layout-class="flex flex-wrap items-center justify-between gap-3" title-class="text-2xl font-bold text-gray-900" modern-actions-class="mb-4 flex justify-end">
      <template #actions><NuxtLinkLocale :to="editorLink()" class="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">{{ $t('common.addProduct') }}</NuxtLinkLocale></template>
    </DashboardPageIntro>
    <DashboardSecondaryNav class="mb-4" />
    <fieldset :disabled="bulk.locked" class="mb-4 min-w-0 rounded-2xl bg-white p-4 shadow">
      <div class="mb-3 grid gap-3 sm:grid-cols-[1fr_13rem]">
        <div>
          <label for="product-search" class="mb-1 block text-xs font-semibold text-gray-700">{{ $t('common.searchProducts') }}</label>
          <input id="product-search" v-model="search" type="search" maxlength="120" :placeholder="$t('productList.searchPlaceholder')" class="w-full rounded-lg border bg-white p-2 text-sm text-gray-900 outline-none focus:border-blue-500">
        </div>
        <div>
          <label for="product-sort" class="mb-1 block text-xs font-semibold text-gray-700">{{ $t('productList.sort') }}</label>
          <select id="product-sort" :value="state.sort" class="w-full rounded-lg border bg-white p-2 text-sm text-gray-900" @change="update({ sort: $event.target.value })">
            <option value="newest">{{ $t('productList.newest') }}</option><option value="oldest">{{ $t('productList.oldest') }}</option>
            <option value="title_asc">{{ $t('productList.titleAsc') }}</option><option value="title_desc">{{ $t('productList.titleDesc') }}</option>
            <option value="price_asc">{{ $t('productList.priceAsc') }}</option><option value="price_desc">{{ $t('productList.priceDesc') }}</option>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div>
          <label for="product-status" class="mb-1 block text-xs font-semibold text-gray-700">{{ $t('productList.publication') }}</label>
          <select id="product-status" :value="state.status" class="w-full rounded-lg border bg-white p-2 text-sm text-gray-900" @change="update({ status: $event.target.value })">
            <option value="all">{{ $t('productList.all') }}</option><option value="published">{{ $t('common.published') }}</option><option value="drafts">{{ $t('productEditor.draft') }}</option>
          </select>
        </div>
        <ListFilter kind="category" :label="$t('productList.category')" :search-label="$t('productList.searchCategories')" :model-value="state.category" @update:model-value="update({ category: $event })" />
        <ListFilter kind="brand" :label="$t('productList.brand')" :search-label="$t('productList.searchBrands')" :model-value="state.brand" @update:model-value="update({ brand: $event })" />
        <div>
          <label for="product-mode" class="mb-1 block text-xs font-semibold text-gray-700">{{ $t('productList.sellingMode') }}</label>
          <select id="product-mode" :value="state.mode" class="w-full rounded-lg border bg-white p-2 text-sm text-gray-900" @change="update({ mode: $event.target.value })">
            <option value="all">{{ $t('productList.all') }}</option><option value="normal">{{ $t('productList.normal') }}</option><option value="coming_soon">{{ $t('productList.comingSoon') }}</option><option value="preorder">{{ $t('productList.preorder') }}</option>
          </select>
        </div>
        <div>
          <label for="product-stock" class="mb-1 block text-xs font-semibold text-gray-700">{{ $t('productList.stock') }}</label>
          <select id="product-stock" :value="state.stock" class="w-full rounded-lg border bg-white p-2 text-sm text-gray-900" @change="update({ stock: $event.target.value })">
            <option value="all">{{ $t('productList.all') }}</option><option value="in_stock">{{ $t('productList.inStock') }}</option><option value="out_of_stock">{{ $t('productList.outOfStock') }}</option>
          </select>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <p>{{ $t('productList.stockHelp') }}</p>
        <div class="flex gap-3"><button v-if="hasFilters || state.q || state.sort !== 'newest'" type="button" class="font-semibold text-blue-700" @click="reset">{{ $t('productList.clearFilters') }}</button><button type="button" :disabled="loading" class="font-semibold text-gray-700 disabled:opacity-50" @click="load">{{ $t('productList.refresh') }}</button></div>
      </div>
    </fieldset>
    <div :aria-busy="loading" class="overflow-hidden rounded-2xl bg-white shadow">
      <div v-if="canEdit" class="border-b px-4 py-3 text-sm" data-bulk-controls>
        <div class="flex flex-wrap items-center gap-3">
          <label class="flex items-center gap-2 text-gray-700"><input type="checkbox" :checked="bulk.allSelected" :indeterminate="bulk.count > 0 && !bulk.allSelected" :disabled="loading || bulk.locked || !bulk.pageItems.length" @change="bulk.togglePage">{{ $t('productBulk.selectPage') }}</label>
          <span role="status" class="text-xs text-gray-600">{{ $t('productBulk.selected', { count: bulk.count }) }}</span>
          <fieldset :disabled="bulk.locked" class="flex min-w-0 flex-wrap items-end gap-3">
            <div><label for="product-bulk-action" class="mb-1 block text-xs font-semibold text-gray-700">{{ $t('productBulk.action') }}</label><select id="product-bulk-action" v-model="bulk.operation" class="rounded-lg border bg-white p-2 text-sm text-gray-900"><option value="publish">{{ $t('productBulk.publish') }}</option><option value="draft">{{ $t('productBulk.draft') }}</option><option value="category">{{ $t('productBulk.category') }}</option><option value="brand">{{ $t('productBulk.brand') }}</option></select></div>
            <ListFilter v-if="bulk.operation === 'category'" v-model="bulk.reference" input-id="product-bulk-category" kind="category" :label="$t('productList.category')" :search-label="$t('productList.searchCategories')" :empty-label="$t('productBulk.chooseCategory')" @selection="bulk.choice" />
            <ListFilter v-if="bulk.operation === 'brand'" v-model="bulk.reference" input-id="product-bulk-brand" kind="brand" :label="$t('productList.brand')" :search-label="$t('productList.searchBrands')" :empty-label="$t('productBulk.chooseBrand')" @selection="bulk.choice" />
            <button type="button" :disabled="!bulk.ready" class="rounded-lg border px-3 py-2 text-sm text-gray-700 disabled:opacity-50" @click="bulk.review">{{ $t('productBulk.review') }}</button>
          </fieldset>
        </div>
        <p class="mt-2 text-xs text-gray-500">{{ $t('productBulk.selectionHelp') }}</p>
        <div v-if="bulk.reviewing" class="mt-3" role="group" :aria-label="$t('productBulk.confirmation')">
          <p class="text-sm text-gray-900">{{ confirmation }}</p><p class="mt-1 text-xs text-gray-500">{{ $t('productBulk.confirmHelp') }}</p>
          <div class="mt-2 flex flex-wrap gap-3"><button type="button" :disabled="!bulk.ready" class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" @click="bulk.confirm">{{ $t('productBulk.apply') }}</button><button type="button" class="rounded-lg border px-3 py-2 text-sm text-gray-700" @click="bulk.cancel">{{ $t('common.cancel') }}</button></div>
        </div>
        <p v-if="bulk.pending && !bulk.busy" class="mt-3 text-sm text-gray-600">{{ $t('productBulk.pending', { count: bulk.pending.items.length }) }}</p>
        <p v-if="bulk.busy" role="status" class="mt-3 text-sm text-gray-600">{{ $t('productBulk.updating', { count: bulk.pending?.items.length || 0 }) }}</p>
        <p v-if="bulk.error" role="alert" class="mt-3 text-sm text-red-600">{{ bulkError }}</p>
        <div v-if="bulk.pending && !bulk.busy" class="mt-2 flex flex-wrap gap-3"><button type="button" :disabled="!canEdit" class="rounded-lg border px-3 py-2 text-sm text-gray-700" @click="bulk.check">{{ $t('productBulk.check') }}</button><button type="button" :disabled="!canEdit" class="rounded-lg border px-3 py-2 text-sm text-gray-700" @click="bulk.retry">{{ $t('productBulk.retry') }}</button></div>
        <div v-if="bulk.outcome" class="mt-3 text-xs text-gray-700" data-bulk-results>
          <p role="status">{{ $t('productBulk.results', bulk.outcome) }}</p>
          <details class="mt-2"><summary class="cursor-pointer">{{ $t('productBulk.details') }}</summary><ul class="mt-2 space-y-1"><li v-for="item in bulk.outcome.items" :key="item.id" class="flex flex-wrap gap-2"><NuxtLinkLocale :to="editorLink(item.id)" class="break-all text-blue-700 hover:underline">{{ result?.items.find(product => product.id === item.id)?.title || item.id }}</NuxtLinkLocale><span>{{ itemResult(item) }}</span></li></ul></details>
        </div>
      </div>
      <p v-if="loading" role="status" class="p-6 text-center text-sm text-gray-500">{{ $t('common.loadingProducts') }}</p>
      <div v-else-if="error" role="alert" class="p-6 text-center">
        <p class="text-sm text-red-600">{{ error === 'permission' ? $t('productList.permission') : $t('productList.loadFailed') }}</p><button v-if="error !== 'permission'" type="button" class="mt-3 rounded-lg border px-4 py-2 text-sm text-gray-700" @click="load">{{ $t('productList.retry') }}</button>
      </div>
      <div v-else-if="!result?.items.length" class="p-6 text-center">
        <h2 class="text-lg font-semibold text-gray-900">{{ emptyTitle }}</h2><p class="mt-1 text-sm text-gray-500">{{ emptyHelp }}</p>
        <div class="mt-4 flex flex-wrap justify-center gap-3"><button v-if="state.q || hasFilters" type="button" class="rounded-lg border px-4 py-2 text-sm text-gray-700" @click="reset">{{ $t('productList.clearFilters') }}</button><NuxtLinkLocale v-if="canAdd" :to="editorLink()" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">{{ $t('common.addProduct') }}</NuxtLinkLocale></div>
      </div>
      <template v-else>
        <div class="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-xs text-gray-500" role="status"><p>{{ $t('productList.results', { start: (result.page - 1) * 25 + 1, end: Math.min(result.page * 25, result.total), total: result.total }) }}</p><p>{{ $t('productList.page', { page: result.page, pages: pages }) }}</p></div>
        <table class="product-list-table w-full text-start text-sm">
          <thead class="bg-gray-50 text-xs text-gray-600"><tr>
            <th scope="col">{{ $t('productList.product') }}</th><th scope="col">{{ $t('productList.categoryBrand') }}</th><th scope="col">{{ $t('productList.price') }}</th><th scope="col">{{ $t('productList.publication') }}</th><th scope="col">{{ $t('productList.stock') }}</th><th scope="col">{{ $t('productList.options') }}</th><th scope="col">{{ $t('productList.actions') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="product in result.items" :key="product.id" :data-product-id="product.id">
              <td class="product-cell"><div class="flex min-w-0 items-start gap-3">
                <input v-if="canEdit" type="checkbox" class="mt-1 shrink-0" :aria-label="$t('productBulk.selectProduct', { title: product.title })" :checked="bulk.isSelected(product.id)" :disabled="bulk.locked || !bulk.selectable(product)" @change="bulk.toggle(product)">
                <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-50"><img v-if="product.image_url" :src="product.image_url" alt="" loading="lazy" class="h-10 w-10 object-contain"><span v-else class="text-gray-400" aria-hidden="true">—</span></div>
                <div class="min-w-0"><NuxtLinkLocale v-if="canEdit" :to="editorLink(product.id)" class="block break-words font-semibold text-gray-900 hover:text-blue-700">{{ product.title }}</NuxtLinkLocale><p v-else class="break-words font-semibold text-gray-900">{{ product.title }}</p><p class="mt-1 break-all text-xs text-gray-500" dir="auto">{{ product.sku || $t('productList.noSku') }}</p><p class="mt-1 break-words text-xs text-gray-500 lg:hidden">{{ [categoryName(product.category), product.brand?.name].filter(Boolean).join(' · ') || '—' }}</p></div>
              </div></td>
              <td class="category-cell"><p class="break-words text-gray-700">{{ categoryName(product.category) || '—' }}</p><p class="mt-1 break-words text-xs text-gray-500">{{ product.brand?.name || '—' }}</p></td>
              <td class="price-cell whitespace-nowrap font-semibold text-gray-900">{{ price(product.price) }}</td>
              <td class="publication-cell"><p class="text-xs font-semibold" :class="product.is_published ? 'text-green-700' : 'text-gray-600'">{{ product.is_published ? $t('common.published') : $t('productEditor.draft') }}</p><p class="mt-1 text-xs text-gray-500">{{ modeLabel(product.selling_mode) }}</p></td>
              <td class="stock-cell text-xs text-gray-700">{{ stockLabel(product.available_quantity) }}</td>
              <td class="options-cell text-xs text-gray-700"><span class="lg:hidden">{{ $t('productList.optionCount', { count: product.option_count }) }}</span><span class="hidden lg:inline">{{ product.option_count }}</span></td>
              <td class="actions-cell"><div v-if="canEdit" class="flex flex-wrap items-center gap-4 text-xs font-semibold"><NuxtLinkLocale :to="editorLink(product.id)" class="py-1 text-blue-700 hover:underline">{{ $t('productList.edit') }}</NuxtLinkLocale><NuxtLinkLocale v-if="product.is_serialized" :to="`/dashboard/commerce?tab=serialized&product=${product.id}`" class="py-1 text-gray-600 hover:underline">{{ $t('common.items') }}</NuxtLinkLocale></div><span v-else class="hidden text-gray-400 lg:inline">—</span></td>
            </tr>
          </tbody>
        </table>
        <nav :aria-label="$t('productList.pagination')" class="flex items-center justify-between gap-3 border-t px-4 py-3">
          <button type="button" :disabled="bulk.locked || result.page <= 1" class="rounded-lg border px-3 py-2 text-sm text-gray-700 disabled:opacity-50" @click="update({ page: result.page - 1 })">{{ $t('common.previous') }}</button><p class="text-xs text-gray-500">{{ $t('productList.page', { page: result.page, pages: pages }) }}</p><button type="button" :disabled="bulk.locked || result.page >= pages" class="rounded-lg border px-3 py-2 text-sm text-gray-700 disabled:opacity-50" @click="update({ page: result.page + 1 })">{{ $t('common.next') }}</button>
        </nav>
      </template>
    </div>
  </div>
</template>

<script setup>
import ListFilter from '~/components/dashboard/products/ListFilter.vue'
import { useProductListing } from '~/composables/useProductListing'
import { useProductBulk } from '~/composables/useProductBulk'
import { getLocalizedCategoryName } from '~/utils/categoryLocale'
definePageMeta({ layout: 'dashboard', key: route => route.path })
const { t, locale } = useI18n()
const { intlLocale } = useUiLocale()
const bulkLocked = ref(false)
const { state, search, result, loading, error, context, canAdd, canEdit, update, load, reset, editorLink, hasFilters } = useProductListing({ locked: bulkLocked })
const bulk = reactive(useProductBulk({ result, loading, context, canEdit, load }))
watch(() => bulk.locked, value => { bulkLocked.value = value }, { flush: 'sync' })
const confirmation = computed(() => bulk.operation === 'publish' ? t('productBulk.confirmPublish', { count: bulk.count }) : bulk.operation === 'draft' ? t('productBulk.confirmDraft', { count: bulk.count }) : bulk.operation === 'category' ? t('productBulk.confirmCategory', { count: bulk.count, name: bulk.referenceName }) : t('productBulk.confirmBrand', { count: bulk.count, name: bulk.referenceName }))
const bulkError = computed(() => bulk.error === 'permission' ? t('productBulk.permission') : bulk.error === 'reference' ? t('productBulk.referenceError') : bulk.error === 'invalid' ? t('productBulk.invalid') : bulk.error === 'storage' ? t('productBulk.storage') : bulk.error === 'leave' ? t('productBulk.leave') : t('productBulk.unknown'))
const itemResult = item => item.status === 'succeeded' ? t('productBulk.succeeded') : item.status === 'unchanged' ? t('productBulk.unchanged') : item.status === 'conflicted' ? t('productBulk.conflicted') : item.reason === 'incomplete' ? t('productBulk.incomplete') : item.reason === 'reference' ? t('productBulk.referenceError') : item.reason === 'not_found' ? t('productBulk.notFound') : t('productBulk.failed')
const pages = computed(() => Math.max(1, Math.ceil((result.value?.total || 0) / 25)))
const categoryName = category => getLocalizedCategoryName(category, locale.value)
const price = amount => amount == null ? '—' : t('common.valueEgp', { value0: new Intl.NumberFormat(intlLocale.value, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount)) })
const modeLabel = mode => mode === 'preorder' ? t('productList.preorder') : mode === 'coming_soon' ? t('productList.comingSoon') : t('productList.normal')
const stockLabel = quantity => quantity > 0 ? t('productList.available', { count: quantity }) : t('productList.outOfStock')
const emptyTitle = computed(() => result.value?.catalog_total === 0 ? t('common.noProductsYet') : state.value.q ? t('productList.noSearch') : t('productList.noFilters'))
const emptyHelp = computed(() => result.value?.catalog_total === 0 ? t('productList.firstProduct') : state.value.q ? t('productList.trySearch') : t('productList.tryFilters'))
</script>

<style scoped>
.product-list-table { table-layout: fixed; }
.product-list-table th { padding: .75rem; text-align: start; font-weight: 600; }
.product-list-table td { padding: .75rem; vertical-align: top; }
.product-list-table tbody tr { border-bottom: 1px solid var(--border, #f3f4f6); }
.product-list-table th:first-child { width: 30%; }
.product-list-table th:nth-child(2) { width: 16%; }
.product-list-table th:nth-child(6) { width: 7%; }
@media (max-width: 1023px) {
  .product-list-table, .product-list-table tbody { display: block; }
  .product-list-table thead, .product-list-table .category-cell { display: none; }
  .product-list-table tbody tr { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: .5rem 1rem; padding: 1rem; }
  .product-list-table td { display: block; padding: 0; }
  .product-list-table .product-cell { grid-column: 1 / -1; margin-bottom: .25rem; }
  .product-list-table .publication-cell, .product-list-table .options-cell { text-align: end; }
  .product-list-table .actions-cell { grid-column: 1 / -1; margin-top: .25rem; }
  .product-list-table .actions-cell > div { justify-content: flex-end; }
}
</style>
