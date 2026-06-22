<template>
    <div class="relative border rounded-2xl w-[200px] h-[300px] overflow-hidden">
        <img    class="object-cover w-full h-full"
                src="https://placehold.co/200x300" alt=""/>

                <div class="absolute inset-0 bg-black/20">
                    Detailed Text
                </div>

                <button class="absolute bottom-8 left-6 border border-white/70 rounded-full p-2 bg-white/20 text-white font-bold px-6 py-3">
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