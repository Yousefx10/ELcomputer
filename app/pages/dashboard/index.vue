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

      <DashboardProducts/>

    </div>
  </div>
</template>

<script setup>

definePageMeta({
  layout:'default'
})




// const supabase = useSupabaseClient()
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
 



//  const addProduct = async() =>{
//     loading.value=true
//     errorMessage.value=''

//     const {error} = await supabase.from('products').insert({
//         title: title.value,
//         price: Number(price.value),
//         old_price: oldPrice.value ? Number(oldPrice.value) : null,
//         category: category.value,
//         image_url: imageUrl.value
//     })

//         loading.value=false

//     if(error){
//         errorMessage.value=error.message
//         return
//     }

//     title.value = ''
//     price.value = ''
//     oldPrice.value = ''
//     category.value = ''
//     imageUrl.value = ''

//     await getProducts()
//  }

//  const deleteProduct = async (id) =>{
//     const {error} = await supabase
//     .from('products')
//     .delete()
//     .eq('id',id)

//     if(error){
//         errorMessage.value = error.message
//     }

//     await getProducts()
//  }

 const logout = async () =>{
    await supabase.auth.signOut()
    await navigateTo('/login')
 }

 onMounted(() =>{

 })

</script>

<style>

</style>