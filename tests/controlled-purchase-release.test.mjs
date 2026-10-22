import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {argumentsFor,toolHashes} from '../scripts/controlled-purchase-release/operator.mjs'
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
