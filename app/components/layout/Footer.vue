<template>
    <footer class="bg-black text-white pt-10 mb-0">

        <div class="container mx-auto p-5 bg-blue">

            <div class="text-center space-y-10">
                <img class="mx-auto"
                src="https://placehold.co/300x100"/>

                <div class="font-bold text-4xl">
                    <p>What are you waiting for?</p>
                    <p>Purchase your fav gear</p>
                </div>

                <button class="rounded-full bg-blue-600 p-6 font-bold">
                    Shop Now ->
                </button>
            </div>

            <div 
                class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 text-center md:text-start gap-10 mt-15 text-2xl border-t py-5">
                <div>
                    <h3 class="mb-6 font-bold">Shop</h3>
                    <ul class="space-y-4 text-gray-400">
                        <li><NuxtLink to="/" >Browse</NuxtLink></li>
                        <li><NuxtLink to="/" >Keyboards</NuxtLink></li>
                        <li><NuxtLink to="/" >Mice</NuxtLink></li>
                        <li><NuxtLink to="/">Headsets</NuxtLink></li>
                    </ul>

                    <h3 class="mt-10 mb-4 font-bold">Community</h3>
                    <ul class="space-y-4 text-gray-400">
                        <li><NuxtLink to="/" >Discord</NuxtLink></li>
                    </ul>
                </div>
                
                <div>
                    <h3 class="mb-6 font-bold">Explore</h3>
                    <ul class="space-y-4 text-gray-400">
                        <li><NuxtLink to="/" >Mouse Pads</NuxtLink></li>
                        <li><NuxtLink to="/" >Microphone</NuxtLink></li>
                        <li><NuxtLink to="/" >Accessories</NuxtLink></li>
                        <li><NuxtLink to="/">Webcam</NuxtLink></li>
                    </ul>
                </div>

                <div>
                    <h3 class="mb-6 font-bold">Support</h3>
                    <ul class="space-y-4 text-gray-400">
                        <li><NuxtLink to="/" >Contact us</NuxtLink></li>
                        <li><NuxtLink to="/" >Track Order</NuxtLink></li>
                        <li><NuxtLink to="/" >Return Policy</NuxtLink></li>
                        <li><NuxtLink to="/">Refund Request</NuxtLink></li>
                    </ul>
                </div>

                <div>
                    <h3 class="mb-6 font-bold">Connect</h3>
                    <ul class="space-y-4 text-gray-400">
                        <li><NuxtLink to="/" >Instagram</NuxtLink></li>
                        <li><NuxtLink to="/" >X(Twitter)</NuxtLink></li>
                        <li><NuxtLink to="/" >YouTube</NuxtLink></li>
                        <li><NuxtLink to="/" >Facebook</NuxtLink></li>
                        <li><NuxtLink to="/" >Amazon</NuxtLink></li>
                    </ul>
                </div>
                <div>
                    <h3 class="mb-6 font-bold">Contact</h3>
                    <ul class="space-y-4 text-gray-400">
                        <li class="text-white">EMAIL</li>
                        <li>info@elcomputer.net</li>
                        <li class="text-white">PHONE</li>
                        <li>01505121684</li>
                        <li>address address</li>
                    </ul>
                </div>
            </div>

                <p class="text-center border-t mt-10 py-5 text-lg">
                    © 2026 All rights reserved by <b>ELCOMPUTER</b>
                </p>


        </div>

    </footer>
</template>

<script setup>

</script>

<style>

</style>