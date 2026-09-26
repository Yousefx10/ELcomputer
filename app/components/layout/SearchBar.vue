<template>
  <div ref="root" class="store-search-wrap">
    <form role="search" class="store-search" @submit.prevent="submitSearch">
      <label for="store-search-input" class="sr-only">Search products</label>
      <input
        id="store-search-input"
        v-model="searchQuery"
        type="search"
        placeholder="Search products and brands"
        autocomplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="store-search-suggestions"
        :aria-expanded="suggestionsOpen"
        :aria-activedescendant="activeOptionId || undefined"
        @focus="openSuggestions"
        @keydown.down.prevent="moveSelection(1)"
        @keydown.up.prevent="moveSelection(-1)"
        @keydown.enter="selectActiveSuggestion"
        @keydown.esc.stop="closeSuggestions"
      />
      <button type="submit" aria-label="Search"><Icon name="lucide:search" size="23" /></button>
    </form>

    <div v-if="suggestionsOpen" id="store-search-suggestions" class="store-search-suggestions" role="listbox" aria-label="Search suggestions">
      <p v-if="suggestionsLoading" class="store-search-suggestion-state" role="status">Finding products…</p>

      <template v-else>
        <div v-if="categorySuggestions.length" class="store-search-suggestion-section">
          <p class="store-search-suggestion-heading">Categories</p>
          <NuxtLink
            v-for="category in categorySuggestions"
            :id="getOptionId(`category-${category.id}`)"
            :key="category.id"
            :to="{ path: '/search', query: { category: category.slug } }"
            class="store-search-category-suggestion"
            :class="{ 'store-search-suggestion-active': activeSuggestionKey === `category-${category.id}` }"
            role="option"
            :aria-selected="activeSuggestionKey === `category-${category.id}`"
            @mouseenter="activeSuggestionKey = `category-${category.id}`"
            @click="closeSuggestions"
          >
            <Icon name="lucide:layout-grid" size="17" />
            <span>{{ category.name }}</span>
            <small>Category</small>
          </NuxtLink>
        </div>

        <div v-if="brandSuggestions.length" class="store-search-suggestion-section">
          <p class="store-search-suggestion-heading">Brands</p>
          <NuxtLink
            v-for="brand in brandSuggestions"
            :id="getOptionId(`brand-${brand.id}`)"
            :key="brand.id"
            :to="{ path: '/search', query: { brand: brand.slug } }"
            class="store-search-category-suggestion"
            :class="{ 'store-search-suggestion-active': activeSuggestionKey === `brand-${brand.id}` }"
            role="option"
            :aria-selected="activeSuggestionKey === `brand-${brand.id}`"
            @mouseenter="activeSuggestionKey = `brand-${brand.id}`"
            @click="closeSuggestions"
          >
            <Icon name="lucide:badge" size="17" />
            <span>{{ brand.name }}</span>
            <small>Brand</small>
          </NuxtLink>
        </div>

        <div v-if="productSuggestions.length" class="store-search-suggestion-section">
          <p class="store-search-suggestion-heading">Products</p>
          <NuxtLink
            v-for="product in productSuggestions"
            :id="getOptionId(`product-${product.id}`)"
            :key="product.id"
            :to="`/products/${product.slug}`"
            class="store-search-product-suggestion"
            :class="{ 'store-search-suggestion-active': activeSuggestionKey === `product-${product.id}` }"
            role="option"
            :aria-selected="activeSuggestionKey === `product-${product.id}`"
            @mouseenter="activeSuggestionKey = `product-${product.id}`"
            @click="closeSuggestions"
          >
            <span class="store-search-suggestion-image">
              <img v-if="getStoreImageUrl(product.image_url)" :src="getStoreImageUrl(product.image_url)" :alt="product.title" />
              <Icon v-else name="lucide:package" size="19" />
            </span>
            <span class="store-search-suggestion-copy">
              <strong>{{ product.title }}</strong>
              <small>{{ product.brand?.name || product.category?.name || 'Store product' }}</small>
            </span>
            <span class="store-search-suggestion-price">{{ formatPrice(product.price) }}</span>
          </NuxtLink>
        </div>

        <p v-if="hasSearchTerm && !hasSuggestions" class="store-search-suggestion-state">No quick matches found.</p>

        <button v-if="hasSearchTerm" type="button" class="store-search-view-all" @click="submitSearch">
          <Icon name="lucide:search" size="16" />
          <span>See all results for “{{ normalizedQuery }}”</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { getStoreImageUrl } from '~/utils/storefront'

const route = useRoute()
const supabase = useSupabaseClient()
const { data: siteContent } = await useSiteContent()

const root = ref(null)
const searchQuery = ref('')
const productSuggestions = ref([])
const brandSuggestions = ref([])
const suggestionsLoading = ref(false)
const suggestionsOpenRequested = ref(false)
const activeSuggestionKey = ref('')
let searchTimer
let searchController

const normalizedQuery = computed(() => String(searchQuery.value || '').trim().replace(/\s+/g, ' '))
const hasSearchTerm = computed(() => normalizedQuery.value.length >= 2)
const categorySuggestions = computed(() => {
  if (!hasSearchTerm.value) return []
  const query = normalizedQuery.value.toLocaleLowerCase()
  return (siteContent.value?.navbarCategories || [])
    .filter(category => String(category.name || '').toLocaleLowerCase().includes(query))
    .slice(0, 3)
})
const suggestionItems = computed(() => [
  ...categorySuggestions.value.map(category => ({ key: `category-${category.id}`, to: { path: '/search', query: { category: category.slug } } })),
  ...brandSuggestions.value.map(brand => ({ key: `brand-${brand.id}`, to: { path: '/search', query: { brand: brand.slug } } })),
  ...productSuggestions.value.map(product => ({ key: `product-${product.id}`, to: `/products/${product.slug}` }))
])
const hasSuggestions = computed(() => suggestionItems.value.length > 0)
const suggestionsOpen = computed(() => suggestionsOpenRequested.value && hasSearchTerm.value)
const activeOptionId = computed(() => activeSuggestionKey.value ? getOptionId(activeSuggestionKey.value) : '')

const getOptionId = key => `store-search-option-${key}`
const formatPrice = value => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value || 0))} EGP`

const closeSuggestions = () => {
  suggestionsOpenRequested.value = false
  activeSuggestionKey.value = ''
}

const openSuggestions = () => {
  suggestionsOpenRequested.value = true
  if (hasSearchTerm.value && !productSuggestions.value.length && !suggestionsLoading.value) queueSuggestions()
}

const loadSuggestions = async () => {
  const query = normalizedQuery.value
  if (query.length < 2) {
    productSuggestions.value = []
    brandSuggestions.value = []
    suggestionsLoading.value = false
    return
  }

  searchController?.abort()
  searchController = new AbortController()
  const safeQuery = query.replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim()
  if (!safeQuery) {
    brandSuggestions.value = []
    productSuggestions.value = []
    suggestionsLoading.value = false
    return
  }

  suggestionsLoading.value = true
  try {
    const matchingCategoryIds = categorySuggestions.value.map(category => category.id)
    const brandsResult = await supabase
      .from('brands')
      .select('id, name, slug')
      .ilike('name', `%${safeQuery}%`)
      .order('name')
      .limit(3)
      .abortSignal(searchController.signal)

    if (brandsResult.error) throw brandsResult.error
    const matchingBrands = brandsResult.data || []
    const filters = [
      `title.ilike.%${safeQuery}%`,
      `sku.ilike.%${safeQuery}%`,
      `description.ilike.%${safeQuery}%`,
      ...matchingCategoryIds.map(id => `category_id.eq.${id}`),
      ...matchingBrands.map(brand => `brand_id.eq.${brand.id}`)
    ]
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        title,
        slug,
        image_url,
        price,
        stock_quantity,
        category:categories (id, name, slug),
        brand:brands (id, name, slug)
      `)
      .eq('is_published', true)
      .or(filters.join(','))
      .order('popularity_score', { ascending: false })
      .limit(6)
      .abortSignal(searchController.signal)

    if (error) throw error
    if (query === normalizedQuery.value) {
      brandSuggestions.value = matchingBrands
      productSuggestions.value = data || []
    }
  } catch (error) {
    if (error?.name !== 'AbortError') {
      brandSuggestions.value = []
      productSuggestions.value = []
    }
  } finally {
    if (query === normalizedQuery.value) suggestionsLoading.value = false
  }
}

const queueSuggestions = () => {
  if (!import.meta.client) return
  clearTimeout(searchTimer)
  activeSuggestionKey.value = ''
  if (!hasSearchTerm.value) {
    productSuggestions.value = []
    brandSuggestions.value = []
    suggestionsLoading.value = false
    return
  }
  suggestionsLoading.value = true
  searchTimer = setTimeout(loadSuggestions, 180)
}

const moveSelection = direction => {
  if (!suggestionsOpen.value) openSuggestions()
  const items = suggestionItems.value
  if (!items.length) return
  const currentIndex = items.findIndex(item => item.key === activeSuggestionKey.value)
  const nextIndex = currentIndex < 0
    ? (direction > 0 ? 0 : items.length - 1)
    : (currentIndex + direction + items.length) % items.length
  activeSuggestionKey.value = items[nextIndex].key
}

const selectActiveSuggestion = async event => {
  const item = suggestionItems.value.find(suggestion => suggestion.key === activeSuggestionKey.value)
  if (!suggestionsOpen.value || !item) return
  event.preventDefault()
  closeSuggestions()
  await navigateTo(item.to)
}

const submitSearch = async () => {
  const q = normalizedQuery.value
  closeSuggestions()
  await navigateTo({ path: '/search', query: q ? { q } : {} })
}

const onOutsidePointer = event => {
  if (!root.value?.contains(event.target)) closeSuggestions()
}

watch(searchQuery, queueSuggestions)
watch(() => route.query.q, value => {
  searchQuery.value = typeof value === 'string' ? value : ''
}, { immediate: true })
watch(() => route.fullPath, closeSuggestions)

onMounted(() => document.addEventListener('pointerdown', onOutsidePointer))
onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  searchController?.abort()
  document.removeEventListener('pointerdown', onOutsidePointer)
})
</script>
