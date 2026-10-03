<template>
  <div class="store-container store-home">
    <nav class="store-discovery" :aria-label="$t('common.exploreProducts')">
      <p class="store-discovery-label">{{ $t('common.browseProducts') }}</p>
      <div class="store-discovery-links no-scrollbar">
        <NuxtLinkLocale :to="{ path: '/search', query: { sort: 'latest' } }" class="store-chip">{{ $t('common.newArrivals') }}</NuxtLinkLocale>
        <NuxtLinkLocale v-for="category in topCategories" :key="category.id" :to="{ path: '/search', query: { category: category.slug } }" class="store-chip">{{ category.name }}</NuxtLinkLocale>
        <NuxtLinkLocale :to="{ path: '/search', query: { status: 'instock' } }" class="store-chip">{{ $t('common.inStockNow') }}</NuxtLinkLocale>
      </div>
    </nav>

    <h1 v-if="hasCustomHero || !heroEnabled" class="sr-only">{{ $t('home.valueComputerAccessories', { value0: (siteContent?.settings?.site_name || 'ELcomputer') }) }}</h1>
    <div v-if="heroEnabled" class="store-hero-grid">
      <CardsHeroCard />
      <div class="store-hero-side">
        <NuxtLinkLocale v-for="(tile, index) in discoveryTiles" :key="index" :to="tile.to" class="store-promo-tile">
          <div class="store-promo-copy">
            <p>{{ tile.eyebrow }}</p>
            <h2>{{ tile.title }}</h2>
            <span>{{ $t('common.shopNow') }} <Icon name="lucide:arrow-right" size="14" class="directional-icon" /></span>
          </div>
          <img v-if="tile.image" :src="tile.image" alt="" />
          <Icon v-else :name="tile.icon" />
        </NuxtLinkLocale>
      </div>
    </div>

    <nav class="store-service-strip" :aria-label="$t('common.shoppingShortcuts')">
      <NuxtLinkLocale :to="{ path: '/search', query: { status: 'instock' } }"><Icon name="lucide:package-check" size="23" /><span>{{ $t('common.findInStockGear') }}</span></NuxtLinkLocale>
      <NuxtLinkLocale :to="ordersPath"><Icon name="lucide:truck" size="23" /><span>{{ $t('common.trackYourOrders') }}</span></NuxtLinkLocale>
      <NuxtLinkLocale to="/contact"><Icon name="lucide:headphones" size="23" /><span>{{ $t('common.talkToOurTeam') }}</span></NuxtLinkLocale>
    </nav>

    <div v-if="homeError" class="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">{{ $t('home.weCouldnTLoadProductsPleaseRefreshAndTryAgain') }}</div>
    <LayoutPageLoading v-else-if="homePending && homeHydrated" :label="$t('common.loadingProducts')" class="mt-8" />
    <TopCategories :categories="topCategories" />
    <HomeProductSection v-if="featuredProducts.length" :title="$t('common.storePicks')" :products="featuredProducts" />
    <CardsBanner v-if="bannerAds.bannerAd1" v-bind="bannerAds.bannerAd1" />
    <OfferSlider />
    <HomeProductSection v-if="topSellerProducts.length" :title="$t('common.moreProducts')" :products="topSellerProducts" />
    <CardsBanner v-if="bannerAds.bannerAd2" v-bind="bannerAds.bannerAd2" />
    <FeaturedBrands v-if="featuredBrands.length" :title="$t('common.shopByBrand')" :brands="featuredBrands" />

    <section v-for="category in categorySections" :key="category.id">
      <HomeProductSection :title="category.name" :products="category.products" :to="{ path: '/search', query: { category: category.slug } }" />
    </section>

    <HomeCustomerReviews v-if="homepageReviewsEnabled" :show-view-all="homepageReviewsViewAllEnabled" />
    <NpsSurvey source="homepage" :store-name="siteContent?.settings?.site_name || 'ELcomputer'" />
  </div>
</template>

<script setup>
import { siteSchema, publicSiteUrl } from '~/utils/seo'
const { uiLabel } = useUiLocale()

import { getConfiguredStoreImageUrl, getStoreCategoryIcon, getStoreImageUrl } from '~/utils/storefront'
import FeaturedBrands from '~/components/cards/FeaturedBrands.vue'
import TopCategories from '~/components/cards/TopCategories.vue'
import OfferSlider from '~/components/layout/OfferSlider.vue'

const supabase = useSupabaseClient()
const { data: siteContent } = await useSiteContent()
const homeHydrated = ref(false)
onMounted(() => { homeHydrated.value = true })

const { data: homeData, pending: homePending, error: homeError } = await useAsyncData('store-home', async () => {
  const [productsResult, categoriesResult, brandsResult] = await Promise.all([
    supabase
      .from('storefront_products')
      .select(`
        id,
        title,
        slug,
        description,
        price,
        old_price,
        image_url,
        stock_quantity,
        is_serialized,
        selling_mode,
        is_featured,
        is_top_seller,
        category:categories (
          id,
          name,
          name_ar,
          slug
        ),
        brand:brands (
          id,
          name,
          slug,
          logo_url
        )
      `)
      .eq('is_published', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('categories')
      .select('id, name, name_ar, slug, image_url')
      .order('name'),
    supabase
      .from('brands')
      .select('id, name, slug, logo_url')
      .order('name')
  ])

  if (productsResult.error) {
    throw productsResult.error
  }

  if (categoriesResult.error) {
    throw categoriesResult.error
  }

  if (brandsResult.error) {
    throw brandsResult.error
  }

  const products = productsResult.data || []
  const categories = categoriesResult.data || []
  const brands = brandsResult.data || []

  const categoriesWithProducts = categories
    .map((category) => {
      const categoryProducts = products
        .filter((product) => product.category?.id === category.id)
        .slice(0, 8)

      return {
        ...category,
        productCount: products.filter((product) => product.category?.id === category.id).length,
        products: categoryProducts,
        displayImageUrl: getStoreImageUrl(category.image_url) || categoryProducts.find((product) => getStoreImageUrl(product.image_url))?.image_url || ''
      }
    })
    .filter((category) => category.productCount > 0)
    .sort((firstCategory, secondCategory) => secondCategory.productCount - firstCategory.productCount)

  const featuredProducts = products.filter((product) => product.is_featured)
  const topSellerProducts = products.filter((product) => product.is_top_seller)
  const usedBrandIds = new Set(products.map((product) => product.brand?.id).filter(Boolean))
  return {
    latestImage: products.find((product) => getStoreImageUrl(product.image_url))?.image_url || '',
    featuredProducts: (featuredProducts.length ? featuredProducts : products).slice(0, 8),
    topSellerProducts: (topSellerProducts.length ? topSellerProducts : products).slice(0, 8),
    topCategories: categoriesWithProducts.slice(0, 6),
    categorySections: categoriesWithProducts.slice(0, 3),
    featuredBrands: brands.filter((brand) => usedBrandIds.has(brand.id))
  }
}, {
  lazy: true,
  server: false,
  default: () => ({
    latestImage: '',
    featuredProducts: [],
    topSellerProducts: [],
    topCategories: [],
    categorySections: [],
    featuredBrands: []
  })
})

const customerUser = useSupabaseUser()
const ordersPath = computed(() => customerUser.value ? '/account/orders' : { path: '/login', query: { redirect: '/account/orders' } })
const heroEnabled = computed(() => siteContent.value?.settings?.hero_enabled ?? true)
const hasCustomHero = computed(() => (siteContent.value?.heroBanners || []).some((banner) => getConfiguredStoreImageUrl(banner.image_url) && banner.id !== 'default-hero-banner'))
const discoveryTiles = computed(() => [
  {
    eyebrow: uiLabel('Shop by category'),
    title: topCategories.value[0]?.name || uiLabel('Computer accessories'),
    image: topCategories.value[0]?.displayImageUrl,
    icon: getStoreCategoryIcon(topCategories.value[0]?.name),
    to: topCategories.value[0] ? { path: '/search', query: { category: topCategories.value[0].slug } } : '/search'
  },
  {
    eyebrow: uiLabel('New arrivals'),
    title: uiLabel('New to the store'),
    image: homeData.value?.latestImage || '',
    icon: 'lucide:headphones',
    to: { path: '/search', query: { sort: 'latest' } }
  }
])

const featuredProducts = computed(() => homeData.value?.featuredProducts || [])
const topSellerProducts = computed(() => homeData.value?.topSellerProducts || [])
const topCategories = computed(() => homeData.value?.topCategories || [])
const categorySections = computed(() => homeData.value?.categorySections || [])
const featuredBrands = computed(() => homeData.value?.featuredBrands || [])
const homepageReviewsEnabled = computed(() => {
  return siteContent.value?.settings?.homepage_reviews_enabled ?? true
})
const homepageReviewsViewAllEnabled = computed(() => {
  return homepageReviewsEnabled.value
    && (siteContent.value?.settings?.homepage_reviews_view_all_enabled ?? true)
})
const bannerAds = computed(() => {
  const settings = siteContent.value?.settings || {}

  return {
    bannerAd1: settings.banner_ad_1_enabled && settings.banner_ad_1_image_url
      ? {
          imageUrl: settings.banner_ad_1_image_url,
          linkUrl: settings.banner_ad_1_link_url || '',
          altText: 'Store promotion'
        }
      : null,
    bannerAd2: settings.banner_ad_2_enabled && settings.banner_ad_2_image_url
      ? {
          imageUrl: settings.banner_ad_2_image_url,
          linkUrl: settings.banner_ad_2_link_url || '',
          altText: 'Store promotion'
        }
      : null
  }
})

const seoConfig = useRuntimeConfig()
usePageSeo(() => ({
  index: true,
  structuredData: siteSchema(siteContent.value?.settings || {}, publicSiteUrl(siteContent.value?.settings || {}, seoConfig.public.siteUrl))
}))
</script>
