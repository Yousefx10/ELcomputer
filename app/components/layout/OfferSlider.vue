<template>
    <div>
        <section class="bg-black py-8">
            <div 
            class="flex gap-3 px-4 overflow-x-auto container mx-auto justify-center">
                <div v-for=" offer in offers" class="shrink-0 basis-[35%] md:basis-[21%] lg:basis-[15%]">
                    <OfferCard
                        :key="offer.id"
                        :image="offer.image"
                        :title="offer.title"
                    />
                </div>
            </div>
        </section>
    </div>
</template>

<script setup>
import OfferCard from '../cards/OfferCard.vue';

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