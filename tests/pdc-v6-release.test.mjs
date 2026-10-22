import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {argumentsFor,toolHashes} from '../scripts/pdc-v6-release/operator.mjs'
import {hash} from '../scripts/pdc-v6-release/database.mjs'
const run=promisify(execFile)
test('PDC release preserves consumed operators and requires an independent exact approval',async()=>{
 for(const dir of ['premium-product-finishing-release','premium-product-release'])for(const file of ['operator.mjs','database.mjs','remote.py'])assert.equal(hash(await readFile('scripts/'+dir+'/'+file)),hash((await run('git',['show','f1e5146:scripts/'+dir+'/'+file],{encoding:'buffer'})).stdout))
 for(const args of [[],['apply','plan'],['apply','plan','--force','a'.repeat(64)],['apply','plan','--approved','short']])assert.throws(()=>argumentsFor(args))
 assert.equal(argumentsFor(['apply','plan','--approved','a'.repeat(64)]).approval,'a'.repeat(64));assert.equal(argumentsFor(['seal','candidate','qualification']).mode,'seal')
 const source=await readFile('scripts/pdc-v6-release/operator.mjs','utf8')
 assert.match(source,/plan\.format,5/);assert.match(source,/milestone:'pdc_v6_compatibility'/);assert.match(source,/qualification\.archive_sha256,candidate\.archive_sha256/)
 assert.match(source,/pdc-v6-compatibility-releases/);assert.doesNotMatch(source,/applyMigration|readOnly:\s*false/)
 const hashes=await toolHashes();assert.ok(hashes['../../tests/pdc-v6-compatibility.test.mjs']);assert.ok(hashes['../premium-product-finishing-release/database.mjs'])
})
test('PDC remote fault matrix rejects wrong approval/scope, writes, altered proofs and consumed attempts',async()=>{
 const {stdout,stderr}=await run('/usr/bin/python3',['-B','tests/pdc_v6_release_test.py']);assert.match(stdout+stderr,/Ran 9 tests/);assert.match(stdout+stderr,/OK/)
})
