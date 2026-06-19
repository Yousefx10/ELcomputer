<template>
    <div>
        <section class="bg-black py-8">
            <div class="flex justify-evenly gap-2 overflow-x-auto px-6">
                <OfferCard
                    v-for="offer in offers"
                    :key="offer.id"
                    :image="offer.image"
                    :title="offer.title"
                />
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