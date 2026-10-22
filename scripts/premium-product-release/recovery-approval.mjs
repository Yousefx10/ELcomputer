import assert from 'node:assert/strict'
import {readFile,access} from 'node:fs/promises'
import {dirname,join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {approvalState,digest,stable} from '../live-sales-release/operator.mjs'

// Connection modes are separate, positive requirements. Every protected state
// field still compares exactly, using the existing Auth/telemetry projection.
export function assertLockedApprovalState(locked,approved){
 assert.equal(approved.read_only,'on','Approved observation must be read-only')
 assert.equal(locked.read_only,'off','Approved migration must use a write transaction')
 const {read_only:lockedMode,...actual}=approvalState(locked)
 const {read_only:approvedMode,...expected}=approvalState(approved)
 assert.deepEqual(actual,expected,'Locked protected state differs from owner-approved state')
}

export async function stoppedReleaseEvidence(planFile){
 const load=async file=>JSON.parse(await readFile(file,'utf8')),root=dirname(planFile)
 const paths={plan:planFile,intent:join(root,'execution-intent.json'),stop:join(root,'STOP.json'),diagnosis:join(root,'..','STOP-DIAGNOSIS.json'),runtime:join(root,'..','stopped-runtime.json'),database:join(root,'..','stopped-database.json'),http:join(root,'..','stopped-http.json')}
 const values=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([name,file])=>[name,await load(file)])))
 const {seal,...body}=values.plan;assert.equal(digest(body),seal)
 assert.equal(values.intent.plan_sha256,seal);assert.equal(values.intent.automatic_retry,false)
 assert.deepEqual(values.stop,{result:'STOP',phase:'locked additive migration89',error_type:'AssertionError',code:'ERR_ASSERTION',automatic_retry:false,automatic_rollback:false})
 assert.equal(values.diagnosis.result,'CONFIRMED_ROLLED_BACK');assert.equal(values.diagnosis.consumed_seal,seal)
 assert.equal(values.diagnosis.production_schema,88);assert.equal(values.diagnosis.migration89_present,false);assert.equal(values.diagnosis.activation_attempted,false)
 assert.equal(values.diagnosis.production_matches_approved,true);assert.equal(values.diagnosis.production_diagnostic_writes,0)
 assert.deepEqual(values.diagnosis.synthetic_assertion.differing_top_level_keys,['read_only'])
 assert.deepEqual(stable(values.runtime),stable(values.plan.before));assert.deepEqual(approvalState(values.database),approvalState(values.plan.database))
 assert.equal(values.database.read_only,'on')
 for(const name of ['completed.json','migration-before-commit.json','migration-committed.json','runtime-after-activation.json']){
  try{await access(join(root,name));assert.fail('Stopped release has unexpected commit/activation evidence')}catch(e){if(e.code!=='ENOENT')throw e}
 }
 const here=dirname(fileURLToPath(import.meta.url))
 for(const[file,sha]of Object.entries(values.plan.tools))assert.equal(createHash('sha256').update(await readFile(resolve(here,file))).digest('hex'),sha,'Consumed release tools must remain immutable')
 return {plan_file:planFile,seal,release_id:values.plan.release_id,result:'CONFIRMED_ROLLED_BACK',evidence_sha256:Object.fromEntries(await Promise.all(Object.values(paths).map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])))}
}
