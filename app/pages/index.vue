<template>
  <div class="store-container store-home">
    <nav class="store-discovery" aria-label="Explore products">
      <p class="store-discovery-label">Find your next upgrade</p>
      <div class="store-discovery-links no-scrollbar">
        <NuxtLink :to="{ path: '/search', query: { sort: 'latest' } }" class="store-chip"><Icon name="lucide:sparkles" size="14" />Just landed</NuxtLink>
        <NuxtLink v-for="category in topCategories" :key="category.id" :to="{ path: '/search', query: { category: category.slug } }" class="store-chip">{{ category.name }}</NuxtLink>
        <NuxtLink :to="{ path: '/search', query: { status: 'instock' } }" class="store-chip">In stock now</NuxtLink>
      </div>
    </nav>

    <h1 v-if="hasCustomHero || !heroEnabled" class="sr-only">{{ siteContent?.settings?.site_name || 'ELcomputer' }} — Shop your next setup</h1>
    <div v-if="heroEnabled" class="store-hero-grid">
      <CardsHeroCard />
      <div class="store-hero-side">
        <NuxtLink v-for="(tile, index) in discoveryTiles" :key="index" :to="tile.to" class="store-promo-tile">
          <div class="store-promo-copy">
            <p>{{ tile.eyebrow }}</p>
            <h2>{{ tile.title }}</h2>
            <span>Explore now <Icon name="lucide:arrow-right" size="14" /></span>
          </div>
          <img v-if="tile.image" :src="tile.image" alt="" />
          <Icon v-else :name="tile.icon" />
        </NuxtLink>
      </div>
    </div>

    <nav class="store-service-strip" aria-label="Shopping shortcuts">
      <NuxtLink :to="{ path: '/search', query: { status: 'instock' } }"><Icon name="lucide:package-check" size="23" /><span>Find in-stock gear</span></NuxtLink>
      <NuxtLink :to="ordersPath"><Icon name="lucide:truck" size="23" /><span>Track your orders</span></NuxtLink>
      <a v-if="supportEmail" :href="`mailto:${supportEmail}`"><Icon name="lucide:headphones" size="23" /><span>Talk to our team</span></a>
      <NuxtLink v-else to="/account/messages"><Icon name="lucide:headphones" size="23" /><span>Talk to our team</span></NuxtLink>
    </nav>

    <div v-if="homeError" class="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">We couldn't load products. Please refresh and try again.</div>
    <TopCategories :categories="topCategories" />
    <HomeProductSection v-if="featuredProducts.length" title="Worth a closer look" description="A few picks for your next setup." :products="featuredProducts" />
    <OfferSlider />
    <HomeProductSection v-if="topSellerProducts.length" title="More to explore" description="Find something that fits your everyday." :products="topSellerProducts" />
    <FeaturedBrands v-if="featuredBrands.length" title="Shop your favorite brands" :brands="featuredBrands" />

    <section v-for="category in categorySections" :key="category.id">
      <CardsBanner v-if="getBannerBeforeCategory(category)" :image-url="getBannerBeforeCategory(category).imageUrl" :link-url="getBannerBeforeCategory(category).linkUrl" :alt-text="getBannerBeforeCategory(category).altText" />
      <HomeProductSection :title="category.name" :products="category.products" :to="{ path: '/search', query: { category: category.slug } }" />
    </section>

    <HomeCustomerReviews v-if="homepageReviewsEnabled" :show-view-all="homepageReviewsViewAllEnabled" />
    <NpsSurvey source="homepage" :store-name="siteContent?.settings?.site_name || 'ELcomputer'" />
  </div>
</template>

<script setup>
import { getStoreCategoryIcon, getStoreImageUrl } from '~/utils/storefront'
import FeaturedBrands from '~/components/cards/FeaturedBrands.vue'
import TopCategories from '~/components/cards/TopCategories.vue'
import OfferSlider from '~/components/layout/OfferSlider.vue'

const supabase = useSupabaseClient()
const { data: siteContent } = await useSiteContent()

const categoryBannerTargets = {
  bannerAd1: ['keyboard', 'keyboards'],
  bannerAd2: ['accessory', 'accessories']
}

const normalizeCategoryValue = (value = '') => {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

const categoryMatchesAny = (category, targetValues = []) => {
  const categoryValues = [
    normalizeCategoryValue(category?.slug),
    normalizeCategoryValue(category?.name)
  ]

  return targetValues.some((targetValue) => {
    return categoryValues.includes(normalizeCategoryValue(targetValue))
  })
}

const { data: homeData, error: homeError } = await useAsyncData('store-home', async () => {
  const [productsResult, categoriesResult, brandsResult] = await Promise.all([
    supabase
      .from('products')
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
        is_featured,
        is_top_seller,
        category:categories (
          id,
          name,
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
      .select('id, name, slug, image_url')
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
  const preferredCategories = [
    categoriesWithProducts.find((category) => categoryMatchesAny(category, categoryBannerTargets.bannerAd1)),
    categoriesWithProducts.find((category) => categoryMatchesAny(category, categoryBannerTargets.bannerAd2))
  ].filter(Boolean).filter((category, index, list) => {
    return category && list.findIndex((item) => item.id === category.id) === index
  })
  const remainingCategories = categoriesWithProducts.filter((category) => {
    return !preferredCategories.some((preferredCategory) => preferredCategory.id === category.id)
  })

  return {
    latestImage: products.find((product) => getStoreImageUrl(product.image_url))?.image_url || '',
    featuredProducts: (featuredProducts.length ? featuredProducts : products).slice(0, 8),
    topSellerProducts: (topSellerProducts.length ? topSellerProducts : products).slice(0, 8),
    topCategories: categoriesWithProducts.slice(0, 6),
    categorySections: [...preferredCategories, ...remainingCategories].slice(0, 3),
    featuredBrands: brands.filter((brand) => usedBrandIds.has(brand.id))
  }
})

const customerUser = useSupabaseUser()
const ordersPath = computed(() => customerUser.value ? '/account#orders' : { path: '/login', query: { redirect: '/account#orders' } })
const supportEmail = computed(() => siteContent.value?.settings?.footer_email || '')
const heroEnabled = computed(() => siteContent.value?.settings?.hero_enabled ?? true)
const hasCustomHero = computed(() => (siteContent.value?.heroBanners || []).some((banner) => getStoreImageUrl(banner.image_url) && banner.id !== 'default-hero-banner'))
const discoveryTiles = computed(() => [
  {
    eyebrow: 'Shop by category',
    title: topCategories.value[0]?.name || 'Meet your new favorites',
    image: topCategories.value[0]?.displayImageUrl,
    icon: getStoreCategoryIcon(topCategories.value[0]?.name),
    to: topCategories.value[0] ? { path: '/search', query: { category: topCategories.value[0].slug } } : '/search'
  },
  {
    eyebrow: 'Fresh finds',
    title: 'New to the store',
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
          altText: 'Banner Ad 1'
        }
      : null,
    bannerAd2: settings.banner_ad_2_enabled && settings.banner_ad_2_image_url
      ? {
          imageUrl: settings.banner_ad_2_image_url,
          linkUrl: settings.banner_ad_2_link_url || '',
          altText: 'Banner Ad 2'
        }
      : null
  }
})

const getBannerBeforeCategory = (category) => {
  if (categoryMatchesAny(category, categoryBannerTargets.bannerAd1)) {
    return bannerAds.value.bannerAd1
  }

  if (categoryMatchesAny(category, categoryBannerTargets.bannerAd2)) {
    return bannerAds.value.bannerAd2
  }

  return null
}

useHead(() => ({
  title: siteContent.value?.settings?.landing_page_title || siteContent.value?.settings?.site_name || 'ELcomputer'
}))
</script>
