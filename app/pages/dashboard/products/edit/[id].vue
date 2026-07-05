<template>
  <div>
    <p>ID from URL: {{ id }}</p>

    <div v-if="pending">
      Loading product...
    </div>

    <div v-else-if="error">
      Error: {{ error.message }}
    </div>

    <div v-else-if="product">
      <p>Title: {{ product.title }}</p>
      <p>Price: {{ product.price }}</p>
      <p>Old Price: {{ product.old_price }}</p>
      <p>Image URL: {{ product.image_url }}</p>
      <p>Category: {{ product.category }}</p>
    </div>

    <div v-else>
      No product found.
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: "dashboard"
})

const supabase = useSupabaseClient()

const route = useRoute()
const id = route.params.id

const { data: product, pending, error } = await useAsyncData(`edit-product-${id}`, async () => {
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