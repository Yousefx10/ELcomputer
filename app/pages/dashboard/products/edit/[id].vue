<template>
    <div>
        {{ id }}
    </div>
</template>

<script setup>

definePageMeta({
    layout:"dashboard"
})


//getting URL slug ID
const route = useRoute()
const id = route.params.id


//Fetch Products
const { data: product } = await useAsyncData(`edit-product-${id}`, async () => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  return data
})


</script>

<style scoped>

</style>