<template>
    <!-- Mobile View -->
    <aside class="md:hidden">
        <NuxtLink
                    class="w-full bg-red-200 block text-black my-5"
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