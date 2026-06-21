<template>
    <div>
        <div class="my-5">
            <p class="text-6xl font-bold uppercase">
            {{title}}
            </p>
            <span>{{description}}</span>
        </div>

        <div class="overflow-hidden">
                <div class="flex gap-5 animate-scroll w-max">

                    <NuxtLink   v-for="brand in brands"
                                :key="'A'+brand.id"
                                :to="brand.link"
                                class="min-w-[150px] h-[180px] p-3 bg-white rounded-2xl border-2 border-gray-400 flex items-center justify-center">
                        
                        <img class="max-w-[150px] max-h-[150px] object-contain"
                        :src="brand.image"/>

                    </NuxtLink>

                    <!-- Second Dublicated Group, for seamless tranation -->
                    <NuxtLink   v-for="brand in brands"
                                :key="'B'+brand.id"
                                :to="brand.link"
                                class="min-w-[150px] h-[180px] p-3 bg-white rounded-2xl border-2 border-gray-400 flex items-center justify-center">
                        
                        <img class="max-w-[150px] max-h-[150px] object-contain"
                        :src="brand.image"/>

                    </NuxtLink>



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



//for testing purposes
const brands =[
    {
        id:1,
        image:'https://placehold.co/150x150',
        link:'/'
    },
    {
        id:2,
        image:'https://placehold.co/150x150',
        link:'/'
    },
    {
        id:3,
        image:'https://placehold.co/150x150',
        link:'/'
    },
    {
        id:4,
        image:'https://placehold.co/150x150',
        link:'/'
    },
    {
        id:5,
        image:'https://placehold.co/150x150',
        link:'/'
    },
    {
        id:6,
        image:'https://placehold.co/150x150',
        link:'/'
    },
    {
        id:7,
        image:'https://placehold.co/150x150',
        link:'/'
    },
    {
        id:8,
        image:'https://placehold.co/150x150',
        link:'/'
    },
]
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

.animate-scroll:hover {
    animation-play-state: paused;
}
</style>