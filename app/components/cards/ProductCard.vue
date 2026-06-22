<template>
    <div class="inline-block bg-white/90 border-1 border-gray-500 rounded-2xl w-[280px] h-[370px] overflow-hidden">

        <p class="text-center m-2">{{product.title}}</p>

        <div class="relative">
            <img    class="h-full w-full object-cover"
                    :src="product.image_url"
                    :alt="product.title"/>

            <span 
            class="absolute top-0 m-2 p-2 inline-block w-20 h-8 text-center bg-green-500/90 rounded-full text-white font-bold text-xs">
            25% OFF
            </span>

            <div class="flex justify-between p-5 items-center">
                <div class="flex flex-col">
                    <span>Buy For</span>
                    <span class="line-through" v-if="product.old_price">{{ product.old_price }} EGP</span>
                    <span class="text-blue-800 font-bold text-2xl">{{product.price}} EGP</span>
                </div>
                <button class="bg-blue-600 rounded-2xl h-[50px] w-[50px] font-bold text-white">+</button>
            </div>
        </div>
    </div>
</template>

<script setup>
defineProps({
    product:{
        type:Object,
        required: true
    }
})
</script>

<style>

</style>