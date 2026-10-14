import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { applyCandidate, verifyBundle } from '../lib/cleanBaseline.mjs'
import { bootstrapFirstOwner, ownerBinding } from '../lib/installationBootstrap.mjs'
import { connectPlatform } from './platform.mjs'
import { ensure, fail, digest, object, frozenSource, validateTarget } from './contracts.mjs'
import { createWorkspace, writeAtomic, checkpointWrite, checkpointRead, workspaceLock, settledCliJobs, receipt } from './files.mjs'
import { refreshPolicy } from '../lib/targetPolicy.mjs'
import { assertFresh, verifySchema, verifyBaseline, readHistory, validateHistory, readJournal, assertJournal, verifyInstalledData, verifyBuckets, pendingIdentity, buckets } from './verify.mjs'
import { releasePlan, releaseStagesFor, assertReleaseSource, releaseObservation, assertFreshRelease, releaseHistory, verifyReleaseSchema, matchReleaseTarget, observeReleaseOwner } from './releases.mjs'

export const stages=['baseline','history','migration71','database','storage','owner','complete']
const stagesFor=source=>source.release?[...stages.slice(0,-1),...releaseStagesFor(source),'complete']:stages
export const confirmation=plan=>`${plan.target.project_ref}:${plan.target.installation_id}:${plan.plan_digest}`
export function validatePlan(plan) {
  object(plan,['format','engine','created_at','target','source','observation','owner_request_id','stages','plan_digest'])
  ensure(plan.format===1 && [1,2,3].includes(plan.engine) && Array.isArray(plan.stages),'checkpoint_changed')
  if(releasePlan(plan)){try{assertReleaseSource(plan.source,plan.engine)}catch{fail('checkpoint_changed')}}
  else ensure(!plan.source.release,'checkpoint_changed')
  ensure(JSON.stringify(plan.stages)===JSON.stringify(stagesFor(plan.source)),'checkpoint_changed')
  validateTarget(plan.target)
  const {plan_digest,...content}=plan
  ensure(/^[0-9a-f]{64}$/.test(plan_digest) && digest(content)===plan_digest,'checkpoint_changed')
  return plan
}
async function unchangedSource(plan) {
  await refreshPolicy(plan.target)
  try{assert.deepEqual(await frozenSource(),plan.source)}catch{fail('source_changed')}
}
async function unchangedTarget(platform,plan) {
  try{await matchReleaseTarget(platform,plan)}catch{fail('target_changed')}
}
export async function planInstallation({target,credentials,directory,platformFactory=connectPlatform}) {
  validateTarget(target)
  ensure(process.versions.node==='22.23.1','platform_unavailable')
  const source=await frozenSource()
  await createWorkspace(directory)
  const platform=await platformFactory(target,credentials)
  try{
    await assertFresh(platform)
    if(source.release)await assertFreshRelease(platform)
    const releaseStages=stagesFor(source)
    const content={format:1,engine:source.release?.id==='release-82-v1'?3:source.release?2:1,created_at:new Date().toISOString(),target,source,observation:source.release?releaseObservation(platform):platform.identity,owner_request_id:randomUUID(),stages:releaseStages}
    const plan={...content,plan_digest:digest(content)}
    await writeAtomic(directory,'plan.json',plan,{exclusive:true})
    await checkpointWrite(directory,plan,null,'planned','ready',{fresh_target:true})
    return {ok:true,command:'plan',plan_digest:plan.plan_digest,installation_id:target.installation_id,project_ref:target.project_ref,confirmation:confirmation(plan),stages:releaseStages}
  }finally{await platform.close()}
}
export async function observeInstallation(platform,plan,inventory,{complete=false}={}) {
  const journal=await readJournal(platform.db),history=await readHistory(platform.db)
  if(!journal){
    const installed=(await platform.db.query("select to_regclass('public.quick_setup_state') present")).rows[0].present
    if(!installed){await assertFresh(platform);ensure(!complete,'bootstrap_uncertain');return {stage:'planned',status:'ready'}}
    await verifyBaseline(platform,plan)
    if(history.length){validateHistory(history,inventory,{partial:true});if(releasePlan(plan))await releaseHistory(plan,history,{partial:true})}
    ensure(!complete,'bootstrap_uncertain')
    return {stage:history.length===70?'history':'baseline',status:'verified',covered_versions:history.length}
  }
  if(journal.phase==='complete'&&releasePlan(plan))return observeReleaseOwner(platform,plan,{complete})
  if(releasePlan(plan)){await verifyReleaseSchema(platform,plan,71);await releaseHistory(plan,history)}
  else await verifySchema(platform,71)
  assertJournal(journal,plan)
  validateHistory(history,inventory,{allow71:true})
  if(journal.phase==='complete') {
    const proof=await verifyInstalledData(platform,plan,{owner:journal.auth_subject,storage:true})
    const users=await platform.client.auth.admin.listUsers({page:1,perPage:2})
    ensure(!users.error&&users.data.users.length===1&&users.data.users[0].id===journal.auth_subject,'owner_unavailable')
    return {stage:'complete',status:'complete',...proof,covered_versions:70,migration71:true,buckets:6,owner_created:true,bootstrap_sealed:true}
  }
  const subject=journal.phase==='auth_started'?await pendingIdentity(platform,plan,journal):null
  const bucketIds=await verifyBuckets(platform)
  // Partial API-created buckets are expected only with an authorized checkpoint.
  const proof=await verifyInstalledData(platform,plan,{pendingSubject:subject,storage:'partial'})
  ensure(!complete,'bootstrap_uncertain')
  return {stage:journal.phase==='auth_started'?'owner':bucketIds.length===6?'storage':'database',status:'verified',...proof,covered_versions:70,migration71:true,buckets:bucketIds.length,owner_created:false}
}
export async function readOnlyInstallation({command,plan,directory,credentials,platformFactory=connectPlatform}) {
  validatePlan(plan);await unchangedSource(plan)
  const chain=await checkpointRead(directory,plan),latest=chain.at(-1),release=await workspaceLock(directory,plan)
  let platform
  try{
    await settledCliJobs(directory,plan)
    platform=await platformFactory(plan.target,credentials)
    await unchangedTarget(platform,plan)
    const {inventory}=await verifyBundle()
    const observation=await observeInstallation(platform,plan,inventory,{complete:command==='verify'&&latest.status==='complete'})
    if(command==='check'&&latest.stage==='planned')ensure(observation.stage==='planned','target_occupied')
    if(observation.stage!=='planned')ensure(chain.some(item=>item.stage==='baseline'&&item.status==='pending'),'checkpoint_changed')
    if(releasePlan(plan)&&['baseline','history'].includes(observation.stage)&&observation.covered_versions)ensure(chain.some(item=>item.stage==='history'&&item.status==='pending'),'checkpoint_changed')
    if(releasePlan(plan)&&observation.last_migration>71)for(let version=72;version<=observation.last_migration;version++)ensure(chain.some(item=>item.stage==='migration'+version&&item.status==='pending'),'checkpoint_changed')
    return {ok:true,command,plan_digest:plan.plan_digest,installation_id:plan.target.installation_id,project_ref:plan.target.project_ref,observation,mutated:false}
  }finally{await platform?.close();await release()}
}
export async function executeInstallation({command,plan,directory,credentials,owner,confirm,progress=()=>{},platformFactory=connectPlatform}) {
  validatePlan(plan);await unchangedSource(plan)
  ensure(confirm===confirmation(plan),'confirmation_required')
  let chain=await checkpointRead(directory,plan),checkpoint=chain.at(-1)
  if(command==='apply')ensure(checkpoint.stage==='planned'&&checkpoint.status==='ready','installation_complete')
  const release=await workspaceLock(directory,plan,{resume:command==='resume'})
  let platform
  try{
    await settledCliJobs(directory,plan)
    platform=await platformFactory(plan.target,credentials,{mutating:true});await unchangedTarget(platform,plan)
    const {inventory}=await verifyBundle()
    const mark=async(stage,status,evidence={})=>{
      await refreshPolicy(plan.target)
      platform.lease();checkpoint=await checkpointWrite(directory,plan,checkpoint,stage,status,evidence);chain.push(checkpoint)
      progress({stage,status})
    }
    const authorized=stage=>chain.some(item=>item.stage===stage&&item.status==='pending')||checkpoint.stage===stage&&checkpoint.status==='pending'
    const finishRelease=async()=>{
      // Every successful stage must have its original intent in this chain.
      // Live schema/history are checked before any new intent or SQL execution.
      for(const stage of stages.slice(0,-1))ensure(authorized(stage),'checkpoint_changed')
      let observed=await observeReleaseOwner(platform,plan)
      for(let version=72;version<=observed.last_migration;version++)ensure(authorized('migration'+version),'checkpoint_changed')
      if(!chain.some(item=>item.stage==='owner'&&item.status==='verified'))await mark('owner','verified',observed)
      for(let version=72;version<=plan.source.release.last_migration;version++){
        const stage='migration'+version
        if(observed.last_migration>=version){
          ensure(authorized(stage),'checkpoint_changed')
          if(!chain.some(item=>item.stage===stage&&item.status==='verified'))await mark(stage,'verified',{...observed,reconciled:true})
          continue
        }
        ensure(observed.last_migration===version-1,'history_uncertain')
        await mark(stage,'pending',{last_migration:version-1,normal_versions:observed.normal_versions})
        await unchangedSource(plan);platform.lease()
        await platform.cli(directory,inventory,{migrationHash:plan.source.migration71_sha256,followOn:plan.source.release.normal_migrations.slice(1,version-70)})
        observed=await observeReleaseOwner(platform,plan)
        ensure(observed.last_migration===version,'history_uncertain')
        await mark(stage,'verified',observed)
      }
      const proof=await observeReleaseOwner(platform,plan,{complete:true})
      await mark('complete','complete',proof)
      return {ok:true,command,plan_digest:plan.plan_digest,...proof}
    }
    if(checkpoint.status==='complete'){
      if(releasePlan(plan))for(const stage of plan.stages.filter(stage=>stage!=='complete'))ensure(authorized(stage),'checkpoint_changed')
      const observed=await observeInstallation(platform,plan,inventory,{complete:true})
      // The original engine re-publishes only its derived pointer after exact
      // live verification. No SQL, buckets, owner or checkpoints are replayed.
      await writeAtomic(directory,'receipt.json',receipt(plan,checkpoint))
      return {ok:true,command,...observed,plan_digest:plan.plan_digest}
    }
    ensure(owner,'invalid_input')
    let journal=await readJournal(platform.db)
    let baselinePresent=(await platform.db.query("select to_regclass('public.quick_setup_state') present")).rows[0].present
    if(baselinePresent&&journal?.phase==='complete'&&releasePlan(plan)){
      ensure(command==='resume','target_occupied');assertJournal(journal,plan,{complete:true})
      return await finishRelease()
    }
    if(!baselinePresent) {
      await assertFresh(platform)
      if(releasePlan(plan))await assertFreshRelease(platform)
      if(command==='resume')ensure(checkpoint.stage==='planned'||authorized('baseline'),'checkpoint_changed')
      await mark('baseline','pending')
      await unchangedSource(plan)
      try{
        await applyCandidate(platform.db,{installationId:plan.target.installation_id,validate:async()=>{await unchangedSource(plan);await verifySchema(platform,70)}})
      }catch{fail('stage_uncertain')}
      await verifyBaseline(platform,plan)
      await mark('baseline','verified',{application_schema_verified:true})
      baselinePresent=true
    }else{
      ensure(command==='resume'&&authorized('baseline'),'target_occupied')
      if(!journal)await verifyBaseline(platform,plan)
    }
    // A partial ledger is resumable only after the recorded certified adoption
    // intent. No arbitrary versions, SQL replay or unknown repair is accepted.
    let history=await readHistory(platform.db)
    if(!journal) {
      await verifyBaseline(platform,plan)
      const missing=history.length?validateHistory(history,inventory,{partial:true}):inventory.map(item=>item.version)
      if(releasePlan(plan)&&history.length){ensure(authorized('history'),'history_uncertain');await releaseHistory(plan,history,{partial:true})}
      if(history.length&&missing.length)ensure(authorized('history'),'history_uncertain')
      if(missing.length){
        await mark('history','pending')
        await unchangedSource(plan)
        await platform.cli(directory,inventory,{repairVersions:missing,migrationHash:plan.source.migration71_sha256})
        history=await readHistory(platform.db)
      }
      validateHistory(history,inventory)
      if(releasePlan(plan))await releaseHistory(plan,history,{partial:true})
      await verifyBaseline(platform,plan)
      await mark('history','verified',{covered_versions:70,historical_sql_executed:0})
      await mark('migration71','pending',{covered_versions:70})
      await unchangedSource(plan)
      await platform.cli(directory,inventory,{migrationHash:plan.source.migration71_sha256})
      journal=await readJournal(platform.db)
    }else{
      ensure(authorized('migration71'),'checkpoint_changed')
      // Schema 71 without its ledger entry is uncertain, never auto-repaired.
      validateHistory(history,inventory,{allow71:true})
    }
    if(releasePlan(plan)){await verifyReleaseSchema(platform,plan,71);await releaseHistory(plan,await readHistory(platform.db))}
    else await verifySchema(platform,71)
    assertJournal(journal,plan)
    validateHistory(await readHistory(platform.db),inventory,{allow71:true})
    if(journal.phase!=='available')ensure(authorized('database'),'checkpoint_changed')
    if(['auth_started','complete'].includes(journal.phase))ensure(authorized('owner'),'checkpoint_changed')
    const existingBuckets=await verifyBuckets(platform)
    if(existingBuckets.length)ensure(authorized('storage'),'checkpoint_changed')
    const existingSubject=journal.phase==='auth_started'?await pendingIdentity(platform,plan,journal):null
    await verifyInstalledData(platform,plan,{owner:journal.phase==='complete'?journal.auth_subject:null,pendingSubject:existingSubject,storage:'partial'})
    await mark('migration71','verified',{covered_versions:70,migration71:true})
    if(journal.phase==='complete'){
      if(releasePlan(plan))return await finishRelease()
      const proof=await observeInstallation(platform,plan,inventory,{complete:true})
      await mark('complete','complete',proof)
      return {ok:true,command,plan_digest:plan.plan_digest,...proof}
    }
    const binding=ownerBinding({installation_id:plan.target.installation_id,request_id:plan.owner_request_id,target_digest:plan.plan_digest,project_ref:plan.target.project_ref,site_origin:plan.target.site_origin},owner.email)
    if(journal.phase==='available') {
      await verifyInstalledData(platform,plan)
      await mark('database','pending',{covered_versions:70,migration71:true})
      await unchangedSource(plan)
      // Transfer the frozen source/target/stage authorization to migration 71's
      // immutable journal. Registration cannot create Auth or elevate anyone.
      await platform.db.query('select private.installation_register($1::jsonb)',[binding])
      journal=await readJournal(platform.db);assertJournal(journal,plan)
      await platform.db.query("select pg_notify('pgrst','reload schema')")
      await mark('database','verified',{covered_versions:70,migration71:true,permissions_verified:true})
    }else{
      ensure(authorized('database'),'checkpoint_changed')
      ensure(journal.binding.owner_email_digest===binding.owner_email_digest,'bootstrap_uncertain')
    }
    let bucketIds=await verifyBuckets(platform)
    if(bucketIds.length)ensure(authorized('storage'),'checkpoint_changed')
    if(bucketIds.length<6){
      ensure(journal.phase==='registered','bootstrap_uncertain')
      await mark('storage','pending',{covered_versions:70,migration71:true,buckets:bucketIds.length})
      for(const bucket of buckets){
        if(bucketIds.includes(bucket.id))continue
        platform.lease();await unchangedSource(plan)
        const result=await platform.client.storage.createBucket(bucket.id,{public:false,fileSizeLimit:bucket.file_size_limit,allowedMimeTypes:bucket.allowed_mime_types||undefined})
        // A lost response is resolved against both API and authoritative rows.
        bucketIds=await verifyBuckets(platform)
        if(result.error&&!bucketIds.includes(bucket.id))fail('stage_uncertain')
        ensure(bucketIds.includes(bucket.id),'stage_uncertain')
        await mark('storage','pending',{covered_versions:70,migration71:true,buckets:bucketIds.length})
      }
    }
    await verifyBuckets(platform,{complete:true})
    const subject=journal.phase==='auth_started'?await pendingIdentity(platform,plan,journal):null
    await verifyInstalledData(platform,plan,{pendingSubject:subject,storage:true})
    await mark('storage','verified',{covered_versions:70,migration71:true,buckets:6})
    await mark('owner','pending',{covered_versions:70,migration71:true,buckets:6})
    await unchangedSource(plan)
    try{
      await bootstrapFirstOwner({db:platform.db,authAdmin:platform.client.auth.admin,target:{installation_id:plan.target.installation_id,request_id:plan.owner_request_id,target_digest:plan.plan_digest,project_ref:plan.target.project_ref,site_origin:plan.target.site_origin},email:owner.email,password:owner.password,fullName:owner.full_name||'',confirmOwner:true})
    }catch{fail('bootstrap_uncertain')}
    if(releasePlan(plan))return await finishRelease()
    const proof=await observeInstallation(platform,plan,inventory,{complete:true})
    await mark('owner','verified',proof)
    await mark('complete','complete',proof)
    return {ok:true,command,plan_digest:plan.plan_digest,...proof}
  }finally{await platform?.close();await release()}
}
