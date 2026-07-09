<template>
  <div>
    <p>ID from URL: {{ id }}</p>

    <div v-if="pending">
      Loading product...
    </div>

    <div v-else-if="error">
      Error: {{ error.message }}
    </div>

    <div v-else-if="product" class="">

      <form @submit.prevent="updateProduct">
        <input v-model="title" type="text" >
        <input v-model="price" type="number" >
        <input v-model="oldPrice" type="number" >
        <input v-model="imageUrl" type="text" >
        <input v-model="category" type="text" >

        <button
          type="submit"
          class="border p-5 rounded-2xl my-10">
          SAVE CHANGES
        </button>

        <button
          type="button"
          @click="deleteProduct"
          class="border p-5 rounded-2xl my-10 text-red-600">
          DELETE PRODUCT
        </button>

      </form>



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

// Form fields
const title = ref('')
const price = ref('')
const oldPrice = ref('')
const imageUrl = ref('')
const category = ref('')

// Fetch selected product
const { data: product, pending, error } = await useAsyncData(`edit-product-${id}`, async () => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  return data
})

// Put fetched product data into form fields
watchEffect(() => {
  if (product.value) {
    title.value = product.value.title
    price.value = product.value.price
    oldPrice.value = product.value.old_price
    imageUrl.value = product.value.image_url
    category.value = product.value.category
  }
})

// Update product
const updateProduct = async () => {
  const { error } = await supabase
    .from('products')
    .update({
      title: title.value,
      price: Number(price.value),
      old_price: oldPrice.value ? Number(oldPrice.value) : null,
      image_url: imageUrl.value,
      category: category.value
    })
    .eq('id', id)

  if (error) {
    console.log(error.message)
    return
  }

  await navigateTo('/dashboard/products')
}



const deleteProduct = async () => {
  const confirmDelete = confirm('Are you sure you want to delete this product?')

  if (!confirmDelete) {
    return
  }

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (error) {
    console.log(error.message)
    return
  }

  await navigateTo('/dashboard/products')
}
</script>

<style scoped>

/*
  Better LATER to use Tailwindcss @Apply
*/

input{
    /* 1px thick, solid line, light gray color */
    border: 1px solid #ccc;
    
    /* Keeps the ugly browser focus outline hidden */
    outline: none;

    display: block;
}

</style>