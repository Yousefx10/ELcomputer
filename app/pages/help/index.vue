<script setup>
const route = useRoute()
const searchInput = ref(String(route.query.q || ''))
const searchQuery = computed(() => String(route.query.q || '').trim())
const categoryQuery = computed(() => String(route.query.category || '').trim())
const { data, pending, error } = await useFetch('/api/help', {
  query: computed(() => ({ q: searchQuery.value, category: categoryQuery.value })),
  watch: [searchQuery, categoryQuery]
})
const categories = computed(() => data.value?.categories || [])
const articles = computed(() => data.value?.articles || [])
const selectedCategory = computed(() => categories.value.find(item => item.slug === categoryQuery.value))
const submitSearch = () => navigateTo({ path: '/help', query: { ...(categoryQuery.value ? { category: categoryQuery.value } : {}), ...(searchInput.value.trim() ? { q: searchInput.value.trim() } : {}) } })
const categoryUrl = slug => ({ path: '/help', query: { ...(slug ? { category: slug } : {}), ...(searchQuery.value ? { q: searchQuery.value } : {}) } })
const articleUrl = article => `/help/${categories.value.find(item => item.id === article.category_id)?.slug || 'other'}/${article.slug}`
useHead({ title: 'Help Center' })
</script>

<template>
  <div class="min-h-screen bg-slate-50 pb-20">
    <section class="border-b border-slate-200 bg-white py-14 sm:py-20">
      <div class="mx-auto max-w-4xl px-5 text-center">
        <p class="text-sm font-bold uppercase tracking-widest text-blue-600">Help Center</p>
        <h1 class="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">How can we help?</h1>
        <p class="mt-4 text-slate-600">Find answers about orders, delivery, returns, and more.</p>
        <form class="mx-auto mt-8 flex max-w-2xl gap-2" role="search" @submit.prevent="submitSearch">
          <label class="relative min-w-0 flex-1"><span class="sr-only">Search help articles</span><Icon name="lucide:search" size="19" class="absolute start-4 top-1/2 -translate-y-1/2 text-slate-400" /><input v-model="searchInput" type="search" maxlength="120" placeholder="Search help articles" class="min-h-12 w-full rounded-xl border border-slate-300 bg-white ps-11 pe-4 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>
          <button type="submit" class="min-h-12 rounded-xl bg-blue-600 px-5 font-bold text-white hover:bg-blue-700">Search</button>
        </form>
      </div>
    </section>

    <div class="mx-auto max-w-6xl px-5 pt-10">
      <div v-if="error" class="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700" role="alert">Could not load help articles. Please try again.</div>
      <template v-else>
        <div class="mb-8 flex flex-wrap items-center justify-between gap-3"><h2 class="text-2xl font-bold text-slate-900">{{ selectedCategory?.name || (searchQuery ? 'Search results' : 'Browse topics') }}</h2><NuxtLink to="/account/support" class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 font-semibold text-blue-700 hover:bg-blue-50"><Icon name="lucide:life-buoy" size="18" /> Contact support</NuxtLink></div>
        <div v-if="!searchQuery" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NuxtLink v-for="category in categories" :key="category.id" :to="categoryUrl(category.slug)" class="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-sm" :aria-current="category.slug === categoryQuery ? 'page' : undefined"><span class="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon name="lucide:book-open" size="20" /></span><h3 class="mt-4 font-bold text-slate-900">{{ category.name }}</h3><p class="mt-1 text-sm text-slate-500">{{ category.description }}</p></NuxtLink>
        </div>
        <div class="mt-10">
          <div class="mb-4 flex items-center justify-between"><h2 class="text-xl font-bold text-slate-900">{{ searchQuery ? `Results for “${searchQuery}”` : selectedCategory ? 'Articles' : 'Popular articles' }}</h2><NuxtLink v-if="categoryQuery" to="/help" class="text-sm font-semibold text-blue-700">All topics</NuxtLink></div>
          <p v-if="pending" class="text-sm text-slate-500">Loading articles...</p>
          <div v-else-if="articles.length" class="grid gap-3 sm:grid-cols-2">
            <NuxtLink v-for="article in articles" :key="article.id" :to="articleUrl(article)" class="group rounded-2xl border border-slate-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm"><span class="text-xs font-semibold uppercase tracking-wide text-blue-700">{{ categories.find(item => item.id === article.category_id)?.name }}</span><h3 class="mt-2 font-bold text-slate-900 group-hover:text-blue-700">{{ article.title }}</h3><p class="mt-2 text-sm text-slate-500">{{ article.summary }}</p></NuxtLink>
          </div>
          <div v-else class="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><p class="font-semibold text-slate-800">No articles found</p><p class="mt-2 text-sm text-slate-500">Try another search or contact support.</p><NuxtLink to="/account/support" class="mt-4 inline-block font-semibold text-blue-700">Create a ticket</NuxtLink></div>
        </div>
      </template>
    </div>
  </div>
</template>
