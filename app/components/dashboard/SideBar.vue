<template>
    <aside class="text-center sticky top-5 w-64 h-64 mt-5 p-4 bg-gray-700 text-white">
        
        <NuxtLink
                    class="w-full bg-white block text-black my-5"
                    v-for="link in links"
                    :key="link.key"
                    :to="link.to">
                    {{ link.label }}
        </NuxtLink>

    </aside>
</template>

<script setup>
defineProps({
    links:Object
})
</script>

<style>

</style>