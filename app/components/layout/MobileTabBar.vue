<script setup>
import { getStoreCategoryIcon } from '~/utils/storefront'
// Phone navigation: always within thumb reach while the header scrolls away.
// Product, cart and checkout pages keep their own bottom action instead.
const route = useUiRoute()
const { categoryName } = useCategoryLocale()
const identity = useCustomerIdentity()
const { data: siteContent } = await useSiteContent()
const { itemCount, isReady: cartReady } = useCart()
const hydrated = ref(false)
const sheetOpen = ref(false)
const sheet = ref(null)
const phoneSearch = usePhoneSearch()
const categories = computed(() => siteContent.value?.navbarCategories || [])
const accountPath = computed(() => hydrated.value && identity.accountId.value ? '/account' : '/login')
const visible = computed(() => !/^\/(products\/|cart$|checkout)/.test(route.path))
const active = computed(() => {
  const path = route.path
  if (phoneSearch.open.value) return 'search'
  if (sheetOpen.value) return 'categories'
  if (path === '/') return 'home'
  if (path === '/cart') return 'cart'
  if (path === '/login' || path.startsWith('/account')) return 'account'
  if (path === '/search' && route.query.q) return 'search'
  if (path === '/search' || path === '/shop' || path.startsWith('/brand/')) return 'categories'
  return ''
})
const count = computed(() => hydrated.value && cartReady.value ? itemCount.value : 0)
const focusSearch = () => {
  sheetOpen.value = false
  phoneSearch.toggle()
}
const openSheet = async () => {
  sheetOpen.value = !sheetOpen.value
  if (sheetOpen.value) { await nextTick(); sheet.value?.querySelector('a')?.focus() }
}
const closeSheet = () => { sheetOpen.value = false }
const onKey = event => { if (event.key === 'Escape' && sheetOpen.value) closeSheet() }
watch(() => route.fullPath, closeSheet)
watch(sheetOpen, open => { if (import.meta.client) document.documentElement.classList.toggle('store-sheet-open', open) })
onMounted(() => { hydrated.value = true; document.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { document.removeEventListener('keydown', onKey); document.documentElement.classList.remove('store-sheet-open') })
</script>

<template>
  <div v-if="visible" class="store-tabbar-root">
    <Transition name="store-sheet">
      <div v-if="sheetOpen" class="store-sheet-backdrop" @click.self="closeSheet">
        <div id="store-category-sheet" ref="sheet" class="store-sheet" role="dialog" aria-modal="true" :aria-label="$t('common.shopByDepartment')">
          <div class="store-sheet-handle" aria-hidden="true" />
          <div class="store-sheet-head"><strong>{{ $t('common.shopByDepartment') }}</strong><button type="button" :aria-label="$t('common.closeDepartments')" @click="closeSheet"><Icon name="lucide:x" size="20" /></button></div>
          <nav class="store-sheet-grid" :aria-label="$t('common.browseCategories')">
            <NuxtLinkLocale to="/search" class="store-sheet-tile store-sheet-tile-main"><Icon name="lucide:layout-grid" size="22" /><span>{{ $t('common.allProducts') }}</span></NuxtLinkLocale>
            <NuxtLinkLocale :to="{ path: '/search', query: { sort: 'latest' } }" class="store-sheet-tile"><Icon name="lucide:sparkles" size="22" /><span>{{ $t('common.newArrivals') }}</span></NuxtLinkLocale>
            <NuxtLinkLocale v-for="category in categories" :key="category.id" :to="{ path: '/search', query: { category: category.slug } }" class="store-sheet-tile"><Icon :name="getStoreCategoryIcon(category.name)" size="22" /><span>{{ categoryName(category) }}</span></NuxtLinkLocale>
          </nav>
        </div>
      </div>
    </Transition>
    <nav class="store-tabbar" :aria-label="$t('common.yourShopping')">
      <NuxtLinkLocale to="/" class="store-tab" :aria-current="active === 'home' ? 'page' : undefined"><Icon name="lucide:house" size="22" /><span>{{ $t('common.home') }}</span></NuxtLinkLocale>
      <button type="button" class="store-tab" :aria-current="active === 'categories' ? 'true' : undefined" :aria-expanded="sheetOpen" aria-controls="store-category-sheet" @click="openSheet"><Icon name="lucide:layout-grid" size="22" /><span>{{ $t('common.categories') }}</span></button>
      <button type="button" class="store-tab" :aria-current="active === 'search' ? 'true' : undefined" :aria-expanded="phoneSearch.open.value" aria-controls="store-search-input" @click="focusSearch"><Icon name="lucide:search" size="22" /><span>{{ $t('common.search') }}</span></button>
      <NuxtLinkLocale to="/cart" class="store-tab" :aria-current="active === 'cart' ? 'page' : undefined" :aria-label="count ? $t('common.cartValueItems', { value0: count }) : undefined"><span class="store-tab-icon"><Icon name="lucide:shopping-cart" size="22" /><span v-if="count" class="store-tab-badge">{{ count > 99 ? '99+' : count }}</span></span><span>{{ $t('common.cart') }}</span></NuxtLinkLocale>
      <NuxtLinkLocale :to="accountPath" class="store-tab" :aria-current="active === 'account' ? 'page' : undefined"><Icon name="lucide:user-round" size="22" /><span>{{ $t('common.account') }}</span></NuxtLinkLocale>
    </nav>
  </div>
</template>
