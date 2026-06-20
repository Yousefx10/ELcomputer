<template>
    <p class="text-6xl font-bold">
        {{title}}
    </p>
    <span>{{description}}</span>
    <div class="flex gap-2 mt-5">
        <CardsProductCard/>
        <CardsProductCard/>
        <CardsProductCard/>
        <CardsProductCard/>
    </div>
</template>

<script setup>
defineProps({
    title:'',
    description:''
})
</script>

<style>

</style>