<template>
    <div 
    class="relative flex-shrink-0 w-[150px] md:w-[200px] bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-lg transition">
        
        <img    class="relative object-cover w-full h-full"
                src="https://placehold.co/200x250" alt=""/>

        <div class="absolute inset-0 bg-black/20">
            Detailed Text
        </div>

        <button class="absolute bottom-8 left-6 border border-white/70 rounded-full p-2 bg-white/20 text-white font-bold px-1 py-1 text-sm md:px-6 md:py-3">
            View Offer
        </button>
    </div>
</template>

<script setup>
defineProps({
    image:String,
    title:String,
})
</script>

<style>

</style>