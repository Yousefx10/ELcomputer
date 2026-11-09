import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('phone search stays hidden until the icon opens it at the bottom',async()=>{
 const css=await read('app/assets/css/mobile.css')
 assert.match(css,/\.store-search-wrap \{ display: none; position: fixed;[^}]*bottom: calc\(64px/)
 assert.match(css,/html\.store-search-open \.storefront \.store-search-wrap \{ display: block; \}/)
 assert.match(css,/html\.store-search-keyboard \.storefront \.store-search-wrap \{ bottom: var\(--phone-search-keyboard/)
 assert.match(css,/\.store-search-suggestions \{ top: auto; bottom: calc\(100% \+ 8px\)/)
})

test('every phone page can open search',async()=>{
 assert.match(await read('app/components/layout/MobileTabBar.vue'),/phoneSearch\.toggle\(\)/)
 const nav=await read('app/components/layout/NavBar.vue')
 assert.match(nav,/products\\\/\|cart\$\|checkout/)
 assert.match(nav,/store-search-action/)
 assert.match(nav,/store-search-dim/)
})

test('the keyboard opens within the tap and closing cleans up',async()=>{
 const code=await read('app/composables/usePhoneSearch.js')
 assert.ok(code.indexOf("classList.add('store-search-open')")<code.indexOf('.focus()'))
 assert.match(code,/classList\.remove\('store-search-open', 'store-search-keyboard'\)/)
 assert.match(code,/removeEventListener\('resize', place\)/)
})
