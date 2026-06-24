<template>
    <header class="bg-black text-white">

        <!-- Default Desktop NavBar -->
        <nav class="container mx-auto flex items-center justify-between px-4 py-6">
            <div>
                <NuxtLink to="/">Elcomputer</NuxtLink>
            </div>
            <ul class="hidden lg:flex items-center gap-4 whitespace-nowrap">

                <li v-for="link in NavLinks" :key="link.label">
                    <NuxtLink :to="link.to">
                        {{ link.label }}
                    </NuxtLink>
                </li>

                <li><input type="search" class="w-56 border rounded-full px-4 py-1"></li>
                <li>
                    <NuxtLink to="/login">
                        <Icon name="lucide:user" size="24"/>
                    </NuxtLink>
                </li>
                <li><Icon name="lucide:shopping-cart" size="24"/></li>
            </ul>
            <button class="lg:hidden text-white cursor-pointer" @click="isMenuOpen=!isMenuOpen">
                <Icon name="lucide:menu" size="28"/>
            </button>
        </nav>

        <!-- Mobile NavBar -->
        <div v-if="isMenuOpen" class="lg:hidden px-6 pb-6 flex justify-center">
            <ul class="grid grid-cols-2 gap-4">

                <li v-for="link in NavLinks" :key="link.label" @click="isMenuOpen=false">
                    <NuxtLink :to="link.to">
                    {{ link.label }}
                    </NuxtLink>
                </li>

                <li><input type="search" class="w-56 border rounded-full px-4 py-1"></li>
                
                <li @click="isMenuOpen=false">
                    <NuxtLink to="/login">
                        <Icon name="lucide:user" size="24"/>
                    </NuxtLink>
                </li>

                <li @click="isMenuOpen=false"><Icon name="lucide:shopping-cart" size="24"/></li>
            </ul>
        </div>


    </header>
</template>


<script setup>
const isMenuOpen = ref(false)


const NavLinks = [
    {label : 'Home' , to : '/'},
    {label : 'Shop Category' , to : '/'},
    {label : 'Return Policy' , to : '/'},
    {label : 'Request Refund' , to : '/'},
    {label : 'Tool Kit' , to : '/'},
]

</script>


<style>

</style>