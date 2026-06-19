<template>
  <div class="bg-red-200 min-h-screen">
    <LayoutTopBar/>
    <LayoutNavBar/>

    <main class="container mx-auto">
        <slot />
    </main>


    <LayoutFooter/>
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