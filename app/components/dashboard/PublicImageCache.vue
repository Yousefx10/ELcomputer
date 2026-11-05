<template>
  <fieldset class="space-y-3 rounded-lg border p-4">
    <legend class="px-1 text-sm font-semibold">{{ $t('imageCache.title') }}</legend>
    <label class="flex items-center gap-2 text-sm"><input :checked="value.enabled" type="checkbox" @change="set('enabled',$event.target.checked)">{{ $t('imageCache.enabled') }}</label>
    <label class="block text-sm">{{ $t('imageCache.freshness') }}<select :value="value.maxAge" class="ms-2 rounded-lg border p-2" @change="set('maxAge',Number($event.target.value))"><option v-for="seconds in [0,3600,86400,604800]" :key="seconds" :value="seconds">{{ $t(`imageCache.age${seconds}`) }}</option></select></label>
    <p class="text-sm text-gray-500">{{ $t('imageCache.originals') }}</p>
    <p class="text-sm text-gray-500">{{ $t('imageCache.expiry') }}</p>
    <div class="flex flex-wrap gap-2"><button type="button" class="min-h-11 rounded-lg border px-3 text-sm" @click="invalidate">{{ $t('imageCache.invalidate') }}</button><button type="button" :disabled="busy" class="min-h-11 rounded-lg border px-3 text-sm" @click="inspect">{{ $t('imageCache.inspect') }}</button></div>
    <p v-if="diagnostics" role="status" class="text-sm">{{ $t('imageCache.verified',{seconds:diagnostics.configurationRefreshSeconds}) }}</p>
    <dl v-if="diagnostics?.diagnostics" class="grid grid-cols-2 gap-2 text-sm">
      <dt>{{ $t('imageCache.responses') }}</dt><dd>{{ diagnostics.diagnostics.responses }}</dd>
      <dt>{{ $t('imageCache.revalidated') }}</dt><dd>{{ diagnostics.diagnostics.revalidated }}</dd>
      <dt>{{ $t('imageCache.avoided') }}</dt><dd>{{ diagnostics.diagnostics.revalidationBytesAvoided }}</dd>
    </dl>
    <p v-if="diagnostics?.diagnostics" class="text-xs text-gray-500">{{ $t('imageCache.measurementScope') }}</p>
    <p v-if="failed" role="alert" class="text-sm text-red-700">{{ $t('imageCache.failed') }}</p>
  </fieldset>
</template>
<script setup>
import {normalizePublicImageCache} from '~/utils/publicImageCache'
const props=defineProps({modelValue:{type:Object,default:()=>({})}}),emit=defineEmits(['update:modelValue'])
const value=computed(()=>normalizePublicImageCache(props.modelValue)),session=useSupabaseSession(),busy=ref(false),failed=ref(false),diagnostics=shallowRef(null)
const set=(key,next)=>emit('update:modelValue',{...value.value,[key]:next})
const invalidate=()=>set('version',globalThis.crypto.randomUUID())
const inspect=async()=>{if(busy.value)return;busy.value=true;failed.value=false;try{const token=session.value?.access_token;if(!token)throw Error('Session unavailable');diagnostics.value=await $fetch('/api/admin-image-cache',{headers:{authorization:'Bearer '+token},retry:0,timeout:10000})}catch{failed.value=true}finally{busy.value=false}}
</script>
