<template>
  <div v-if="page" class="custom-page-wrap">
    <article class="custom-page-card" :dir="page.text_direction || 'auto'">
      <header class="custom-page-header">
        <p>{{ $t('common.information') }}</p>
        <h1>{{ page.title }}</h1>
      </header>
      <div v-if="page.content_markdown" class="custom-page-markdown" v-html="renderedContent" />
      <p v-else class="custom-page-empty">{{ $t('pages.custom.thisPageHasNoContentYet') }}</p>
    </article>
  </div>
  <section v-else class="custom-page-not-found" aria-labelledby="not-found-title">
    <div class="custom-page-not-found-card">
      <span>404</span>
      <h1 id="not-found-title">{{ $t('common.pageNotFound') }}</h1>
      <p>{{ $t('pages.custom.thisPageIsUnavailable') }}</p>
      <NuxtLinkLocale to="/">{{ $t('common.returnHome') }}</NuxtLinkLocale>
    </div>
  </section>
</template>

<script setup>
import { selectWithSeo } from '~/utils/seoQuery'
import { publicSiteUrl, breadcrumbs } from '~/utils/seo'
const { uiLabel } = useUiLocale()
import { renderSafeMarkdown } from '~/utils/markdown'

const route = useUiRoute()
const supabase = useSupabaseClient()
const pagePath = computed(() => {
  const value = route.params.pagePath
  return (Array.isArray(value) ? value : [value]).filter(Boolean).join('/').toLowerCase()
})

const { data: pageResult } = await useAsyncData(
  () => `site-page:${pagePath.value}`,
  async () => {
    const { data, error } = await selectWithSeo(fields => supabase.from('site_pages').select(fields)
      .eq('path', pagePath.value).eq('is_published', true).maybeSingle(),
      'id,title,path,content_markdown,text_direction,updated_at', 'seo_title,seo_description,seo_image_url,seo_noindex')

    if (error) throw createError({ statusCode: 500, statusMessage: 'Could not load this page.' })
    return { item: data || null }
  },
  { watch: [pagePath] }
)
const page = computed(() => pageResult.value?.item || null)

if (!page.value) {
  const event = useRequestEvent()
  if (event) setResponseStatus(event, 404)
}

const renderedContent = computed(() => renderSafeMarkdown(page.value?.content_markdown || ''))
const { data: siteContent } = await useSiteContent()

const { locale: seoLocale } = useI18n()
const seoConfig = useRuntimeConfig()
usePageSeo(() => ({
  title: page.value?.seo_title || page.value?.title || uiLabel('Page not found'),
  description: page.value?.seo_description || page.value?.content_markdown,
  image: page.value?.seo_image_url,
  index: !!page.value && page.value.seo_noindex !== true,
  structuredData: page.value ? [breadcrumbs([{ name: uiLabel('Home'), path: '/' }, { name: page.value.title, path: `/${page.value.path}` }], publicSiteUrl(siteContent.value?.settings || {}, seoConfig.public.siteUrl), seoLocale.value)] : []
}))
</script>

<style scoped>
.custom-page-wrap {
  width: min(100% - 2rem, 960px);
  margin: 0 auto;
  padding: 3rem 0 5rem;
}

.custom-page-card {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 1.25rem;
  background: var(--surface);
  box-shadow: 0 16px 45px rgb(15 23 42 / 0.06);
}

.custom-page-header {
  border-bottom: 1px solid #eef0f3;
  padding: clamp(1.5rem, 4vw, 3rem);
  background: linear-gradient(135deg, #f8fafc, #eff6ff);
  text-align: center;
}

.custom-page-header p {
  margin: 0 0 0.5rem;
  color: #2563eb;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.custom-page-header h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: clamp(2rem, 5vw, 3.25rem);
  line-height: 1.1;
}

.custom-page-markdown,
.custom-page-empty {
  padding: clamp(1.5rem, 4vw, 3rem);
}

.custom-page-markdown { color: var(--text-primary); line-height: 1.75; }
.custom-page-markdown :deep(h1),
.custom-page-markdown :deep(h2),
.custom-page-markdown :deep(h3),
.custom-page-markdown :deep(h4) { margin: 1.8em 0 0.55em; color: var(--text-primary); font-weight: 750; line-height: 1.25; }
.custom-page-markdown :deep(h1:first-child),
.custom-page-markdown :deep(h2:first-child),
.custom-page-markdown :deep(h3:first-child) { margin-top: 0; }
.custom-page-markdown :deep(h1) { font-size: 2rem; }
.custom-page-markdown :deep(h2) { font-size: 1.55rem; }
.custom-page-markdown :deep(h3) { font-size: 1.25rem; }
.custom-page-markdown :deep(p) { margin: 0 0 1rem; }
.custom-page-markdown :deep(ul),
.custom-page-markdown :deep(ol) { margin: 0 0 1rem; padding-inline-start: 1.5rem; }
.custom-page-markdown :deep(ul) { list-style: disc; }
.custom-page-markdown :deep(ol) { list-style: decimal; }
.custom-page-markdown :deep(a) { color: #1d4ed8; font-weight: 650; text-decoration: underline; }
.custom-page-markdown :deep(blockquote) { margin: 1.25rem 0; border-inline-start: 4px solid #60a5fa; background: var(--surface-muted); padding: 1rem; color: var(--text-secondary); }
.custom-page-markdown :deep(code) { border-radius: 0.35rem; background: var(--surface-muted); padding: 0.15rem 0.35rem; color: #be123c; font-size: 0.9em; }
.custom-page-markdown :deep(pre) { overflow-x: auto; border-radius: 0.75rem; background: #111827; padding: 1rem; color: #f9fafb; }
.custom-page-markdown :deep(pre code) { background: transparent; padding: 0; color: inherit; }
.custom-page-markdown :deep(hr) { margin: 2rem 0; border: 0; border-top: 1px solid #e5e7eb; }
.custom-page-empty { color: var(--text-secondary); }

.custom-page-not-found {
  display: grid;
  min-height: 60vh;
  place-items: center;
  padding: 3rem 1rem;
  background: var(--surface);
}

.custom-page-not-found-card {
  width: min(100%, 460px);
  padding: 3rem 2rem;
  border: 1px solid #e5e7eb;
  border-radius: 1.25rem;
  background: var(--surface);
  box-shadow: 0 16px 45px rgb(15 23 42 / 0.06);
  text-align: center;
}

.custom-page-not-found-card span {
  display: inline-flex;
  margin-bottom: 1rem;
  border-radius: 999px;
  padding: 0.4rem 0.8rem;
  background: var(--surface-muted);
  color: #2563eb;
  font-size: 0.8rem;
  font-weight: 800;
}

.custom-page-not-found-card h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: clamp(2rem, 6vw, 3rem);
  line-height: 1.1;
}

.custom-page-not-found-card p {
  margin: 0.85rem 0 1.5rem;
  color: var(--text-secondary);
}

.custom-page-not-found-card a {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.75rem;
  padding: 0.7rem 1.1rem;
  background: #2563eb;
  color: white;
  font-size: 0.875rem;
  font-weight: 700;
}
</style>
