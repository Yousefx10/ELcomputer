<template>
    <div>

    </div>
</template>

<script setup>
definePageMeta({
  layout:'dashboard'
})





const supabase = useSupabaseClient()


const getCategoriesLIST = async()=>{

    const {data,error} = await supabase
    .from("")
}
</script>

<style>

</style>