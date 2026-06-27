<template>
    <div>
        <p class="text-center font-bold text-4xl pb-5">TOP CATEGORIES</p>

        <section class="flex gap-4">
            <!-- writting extra for loop to repeat same data 5 times, temporary only -->
            <div            class="flex flex-col items-center mx-auto" 
                            v-for="offer in offers" :key="offer.id">

                <div        class="rounded-[50px] overflow-hidden">
                    <img    class="max-w-full h-full object-cover" 
                            :src="offer.image"/>
                </div>

                <p class="font-bold py-3">{{offer.title}}</p>

            </div>
        </section>


    </div>
</template>

<script setup>
    const offers=[
        {
            id:1,
            image:'https://placehold.co/200x200',
            title:'Hedseat',
        },
        {
            id:2,
            image:'https://placehold.co/200x200',
            title:'Hedseat',
        },
        {
            id:3,
            image:'https://placehold.co/200x200',
            title:'Hedseat',
        },
        {
            id:4,
            image:'https://placehold.co/200x200',
            title:'Hedseat',
        },
        {
            id:5,
            image:'https://placehold.co/200x200',
            title:'Hedseat',
        },
        
        
    ]
</script>

<style>

</style>