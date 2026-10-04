<script setup>
import { normalizeBrandPage, visibleBrandRows } from '~/utils/brandPage'
import { renderSafeMarkdown } from '~/utils/markdown'
import { brandSeoFields, breadcrumbs, publicSiteUrl } from '~/utils/seo'

const route = useRoute(), { locale } = useI18n(), { categoryName } = useCategoryLocale()
const localePath = useLocalePath()
const slug = computed(() => String(route.params.slug || ''))
const filterKeys = ['category', 'status', 'sort', 'page']
const query = computed(() => Object.fromEntries(filterKeys.filter(key => typeof route.query[key] === 'string').map(key => [key, route.query[key]])))
const { data, pending, error } = await useAsyncData(() => `brand:${slug.value}:${JSON.stringify(query.value)}`, () => $fetch(`/api/storefront/brands/${encodeURIComponent(slug.value)}`, { query: query.value }), { watch: [slug, query] })
if (error.value) throw createError({ statusCode: error.value.statusCode || 503, statusMessage: error.value.statusCode === 404 ? 'Brand not found.' : 'Brand content is unavailable.' })
const brand = computed(() => data.value?.brand)
const page = computed(() => normalizeBrandPage(brand.value?.brand_page))
const rows = computed(() => visibleBrandRows(page.value))
const storyHtml = computed(() => renderSafeMarkdown(page.value.story.content))
const { data: siteContent } = await useSiteContent()
const config = useRuntimeConfig()
usePageSeo(() => ({
  ...brandSeoFields(brand.value || {}, siteContent.value?.settings || {}, locale.value),
  path: `/brand/${slug.value}`, index: !!brand.value && !Object.keys(route.query).length,
  structuredData: brand.value ? [breadcrumbs([{ name: locale.value === 'ar' ? 'الرئيسية' : 'Home', path: '/' }, { name: brand.value.name, path: `/brand/${slug.value}` }], publicSiteUrl(siteContent.value?.settings || {}, config.public.siteUrl), locale.value)] : []
}))
const wallpaper = computed(() => ({
  ...(page.value.background.color ? { backgroundColor: page.value.background.color } : {}),
  ...(page.value.background.image ? { backgroundImage: `url("${page.value.background.image}")` } : {})
}))
const filters = reactive({ category: '', status: '', sort: 'latest' })
watch(data, value => Object.assign(filters, { category: value?.filters?.category || '', status: value?.filters?.status || '', sort: value?.filters?.sort || 'latest' }), { immediate: true })
const productLink = pageNumber => ({ path: `/brand/${slug.value}`, query: { ...Object.fromEntries(Object.entries(filters).filter(([key, value]) => value && !(key === 'sort' && value === 'latest'))), ...(pageNumber > 1 ? { page: String(pageNumber) } : {}) }, hash: '#brand-products' })
const applyFilters = () => navigateTo(localePath(productLink(1)))
</script>

<template>
  <article v-if="brand" class="brand-landing" :class="{ 'brand-wallpaper': page.background.image || page.background.color }" :style="wallpaper">
    <header class="brand-hero" :class="[page.hero.image ? 'brand-hero-immersive' : 'brand-hero-simple', `brand-align-${page.hero.alignment}`]">
      <picture v-if="page.hero.image" class="brand-hero-image">
        <source v-if="page.hero.mobile_image" media="(max-width: 600px)" :srcset="page.hero.mobile_image">
        <img :src="page.hero.image" :alt="''" width="1920" height="800" fetchpriority="high" decoding="async">
      </picture>
      <div v-if="page.hero.image" class="brand-hero-shade" :style="{ opacity: page.hero.overlay }" />
      <div class="brand-hero-copy store-container">
        <img v-if="brand.logo_url" class="brand-wordmark" :src="brand.logo_url" :alt="brand.name" width="220" height="80">
        <p v-if="page.hero.title" class="brand-eyebrow" dir="auto">{{ brand.name }}</p>
        <h1 dir="auto">{{ page.hero.title || brand.name }}</h1>
        <p v-if="page.hero.text" class="brand-hero-text" dir="auto">{{ page.hero.text }}</p>
        <a v-if="page.hero.cta_label && page.hero.cta_url.startsWith('#')" :href="page.hero.cta_url" class="brand-cta">{{ page.hero.cta_label }}</a>
        <NuxtLinkLocale v-else-if="page.hero.cta_label && page.hero.cta_url" :to="page.hero.cta_url" class="brand-cta">{{ page.hero.cta_label }}</NuxtLinkLocale>
        <a v-else href="#brand-products" class="brand-cta">{{ $t('brandPages.exploreProducts') }}</a>
      </div>
    </header>

    <div class="brand-editorial store-container">
      <section v-if="page.story.content || page.story.supporting" class="brand-story" aria-labelledby="brand-story-heading">
        <div><p class="brand-eyebrow">{{ brand.name }}</p><h2 id="brand-story-heading" dir="auto">{{ page.story.title || $t('brandPages.aboutBrand', { brand: brand.name }) }}</h2></div>
        <div class="brand-story-body" dir="auto"><div v-if="storyHtml" class="brand-prose" v-html="storyHtml" /><p v-if="page.story.supporting" class="brand-story-supporting">{{ page.story.supporting }}</p></div>
      </section>
      <div v-if="rows.length" class="brand-media-rows">
        <section v-for="row in rows" :key="row.id" class="brand-media-row" :class="{ 'brand-media-row-two': row.layout === 'two' && row.items.length > 1 }" :aria-label="$t('brandPages.brandMedia', { brand: brand.name })">
          <BrandMedia v-for="item in row.items" :key="item.id" :item="item" :brand-name="brand.name" />
        </section>
      </div>
    </div>

    <section id="brand-products" class="brand-products" aria-labelledby="brand-products-heading" :aria-busy="pending">
      <div class="store-container">
        <div class="brand-products-heading"><p class="brand-eyebrow">{{ $t('common.shopByBrand') }}</p><h2 id="brand-products-heading">{{ $t('brandPages.productsBy', { brand: brand.name }) }}</h2><p>{{ $t('brandPages.productCount', { count: data.total }) }}</p></div>
        <form class="brand-product-controls" @submit.prevent="applyFilters">
          <label>{{ $t('common.category') }}<select v-model="filters.category"><option value="">{{ $t('common.allCategories') }}</option><option v-for="category in data.categories" :key="category.id" :value="category.slug">{{ categoryName(category) }}</option></select></label>
          <label>{{ $t('common.status') }}<select v-model="filters.status"><option value="">{{ $t('common.allProducts') }}</option><option value="instock">{{ $t('common.inStock') }}</option><option value="unavailable">{{ $t('common.unavailable') }}</option></select></label>
          <label>{{ $t('common.sortBy') }}<select v-model="filters.sort"><option value="latest">{{ $t('brandPages.latest') }}</option><option value="price-asc">{{ $t('brandPages.priceAsc') }}</option><option value="price-desc">{{ $t('brandPages.priceDesc') }}</option><option value="popularity">{{ $t('brandPages.popular') }}</option><option value="average-rating">{{ $t('brandPages.rating') }}</option></select></label>
          <button type="submit" :disabled="pending">{{ $t('common.applyFilters') }}</button>
        </form>
        <p v-if="error" class="brand-feedback" role="alert">{{ $t('brandPages.loadError') }}</p>
        <div v-else-if="data.products.length" class="store-search-grid"><CardsProductCard v-for="product in data.products" :key="product.id" :product="product" /></div>
        <p v-else class="brand-feedback">{{ $t('brandPages.noProducts') }}</p>
        <nav v-if="data.pages > 1" class="brand-pagination" :aria-label="$t('brandPages.pagination')"><NuxtLinkLocale v-if="data.page > 1" :to="productLink(data.page - 1)">{{ $t('common.previous') }}</NuxtLinkLocale><span>{{ $t('common.pageValueOfValue', { value0: data.page, value1: data.pages }) }}</span><NuxtLinkLocale v-if="data.page < data.pages" :to="productLink(data.page + 1)">{{ $t('common.next') }}</NuxtLinkLocale></nav>
      </div>
    </section>
  </article>
</template>

<style scoped>
.brand-landing { background:var(--surface); background-size:cover; background-position:center top; color:var(--text-primary); }
.brand-hero { position:relative; isolation:isolate; overflow:hidden; }
.brand-hero-immersive { display:grid; align-items:center; min-height:clamp(340px,42vw,620px); color:#fff; background:#17202c; }
.brand-hero-image,.brand-hero-shade { position:absolute; inset:0; z-index:-1; }
.brand-hero-image img { width:100%; height:100%; object-fit:cover; object-position:center; }
.brand-hero-shade { background:#000; }
.brand-hero-copy { padding-block:clamp(36px,6vw,88px); }
.brand-wordmark { width:auto; max-width:220px; height:64px; object-fit:contain; padding:10px 16px; margin-bottom:28px; background:#fff; }
.brand-eyebrow { margin:0 0 14px; font-size:.76rem; font-weight:750; letter-spacing:.14em; text-transform:uppercase; overflow-wrap:anywhere; }
.brand-hero h1 { margin:0; max-width:920px; font-size:clamp(2.3rem,5.5vw,5.25rem); font-weight:750; letter-spacing:-.04em; line-height:1.08; overflow-wrap:anywhere; }
.brand-hero-immersive h1,.brand-hero-immersive .brand-hero-text,.brand-hero-immersive .brand-eyebrow { text-shadow:0 2px 16px rgb(0 0 0/.65); }
.brand-hero-text { margin-block:24px 0; max-width:620px; font-size:clamp(1rem,1.7vw,1.25rem); line-height:1.6; white-space:pre-line; }
.brand-align-center { text-align:center; }.brand-align-center :is(h1,.brand-hero-text) { margin-inline:auto; }
.brand-align-end { text-align:end; }.brand-align-end :is(h1,.brand-hero-text) { margin-inline-start:auto; }
.brand-cta { display:inline-flex; align-items:center; justify-content:center; min-height:48px; margin-top:30px; padding:12px 24px; border:1px solid currentColor; font-weight:700; font-size:.9rem; }
.brand-hero-immersive .brand-cta { color:#101820; background:#fff; border-color:#fff; }
.brand-hero-simple { background:var(--surface); border-bottom:1px solid var(--border); }
.brand-hero-simple h1 { font-size:clamp(2.4rem,5vw,4.5rem); }
.brand-editorial { padding-block:clamp(32px,6vw,88px); }
.brand-editorial:has(> :only-child) { padding-bottom:clamp(32px,6vw,72px); }.brand-editorial:empty { display:none; }
.brand-story { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.7fr); gap:clamp(24px,5vw,80px); padding-bottom:clamp(32px,6vw,80px); }
.brand-story:last-child { padding-bottom:0; }
.brand-story h2,.brand-products h2 { font-size:clamp(1.75rem,3vw,3rem); font-weight:700; line-height:1.18; letter-spacing:-.03em; overflow-wrap:anywhere; }
.brand-story-supporting { padding-block-start:24px; margin-top:24px; border-top:1px solid var(--border); color:var(--text-secondary); white-space:pre-line; }
.brand-story-body { min-width:0; font-size:1.1rem; line-height:1.85; overflow-wrap:anywhere; }
.brand-prose :deep(p) { margin:0 0 1.25em; }.brand-prose :deep(:is(h1,h2,h3,h4,h5,h6)) { margin:1.5em 0 .6em; font-size:1.4rem; font-weight:700; }
.brand-prose :deep(a) { text-decoration:underline; }.brand-prose :deep(ul) { list-style:disc; padding-inline-start:1.5em; }.brand-prose :deep(ol) { list-style:decimal; padding-inline-start:1.5em; }.brand-prose :deep(pre) { overflow:auto; background:var(--surface-muted); padding:16px; }
.brand-media-rows { display:grid; gap:clamp(24px,4vw,56px); }.brand-media-row { display:grid; min-width:0; gap:24px; }.brand-media-row-two { grid-template-columns:repeat(2,minmax(0,1fr)); }
.brand-wallpaper .brand-editorial { background:var(--surface); padding-inline:clamp(20px,4vw,56px); }
.brand-products { padding-block:clamp(40px,6vw,88px); background:var(--surface); scroll-margin-top:150px; border-top:1px solid var(--border); }
.brand-products-heading { text-align:center; margin-bottom:36px; }.brand-products-heading>p:last-child { margin-top:14px; color:var(--text-secondary); font-size:.9rem; }
.brand-product-controls { display:flex; flex-wrap:wrap; align-items:end; gap:16px; padding-block:20px; margin-bottom:24px; border-block:1px solid var(--border); }
.brand-product-controls label { flex:1 1 160px; min-width:0; font-size:.8rem; font-weight:650; }
.brand-product-controls select { display:block; width:100%; min-height:44px; margin-top:8px; border:1px solid var(--border); background:var(--surface); color:var(--text-primary); padding:10px; border-radius:0; }
.brand-product-controls button { min-height:44px; padding:10px 22px; background:var(--brand); color:#fff; font-weight:700; font-size:.85rem; }
.brand-pagination { display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:24px; margin-top:40px; font-size:.9rem; }.brand-pagination a { min-height:44px; display:inline-flex; align-items:center; padding-inline:16px; border:1px solid var(--border); }
.brand-feedback { padding-block:40px; text-align:center; color:var(--text-secondary); }
:is(a,button,select):focus-visible { outline:3px solid var(--brand); outline-offset:4px; }
@media(max-width:700px) { .brand-story,.brand-media-row-two { grid-template-columns:minmax(0,1fr); }.brand-hero-immersive { min-height:340px; }.brand-wordmark { height:54px; max-width:180px; margin-bottom:20px; }.brand-hero h1 { font-size:clamp(2rem,9vw,3.25rem); }.brand-hero-text { margin-top:16px; }.brand-product-controls { gap:12px; }.brand-product-controls label { flex-basis:calc(50% - 12px); }.brand-product-controls button { flex:1; }.brand-story-body { font-size:1rem; }.brand-wallpaper .brand-editorial { width:calc(100% - 2rem); } }
</style>
