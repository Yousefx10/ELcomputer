<script setup>
import { localizedPath } from '~/utils/appearance'
const props = defineProps({ error: { type: Object, default: () => ({}) } })
const { locale } = useI18n()
const { uiLabel } = useUiLocale()
const title = computed(() => uiLabel(Number(props.error.statusCode) === 404 ? 'Page not found' : 'Something went wrong.'))
useHead(() => ({ title: title.value, htmlAttrs: { lang: locale.value, dir: locale.value === 'ar' ? 'rtl' : 'ltr' } }))
const returnHome = () => clearError({ redirect: localizedPath('/', locale.value) })
</script>

<template>
  <main class="grid min-h-screen place-items-center bg-gray-50 p-5">
    <section class="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center">
      <p class="text-sm font-semibold text-gray-500">{{ error.statusCode || 500 }}</p>
      <h1 class="mt-3 text-2xl font-bold text-gray-950">{{ title }}</h1>
      <p class="mt-3 text-sm text-gray-600">{{ $t('errors.tryAgainOrReturnHome') }}</p>
      <button type="button" class="mt-6 min-h-11 rounded-xl bg-blue-600 px-5 font-semibold text-white focus-visible:outline focus-visible:outline-offset-4 focus-visible:outline-blue-500" @click="returnHome">
        {{ $t('common.returnHome') }}
      </button>
    </section>
  </main>
</template>
