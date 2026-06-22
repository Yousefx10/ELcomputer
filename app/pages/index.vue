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



    <section class="container mx-auto pb-20">
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
            <HomeProductSection title="Keyboard" description="Long Description There" :products="keyboardProducts"/>
        </section>

        <!-- Product Section -->
        <section>
            <HomeProductSection title="Mouse" description="Long Description There" :products="mouseProducts"/>
        </section>

        <!-- Featured Brands Section -->
        <section>
            <FeaturedBrands title="Featured Brands" description="Shop by your favorite brand"/>
        </section>

        <!-- Product Section -->
        <section>
            <HomeProductSection title="Headset" description="Long Description There" :products="headsetProducts"/>
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






// fetch data from DB to be displayed
const supabase = useSupabaseClient()

const { data: products } = await useAsyncData('products',async() => {
    const { data , error } = await supabase
    .from('products')
    .select('*')
    .order('created_at',{ascending:false})

    if(error)
        throw error

    return data
})


const keyboardProducts = computed(() => {
    return products .value?.filter(product=>product.category === 'keyboard') || []
})

const mouseProducts = computed(() => {
    return products .value?.filter(product=>product.category === 'mouse') || []
})

const headsetProducts = computed(() => {
    return products .value?.filter(product=>product.category === 'headset') || []
})

</script>

<style>

</style>