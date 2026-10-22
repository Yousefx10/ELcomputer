import assert from 'node:assert/strict'
import {readFile,access} from 'node:fs/promises'
import {dirname,join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {approvalState,digest,stable} from '../live-sales-release/operator.mjs'
import {hash,assertAdditive} from './database.mjs'

// Keep the established two-table live-telemetry projection. Migration89's
// committed receipt still proves exact preservation of ALL135 locked tables.
export function assertCommittedState(current,receipt,sourcePlan){
 assert.equal(current.read_only,'on','Activation observations must be read-only')
 assert.equal(receipt.after.read_only,'off','Committed migration receipt must identify its write transaction')
 assert.equal(receipt.schema,89);assert.equal(receipt.additive_schema,'PASS');assert.equal(receipt.classic_default,true)
 assert.equal(receipt.migration,sourcePlan.migration_sha256)
 assert.deepEqual(approvalState(current),approvalState({...receipt.after,read_only:'on'}),'Protected committed state changed')
 assertAdditive(sourcePlan.database.schema,current.schema)
 assert.deepEqual(current.controls,sourcePlan.database.controls);assert.deepEqual(current.auth_security,sourcePlan.database.auth_security)
 return current.protected_tables.filter(t=>t.schema==='public'&&['store_analytics_events','store_analytics_sessions'].includes(t.name)).map(t=>({schema:t.schema,name:t.name,count:t.count,sha256:t.sha256}))
}

export async function committedReleaseEvidence(planFile){
 const load=async file=>JSON.parse(await readFile(file,'utf8')),root=dirname(planFile),parent=dirname(root)
 const files={plan:planFile,intent:join(root,'execution-intent.json'),stop:join(root,'STOP.json'),precommit:join(root,'migration-before-commit.json'),committed:join(root,'migration-committed.json'),diagnosis:join(parent,'SCHEMA89-STOP-DIAGNOSIS.json'),preservation:join(parent,'SCHEMA89-PRESERVATION-VERIFICATION.json'),runtime:join(parent,'schema89-stopped-runtime.json'),database:join(parent,'schema89-stopped-database.json'),http:join(parent,'schema89-stopped-http.json'),browser:join(parent,'recovery-artifact-browser/browser-report.json'),dashboard:join(parent,'recovery-artifact-browser/dashboard-report.json'),readiness:join(parent,'FINAL-RECOVERY-PREPARATION-RECEIPT.json')}
 const v=Object.fromEntries(await Promise.all(Object.entries(files).map(async([name,file])=>[name,await load(file)])))
 const {seal,...body}=v.plan;assert.equal(digest(body),seal);assert.equal(v.plan.format,2)
 assert.equal(v.intent.plan_sha256,seal);assert.equal(v.intent.automatic_retry,false)
 assert.deepEqual(v.stop,{result:'STOP',phase:'schema89 private candidate',error_type:'AssertionError',code:'ERR_ASSERTION',automatic_retry:false,automatic_rollback:false})
 assert.deepEqual(v.precommit,v.committed);assert.equal(v.committed.preserved_tables,v.plan.database.protected_tables.length)
 assert.equal(v.diagnosis.result,'READ_ONLY_FAILURE_REPRODUCED');assert.equal(v.diagnosis.plan,seal);assert.equal(v.diagnosis.migration_committed,true);assert.equal(v.diagnosis.activation_attempted,false)
 const failure=v.diagnosis.steps.find(s=>s.result==='FAIL');assert.equal(failure.phase,'compareOriginal135');assert.match(failure.short_message,/^Existing row changed: "public"\."store_analytics_(events|sessions)"$/)
 assert.equal(v.preservation.result,'PASS_PROTECTED_STATE_PRESERVED');assert.equal(v.preservation.source_seal,seal);assert.equal(v.preservation.all135_original_tables_verified_at_commit,true);assert.equal(v.preservation.all_non_telemetry_data_matches_commit,true)
 assert.deepEqual(stable(v.runtime),stable(v.plan.before));assertCommittedState(v.database,v.committed,v.plan)
 assert.equal(v.readiness.seal,seal);assert.equal(v.readiness.result,'READY_FOR_FINAL_OWNER_APPROVAL')
 for(const[file,sha]of Object.entries(v.readiness.evidence_sha256))assert.equal(hash(await readFile(resolve(parent,file))),sha,'Qualified artifact evidence changed')
 assert.equal(hash(await readFile(v.plan.qualification.file)),v.plan.qualification.sha256)
 const qualification=await load(v.plan.qualification.file);assert.equal(qualification.result,'PASS');assert.equal(qualification.application_commit,v.plan.application_commit)
 for(const[file,sha]of Object.entries(qualification.evidence_sha256))assert.equal(hash(await readFile(file)),sha,'Application qualification changed')
 assert.equal(v.browser.checks.length,266);for(const name of ['errors','external','restFailures'])assert.equal(v.browser[name].length,0)
 for(const name of ['completed.json','runtime-after-activation.json','remote-candidate89.json','database-preactivation.json']){
  try{await access(join(root,name));assert.fail('Stopped plan contains unexpected candidate/activation evidence')}catch(e){if(e.code!=='ENOENT')throw e}
 }
 const here=dirname(fileURLToPath(import.meta.url));for(const[file,sha]of Object.entries(v.plan.tools))assert.equal(hash(await readFile(resolve(here,file))),sha,'Consumed executor changed')
 assert.equal(hash(await readFile(join(root,'release.tar.gz'))),v.plan.archive_sha256)
 assert.equal(digest(await load(join(root,'inventory.json'))),v.plan.inventory_sha256)
 return {plan_file:planFile,seal,release_id:v.plan.release_id,migration_sha256:v.plan.migration_sha256,result:'SCHEMA89_COMMITTED_ACTIVATION_NOT_ATTEMPTED',evidence_sha256:Object.fromEntries(await Promise.all(Object.values(files).map(async file=>[file,hash(await readFile(file))])))}
}
