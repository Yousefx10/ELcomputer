<template>
  <section>
    <CardsHeroCard />
  </section>

  <section>
    <OfferSlider />
  </section>

  <section class="container mx-auto pb-20">
    <div v-if="homeError" class="mx-4 mt-6 rounded-2xl bg-red-50 p-4 text-red-600">
      {{ homeError.message }}
    </div>

    <section>
      <TopCategories :categories="topCategories" class="mx-1 my-5" />
    </section>

    <section v-if="featuredProducts.length">
      <HomeProductSection
        title="Featured Products"
        description="Selected products currently available in the store"
        :products="featuredProducts"
      />
    </section>

    <section v-if="topSellerProducts.length">
      <HomeProductSection
        title="Top Sellers"
        description="Popular products from the current catalog"
        :products="topSellerProducts"
      />
    </section>

    <section v-if="featuredBrands.length">
      <FeaturedBrands
        title="Featured Brands"
        description="Brands currently available in the store"
        :brands="featuredBrands"
      />
    </section>

    <section
      v-for="category in categorySections"
      :key="category.id"
    >
      <CardsBanner
        v-if="getBannerBeforeCategory(category)"
        :image-url="getBannerBeforeCategory(category).imageUrl"
        :link-url="getBannerBeforeCategory(category).linkUrl"
        :alt-text="getBannerBeforeCategory(category).altText"
      />

      <HomeProductSection
        :title="category.name"
        description="Browse products from this category"
        :products="category.products"
      />
    </section>
  </section>
</template>

<script setup>
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
      .select('id, name, slug')
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
        products: categoryProducts
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
    featuredProducts: (featuredProducts.length ? featuredProducts : products).slice(0, 8),
    topSellerProducts: (topSellerProducts.length ? topSellerProducts : products).slice(0, 8),
    topCategories: categoriesWithProducts.slice(0, 6),
    categorySections: [...preferredCategories, ...remainingCategories].slice(0, 3),
    featuredBrands: brands.filter((brand) => usedBrandIds.has(brand.id))
  }
})

const featuredProducts = computed(() => homeData.value?.featuredProducts || [])
const topSellerProducts = computed(() => homeData.value?.topSellerProducts || [])
const topCategories = computed(() => homeData.value?.topCategories || [])
const categorySections = computed(() => homeData.value?.categorySections || [])
const featuredBrands = computed(() => homeData.value?.featuredBrands || [])
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
</script>

<style>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
