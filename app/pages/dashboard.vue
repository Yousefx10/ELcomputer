<template>
  <div class="min-h-screen bg-gray-100 p-6">
    <div class="mx-auto max-w-5xl">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-3xl font-bold">Dashboard</h1>

        <button
          @click="logout"
          class="rounded-lg bg-black px-4 py-2 text-white"
        >
          Logout
        </button>
      </div>

      <form
        @submit.prevent="addProduct"
        class="mb-8 grid gap-3 rounded-2xl bg-white p-5 shadow md:grid-cols-2"
      >
        <input
          v-model="title"
          placeholder="Product title"
          class="rounded-lg border p-3"
        />

        <input
          v-model="category"
          placeholder="Category"
          class="rounded-lg border p-3"
        />

        <input
          v-model="price"
          type="number"
          placeholder="Price"
          class="rounded-lg border p-3"
        />

        <input
          v-model="oldPrice"
          type="number"
          placeholder="Old price"
          class="rounded-lg border p-3"
        />

        <input
          v-model="imageUrl"
          placeholder="Image URL"
          class="rounded-lg border p-3 md:col-span-2"
        />

        <p v-if="errorMessage" class="text-red-600 md:col-span-2">
          {{ errorMessage }}
        </p>

        <button
          type="submit"
          class="rounded-lg bg-blue-600 p-3 font-bold text-white md:col-span-2"
        >
          {{ loading ? 'Adding...' : 'Add Product' }}
        </button>
      </form>

      <div class="grid gap-4 md:grid-cols-3">
        <div
          v-for="product in products"
          :key="product.id"
          class="rounded-2xl bg-white p-4 shadow"
        >
          <img
            v-if="product.image_url"
            :src="product.image_url"
            class="mb-3 h-40 w-full rounded-xl object-cover"
          />

          <h2 class="font-bold">{{ product.title }}</h2>
          <p class="text-sm text-gray-500">{{ product.category }}</p>

          <div class="mt-3">
            <span class="font-bold text-blue-600">
              {{ product.price }} EGP
            </span>

            <span
              v-if="product.old_price"
              class="ml-2 text-sm text-gray-400 line-through"
            >
              {{ product.old_price }} EGP
            </span>
          </div>

          <button
            @click="deleteProduct(product.id)"
            class="mt-4 rounded-lg bg-red-600 px-3 py-2 text-sm text-white"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const supabase = useSupabaseClient()
const user =  useSupabaseUser()

watchEffect(()=>{
    if(user.value === null){
        navigateTo('/login')
    }
})

const title = ref('')
const price = ref('')
const oldPrice = ref('')
const category = ref('')
const imageUrl = ref('')
const products = ref([])
const loading = ref(false)
const errorMessage = ref('')
 




 const getProducts = async()=>{
    const {data,error} = await supabase
    .from('products')
    .select('*')
    .order('created_at',{ascending:false})

    if(error){
        errorMessage.value=error.message
        return
    }

    products.value=data
 }



 const addProduct = async() =>{
    loading.value=true
    errorMessage.value=''

    const {error} = await supabase.from('products').insert({
        title: title.value,
        price: Number(price.value),
        old_price: oldPrice.value ? Number(oldPrice.value) : null,
        category: category.value,
        image_url: imageUrl.value
    })

        loading.value=false

    if(error){
        errorMessage.value=error.message
        return
    }

    title.value = ''
    price.value = ''
    oldPrice.value = ''
    category.value = ''
    imageUrl.value = ''

    await getProducts()
 }
 const deleteProduct = async (id) =>{
    const {error} = await supabase
    .from('products')
    .delete()
    .eq('id',id)

    if(error){
        errorMessage.value = error.message
    }

    await getProducts()
 }

 const logout = async () =>{
    await supabase.auth.signOut()
    await navigateTo('/login')
 }

 onMounted(() =>{
    getProducts()
 })

</script>

<style>

</style>