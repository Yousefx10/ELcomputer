<template>
    <div>
        <p class="text-center text-blue-500">index Content</p>
    </div>

    <section>
            <CardsHeroCard/>
    </section>

    <section>
        <!-- <CardsOfferCard class="mt-10 w-[250px]"/> -->
        <OfferSlider/>
    </section>

    <section class="container mx-auto pb-200">
        <!-- Site Content -->
    </section>

</template>

<script setup>
import OfferSlider from '~/components/layout/OfferSlider.vue';


</script>

<style>

</style>