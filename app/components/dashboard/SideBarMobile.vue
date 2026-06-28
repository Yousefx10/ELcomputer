<template>
    <!-- Mobile View -->
    <aside class="md:hidden bg-gray-700 text-white flex justify-center gap-5 p-2">
        <NuxtLink
                    class="border p-2 rounded-2xl"
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