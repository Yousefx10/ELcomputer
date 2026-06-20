<template>
    <div>
        <p class="text-6xl font-bold uppercase">
        {{title}}
        </p>
        <span>{{description}}</span>

        <div>
            <div v-for="n in 6" class="m-3 p-5 bg-white/40 flex justify-normal inline-block" >
                <img src="https://placehold.co/150x150"/>
            </div>
        </div>
    </div>
</template>

<script setup>
defineProps({
    title:'',
    description:'',
})
</script>

<style>

</style>