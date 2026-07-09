<template>
  <div v-if="imageUrl" class="my-10">
    <a :href="linkUrl || '#'" class="block overflow-hidden rounded-3xl bg-gray-100">
      <div class="h-[180px] md:h-[220px]">
        <img class="h-full w-full object-cover" :src="imageUrl" :alt="altText">
      </div>
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
