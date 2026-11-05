<template>
 <aside v-if="state.enabled && publicPage" class="fixed bottom-3 inset-x-3 z-50 mx-auto max-w-xl rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
  <template v-if="state.choice===null || state.settingsOpen">
   <p class="font-semibold">{{ $t('metaTracking.privacyTitle') }}</p>
   <p class="mt-1">{{ $t('metaTracking.privacyDetail') }}</p>
   <p v-if="state.error" role="alert" class="mt-2 text-red-700">{{ $t('metaTracking.failed') }}</p>
   <div class="mt-3 flex flex-wrap gap-2"><button :disabled="state.busy" class="min-h-11 rounded-lg border px-3" @click="choose(false)">{{ $t('metaTracking.decline') }}</button><button :disabled="state.busy" class="min-h-11 rounded-lg bg-blue-700 px-3 text-white" @click="choose(true)">{{ $t('metaTracking.allow') }}</button><button v-if="state.choice!==null" class="min-h-11 px-3" @click="state.settingsOpen=false">{{ $t('common.close') }}</button></div>
  </template>
  <button v-else class="min-h-11" @click="state.settingsOpen=true">{{ $t('metaTracking.privacySettings') }}</button>
 </aside>
</template>
<script setup>
import {metaPublicPath} from '~/utils/metaTracking'
const {state,choose}=useMetaTracking(),route=useRoute(),publicPage=computed(()=>!!metaPublicPath(route.path))
</script>
