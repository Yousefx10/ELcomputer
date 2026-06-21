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
    <!-- Site Content [START]-->

        <!-- Top Categories Card -->
        <section>
            <TopCategories class="my-5"/>
        </section>

        <!-- Product Section -->
        <section>
            <HomeProductSection title="Big Title Here" description="Long Description There"/>
        </section>

        <!-- Product Section -->
        <section>
            <HomeProductSection title="Top Seller" description="Long Description There"/>
        </section>

        <!-- Image Banner -->
        <section>
            <CardsBanner/>
        </section>

        <!-- Product Section -->
        <section>
            <HomeProductSection title="Keyboard" description="Long Description There"/>
        </section>

        <!-- Product Section -->
        <section>
            <HomeProductSection title="Mouse" description="Long Description There"/>
        </section>

        <!-- Featured Brands Section -->
        <section>
            <FeaturedBrands title="Featured Brands" description="Shop by your favorite brand"/>
        </section>

        <!-- Product Section -->
        <section>
            <HomeProductSection title="Headset" description="Long Description There"/>
        </section>

        <!-- Product Section -->
        <section>
            <HomeProductSection title="Microphone" description="Long Description There"/>
        </section>

        <!-- Product Section -->
        <section>
            <HomeProductSection title="Mouse pad" description="Long Description There"/>
        </section>

        <!-- Image Banner -->
        <section>
            <CardsBanner/>
        </section>

        <!-- Product Section -->
        <section>
            <HomeProductSection title="Accessories" description="Long Description There"/>
        </section>

        <!-- Product Section -->
        <section>
            <HomeProductSection title="Hot sale" description="Long Description There"/>
        </section>

        <!-- Product Section -->
        <section>
            <HomeProductSection title="Top Rated" description="Long Description There"/>
        </section>

        <!-- Product Section -->
        <section>
            <HomeProductSection title="Recommended" description="Long Description There"/>
        </section>
    <!-- Site Content [END]-->
    </section>

</template>

<script setup>
import FeaturedBrands from '~/components/cards/FeaturedBrands.vue';
import TopCategories from '~/components/cards/TopCategories.vue';
import OfferSlider from '~/components/layout/OfferSlider.vue';


</script>

<style>

</style>