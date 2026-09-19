<script setup>
import { renderSafeMarkdown } from '~/utils/markdown'

const route = useRoute()
const { data, error } = await useFetch(() => `/api/help/${encodeURIComponent(route.params.category)}/${encodeURIComponent(route.params.slug)}`)
if (error.value?.statusCode === 404) throw createError({ statusCode: 404, statusMessage: 'Article not found.' })
const article = computed(() => data.value?.article)
const category = computed(() => data.value?.category)
const rendered = computed(() => renderSafeMarkdown(article.value?.content_markdown || ''))
useHead(() => ({ title: article.value ? `${article.value.title} | Help Center` : 'Help Center' }))
</script>

<template>
  <div class="min-h-screen bg-slate-50 px-5 py-10 sm:py-16">
    <article v-if="article" class="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      <nav aria-label="Breadcrumb" class="flex flex-wrap items-center gap-2 text-sm text-slate-500"><NuxtLink to="/help" class="hover:text-blue-700">Help Center</NuxtLink><Icon name="lucide:chevron-right" size="15" /><NuxtLink :to="`/help?category=${category.slug}`" class="hover:text-blue-700">{{ category.name }}</NuxtLink></nav>
      <h1 class="mt-7 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{{ article.title }}</h1>
      <p v-if="article.summary" class="mt-3 text-lg text-slate-600">{{ article.summary }}</p>
      <div class="help-article-body mt-8 border-t border-slate-100 pt-8" v-html="rendered" />
      <div class="mt-10 rounded-2xl bg-blue-50 p-5"><h2 class="font-bold text-slate-900">Still need help?</h2><p class="mt-1 text-sm text-slate-600">Send our team a support ticket.</p><NuxtLink to="/account/support" class="mt-3 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 font-bold text-white hover:bg-blue-700">Contact support</NuxtLink></div>
    </article>
    <div v-else class="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center"><p class="font-semibold text-slate-900">{{ error ? 'Could not load this article. Try again.' : 'Loading article...' }}</p><NuxtLink to="/help" class="mt-3 inline-block text-blue-700">Back to Help Center</NuxtLink></div>
  </div>
</template>

<style scoped>
.help-article-body { color: #334155; line-height: 1.8; overflow-wrap: anywhere; }
.help-article-body :deep(h1), .help-article-body :deep(h2), .help-article-body :deep(h3) { color: #0f172a; font-weight: 750; margin: 1.5em 0 .5em; line-height: 1.3; }
.help-article-body :deep(h1) { font-size: 1.8rem; }
.help-article-body :deep(h2) { font-size: 1.45rem; }
.help-article-body :deep(h3) { font-size: 1.2rem; }
.help-article-body :deep(p), .help-article-body :deep(ul), .help-article-body :deep(ol) { margin-bottom: 1rem; }
.help-article-body :deep(ul), .help-article-body :deep(ol) { padding-inline-start: 1.5rem; }
.help-article-body :deep(ul) { list-style: disc; }
.help-article-body :deep(ol) { list-style: decimal; }
.help-article-body :deep(a) { color: #1d4ed8; text-decoration: underline; }
.help-article-body :deep(pre) { overflow-x: auto; background: #0f172a; color: white; border-radius: .75rem; padding: 1rem; }
.help-article-body :deep(blockquote) { border-inline-start: 3px solid #60a5fa; padding-inline-start: 1rem; }
</style>
