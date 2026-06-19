<template>
    <div>
        <p class="text-center font-bold text-4xl">TOP CATEGORIES</p>

        <section class="flex gap-5">
            <!-- writting extra for loop to repeat same data 5 times, temporary only -->
            <div class="flex flex-col items-center " v-for="n in 5">
                <div    v-for="offer in offers" :key="n"
                        class="rounded-[50px] overflow-hidden">
                    <img    class="w-full h-full object-cover" 
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
        }
    ]
</script>

<style>

</style>