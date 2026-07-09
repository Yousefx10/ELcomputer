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

    <section>
      <CardsBanner />
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

  return {
    featuredProducts: (featuredProducts.length ? featuredProducts : products).slice(0, 8),
    topSellerProducts: (topSellerProducts.length ? topSellerProducts : products).slice(0, 8),
    topCategories: categoriesWithProducts.slice(0, 6),
    categorySections: categoriesWithProducts.slice(0, 3),
    featuredBrands: brands.filter((brand) => usedBrandIds.has(brand.id))
  }
})

const featuredProducts = computed(() => homeData.value?.featuredProducts || [])
const topSellerProducts = computed(() => homeData.value?.topSellerProducts || [])
const topCategories = computed(() => homeData.value?.topCategories || [])
const categorySections = computed(() => homeData.value?.categorySections || [])
const featuredBrands = computed(() => homeData.value?.featuredBrands || [])
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
