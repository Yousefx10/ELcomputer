<template>
    <div class="my-10 px-4 md:px-10 select-none">
        <h2 class="text-4xl md:text-7xl font-black tracking-tight uppercase">
        {{title}}
        </h2>
        <p class="mt-2 text-base md:text-lg text-gray-700">{{description}}</p>


        <div class="relative mt-6">
                <!--  -->
            <button
            class="cursor-pointer flex absolute left-0 top-1/2 -translate-y-1/2 z-10 h-14 w-14 items-center justify-center rounded-full bg-gray-700/80 text-white shadow-lg"
            @click="scrollLeft">
            ‹
            </button>
                <!--  -->
            <div    ref="slider" 
                    class="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 no-scrollbar">

                <CardsProductCard
                v-for="product in products"
                :key="product.id"
                :product="product"
                class="snap-start" />
            </div>
                <!--  -->
            <button
            class="cursor-pointer flex absolute right-0 top-1/2 -translate-y-1/2 z-10 h-14 w-14 items-center justify-center rounded-full bg-gray-700/80 text-white shadow-lg"
            @click="scrollRight">
            ›
            </button>
                <!--  -->
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



const slider =ref(null)
const scrollLeft = () => {
  slider.value?.scrollBy({
    left: -320,
    behavior: 'smooth'
  })
}

const scrollRight = () => {
  slider.value?.scrollBy({
    left: 320,
    behavior: 'smooth'
  })
}
</script>

<style>

</style>