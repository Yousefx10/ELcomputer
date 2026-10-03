<template>
  <span class="inline-flex rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800" role="status">
    {{ error ? $t('erp.unavailable') : pending || !state ? $t('erp.loading') : $t(state.mode === 'daftra' ? 'erp.activeDaftra' : 'erp.activeBuiltIn') }}
  </span>
</template>
<script setup>
const {data:state,error,pending}=await useActiveErp()
</script>
