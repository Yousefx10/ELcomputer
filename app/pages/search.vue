<template>
  <div class="min-h-screen bg-gray-100 py-8">
    <div class="mx-auto max-w-7xl px-4 md:px-6">
      <div class="rounded-2xl bg-white p-6 shadow">
        <p class="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
          Store Search
        </p>

        <h1 class="mt-2 text-3xl font-bold text-gray-900 md:text-4xl">
          {{ pageTitle }}
        </h1>

        <p class="mt-2 text-sm text-gray-500">
          {{ resultsSummary }}
        </p>
      </div>

      <div v-if="error" class="mt-6 rounded-2xl bg-red-50 p-4 text-red-600 shadow-sm">
        {{ error.message }}
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside class="rounded-2xl bg-white p-5 shadow">
          <div class="space-y-5">
            <div>
              <h2 class="text-lg font-bold text-gray-900">Filters</h2>
              <p class="mt-1 text-sm text-gray-500">
                Narrow results by price, category, brand, and stock status.
              </p>
            </div>

            <div class="border-t pt-5">
              <label class="mb-3 block text-sm font-semibold text-gray-700">
                Price Range
              </label>

              <div class="mb-3 flex items-center justify-between text-sm text-gray-500">
                <span>{{ formatCurrency(filters.minPrice) }}</span>
                <span>{{ formatCurrency(filters.maxPrice) }}</span>
              </div>

              <input
                :value="filters.minPrice"
                type="range"
                :min="sliderMin"
                :max="filters.maxPrice"
                class="w-full"
                @input="updateMinPrice($event)"
              >

              <input
                :value="filters.maxPrice"
                type="range"
                :min="filters.minPrice"
                :max="sliderMax"
                class="mt-3 w-full"
                @input="updateMaxPrice($event)"
              >

              <div class="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label class="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Minimum
                  </label>

                  <input
                    :value="filters.minPrice"
                    type="number"
                    :min="sliderMin"
                    :max="filters.maxPrice"
                    class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                    @input="updateMinPrice($event)"
                  >
                </div>

                <div>
                  <label class="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Maximum
                  </label>

                  <input
                    :value="filters.maxPrice"
                    type="number"
                    :min="filters.minPrice"
                    :max="sliderMax"
                    class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                    @input="updateMaxPrice($event)"
                  >
                </div>
              </div>
            </div>

            <div class="border-t pt-5">
              <label class="mb-2 block text-sm font-semibold text-gray-700">
                Category
              </label>

              <select
                v-model="filters.category"
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              >
                <option value="">All categories</option>

                <option
                  v-for="category in categories"
                  :key="category.id"
                  :value="category.slug"
                >
                  {{ category.name }}
                </option>
              </select>
            </div>

            <div class="border-t pt-5">
              <label class="mb-2 block text-sm font-semibold text-gray-700">
                Brand
              </label>

              <select
                v-model="filters.brand"
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              >
                <option value="">All brands</option>

                <option
                  v-for="brand in brands"
                  :key="brand.id"
                  :value="brand.slug"
                >
                  {{ brand.name }}
                </option>
              </select>
            </div>

            <div class="border-t pt-5">
              <label class="mb-2 block text-sm font-semibold text-gray-700">
                Status
              </label>

              <select
                v-model="filters.status"
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              >
                <option value="">All products</option>
                <option value="instock">In Stock</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>

            <div class="flex gap-3 border-t pt-5">
              <button
                type="button"
                class="rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
                @click="applyFilters"
              >
                Apply Filters
              </button>

              <button
                type="button"
                class="rounded-lg bg-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-300"
                @click="clearFilters"
              >
                Clear
              </button>
            </div>
          </div>
        </aside>

        <section class="space-y-5">
          <div class="rounded-2xl bg-white p-5 shadow">
            <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div class="space-y-3">
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="chip in activeFilterChips"
                    :key="chip"
                    class="rounded-full bg-gray-100 px-3 py-2 text-sm text-gray-700"
                  >
                    {{ chip }}
                  </span>

                  <span
                    v-if="!activeFilterChips.length"
                    class="rounded-full bg-gray-100 px-3 py-2 text-sm text-gray-500"
                  >
                    No active filters
                  </span>
                </div>

                <p class="text-sm text-gray-500">
                  {{ totalCount }} product{{ totalCount === 1 ? '' : 's' }} found
                </p>
              </div>

              <div class="w-full md:w-64">
                <label class="mb-2 block text-sm font-semibold text-gray-700">
                  Sort By
                </label>

                <select
                  v-model="filters.sortBy"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                  @change="changeSort"
                >
                  <option
                    v-for="option in sortOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <div v-if="pending" class="rounded-2xl bg-white p-8 text-center text-gray-500 shadow">
            Loading results...
          </div>

          <div
            v-else-if="!products.length"
            class="rounded-2xl bg-white p-8 text-center text-gray-500 shadow"
          >
            No products match the current search and filters.
          </div>

          <div v-else class="rounded-2xl bg-white p-5 shadow">
            <div class="flex flex-wrap justify-center gap-5 lg:justify-start">
              <CardsProductCard
                v-for="product in products"
                :key="product.id"
                :product="product"
              />
            </div>

            <div
              v-if="totalPages > 1"
              class="mt-6 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"
            >
              <button
                type="button"
                :disabled="currentPage <= 1"
                class="rounded-lg px-4 py-3 text-sm font-medium"
                :class="currentPage > 1
                  ? 'bg-black text-white hover:bg-gray-800'
                  : 'cursor-not-allowed bg-gray-200 text-gray-400'"
                @click="goToPage(currentPage - 1)"
              >
                Previous
              </button>

              <p class="text-sm text-gray-500">
                Page {{ currentPage }} of {{ totalPages }}
              </p>

              <button
                type="button"
                :disabled="currentPage >= totalPages"
                class="rounded-lg px-4 py-3 text-sm font-medium"
                :class="currentPage < totalPages
                  ? 'bg-black text-white hover:bg-gray-800'
                  : 'cursor-not-allowed bg-gray-200 text-gray-400'"
                @click="goToPage(currentPage + 1)"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
const supabase = useSupabaseClient()
const route = useRoute()

const pageSize = 12
const defaultSort = 'relevance'
const defaultStatus = ''

const sortOptions = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'popularity', label: 'Popularity' },
  { value: 'average-rating', label: 'Average Rating' },
  { value: 'latest', label: 'Latest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' }
]

const validSortValues = new Set(sortOptions.map((option) => option.value))
const validStatusValues = new Set(['instock', 'unavailable'])

const filters = reactive({
  searchQuery: '',
  category: '',
  brand: '',
  status: defaultStatus,
  minPrice: 0,
  maxPrice: 0,
  sortBy: defaultSort
})

const normalizeTextValue = (value = '') => {
  return String(value).trim()
}

const normalizeSearchTerm = (value = '') => {
  return normalizeTextValue(value)
    .replace(/[%_]/g, ' ')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
}

const normalizePositiveNumber = (value, fallback = 0) => {
  const parsedValue = Number(value)

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return fallback
  }

  return parsedValue
}

const normalizePageValue = (value) => {
  const parsedValue = Number(value)

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    return 1
  }

  return parsedValue
}

const normalizeProductRecord = (product) => {
  return {
    ...product,
    category: product.categories || null,
    brand: product.brands || null
  }
}

const getRelevanceScore = (product, searchTerm) => {
  const normalizedTerm = searchTerm.toLowerCase()
  const title = String(product.title || '').toLowerCase()
  const brandName = String(product.brands?.name || '').toLowerCase()
  const categoryName = String(product.categories?.name || '').toLowerCase()
  const description = String(product.description || '').toLowerCase()
  const longDescription = String(product.long_description || '').toLowerCase()
  const sku = String(product.sku || '').toLowerCase()

  let score = 0

  if (title === normalizedTerm) {
    score += 200
  } else if (title.startsWith(normalizedTerm)) {
    score += 140
  } else if (title.includes(normalizedTerm)) {
    score += 100
  }

  if (brandName === normalizedTerm) {
    score += 90
  } else if (brandName.includes(normalizedTerm)) {
    score += 60
  }

  if (categoryName === normalizedTerm) {
    score += 80
  } else if (categoryName.includes(normalizedTerm)) {
    score += 50
  }

  if (sku === normalizedTerm) {
    score += 70
  } else if (sku.includes(normalizedTerm)) {
    score += 40
  }

  if (description.includes(normalizedTerm)) {
    score += 25
  }

  if (longDescription.includes(normalizedTerm)) {
    score += 15
  }

  if (product.stock_quantity > 0) {
    score += 2
  }

  return score
}

const normalizePriceRange = (minPrice, maxPrice, bounds) => {
  const normalizedMin = Math.max(bounds.min, Math.min(normalizePositiveNumber(minPrice, bounds.min), bounds.max))
  const normalizedMax = Math.min(bounds.max, Math.max(normalizePositiveNumber(maxPrice, bounds.max), normalizedMin))

  return {
    minPrice: normalizedMin,
    maxPrice: normalizedMax
  }
}

const createMissingSortColumnError = (columnLabel) => {
  return createError({
    statusCode: 500,
    statusMessage: 'Database update required',
    message: `Run the Supabase SQL update for ${columnLabel}, then refresh this page.`
  })
}

const applySortOrder = (query, selectedSort) => {
  if (selectedSort === 'popularity') {
    return query.order('popularity_score', { ascending: false })
  }

  if (selectedSort === 'average-rating') {
    return query.order('average_rating', { ascending: false })
  }

  if (selectedSort === 'price-asc') {
    return query.order('price', { ascending: true })
  }

  if (selectedSort === 'price-desc') {
    return query.order('price', { ascending: false })
  }

  return query.order('created_at', { ascending: false })
}

const throwSortErrorIfNeeded = (selectedSort, queryError) => {
  if (selectedSort === 'popularity' && /popularity_score/i.test(queryError?.message || '')) {
    throw createMissingSortColumnError('popularity sorting')
  }

  if (selectedSort === 'average-rating' && /average_rating/i.test(queryError?.message || '')) {
    throw createMissingSortColumnError('average rating sorting')
  }

  throw queryError
}

const { data: searchPageData, pending, error } = await useAsyncData(
  () => `store-search-${route.fullPath}`,
  async () => {
    const [categoriesResult, brandsResult, minPriceResult, maxPriceResult] = await Promise.all([
      supabase
        .from('categories')
        .select('id, name, slug')
        .order('name'),
      supabase
        .from('brands')
        .select('id, name, slug, logo_url')
        .order('name'),
      supabase
        .from('products')
        .select('price')
        .eq('is_published', true)
        .order('price', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('products')
        .select('price')
        .eq('is_published', true)
        .order('price', { ascending: false })
        .limit(1)
        .maybeSingle()
    ])

    if (categoriesResult.error) {
      throw categoriesResult.error
    }

    if (brandsResult.error) {
      throw brandsResult.error
    }

    if (minPriceResult.error) {
      throw minPriceResult.error
    }

    if (maxPriceResult.error) {
      throw maxPriceResult.error
    }

    const categories = categoriesResult.data || []
    const brands = brandsResult.data || []
    const minBound = normalizePositiveNumber(minPriceResult.data?.price, 0)
    const maxBound = Math.max(minBound, normalizePositiveNumber(maxPriceResult.data?.price, minBound))
    const priceBounds = {
      min: minBound,
      max: maxBound
    }

    const searchQuery = normalizeSearchTerm(route.query.q)
    const selectedCategory = normalizeTextValue(route.query.category)
    const selectedBrand = normalizeTextValue(route.query.brand)
    const selectedStatus = validStatusValues.has(String(route.query.status || ''))
      ? String(route.query.status)
      : defaultStatus
    const selectedSort = validSortValues.has(String(route.query.sort || ''))
      ? String(route.query.sort)
      : defaultSort
    const currentPage = normalizePageValue(route.query.page)
    const normalizedPriceRange = normalizePriceRange(route.query.min, route.query.max, priceBounds)

    const categoryJoin = selectedCategory ? '!inner' : ''
    const brandJoin = selectedBrand ? '!inner' : ''
    const selectFields = `
      id,
      title,
      slug,
      description,
      long_description,
      sku,
      price,
      old_price,
      image_url,
      stock_quantity,
      created_at,
      is_top_seller,
      is_featured,
      categories${categoryJoin} (
        id,
        name,
        slug
      ),
      brands${brandJoin} (
        id,
        name,
        slug,
        logo_url
      )
    `

    const buildBaseQuery = (withCount = false) => {
      let query = supabase
        .from('products')
        .select(selectFields, withCount ? { count: 'exact' } : undefined)
        .eq('is_published', true)
        .gte('price', normalizedPriceRange.minPrice)
        .lte('price', normalizedPriceRange.maxPrice)

      if (searchQuery) {
        query = query.or([
          `title.ilike.%${searchQuery}%`,
          `description.ilike.%${searchQuery}%`,
          `long_description.ilike.%${searchQuery}%`,
          `sku.ilike.%${searchQuery}%`
        ].join(','))
      }

      if (selectedCategory) {
        query = query.eq('categories.slug', selectedCategory)
      }

      if (selectedBrand) {
        query = query.eq('brands.slug', selectedBrand)
      }

      if (selectedStatus === 'instock') {
        query = query.gt('stock_quantity', 0)
      } else if (selectedStatus === 'unavailable') {
        query = query.eq('stock_quantity', 0)
      }

      return query
    }

    const queryState = {
      searchQuery,
      category: selectedCategory,
      brand: selectedBrand,
      status: selectedStatus,
      minPrice: normalizedPriceRange.minPrice,
      maxPrice: normalizedPriceRange.maxPrice,
      sortBy: selectedSort,
      currentPage
    }

    if (selectedSort === 'relevance' && searchQuery) {
      const { data, error } = await buildBaseQuery()

      if (error) {
        throw error
      }

      const rankedProducts = (data || [])
        .sort((firstProduct, secondProduct) => {
          const scoreDifference = getRelevanceScore(secondProduct, searchQuery) - getRelevanceScore(firstProduct, searchQuery)

          if (scoreDifference !== 0) {
            return scoreDifference
          }

          return String(secondProduct.created_at || '').localeCompare(String(firstProduct.created_at || ''))
        })

      const totalCount = rankedProducts.length
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
      const safePage = Math.min(currentPage, totalPages)
      const rangeStart = (safePage - 1) * pageSize
      const pageProducts = rankedProducts
        .slice(rangeStart, rangeStart + pageSize)
        .map(normalizeProductRecord)

      return {
        categories,
        brands,
        priceBounds,
        queryState: {
          ...queryState,
          currentPage: safePage
        },
        products: pageProducts,
        totalCount,
        totalPages
      }
    }

    let requestedPage = currentPage
    let rangeStart = (requestedPage - 1) * pageSize
    let resultsQuery = applySortOrder(buildBaseQuery(true), selectedSort)
      .range(rangeStart, rangeStart + pageSize - 1)

    let { data, error: resultsError, count } = await resultsQuery

    if (resultsError) {
      throwSortErrorIfNeeded(selectedSort, resultsError)
    }

    const totalCount = count || 0
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const safePage = Math.min(currentPage, totalPages)

    if (safePage !== requestedPage && totalCount > 0) {
      requestedPage = safePage
      rangeStart = (requestedPage - 1) * pageSize

      resultsQuery = applySortOrder(buildBaseQuery(true), selectedSort)
        .range(rangeStart, rangeStart + pageSize - 1)

      const rerunResult = await resultsQuery
      data = rerunResult.data
      resultsError = rerunResult.error

      if (resultsError) {
        throwSortErrorIfNeeded(selectedSort, resultsError)
      }
    }

    return {
      categories,
      brands,
      priceBounds,
      queryState: {
        ...queryState,
        currentPage: safePage
      },
      products: (data || []).map(normalizeProductRecord),
      totalCount,
      totalPages
    }
  },
  {
    watch: [() => route.fullPath]
  }
)

const categories = computed(() => searchPageData.value?.categories || [])
const brands = computed(() => searchPageData.value?.brands || [])
const priceBounds = computed(() => searchPageData.value?.priceBounds || { min: 0, max: 0 })
const products = computed(() => searchPageData.value?.products || [])
const totalCount = computed(() => searchPageData.value?.totalCount || 0)
const totalPages = computed(() => searchPageData.value?.totalPages || 1)
const currentPage = computed(() => searchPageData.value?.queryState?.currentPage || 1)
const sliderMin = computed(() => priceBounds.value.min)
const sliderMax = computed(() => Math.max(priceBounds.value.max, priceBounds.value.min))

const currentCategory = computed(() => {
  return categories.value.find((category) => category.slug === filters.category) || null
})

const currentBrand = computed(() => {
  return brands.value.find((brand) => brand.slug === filters.brand) || null
})

const pageTitle = computed(() => {
  if (filters.searchQuery) {
    return `Search results for "${filters.searchQuery}"`
  }

  if (currentCategory.value && currentBrand.value) {
    return `${currentCategory.value.name} / ${currentBrand.value.name}`
  }

  if (currentCategory.value) {
    return currentCategory.value.name
  }

  if (currentBrand.value) {
    return currentBrand.value.name
  }

  return 'All Products'
})

const resultsSummary = computed(() => {
  if (filters.searchQuery) {
    return 'Review matching products and refine the filters if needed.'
  }

  if (currentCategory.value || currentBrand.value) {
    return 'Browse products from the selected category or brand.'
  }

  return 'Use filters to narrow the product catalog.'
})

const activeFilterChips = computed(() => {
  const chips = []

  if (filters.searchQuery) {
    chips.push(`Search: ${filters.searchQuery}`)
  }

  if (currentCategory.value) {
    chips.push(`Category: ${currentCategory.value.name}`)
  }

  if (currentBrand.value) {
    chips.push(`Brand: ${currentBrand.value.name}`)
  }

  if (filters.status === 'instock') {
    chips.push('Status: In Stock')
  } else if (filters.status === 'unavailable') {
    chips.push('Status: Unavailable')
  }

  if (
    filters.minPrice !== priceBounds.value.min ||
    filters.maxPrice !== priceBounds.value.max
  ) {
    chips.push(`Price: ${formatCurrency(filters.minPrice)} - ${formatCurrency(filters.maxPrice)}`)
  }

  return chips
})

const syncFiltersFromQueryState = () => {
  const queryState = searchPageData.value?.queryState

  if (!queryState) {
    return
  }

  filters.searchQuery = queryState.searchQuery
  filters.category = queryState.category
  filters.brand = queryState.brand
  filters.status = queryState.status
  filters.minPrice = queryState.minPrice
  filters.maxPrice = queryState.maxPrice
  filters.sortBy = queryState.sortBy
}

watchEffect(syncFiltersFromQueryState)

const buildRouteQuery = (page = 1) => {
  const query = {}
  const normalizedSearchQuery = normalizeTextValue(filters.searchQuery)

  if (normalizedSearchQuery) {
    query.q = normalizedSearchQuery
  }

  if (filters.category) {
    query.category = filters.category
  }

  if (filters.brand) {
    query.brand = filters.brand
  }

  if (filters.status) {
    query.status = filters.status
  }

  if (filters.minPrice !== priceBounds.value.min) {
    query.min = String(filters.minPrice)
  }

  if (filters.maxPrice !== priceBounds.value.max) {
    query.max = String(filters.maxPrice)
  }

  if (filters.sortBy !== defaultSort) {
    query.sort = filters.sortBy
  }

  if (page > 1) {
    query.page = String(page)
  }

  return query
}

const getEventValue = (eventOrValue) => {
  if (typeof eventOrValue === 'string' || typeof eventOrValue === 'number') {
    return eventOrValue
  }

  return eventOrValue?.target?.value ?? ''
}

const updateMinPrice = (eventOrValue) => {
  filters.minPrice = Math.min(
    normalizePositiveNumber(getEventValue(eventOrValue), sliderMin.value),
    filters.maxPrice
  )
}

const updateMaxPrice = (eventOrValue) => {
  filters.maxPrice = Math.max(
    normalizePositiveNumber(getEventValue(eventOrValue), sliderMax.value),
    filters.minPrice
  )
}

const applyFilters = async () => {
  await navigateTo({
    path: '/search',
    query: buildRouteQuery(1)
  })
}

const clearFilters = async () => {
  filters.searchQuery = ''
  filters.category = ''
  filters.brand = ''
  filters.status = defaultStatus
  filters.minPrice = priceBounds.value.min
  filters.maxPrice = priceBounds.value.max
  filters.sortBy = defaultSort

  await navigateTo('/search')
}

const changeSort = async () => {
  await navigateTo({
    path: '/search',
    query: buildRouteQuery(1)
  })
}

const goToPage = async (page) => {
  await navigateTo({
    path: '/search',
    query: buildRouteQuery(page)
  })
}

const formatCurrency = (value) => {
  return `${Number(value || 0)} EGP`
}

useHead(() => ({
  title: pageTitle.value
}))
</script>
