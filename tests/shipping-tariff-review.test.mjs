import test from 'node:test'
import assert from 'node:assert/strict'
import { argumentsForTariffReview, assertTariffScope, tariffApplicationFiles } from '../scripts/prepare-shipping-tariff-review.mjs'
const migration='supabase/migrations/20261023010000_shipping_tariff_drafts.sql'
test('local review packager has no apply, activation or implicit preparation mode',()=>{
  for(const args of [[],['apply','plan'],['prepare','spec'],['verify','plan'],['prepare','spec','out','--apply']])assert.throws(()=>argumentsForTariffReview(args))
  assert.equal(argumentsForTariffReview(['prepare','spec','out']).directory.endsWith('/out'),true)
})
test('tariff review binds one migration and the exact application scope',()=>{
  assert.doesNotThrow(()=>assertTariffScope([...tariffApplicationFiles,migration,'docs/shipping-tariffs.md']))
  for(const paths of [[...tariffApplicationFiles], [...tariffApplicationFiles,migration,'server/utils/payments/paymob.js'],[...tariffApplicationFiles,migration,'supabase/migrations/20990101000000_unrelated.sql']])assert.throws(()=>assertTariffScope(paths))
})
