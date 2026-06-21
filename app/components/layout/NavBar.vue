<template>
    <header class="bg-black text-white">
        <nav class="container mx-auto flex items-center justify-between px-4 py-6">
            <div>
                <NuxtLink to="/">Elcomputer</NuxtLink>
            </div>
            <ul class="hidden lg:flex items-center gap-4 whitespace-nowrap">
                <li><NuxtLink to="/">Home</NuxtLink></li>
                <li><NuxtLink to="">Shop Category</NuxtLink></li>
                <li><NuxtLink to="">Return Policy</NuxtLink></li>
                <li><NuxtLink to="">Request Refund</NuxtLink></li>
                <li><NuxtLink to="">Tool Kit</NuxtLink></li>
                <li><input type="search" class="w-56 border rounded-full px-4 py-1"></li>
                <li><Icon name="lucide:user" size="24"/></li>
                <li><Icon name="lucide:shopping-cart" size="24"/></li>
            </ul>
            <button class="lg:hidden text-white" @click="isMenuOpen=!isMenuOpen">
                <Icon name="lucide:menu" size="28"/>
            </button>
        </nav>
        <div v-if="isMenuOpen" class="lg:hidden px-6 pb-6 flex justify-center">
            <ul class="grid grid-cols-2 gap-4 ">
                <li><NuxtLink to="/">Home</NuxtLink></li>
                <li><NuxtLink to="">Shop Category</NuxtLink></li>
                <li><NuxtLink to="">Return Policy</NuxtLink></li>
                <li><NuxtLink to="">Request Refund</NuxtLink></li>
                <li><NuxtLink to="">Tool Kit</NuxtLink></li>
                <li><input type="search" class="w-56 border rounded-full px-4 py-1"></li>
                <li><Icon name="lucide:user" size="24"/></li>
                <li><Icon name="lucide:shopping-cart" size="24"/></li>
            </ul>
        </div>
    </header>
</template>


<script setup>
const isMenuOpen = ref(false)

</script>


<style>

</style>