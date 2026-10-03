<template>
  <header ref="header" class="store-header" @keydown.esc="closeDepartments(true)">
    <div class="store-container store-header-main">
      <NuxtLinkLocale to="/" class="store-logo" :class="{ 'store-logo-default': siteLogoUrl === '/images/dashboard-logo.png' }" :aria-label="$t('common.valueHome', { value0: (siteName) })">
        <BrandLogo :settings="siteContent?.settings" :alt="siteName" />
      </NuxtLinkLocale>

      <LayoutSearchBar />

      <nav class="store-header-actions" :aria-label="$t('common.yourShopping')">
        <NuxtLinkLocale :to="ordersPath" class="store-header-action store-orders-action" :aria-label="$t('common.myOrders')">
          <Icon name="lucide:package" size="25" />
          <span class="store-action-copy"><small>{{ $t('common.trackManage') }}</small><strong>{{ $t('common.myOrders') }}</strong></span>
        </NuxtLinkLocale>
        <NuxtLinkLocale :to="customerAccountPath" class="store-header-action" :aria-label="customerUser ? $t('common.myAccount') : $t('common.signInToYourAccount')">
          <Icon name="lucide:user-round" size="25" />
          <span class="store-action-copy"><small>{{ customerUser ? $t('common.welcomeBack') : $t('common.helloSignIn') }}</small><strong>{{ $t('common.account') }}</strong></span>
        </NuxtLinkLocale>
        <NuxtLinkLocale to="/cart" class="store-header-action store-cart-action" :aria-label="$t('common.cartValueItems', { value0: (itemCount) })">
          <span class="store-cart-icon">
            <Icon name="lucide:shopping-cart" size="27" />
            <span class="store-cart-count">{{ itemCount > 99 ? '99+' : itemCount }}</span>
          </span>
          <span class="store-action-copy"><small>{{ $t('common.myCart') }}</small><strong>{{ formattedSubtotal }} <span class="store-cart-currency">EGP</span></strong></span>
        </NuxtLinkLocale>
      </nav>
    </div>

    <div class="store-department-bar">
      <nav class="store-container store-department-nav" :aria-label="$t('common.shopNavigation')">
        <div v-if="departmentsEnabled" class="store-department-trigger-wrap">
          <button ref="departmentButton" type="button" class="store-department-trigger" :aria-expanded="departmentsOpen" aria-controls="store-departments" @click="departmentsOpen = !departmentsOpen">
            <Icon name="lucide:layout-grid" size="19" />
            <span>{{ $t('common.departments') }}</span>
            <Icon :name="departmentsOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'" size="16" />
          </button>
        </div>
        <div class="store-nav-scroll no-scrollbar">
          <NuxtLinkLocale to="/search" class="store-nav-link store-nav-link-bold" :class="{ 'store-nav-link-active': isShopAllActive }" :aria-current="isShopAllActive ? 'page' : false">{{ $t('common.shopAll') }}</NuxtLinkLocale>
          <NuxtLinkLocale :to="{ path: '/search', query: { sort: 'latest' } }" class="store-nav-link" :class="{ 'store-nav-link-active': route.path === '/search' && route.query.sort === 'latest' }" :aria-current="route.path === '/search' && route.query.sort === 'latest' ? 'page' : false">{{ $t('common.newArrivals') }}</NuxtLinkLocale>
          <NuxtLinkLocale v-for="category in headerCategories.slice(0, 5)" :key="category.id" :to="{ path: '/search', query: { category: category.slug } }" class="store-nav-link" :class="{ 'store-nav-link-active': route.path === '/search' && route.query.category === category.slug }" :aria-current="route.path === '/search' && route.query.category === category.slug ? 'page' : false">
            {{ categoryName(category) }}
          </NuxtLinkLocale>
          <template v-for="link in extraHeaderLinks" :key="link.id">
            <a v-if="isExternalUrl(link.url)" :href="link.url" target="_blank" rel="noreferrer" class="store-nav-link">{{ link.is_default ? $uiLabel(link.label) : link.label }}</a>
            <NuxtLinkLocale v-else :to="link.url || '/'" class="store-nav-link">{{ link.is_default ? $uiLabel(link.label) : link.label }}</NuxtLinkLocale>
          </template>
          <NuxtLinkLocale v-for="page in customPages" :key="page.id" :to="`/${page.path}`" class="store-nav-link" :class="{ 'store-nav-link-active': route.path === `/${page.path}` }" :aria-current="route.path === `/${page.path}` ? 'page' : false">{{ page.title }}</NuxtLinkLocale>
        </div>

        <div v-if="departmentsOpen" id="store-departments" class="store-departments-panel">
          <div class="store-departments-heading"><strong>{{ $t('common.shopByDepartment') }}</strong><button type="button" :aria-label="$t('common.closeDepartments')" @click="closeDepartments(true)"><Icon name="lucide:x" size="20" /></button></div>
          <NuxtLinkLocale to="/search" class="store-department-item" @click="closeDepartments()"><Icon name="lucide:layout-grid" size="20" /><span>{{ $t('common.allProducts') }}</span><Icon name="lucide:arrow-right" size="17" class="directional-icon" /></NuxtLinkLocale>
          <NuxtLinkLocale v-for="category in headerCategories" :key="category.id" :to="{ path: '/search', query: { category: category.slug } }" class="store-department-item" @click="closeDepartments()">
            <Icon :name="getStoreCategoryIcon(category.name)" size="19" /><span>{{ categoryName(category) }}</span><Icon name="lucide:chevron-right" size="16" class="directional-icon" />
          </NuxtLinkLocale>
          <p v-if="!headerCategories.length" class="store-department-empty">{{ $t('layout.NavBar.seeAllProductsInTheStore') }}</p>
        </div>
      </nav>
    </div>
  </header>
</template>

<script setup>
const { categoryName } = useCategoryLocale()

const { intlLocale } = useUiLocale()

import { getStoreCategoryIcon, getStoreImageUrl } from '~/utils/storefront'
const route = useUiRoute()
const customerUser = useSupabaseUser()
const { data: siteContent } = await useSiteContent()
const { itemCount, subtotal, loadCart } = useCart()

const header = ref(null)
const departmentButton = ref(null)
const departmentsOpen = ref(false)
const isShopAllActive = computed(() => route.path === '/search' && !Object.keys(route.query).length)
const siteName = computed(() => siteContent.value?.settings?.site_name || 'ELcomputer')
const siteLogoUrl = computed(() => getStoreImageUrl(siteContent.value?.settings?.site_logo_url) || '/images/dashboard-logo.png')
const headerCategories = computed(() => siteContent.value?.navbarCategories || [])
const customerAccountPath = computed(() => customerUser.value ? '/account' : '/login')
const ordersPath = computed(() => customerUser.value ? '/account/orders' : { path: '/login', query: { redirect: '/account/orders' } })
const formattedSubtotal = computed(() => new Intl.NumberFormat(intlLocale.value, { maximumFractionDigits: 2 }).format(subtotal.value))
const departmentsEnabled = computed(() => (siteContent.value?.headerLinks || []).some((link) => link.link_type === 'categories-dropdown'))
const extraHeaderLinks = computed(() => (siteContent.value?.headerLinks || []).filter((link) => link.link_type !== 'categories-dropdown' && link.default_key !== 'home'))
const customPages = computed(() => siteContent.value?.customPages || [])
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
