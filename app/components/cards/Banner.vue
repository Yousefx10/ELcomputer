<template>
  <div v-if="imageUrl" class="my-15">
    <a :href="linkUrl || '#'">
      <img class="mx-auto rounded-3xl object-cover" :src="imageUrl" :alt="altText">
    </a>
  </div>
</template>

<script setup>
defineProps({
  imageUrl: {
    type: String,
    default: ''
  },
  linkUrl: {
    type: String,
    default: ''
  },
  altText: {
    type: String,
    default: 'Banner Ad'
  }
})
</script>
