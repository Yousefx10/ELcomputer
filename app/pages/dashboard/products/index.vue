<template>
    <!-- Component To View Products -->
    <div class="p-6">
        <h2 class="text-center font-bold text-4xl my-5">
            Watch All products
        </h2>
        <!-- Products -->
        <div class="grid gap-4 md:grid-cols-3">

            <div
                v-for="product in products" :key="product.id"
                class="rounded-2xl bg-white p5 shadow"
            >

                <img    v-if="product.image_url"
                        :src="product.image_url"
                        class="mb-3 h-40 w-full rounded-xl object-cover"
                />

                <h2 class="font-bold">
                   {{product.title}} 
                </h2>

                <p class="text-sm text-gray-500">
                    {{product.category}}
                </p>

                <div class="mt-3">
                    <span class="font-bold text-blue-600">
                        {{product.price}} EGP
                    </span>

                    <span   v-if="product.old_price" 
                            class="ml-2 text-sm text-gray-400 line-through">
                        {{product.old_price}} EGP
                    </span>
                </div>

                <div class="mb-2 text-center">
                    <button class="mt-4 rounded-lg bg-black px-3 py-2 text-sm text-white">
                        Edit Product
                    </button>
                </div>
            </div>



        </div>

    </div>
</template>

<script setup>
const supabase = useSupabaseClient()


const title = ref('')
const price = ref('')
const oldPrice = ref('')
const category = ref('')
const imageUrl = ref('')
const products = ref('')
const loading = ref('')
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

    products.value = data
}




onMounted(() =>{
    getProducts()
})

</script>

<style>

</style>