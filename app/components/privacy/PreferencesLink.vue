<template>
 <button v-if="state.enabled && publicPage" type="button" class="underline" @click="state.settingsOpen=true">{{ $t('metaTracking.privacySettings') }}</button>
</template>
<script setup>
import {metaPublicPath} from '~/utils/metaTracking'
const {state}=useMetaTracking(),route=useRoute(),publicPage=computed(()=>!!metaPublicPath(route.path))
</script>
