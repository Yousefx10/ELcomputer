import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,mkdtemp,mkdir,writeFile,symlink,rm,realpath,chmod} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {argumentsFor,toolHashes,createReleaseArchive,reuseReviewedBuild} from '../scripts/controlled-purchase-release/operator.mjs'
import {hash} from '../scripts/controlled-purchase-release/database.mjs'
const run=promisify(execFile)
test('inactive controlled purchase has independent approval and preserves consumed operators',async()=>{
 for(const dir of ['pdc-shipment-contract-release','pdc-v6-rpc-release','premium-product-finishing-release'])for(const file of ['operator.mjs','database.mjs','remote.py'])assert.equal(hash(await readFile('scripts/'+dir+'/'+file)),hash((await run('git',['show','6fc9b5b:scripts/'+dir+'/'+file],{encoding:'buffer'})).stdout))
 for(const args of [[],['apply','plan'],['apply','plan','--force','a'.repeat(64)],['apply','plan','--approved','short']])assert.throws(()=>argumentsFor(args))
 assert.equal(argumentsFor(['apply','plan','--approved','a'.repeat(64)]).approval,'a'.repeat(64))
 const source=await readFile('scripts/controlled-purchase-release/operator.mjs','utf8'),remote=await readFile('scripts/controlled-purchase-release/remote.py','utf8')
 assert.match(source,/plan\.format,8/);assert.match(source,/milestone:'controlled_purchase'/)
 assert.match(source,/qualification\.archive_sha256,candidate\.archive_sha256/);assert.match(source,/controlled-purchase-releases/)
 assert.match(source,/server\/utils\/controlledPurchase.js/);assert.doesNotMatch(source,/applyMigration|readOnly:\s*false/)
 assert.match(remote,/values\.get\('NUXT_CONTROLLED_PURCHASE','\{\}'\)=='\{\}'/)
 const hashes=await toolHashes();assert.ok(hashes['../../tests/controlled-purchase.test.mjs']);assert.ok(hashes['../../tests/controlled-purchase-ui.test.mjs'])
})
test('remote scope, filesystem and execution faults fail closed without target replay',async()=>{
 const {stdout,stderr}=await run('/usr/bin/python3',['-B','tests/controlled_purchase_release_test.py']);assert.match(stdout+stderr,/Ran 9 tests/);assert.match(stdout+stderr,/OK/)
})

test('archive normalizes safe symlink headers for the unchanged guarded extractor',async()=>{
 const {inventory}=await import('../scripts/publish/inventory.mjs'),{tmpdir}=await import('node:os'),{join}=await import('node:path')
 const root=await realpath(await mkdtemp(join(tmpdir(),'controlled-package-')))
 try{
  const build=join(root,'build'),output=join(build,'.output');await mkdir(join(output,'server'),{recursive:true,mode:0o755});await writeFile(join(output,'server/index.mjs'),'fixture',{mode:0o644});await symlink('index.mjs',join(output,'server/link.mjs'));await chmod(output,0o755);await chmod(join(output,'server'),0o755);await chmod(join(output,'server/index.mjs'),0o644)
  const entries=await inventory(output),file=join(root,'archive.tar.gz');await createReleaseArchive(build,file)
  await writeFile(join(root,'inventory.json'),JSON.stringify(entries))
  const code='import importlib.util,pathlib,json,sys,tarfile; s=importlib.util.spec_from_file_location("extractor","scripts/clean-reinstall/deploy.py");m=importlib.util.module_from_spec(s);s.loader.exec_module(m);t=tarfile.open(sys.argv[1]);links=[x for x in t if x.issym()];assert len(links)==1 and links[0].mode==0o755;m.extract_release(sys.argv[1],pathlib.Path(sys.argv[2]),json.loads(pathlib.Path(sys.argv[3]).read_text()))'
  await run('/usr/bin/python3',['-B','-c',code,file,join(root,'readback'),join(root,'inventory.json')])
  assert.deepEqual(await inventory(join(root,'readback')),entries)
 }finally{await rm(root,{recursive:true,force:true})}
})

test('reusing a completed build rejects changed source archives and changed output',async()=>{
 const {inventory}=await import('../scripts/publish/inventory.mjs'),{digest}=await import('../scripts/controlled-purchase-release/operator.mjs'),{applicationCommit}=await import('../scripts/controlled-purchase-release/database.mjs'),{tmpdir}=await import('node:os'),{join}=await import('node:path')
 const root=await realpath(await mkdtemp(join(tmpdir(),'controlled-reuse-')))
 try{
  const original=join(root,'original/build-source'),work=join(root,'new'),build=join(work,'build-source')
  await mkdir(join(original,'.output/server'),{recursive:true});await mkdir(build,{recursive:true})
  await writeFile(join(original,'.output/server/index.mjs'),'reviewed');await writeFile(join(original,'package-lock.json'),'owned-lock')
  await writeFile(join(root,'original/source.tar'),'source');await writeFile(join(work,'source.tar'),'source');await writeFile(join(root,'original/build.log'),'Build complete!');await writeFile(join(root,'original/npm-ci.log'),'completed')
  const app={'package-lock.json':hash('owned-lock')},spec={reuse_build:{application_commit:applicationCommit,directory:original,inventory_sha256:digest(await inventory(join(original,'.output')))}}
  await writeFile(join(work,'source.tar'),'changed');await assert.rejects(reuseReviewedBuild(spec,app,build,work));await writeFile(join(work,'source.tar'),'source')
  await writeFile(join(original,'.output/server/index.mjs'),'changed');await assert.rejects(reuseReviewedBuild(spec,app,build,work));await writeFile(join(original,'.output/server/index.mjs'),'reviewed')
  await reuseReviewedBuild(spec,app,build,work);assert.deepEqual(await inventory(join(build,'.output')),await inventory(join(original,'.output')))
 }finally{await rm(root,{recursive:true,force:true})}
})
