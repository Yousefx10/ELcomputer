<template>
  <div class="bg-red-200">
    <LayoutTopBar/>
    <LayoutNavBar/>

    <main>
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