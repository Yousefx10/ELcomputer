import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { applyCandidate, verifyBundle } from '../lib/cleanBaseline.mjs'
import { bootstrapFirstOwner, ownerBinding } from '../lib/installationBootstrap.mjs'
import { connectPlatform } from './platform.mjs'
import { ensure, fail, digest, object, frozenSource, validateTarget } from './contracts.mjs'
import { createWorkspace, writeAtomic, checkpointWrite, checkpointRead, workspaceLock, settledCliJobs, receipt } from './files.mjs'
import { refreshPolicy } from '../lib/targetPolicy.mjs'
import { assertFresh, verifySchema, verifyBaseline, readHistory, validateHistory, readJournal, assertJournal, verifyInstalledData, verifyBuckets, pendingIdentity, buckets } from './verify.mjs'

export const stages=['baseline','history','migration71','database','storage','owner','complete']
export const confirmation=plan=>`${plan.target.project_ref}:${plan.target.installation_id}:${plan.plan_digest}`
export function validatePlan(plan) {
  object(plan,['format','engine','created_at','target','source','observation','owner_request_id','stages','plan_digest'])
  ensure(plan.format===1 && plan.engine===1 && Array.isArray(plan.stages) && JSON.stringify(plan.stages)===JSON.stringify(stages),'checkpoint_changed')
  validateTarget(plan.target)
  const {plan_digest,...content}=plan
  ensure(/^[0-9a-f]{64}$/.test(plan_digest) && digest(content)===plan_digest,'checkpoint_changed')
  return plan
}
async function unchangedSource(plan) {
  await refreshPolicy(plan.target)
  try{assert.deepEqual(await frozenSource(),plan.source)}catch{fail('source_changed')}
}
function unchangedTarget(platform,plan) {
  try{assert.deepEqual(platform.identity,plan.observation)}catch{fail('target_changed')}
}
export async function planInstallation({target,credentials,directory,platformFactory=connectPlatform}) {
  validateTarget(target)
  ensure(process.versions.node==='22.23.1','platform_unavailable')
  const source=await frozenSource()
  await createWorkspace(directory)
  const platform=await platformFactory(target,credentials)
  try{
    await assertFresh(platform)
    const content={format:1,engine:1,created_at:new Date().toISOString(),target,source,observation:platform.identity,owner_request_id:randomUUID(),stages}
    const plan={...content,plan_digest:digest(content)}
    await writeAtomic(directory,'plan.json',plan,{exclusive:true})
    await checkpointWrite(directory,plan,null,'planned','ready',{fresh_target:true})
    return {ok:true,command:'plan',plan_digest:plan.plan_digest,installation_id:target.installation_id,project_ref:target.project_ref,confirmation:confirmation(plan),stages}
  }finally{await platform.close()}
}
export async function observeInstallation(platform,plan,inventory,{complete=false}={}) {
  const journal=await readJournal(platform.db),history=await readHistory(platform.db)
  if(!journal){
    const installed=(await platform.db.query("select to_regclass('public.quick_setup_state') present")).rows[0].present
    if(!installed){await assertFresh(platform);ensure(!complete,'bootstrap_uncertain');return {stage:'planned',status:'ready'}}
    await verifyBaseline(platform,plan)
    if(history.length)validateHistory(history,inventory,{partial:true})
    ensure(!complete,'bootstrap_uncertain')
    return {stage:history.length===70?'history':'baseline',status:'verified',covered_versions:history.length}
  }
  await verifySchema(platform,71);assertJournal(journal,plan)
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
    unchangedTarget(platform,plan)
    const {inventory}=await verifyBundle()
    const observation=await observeInstallation(platform,plan,inventory,{complete:command==='verify'&&latest.status==='complete'})
    if(command==='check'&&latest.stage==='planned')ensure(observation.stage==='planned','target_occupied')
    if(observation.stage!=='planned')ensure(chain.some(item=>item.stage==='baseline'&&item.status==='pending'),'checkpoint_changed')
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
    platform=await platformFactory(plan.target,credentials,{mutating:true});unchangedTarget(platform,plan)
    const {inventory}=await verifyBundle()
    const mark=async(stage,status,evidence={})=>{
      await refreshPolicy(plan.target)
      platform.lease();checkpoint=await checkpointWrite(directory,plan,checkpoint,stage,status,evidence)
      progress({stage,status})
    }
    const authorized=stage=>chain.some(item=>item.stage===stage&&item.status==='pending')||checkpoint.stage===stage&&checkpoint.status==='pending'
    if(checkpoint.status==='complete'){
      const observed=await observeInstallation(platform,plan,inventory,{complete:true})
      // The original engine re-publishes only its derived pointer after exact
      // live verification. No SQL, buckets, owner or checkpoints are replayed.
      await writeAtomic(directory,'receipt.json',receipt(plan,checkpoint))
      return {ok:true,command,...observed,plan_digest:plan.plan_digest}
    }
    ensure(owner,'invalid_input')
    let journal=await readJournal(platform.db)
    let baselinePresent=(await platform.db.query("select to_regclass('public.quick_setup_state') present")).rows[0].present
    if(!baselinePresent) {
      await assertFresh(platform)
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
      if(history.length&&missing.length)ensure(authorized('history'),'history_uncertain')
      if(missing.length){
        await mark('history','pending')
        await unchangedSource(plan)
        await platform.cli(directory,inventory,{repairVersions:missing,migrationHash:plan.source.migration71_sha256})
        history=await readHistory(platform.db)
      }
      validateHistory(history,inventory)
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
    await verifySchema(platform,71);assertJournal(journal,plan)
    validateHistory(await readHistory(platform.db),inventory,{allow71:true})
    if(journal.phase!=='available')ensure(authorized('database'),'checkpoint_changed')
    if(['auth_started','complete'].includes(journal.phase))ensure(authorized('owner'),'checkpoint_changed')
    const existingBuckets=await verifyBuckets(platform)
    if(existingBuckets.length)ensure(authorized('storage'),'checkpoint_changed')
    const existingSubject=journal.phase==='auth_started'?await pendingIdentity(platform,plan,journal):null
    await verifyInstalledData(platform,plan,{owner:journal.phase==='complete'?journal.auth_subject:null,pendingSubject:existingSubject,storage:'partial'})
    await mark('migration71','verified',{covered_versions:70,migration71:true})
    if(journal.phase==='complete'){
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
    const proof=await observeInstallation(platform,plan,inventory,{complete:true})
    await mark('owner','verified',proof)
    await mark('complete','complete',proof)
    return {ok:true,command,plan_digest:plan.plan_digest,...proof}
  }finally{await platform?.close();await release()}
}
