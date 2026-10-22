<script setup>
import { productPageSections, productPageEditorConfig } from '~/utils/productPage'
const props = defineProps({ pageStyle: { type: String, default: 'classic' }, config: { type: Object, default: null }, disabled: Boolean })
const emit = defineEmits(['update:pageStyle', 'update:config'])
const editor = computed(() => productPageEditorConfig(props.config))
const update = mutate => { const next = productPageEditorConfig(props.config); mutate(next); emit('update:config', next) }
const setSection = (key, value) => update(next => { next.sections[key] = value })
const setLink = (index, key, value) => update(next => { next.policy_links[index][key] = value })
const addLink = () => update(next => { if (next.policy_links.length < 4) next.policy_links.push({ id: crypto.randomUUID(), label: '', label_ar: '', url: '' }) })
const removeLink = index => update(next => { next.policy_links.splice(index, 1) })
</script>

<template>
  <fieldset :disabled="disabled" class="space-y-6" data-product-page-settings>
    <legend class="sr-only">{{ $t('productPage.settingsTitle') }}</legend>
    <div class="grid gap-3 sm:grid-cols-2" role="radiogroup" :aria-label="$t('productPage.settingsTitle')">
      <label v-for="option in ['classic', 'premium']" :key="option" class="flex cursor-pointer items-start gap-3 rounded-lg border p-4 focus-within:ring-2 focus-within:ring-blue-600" :class="pageStyle === option ? 'border-blue-600 bg-blue-50' : 'border-gray-200'">
        <input :checked="pageStyle === option" type="radio" name="product-page-style" :value="option" class="mt-1" @change="emit('update:pageStyle', option)">
        <span><span class="block text-sm font-semibold">{{ $t(`productPage.${option}`) }}</span><span class="mt-1 block text-sm text-gray-500">{{ $t(`productPage.${option}Description`) }}</span></span>
      </label>
    </div>
    <div>
      <h4 class="text-sm font-semibold">{{ $t('productPage.sectionsTitle') }}</h4>
      <p class="mt-1 text-sm text-gray-500">{{ $t('productPage.sectionsHelp') }}</p>
      <div class="mt-3 grid gap-3 sm:grid-cols-3">
        <label v-for="key in productPageSections" :key="key" class="flex items-center gap-2 text-sm"><input type="checkbox" :checked="editor.sections[key]" @change="setSection(key, $event.target.checked)">{{ $t(`productPage.sections.${key}`) }}</label>
      </div>
    </div>
    <div>
      <div class="flex flex-wrap items-center justify-between gap-3"><h4 class="text-sm font-semibold">{{ $t('productPage.policyLinks') }}</h4><button type="button" class="rounded-lg border px-3 py-2 text-sm disabled:opacity-50" :disabled="disabled || editor.policy_links.length >= 4" @click="addLink">{{ $t('productPage.add') }}</button></div>
      <p class="mt-1 text-sm text-gray-500">{{ $t('productPage.policyHelp') }}</p>
      <div v-for="(link, index) in editor.policy_links" :key="link.id" class="mt-3 grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
        <label class="text-sm">{{ $t('productPage.linkLabel') }}<input :value="link.label" maxlength="100" class="mt-1 w-full rounded-lg border p-2" @input="setLink(index, 'label', $event.target.value)"></label>
        <label class="text-sm">{{ $t('productPage.arabicLabel') }}<input :value="link.label_ar" maxlength="100" dir="rtl" class="mt-1 w-full rounded-lg border p-2" @input="setLink(index, 'label_ar', $event.target.value)"></label>
        <label class="text-sm sm:col-span-2">{{ $t('productPage.linkUrl') }}<input :value="link.url" maxlength="2048" dir="ltr" class="mt-1 w-full rounded-lg border p-2" @input="setLink(index, 'url', $event.target.value)"></label>
        <button type="button" class="justify-self-start text-sm text-red-700" @click="removeLink(index)">{{ $t('productPage.remove') }}</button>
      </div>
    </div>
  </fieldset>
</template>
