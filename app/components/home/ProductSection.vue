<template>
    <div class="my-3">
        <p class="text-6xl font-bold uppercase">
        {{title}}
        </p>
        <span>{{description}}</span>
        <div class="flex gap-2 my-5">
            <CardsProductCard
                v-for="product in products"
                :key="product.id"
                :product="product"
            />
        </div>
    </div>
</template>

<script setup>
defineProps({
    title:String,
    description:String,
    products:{
        type:Array,
        default:() => []
    }
})
</script>

<style>

</style>