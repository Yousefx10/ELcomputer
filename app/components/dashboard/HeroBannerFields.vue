<template>
  <div class="grid gap-3 sm:grid-cols-2">
    <DashboardMediaUploadField :model-value="value.mobile_image_url" :label="$t('storefrontUX.mobileImage')" section="hero_banners" preview-height-class="h-24" @update:model-value="set('mobile_image_url', $event)" />
    <div class="space-y-3">
      <label class="block text-sm">{{ $t('storefrontUX.imageFit') }}<select :value="value.fit" class="mt-1 w-full rounded-lg border p-2" @change="set('fit', $event.target.value)"><option value="cover">{{ $t('storefrontUX.cover') }}</option><option value="contain">{{ $t('storefrontUX.contain') }}</option></select></label>
      <label class="block text-sm">{{ $t('commerceReliability.mobileFit') }}<select :value="value.mobile_fit" class="mt-1 w-full rounded-lg border p-2" @change="set('mobile_fit', $event.target.value)"><option value="contain">{{ $t('storefrontUX.contain') }}</option><option value="cover">{{ $t('storefrontUX.cover') }}</option></select></label>
      <div class="grid grid-cols-2 gap-2"><label v-for="key in positions" :key="key" class="text-sm">{{ $t(`storefrontUX.${key}`) }}<input :value="value[key]" type="number" min="0" max="100" class="mt-1 w-full rounded-lg border p-2" @input="set(key, $event.target.value)"></label></div>
    </div>
    <label v-for="field in fields" :key="field" class="block text-sm">{{ $t(`storefrontUX.${field}`) }}<input :value="value[field]" :dir="field.endsWith('_ar') ? 'rtl' : 'ltr'" type="text" :maxlength="field.startsWith('body') ? 240 : field.startsWith('cta') ? 60 : 120" class="mt-1 w-full rounded-lg border p-2" @input="set(field, $event.target.value)"></label>
  </div>
</template>
<script setup>
import { normalizeHeroPresentation } from '~/utils/heroLayout'
const props = defineProps({ modelValue: { type: Object, default: () => ({}) } })
const emit = defineEmits(['update:modelValue'])
const value = computed(() => normalizeHeroPresentation(props.modelValue))
const positions = ['focal_x', 'focal_y', 'mobile_focal_x', 'mobile_focal_y']
const fields = ['title_en', 'title_ar', 'body_en', 'body_ar', 'cta_en', 'cta_ar']
const set = (key, next) => emit('update:modelValue', normalizeHeroPresentation({ ...value.value, [key]: next }))
</script>
