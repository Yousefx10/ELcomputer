<template>
    <div>
        <div class="my-5">
            <p class="text-6xl font-bold uppercase">
            {{title}}
            </p>
            <span>{{description}}</span>
        </div>

        <div class="overflow-hidden">
                <div class="flex gap-5 animate-scroll">
                    <div v-for="n in 12" :key="n"
                        class="p-3 bg-white rounded-2xl border-2 border-gray-400 flex items-center justify-center">

                        <img class="max-w-[150px] max-h-[150px] object-contain"
                        src="https://placehold.co/150x150"/>
                        
                    </div>
                </div>
        </div>

    </div>
</template>

<script setup>
defineProps
({
    title:String,
    description:String,
})
</script>

<style scoped>
@keyframes scroll{
    from{
        transform: translateX(0);
    }
    to{
        transform: translateX(-50%);
    }
}

.animate-scroll{
        animation: scroll 30s linear infinite;
    }
</style>