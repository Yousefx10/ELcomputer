import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {argumentsFor,toolHashes} from '../scripts/pdc-shipment-contract-release/operator.mjs'
import {hash} from '../scripts/pdc-shipment-contract-release/database.mjs'
const run=promisify(execFile)

test('normal-shipment correction has a separate approval and preserves consumed operators',async()=>{
 for(const dir of ['pdc-v6-release','pdc-v6-rpc-release','premium-product-finishing-release'])for(const file of ['operator.mjs','database.mjs','remote.py'])assert.equal(hash(await readFile('scripts/'+dir+'/'+file)),hash((await run('git',['show','5c6c2e6:scripts/'+dir+'/'+file],{encoding:'buffer'})).stdout))
 for(const args of [[],['apply','plan'],['apply','plan','--force','a'.repeat(64)],['apply','plan','--approved','short']])assert.throws(()=>argumentsFor(args))
 assert.equal(argumentsFor(['apply','plan','--approved','a'.repeat(64)]).approval,'a'.repeat(64))
 const source=await readFile('scripts/pdc-shipment-contract-release/operator.mjs','utf8')
 assert.match(source,/plan\.format,7/);assert.match(source,/milestone:'pdc_shipment_contract'/);assert.match(source,/qualification\.archive_sha256,candidate\.archive_sha256/)
 assert.match(source,/pdc-shipment-contract-releases/);assert.match(source,/\['server\/utils\/pdcShipping.js'\]/);assert.doesNotMatch(source,/applyMigration|readOnly:\s*false/)
 const hashes=await toolHashes();assert.ok(hashes['../../tests/pdc-shipment-contract.test.mjs'])
})

test('remote fault matrix denies different scopes, SQL writes, altered proof and duplicate execution',async()=>{
 const {stdout,stderr}=await run('/usr/bin/python3',['-B','tests/pdc_shipment_contract_release_test.py'])
 assert.match(stdout+stderr,/Ran 9 tests/);assert.match(stdout+stderr,/OK/)
})
