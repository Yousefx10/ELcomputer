<template>
  <div class="min-h-screen bg-gray-100 p-6">
    <p class="text-center border-b-1 mb-5">
      Home of DASHBOARD page
    </p>
  </div>
</template>

<script setup>

definePageMeta({
  layout:'dashboard'
})

// const supabase = useSupabaseClient()
const user =  useSupabaseUser()

watchEffect(()=>{
    if(user.value === null){
        navigateTo('/login')
    }
})


  const logout = async () =>{
    await supabase.auth.signOut()
    await navigateTo('/login')
 }





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



 onMounted(() =>{

 })

</script>

<style>

</style>