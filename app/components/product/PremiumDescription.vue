<script setup>
defineProps({ blocks: { type: Array, default: () => [] } })
</script>
<template>
  <div class="pdp-description">
    <template v-for="(block, index) in blocks" :key="index">
      <p v-if="block.type === 'paragraph'">{{ block.text }}</p>
      <h3 v-else-if="block.type === 'heading'">{{ block.text }}</h3>
      <ul v-else-if="block.type === 'list'"><li v-for="(item, itemIndex) in block.items" :key="itemIndex">{{ item }}</li></ul>
      <dl v-else-if="block.type === 'detail'"><div><dt>{{ block.label }}</dt><dd>{{ block.value }}</dd></div></dl>
    </template>
  </div>
</template>
