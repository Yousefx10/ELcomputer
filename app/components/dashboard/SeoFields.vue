<template>
  <section class="space-y-4 rounded-xl border border-gray-200 p-4">
    <h3 class="font-semibold">{{ $t('seo.heading') }}</h3>
    <p class="text-sm text-gray-500">{{ $t('seo.automatic') }}</p>
    <label class="block text-sm font-semibold">{{ $t('seo.title') }}
      <input :value="modelValue.seo_title || ''" type="text" :disabled="disabled" :placeholder="preview.title" class="mt-2 w-full rounded-lg border p-3" @input="update('seo_title', $event.target.value)" />
    </label>
    <p v-if="(modelValue.seo_title || '').length > 70" class="text-xs text-amber-700">{{ $t('seo.titleRecommendation') }}</p>
    <label class="block text-sm font-semibold">{{ $t('seo.description') }}
      <textarea :value="modelValue.seo_description || ''" rows="3" :disabled="disabled" :placeholder="preview.description" class="mt-2 w-full rounded-lg border p-3" @input="update('seo_description', $event.target.value)" />
    </label>
    <p v-if="(modelValue.seo_description || '').length > 160" class="text-xs text-amber-700">{{ $t('seo.descriptionRecommendation') }}</p>
    <DashboardMediaUploadField :model-value="modelValue.seo_image_url || ''" :label="$t('seo.socialImage')" :section="section" :disabled="disabled" :preview-alt="$t('seo.socialImage')" :help-text="$t('seo.imageFallback')" @update:model-value="update('seo_image_url', $event)" />
    <div class="break-words rounded-lg bg-gray-50 p-4" :aria-label="$t('seo.preview')">
      <p class="text-xs text-gray-500">{{ $t('seo.preview') }}</p>
      <p class="mt-2 font-medium text-blue-700">{{ preview.title }}</p>
      <p class="mt-1 text-sm text-gray-600">{{ preview.description }}</p>
    </div>
  </section>
</template>

<script setup>
import { buildSeo, catalogSeoFields } from '~/utils/seo'
const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  fallbackTitle: { type: String, default: '' },
  fallbackDescription: { type: String, default: '' },
  fallbackImage: { type: String, default: '' },
  section: { type: String, required: true },
  catalog: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])
const { data: content } = useSiteContent()
const { locale } = useI18n()
const config = useRuntimeConfig()
const preview = computed(() => buildSeo({ settings: content.value?.settings || {}, siteUrl: config.public.siteUrl, locale: locale.value,
  title: props.modelValue.seo_title || props.fallbackTitle, description: props.modelValue.seo_description || props.fallbackDescription || (props.catalog ? catalogSeoFields({ name: props.fallbackTitle }, content.value?.settings || {}, locale.value).description : ''),
  image: props.modelValue.seo_image_url || props.fallbackImage }))
const update = (field, value) => emit('update:modelValue', { ...props.modelValue, [field]: value })
</script>
