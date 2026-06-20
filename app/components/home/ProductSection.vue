<template>
    <div class="my-3">
        <p class="text-6xl font-bold uppercase">
        {{title}}
        </p>
        <span>{{description}}</span>
        <div class="flex gap-2 my-5">
            <CardsProductCard/>
            <CardsProductCard/>
            <CardsProductCard/>
            <CardsProductCard/>
        </div>
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