import test from 'node:test'
import assert from 'node:assert/strict'
import { argumentsForTariffReview, assertTariffScope, tariffApplicationFiles, immutableTariffAsset, assertTariffBuildReuse, extractTariffReview } from '../scripts/prepare-shipping-tariff-review.mjs'
import { mkdtemp, writeFile, readFile, mkdir, realpath, rm } from 'node:fs/promises'
import { create as tarCreate } from 'tar'
import { inventory } from '../scripts/publish/inventory.mjs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
const migration='supabase/migrations/20261023010000_shipping_tariff_drafts.sql'
test('local review packager has no apply, activation or implicit preparation mode',()=>{
  for(const args of [[],['apply','plan'],['prepare','spec'],['verify','plan'],['prepare','spec','out','--apply']])assert.throws(()=>argumentsForTariffReview(args))
  assert.equal(argumentsForTariffReview(['prepare','spec','out']).directory.endsWith('/out'),true)
})
test('tariff review binds one migration and the exact application scope',()=>{
  assert.doesNotThrow(()=>assertTariffScope([...tariffApplicationFiles,migration,'docs/shipping-tariffs.md']))
  for(const paths of [[...tariffApplicationFiles], [...tariffApplicationFiles,migration,'server/utils/payments/paymob.js'],[...tariffApplicationFiles,migration,'supabase/migrations/20990101000000_unrelated.sql']])assert.throws(()=>assertTariffScope(paths))
})
test('retention excludes only Nuxt mutable latest pointer, keeping old build metadata',()=>{
  assert.equal(immutableTariffAsset('public/_nuxt/builds/latest.json'),false)
  assert.equal(immutableTariffAsset('public/_nuxt/builds/meta/previous.json'),true)
  assert.equal(immutableTariffAsset('public/_nuxt/previous.js'),true)
  assert.equal(immutableTariffAsset('public/uploads/private.jpg'),false)
})
test('build reuse rejects changed source-archive bytes before reading or copying output',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'tariff-review-reuse-'))
  try{
    const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),file=dir+'/source.tar'
    await writeFile(file,'changed archive')
    await assert.rejects(()=>assertTariffBuildReuse({application_commit:head,reuse_build:{application_commit:head,source_archive:file,source_archive_sha256:'0'.repeat(64)}},dir))
  }finally{await rm(dir,{recursive:true,force:true})}
})
test('actual archive readback creates its destination exclusively and preserves an occupied one',async()=>{
  const dir=await realpath(await mkdtemp(join(tmpdir(),'tariff-review-extract-')))
  try{
    await mkdir(dir+'/.output/server',{recursive:true,mode:0o755})
    await writeFile(dir+'/.output/server/index.mjs','export {};\n',{mode:0o644})
    const entries=await inventory(dir+'/.output')
    await writeFile(dir+'/inventory.json',JSON.stringify(entries))
    await tarCreate({cwd:dir,file:dir+'/archive.tar.gz',gzip:true,portable:true,noMtime:true},['.output'])
    await extractTariffReview(dir+'/archive.tar.gz',dir+'/inventory.json',dir+'/new-output',dir+'/readback.log')
    assert.equal(await readFile(dir+'/new-output/server/index.mjs','utf8'),'export {};\n')
    await assert.rejects(()=>extractTariffReview(dir+'/archive.tar.gz',dir+'/inventory.json',dir+'/new-output',dir+'/occupied.log'))
    assert.equal(await readFile(dir+'/new-output/server/index.mjs','utf8'),'export {};\n')
  }finally{await rm(dir,{recursive:true,force:true})}
})
