<template>
  <header ref="header" class="store-header" @keydown.esc="closeDepartments(true)">
    <div class="store-container store-header-main">
      <NuxtLink to="/" class="store-logo" :class="{ 'store-logo-default': siteLogoUrl === '/images/dashboard-logo.png' }" :aria-label="`${siteName} home`">
        <img :src="siteLogoUrl" :alt="siteName" />
      </NuxtLink>

      <form role="search" class="store-search" @submit.prevent="submitSearch">
        <label for="store-search-input" class="sr-only">Search products</label>
        <input id="store-search-input" v-model="searchQuery" type="search" placeholder="Search products and brands" autocomplete="off" />
        <button type="submit" aria-label="Search"><Icon name="lucide:search" size="23" /></button>
      </form>

      <nav class="store-header-actions" aria-label="Your shopping">
        <NuxtLink :to="ordersPath" class="store-header-action store-orders-action">
          <Icon name="lucide:package" size="25" />
          <span class="store-action-copy"><small>Track &amp; manage</small><strong>My orders</strong></span>
        </NuxtLink>
        <NuxtLink :to="customerAccountPath" class="store-header-action" :aria-label="customerUser ? 'My account' : 'Sign in to your account'">
          <Icon name="lucide:user-round" size="25" />
          <span class="store-action-copy"><small>{{ customerUser ? 'Welcome back' : 'Hello, sign in' }}</small><strong>Account</strong></span>
        </NuxtLink>
        <NuxtLink to="/cart" class="store-header-action store-cart-action" :aria-label="`Cart, ${itemCount} items`">
          <span class="store-cart-icon">
            <Icon name="lucide:shopping-cart" size="27" />
            <span class="store-cart-count">{{ itemCount > 99 ? '99+' : itemCount }}</span>
          </span>
          <span class="store-action-copy"><small>My cart</small><strong>{{ formattedSubtotal }} <span class="store-cart-currency">EGP</span></strong></span>
        </NuxtLink>
      </nav>
    </div>

    <div class="store-department-bar">
      <nav class="store-container store-department-nav" aria-label="Shop navigation">
        <div v-if="departmentsEnabled" class="store-department-trigger-wrap">
          <button ref="departmentButton" type="button" class="store-department-trigger" :aria-expanded="departmentsOpen" aria-controls="store-departments" @click="departmentsOpen = !departmentsOpen">
            <Icon name="lucide:layout-grid" size="19" />
            <span>Departments</span>
            <Icon :name="departmentsOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'" size="16" />
          </button>
        </div>
        <div class="store-nav-scroll no-scrollbar">
          <NuxtLink to="/search" class="store-nav-link store-nav-link-bold" :class="{ 'store-nav-link-active': isShopAllActive }" :aria-current="isShopAllActive ? 'page' : false">Shop all</NuxtLink>
          <NuxtLink :to="{ path: '/search', query: { sort: 'latest' } }" class="store-nav-link" :class="{ 'store-nav-link-active': route.path === '/search' && route.query.sort === 'latest' }" :aria-current="route.path === '/search' && route.query.sort === 'latest' ? 'page' : false">New arrivals</NuxtLink>
          <NuxtLink v-for="category in headerCategories.slice(0, 5)" :key="category.id" :to="{ path: '/search', query: { category: category.slug } }" class="store-nav-link" :class="{ 'store-nav-link-active': route.path === '/search' && route.query.category === category.slug }" :aria-current="route.path === '/search' && route.query.category === category.slug ? 'page' : false">
            {{ category.name }}
          </NuxtLink>
          <template v-for="link in extraHeaderLinks" :key="link.id">
            <a v-if="isExternalUrl(link.url)" :href="link.url" target="_blank" rel="noreferrer" class="store-nav-link">{{ link.label }}</a>
            <NuxtLink v-else :to="link.url || '/'" class="store-nav-link">{{ link.label }}</NuxtLink>
          </template>
        </div>

        <div v-if="departmentsOpen" id="store-departments" class="store-departments-panel">
          <div class="store-departments-heading"><strong>Shop by department</strong><button type="button" aria-label="Close departments" @click="closeDepartments(true)"><Icon name="lucide:x" size="20" /></button></div>
          <NuxtLink to="/search" class="store-department-item" @click="closeDepartments()"><Icon name="lucide:layout-grid" size="20" /><span>All products</span><Icon name="lucide:arrow-right" size="17" /></NuxtLink>
          <NuxtLink v-for="category in headerCategories" :key="category.id" :to="{ path: '/search', query: { category: category.slug } }" class="store-department-item" @click="closeDepartments()">
            <Icon :name="getStoreCategoryIcon(category.name)" size="19" /><span>{{ category.name }}</span><Icon name="lucide:chevron-right" size="16" />
          </NuxtLink>
          <p v-if="!headerCategories.length" class="store-department-empty">See all products in the store.</p>
        </div>
      </nav>
    </div>
  </header>
</template>

<script setup>
import { getStoreCategoryIcon, getStoreImageUrl } from '~/utils/storefront'
const supabase = useSupabaseClient()
const route = useRoute()
const customerUser = useSupabaseUser()
const { data: siteContent } = await useSiteContent()
const { itemCount, subtotal, loadCart } = useCart()
const { data: categoriesData } = await useAsyncData('navbar-categories', async () => {
  const { data, error } = await supabase.from('categories').select('id, name, slug').order('name')
  return error ? [] : (data || [])
})

const header = ref(null)
const departmentButton = ref(null)
const departmentsOpen = ref(false)
const searchQuery = ref('')
const isShopAllActive = computed(() => route.path === '/search' && !Object.keys(route.query).length)
const siteName = computed(() => siteContent.value?.settings?.site_name || 'ELcomputer')
const siteLogoUrl = computed(() => getStoreImageUrl(siteContent.value?.settings?.site_logo_url) || '/images/dashboard-logo.png')
const headerCategories = computed(() => categoriesData.value || [])
const customerAccountPath = computed(() => customerUser.value ? '/account' : '/login')
const ordersPath = computed(() => customerUser.value ? '/account#orders' : { path: '/login', query: { redirect: '/account#orders' } })
const formattedSubtotal = computed(() => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(subtotal.value))
const departmentsEnabled = computed(() => (siteContent.value?.headerLinks || []).some((link) => link.link_type === 'categories-dropdown'))
const extraHeaderLinks = computed(() => (siteContent.value?.headerLinks || []).filter((link) => link.link_type !== 'categories-dropdown' && link.default_key !== 'home'))
const isExternalUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value)
const closeDepartments = (restoreFocus = false) => {
  departmentsOpen.value = false
  if (restoreFocus) departmentButton.value?.focus()
}
const onOutsidePointer = (event) => {
  if (!header.value?.contains(event.target)) closeDepartments()
}
const onFocusOutside = (event) => {
  if (!header.value?.contains(event.target)) closeDepartments()
}
const submitSearch = async () => {
  closeDepartments()
  const q = searchQuery.value.trim()
  await navigateTo({ path: '/search', query: q ? { q } : {} })
}
watch(() => route.query.q, (value) => { searchQuery.value = typeof value === 'string' ? value : '' }, { immediate: true })
watch(() => route.fullPath, () => closeDepartments())
onMounted(() => {
  loadCart()
  document.addEventListener('pointerdown', onOutsidePointer)
  document.addEventListener('focusin', onFocusOutside)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutsidePointer)
  document.removeEventListener('focusin', onFocusOutside)
})
</script>
