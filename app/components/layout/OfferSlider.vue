<template>

    <div class="relative mt-6 select-none container mx-auto">
            <!--  -->
        <button
            class="xl:hidden cursor-pointer flex absolute left-0 top-1/2 -translate-y-1/2 z-10 h-14 w-14 items-center justify-center rounded-full bg-gray-700/80 text-white shadow-lg"
            @click="scrollLeft">
            ‹
        </button>
            <!--  -->
        <div    ref="slider" 
                class="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 no-scrollbar justify-center">

            <OfferCard
                v-for=" offer in offers"
                :key="offer.id"
                :image="offer.image"
                :title="offer.title"
                class="snap-start"/>
            </div>
                <!--  -->
            <button
            class="xl:hidden cursor-pointer flex absolute right-0 top-1/2 -translate-y-1/2 z-10 h-14 w-14 items-center justify-center rounded-full bg-gray-700/80 text-white shadow-lg"
                @click="scrollRight">
            ›
            </button>
                <!--  -->
        </div>
</template>

<script setup>
import OfferCard from '../cards/OfferCard.vue';


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



const offers =[
    {
        id:1,
        title:'More to See',
        image:'https://placehold.co/250x300'
    },
        {
        id:2,
        title:'More to See',
        image:'https://placehold.co/250x300'
    },
        {
        id:3,
        title:'More to See',
        image:'https://placehold.co/250x300'
    },
        {
        id:4,
        title:'More to See',
        image:'https://placehold.co/250x300'
    },
        {
        id:5,
        title:'More to See',
        image:'https://placehold.co/250x300'
    },
]

</script>

<style>

</style>