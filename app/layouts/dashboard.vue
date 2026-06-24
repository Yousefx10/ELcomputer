<template>
  <div class="min-h-screen">
    <!-- 
    <LayoutTopBar/>
     -->

    <div class="mb-6 flex items-center justify-between">
        <h1 class="text-3xl font-bold">Dashboard</h1>

        <button
            @click="logout"
            class="rounded-lg bg-black px-4 py-2 text-white">
        Logout
        </button>
    </div>

     <LayoutDashboardNavBar/>
     
    <main class="">
        <slot />
    </main>


    <!-- <LayoutFooter/> -->
  </div>
</template>

<script setup>
/*
definePageMeta({
  layout: 'default'
})
*/

</script>

<style>

</style>