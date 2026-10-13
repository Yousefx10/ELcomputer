import { lstat } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { ensure, object, digest, frozenSource, validateTarget as databaseTarget, validateCredentials, validateOwner, sourceRoot } from '../install/contracts.mjs'
import { readProtected, createWorkspace, writeAtomic, canonicalPath, checkpointRead } from '../install/files.mjs'
import { planInstallation, validatePlan as databasePlan, readOnlyInstallation, executeInstallation, confirmation as databaseConfirmation } from '../install/workflow.mjs'
import { validateRegistry, validateTarget as publicationTarget } from '../publish/contracts.mjs'
import { buildPackage, loadBundle } from '../publish/bundle.mjs'
import { completedInstallation } from '../publish/installation.mjs'
import { prepareRuntime, validateRuntime } from '../publish/runtime.mjs'
import { planPublication, validatePlan as publicationPlan, executePublication, readOnlyPublication, confirmation as publicationConfirmation } from '../publish/workflow.mjs'
import { readChain, receipt as publicationReceipt } from '../publish/state.mjs'
import { openSsh, ingress } from '../publish/ssh.mjs'
import { bindPolicy, refreshPolicy } from '../lib/targetPolicy.mjs'
import { append, chain, lock } from './state.mjs'

const present=async path=>{try{await lstat(path);return true}catch(error){if(error.code==='ENOENT')return false;throw error}}
const manifestFields=['format','database_target_file','publication_target_file','legacy_registry_file','reservation_policy_file','credentials_file','owner_file','key_record_directory','locale']
const configurationFields=['database_target_file','publication_target_file','legacy_registry_file','reservation_policy_file']
const paths=directory=>({package:join(directory,'package'),database:join(directory,'database'),runtime:join(directory,'runtime'),publication:join(directory,'publication')})
function validateManifest(manifest){
  object(manifest,manifestFields);ensure(manifest.format===1&&['en','ar'].includes(manifest.locale))
  for(const key of manifestFields.filter(key=>key.endsWith('_file')||key.endsWith('_directory'))){const path=manifest[key];ensure(typeof path==='string'&&resolve(path)===path&&path.startsWith('/')&&path!==resolve(sourceRoot)&&!path.startsWith(resolve(sourceRoot)+'/'),'unsafe_file')}
  return manifest
}
function validateIntent(intent,deps){
  object(intent,['format','kind','created_at','manifest_file','manifest','manifest_sha256','configurations','source','database_target','publication_draft','registry','intent_digest'])
  const{intent_digest,...content}=intent
  ensure(intent.format===1&&intent.kind==='elcomputer-guided-fresh-installation'&&digest(content)===intent_digest&&digest(intent.manifest)===intent.manifest_sha256,'checkpoint_changed')
  validateManifest(intent.manifest);databaseTarget(intent.database_target)
  object(intent.configurations,configurationFields);validateRegistry(intent.registry)
  deps.publicationTarget({...intent.publication_draft,release_sha256:intent.publication_draft.release_sha256||'0'.repeat(64)},intent.registry)
  ensure(intent.database_target.reservation_policy&&digest(intent.database_target.reservation_policy)===digest(intent.publication_draft.reservation_policy),'policy_invalid')
  ensure(intent.publication_draft.installation_id===intent.database_target.installation_id&&intent.publication_draft.project_ref===intent.database_target.project_ref&&intent.publication_draft.site_origin===intent.database_target.site_origin,'target_changed')
  return intent
}
async function currentInputs(intent,deps){
  validateIntent(intent,deps)
  ensure(digest(await readProtected(intent.manifest_file))===intent.manifest_sha256,'target_changed')
  for(const[key,expected]of Object.entries(intent.configurations))ensure(digest(await readProtected(intent.manifest[key]))===expected,key==='reservation_policy_file'?'policy_changed':'target_changed')
  ensure(digest(await frozenSource())===digest(intent.source),'source_changed')
  await refreshPolicy(intent.database_target);await refreshPolicy(intent.publication_draft,{resolveAddresses:false})
  return validateCredentials(await readProtected(intent.manifest.credentials_file,{maxBytes:16384}),intent.database_target)
}
function runtimeOptions(intent,directory,target,installation,credentials){return{target,installation,credentials,directory:paths(directory).runtime,keyRecordDirectory:intent.manifest.key_record_directory}}
export function dependencies(overrides={}){return{publicationTarget,buildPackage,loadBundle,planInstallation,readOnlyInstallation,executeInstallation,completedInstallation,prepareRuntime,validateRuntime,planPublication,executePublication,readOnlyPublication,remoteFactory:openSsh,ingressCheck:ingress,...overrides}}
async function probe(target,registry,deps,{expected=null,fresh=true}={}){
  await refreshPolicy(target,{resolveAddresses:false})
  const remote=await deps.remoteFactory(target,registry,{expectedIdentity:expected?.ssh_identity})
  try{
    const observed=await remote.call('probe',{target,fresh}),front=await deps.ingressCheck(target,{before:fresh,expected:expected?.ingress,pending:!fresh})
    const proof={remote:observed,ssh_identity:remote.identity,agent_sha256:remote.agent_sha256,ingress:front}
    if(expected)ensure(digest(proof)===digest(expected),'target_changed')
    return proof
  }finally{await remote.close()}
}
async function step(directory,intent,stage,operation){
  const records=await chain(directory,intent),verified=records.findLast(row=>row.stage===stage&&row.status==='verified')
  if(verified)return verified.evidence
  const latest=records.at(-1)
  ensure(latest.stage!==stage||latest.status==='pending','checkpoint_changed')
  if(latest.stage!==stage)await append(directory,intent,stage,'pending')
  const evidence=await operation();await append(directory,intent,stage,'verified',evidence)
  return evidence
}
export async function prepareGuided({manifestFile,directory,overrides={}}){
  const deps=dependencies(overrides)
  const manifest=validateManifest(await readProtected(manifestFile)),binding=await bindPolicy(manifest.reservation_policy_file)
  const rawDatabase=await readProtected(manifest.database_target_file),rawPublication=await readProtected(manifest.publication_target_file),registry=validateRegistry(await readProtected(manifest.legacy_registry_file))
  ensure(!rawDatabase.reservation_policy&&!rawPublication.reservation_policy,'invalid_input')
  const database=databaseTarget({...rawDatabase,reservation_policy:binding})
  ensure(rawPublication.release_sha256===null||/^[a-f0-9]{64}$/.test(rawPublication.release_sha256),'invalid_input')
  const draft={...rawPublication,reservation_policy:binding};deps.publicationTarget({...draft,release_sha256:draft.release_sha256||'0'.repeat(64)},registry)
  ensure(draft.installation_id===database.installation_id&&draft.project_ref===database.project_ref&&draft.site_origin===database.site_origin,'target_changed')
  // Keys are created later by the existing runtime preparer, outside this workspace.
  const keyRoot=manifest.key_record_directory
  ensure(keyRoot!==directory&&!keyRoot.startsWith(directory+'/')&&!directory.startsWith(keyRoot+'/'),'unsafe_file')
  await canonicalPath(dirname(keyRoot));ensure(!await present(keyRoot),'unsafe_file')
  const configurations={};for(const key of configurationFields)configurations[key]=digest(await readProtected(manifest[key]))
  const body={format:1,kind:'elcomputer-guided-fresh-installation',created_at:new Date().toISOString(),manifest_file:manifestFile,manifest,manifest_sha256:digest(manifest),configurations,source:await frozenSource(),database_target:database,publication_draft:draft,registry}
  const intent={...body,intent_digest:digest(body)}
  await createWorkspace(directory);await writeAtomic(directory,'intent.json',intent,{exclusive:true});await append(directory,intent,'preparation','pending')
  const release=await lock(directory,intent)
  try{return await finishPreparation(directory,intent,deps)}finally{await release()}
}
async function finishPreparation(directory,intent,deps){
  const credentials=await currentInputs(intent,deps),p=paths(directory)
  const artifact=await step(directory,intent,'package',async()=>{
    if(!await present(p.package))await deps.buildPackage({directory:p.package,secrets:Object.values(credentials)})
    const bundle=await deps.loadBundle(join(p.package,'bundle.json'),{secrets:Object.values(credentials)})
    ensure(digest(bundle.manifest.source)===digest(intent.source),'source_changed')
    return{bundle_file:join(p.package,'bundle.json'),release_sha256:bundle.manifest.release_sha256}
  })
  const target={...intent.publication_draft,release_sha256:artifact.release_sha256}
  const checkedBundle=await deps.loadBundle(artifact.bundle_file,{secrets:Object.values(credentials)})
  ensure(checkedBundle.manifest.release_sha256===target.release_sha256&&digest(checkedBundle.manifest.source)===digest(intent.source),'source_changed')
  ensure(intent.publication_draft.release_sha256===null||intent.publication_draft.release_sha256===target.release_sha256,'source_changed')
  const preflight=await step(directory,intent,'preflight',()=>probe(target,intent.registry,deps))
  // Re-probe before first database planning too; an acknowledged preflight is historical.
  await probe(target,intent.registry,deps,{expected:preflight})
  const database=await step(directory,intent,'database-plan',async()=>{
    if(!await present(p.database))await deps.planInstallation({target:intent.database_target,credentials,directory:p.database})
    const plan=databasePlan(await readProtected(join(p.database,'plan.json'))),records=await checkpointRead(p.database,plan)
    ensure(digest(plan.target)===digest(intent.database_target)&&digest(plan.source)===digest(intent.source)&&records.at(-1).stage==='planned'&&records.at(-1).status==='ready','checkpoint_changed')
    return{plan_file:join(p.database,'plan.json'),plan_digest:plan.plan_digest}
  })
  const content={format:1,intent_digest:intent.intent_digest,target,preflight,bundle_file:artifact.bundle_file,database_plan_file:database.plan_file,database_plan_digest:database.plan_digest}
  const plan={...content,plan_digest:digest(content)},file=join(directory,'plan.json')
  if(await present(file))ensure(digest(await readProtected(file))===digest(plan),'checkpoint_changed')
  else await writeAtomic(directory,'plan.json',plan,{exclusive:true})
  if(!(await chain(directory,intent)).some(row=>row.stage==='planned'&&row.status==='verified'))await append(directory,intent,'planned','verified',{plan_digest:plan.plan_digest})
  const db=databasePlan(await readProtected(plan.database_plan_file))
  return{ok:true,stage:'awaiting_database_confirmation',workspace:directory,coordinator_plan_digest:plan.plan_digest,database_plan_file:plan.database_plan_file,database_plan_digest:db.plan_digest,confirmation:databaseConfirmation(db),confirmation_kind:'database',next:'apply',mutated:false}
}
async function loadPlan(directory,intent,deps){
  const plan=await readProtected(join(directory,'plan.json'));object(plan,['format','intent_digest','target','preflight','bundle_file','database_plan_file','database_plan_digest','plan_digest'])
  const{plan_digest,...body}=plan;ensure(plan.format===1&&plan.intent_digest===intent.intent_digest&&digest(body)===plan_digest,'checkpoint_changed')
  const records=await chain(directory,intent),approved=records.findLast(row=>row.stage==='planned'&&row.status==='verified'),artifact=records.findLast(row=>row.stage==='package'&&row.status==='verified'),front=records.findLast(row=>row.stage==='preflight'&&row.status==='verified')
  ensure(approved?.evidence.plan_digest===plan.plan_digest&&artifact?.evidence.release_sha256===plan.target.release_sha256&&digest(front?.evidence)===digest(plan.preflight),'checkpoint_changed')
  deps.publicationTarget(plan.target,intent.registry)
  ensure(digest({...plan.target,release_sha256:intent.publication_draft.release_sha256})===digest(intent.publication_draft),'target_changed')
  const p=paths(directory);ensure(plan.bundle_file===join(p.package,'bundle.json')&&plan.database_plan_file===join(p.database,'plan.json'),'checkpoint_changed')
  const db=databasePlan(await readProtected(plan.database_plan_file))
  ensure(db.plan_digest===plan.database_plan_digest&&digest(db.target)===digest(intent.database_target)&&digest(db.source)===digest(intent.source),'checkpoint_changed')
  return{plan,db,p}
}
async function originalPublication(directory,plan,intent){
  const p=paths(directory),pub=publicationPlan(await readProtected(join(p.publication,'plan.json')))
  ensure(digest(pub.target)===digest(plan.target)&&digest(pub.registry)===digest(intent.registry)&&digest(pub.bundle.source)===digest(intent.source),'target_changed')
  const expected={remote:pub.remote,ssh_identity:pub.ssh_identity,agent_sha256:pub.agent_sha256,ingress:pub.ingress}
  ensure(digest(expected)===digest(plan.preflight),'target_changed')
  ensure(pub.installation.receipt_file===join(p.database,'receipt.json')&&pub.bundle.bundle_file===plan.bundle_file,'checkpoint_changed')
  return pub
}
export async function runGuided({command,directory,confirmDatabase=null,confirmPublication=null,overrides={}}){
  ensure(['check','apply','resume','verify'].includes(command),'invalid_input')
  const deps=dependencies(overrides),intent=validateIntent(await readProtected(join(directory,'intent.json')),deps),release=await lock(directory,intent,{resume:command==='resume'})
  try{
    const credentials=await currentInputs(intent,deps),records=await chain(directory,intent)
    ensure(command!=='apply'||records.at(-1).stage!=='complete','installation_complete')
    if(!records.some(row=>row.stage==='planned'&&row.status==='verified')){
      ensure(command==='resume'&&!confirmDatabase&&!confirmPublication,'stage_uncertain')
      return await finishPreparation(directory,intent,deps)
    }
    const{plan,db,p}=await loadPlan(directory,intent,deps),dbRows=await checkpointRead(p.database,db),dbComplete=dbRows.at(-1).stage==='complete'&&dbRows.at(-1).status==='complete'
    const checkedBundle=await deps.loadBundle(plan.bundle_file,{secrets:Object.values(credentials)})
    ensure(checkedBundle.manifest.release_sha256===plan.target.release_sha256&&digest(checkedBundle.manifest.source)===digest(intent.source),'source_changed')
    const mutating=['apply','resume'].includes(command)
    if(dbComplete&&!await present(join(p.database,'receipt.json'))){
      ensure(command==='resume'&&records.some(row=>row.stage==='database'&&row.status==='pending')&&confirmDatabase===databaseConfirmation(db),'confirmation_required')
      await deps.executeInstallation({command:'resume',plan:db,directory:p.database,credentials,confirm:confirmDatabase})
    }
    if(!dbComplete){
      await probe(plan.target,intent.registry,deps,{expected:plan.preflight})
      if(!mutating){ensure(command!=='verify','checkpoint_changed');await deps.readOnlyInstallation({command:'check',plan:db,directory:p.database,credentials});return{ok:true,stage:'awaiting_database_confirmation',confirmation:databaseConfirmation(db),mutated:false}}
      ensure(confirmDatabase===databaseConfirmation(db),'confirmation_required')
      const owner=validateOwner(await readProtected(intent.manifest.owner_file,{maxBytes:8192}))
      await deps.loadBundle(plan.bundle_file,{secrets:[...Object.values(credentials),owner.password]})
      await step(directory,intent,'database',async()=>{
        await probe(plan.target,intent.registry,deps,{expected:plan.preflight})
        await deps.executeInstallation({command:dbRows.at(-1).stage==='planned'?'apply':'resume',plan:db,directory:p.database,credentials,owner,confirm:confirmDatabase})
        const installation=await deps.completedInstallation(join(p.database,'receipt.json'))
        return{receipt_file:installation.receipt_file,receipt_digest:installation.receipt_digest,plan_digest:db.plan_digest}
      })
    }else if(mutating){
      // Lost coordinator acknowledgement: only reconcile the original chain/receipt.
      const completed=await deps.completedInstallation(join(p.database,'receipt.json'))
      const pending=records.some(row=>row.stage==='database'&&row.status==='pending')
      ensure(pending,'checkpoint_changed')
      await step(directory,intent,'database',async()=>({receipt_file:completed.receipt_file,receipt_digest:completed.receipt_digest,plan_digest:db.plan_digest}))
    }
    await deps.readOnlyInstallation({command:'verify',plan:db,directory:p.database,credentials})
    if(!mutating&&!await present(p.publication)){ensure(command!=='verify','checkpoint_changed');return{ok:true,stage:'database_complete_publication_pending',mutated:false}}
    const receiptFor=completion=>({format:1,kind:'elcomputer-guided-installation',installation_id:db.target.installation_id,project_ref:db.target.project_ref,site_origin:db.target.site_origin,release_sha256:plan.target.release_sha256,intent_digest:intent.intent_digest,checkpoint_digest:completion.checkpoint_digest,...proof,setup_url:setup,pending:['Linux/hosted acceptance','independent production inventory review before any legacy-guard removal','backup/recovery and public-ingress review','commerce/provider acceptance']})
    if(mutating){
      await step(directory,intent,'database-verified',async()=>({receipt_file:join(p.database,'receipt.json'),plan_digest:db.plan_digest}))
      const installation=await deps.completedInstallation(join(p.database,'receipt.json'))
      await step(directory,intent,'runtime',async()=>{
        if(!await present(p.runtime))await deps.prepareRuntime(runtimeOptions(intent,directory,plan.target,installation,credentials))
        const runtimeFile=join(p.runtime,'runtime.json'),runtime=await deps.validateRuntime(await readProtected(runtimeFile),plan.target,installation,credentials)
        return{runtime_file:runtimeFile,runtime_id:runtime.runtime_id}
      })
      await step(directory,intent,'publication-plan',async()=>{
        if(!await present(p.publication))await deps.planPublication({target:plan.target,registry:intent.registry,receiptFile:join(p.database,'receipt.json'),bundleFile:plan.bundle_file,runtimeFile:join(p.runtime,'runtime.json'),credentials,directory:p.publication,remoteFactory:deps.remoteFactory,ingressCheck:deps.ingressCheck})
        const pub=await originalPublication(directory,plan,intent);await readChain(p.publication,pub)
        return{plan_file:join(p.publication,'plan.json'),plan_digest:pub.plan_digest}
      })
    }
    const pub=await originalPublication(directory,plan,intent);let pubRows=await readChain(p.publication,pub);const pubComplete=pubRows.at(-1).status==='complete'
    const owner=validateOwner(await readProtected(intent.manifest.owner_file,{maxBytes:8192}))
    if(!mutating&&command==='check'){
      await deps.readOnlyPublication({command:'check',plan:pub,directory:p.publication,credentials,remoteFactory:deps.remoteFactory,ingressCheck:deps.ingressCheck})
      return{ok:true,stage:pubComplete?'published_pending_final_verification':'awaiting_publication_confirmation',confirmation:publicationConfirmation(pub),mutated:false}
    }
    if(!pubComplete){
      ensure(mutating,'checkpoint_changed')
      if(!confirmPublication)return{ok:true,stage:'awaiting_publication_confirmation',publication_plan_file:join(p.publication,'plan.json'),publication_plan_digest:pub.plan_digest,confirmation:publicationConfirmation(pub),confirmation_kind:'publication',next:'apply',workspace:directory}
      ensure(confirmPublication===publicationConfirmation(pub),'confirmation_required')
      await step(directory,intent,'publication',async()=>{
        await deps.executePublication({command:pubRows.at(-1).stage==='planned'?'apply':'resume',plan:pub,directory:p.publication,credentials,runtimeFile:join(p.runtime,'runtime.json'),owner,confirm:confirmPublication,remoteFactory:deps.remoteFactory,ingressCheck:deps.ingressCheck})
        return{receipt_file:join(p.publication,'receipt.json'),plan_digest:pub.plan_digest}
      })
    }else if(mutating){
      ensure((await chain(directory,intent)).some(row=>row.stage==='publication'&&row.status==='pending'),'checkpoint_changed')
      await step(directory,intent,'publication',async()=>({receipt_file:join(p.publication,'receipt.json'),plan_digest:pub.plan_digest}))
    }
    // Component receipts are never generated by the coordinator.
    if(!await present(join(p.publication,'receipt.json'))){
      ensure(command==='resume'&&confirmPublication===publicationConfirmation(pub),'confirmation_required')
      await deps.executePublication({command:'resume',plan:pub,directory:p.publication,credentials,runtimeFile:join(p.runtime,'runtime.json'),owner,confirm:confirmPublication,remoteFactory:deps.remoteFactory,ingressCheck:deps.ingressCheck})
    }
    pubRows=await readChain(p.publication,pub)
    const saved=await readProtected(join(p.publication,'receipt.json'))
    ensure(digest(saved)===digest(publicationReceipt(pub,pubRows.at(-1))),'checkpoint_changed')
    const verify=async()=>{
      await deps.readOnlyPublication({command:'verify',plan:pub,directory:p.publication,credentials,owner,remoteFactory:deps.remoteFactory,ingressCheck:deps.ingressCheck})
      await deps.readOnlyInstallation({command:'verify',plan:db,directory:p.database,credentials})
      await currentInputs(intent,deps)
      return{installation_receipt_file:join(p.database,'receipt.json'),publication_receipt_file:join(p.publication,'receipt.json'),publication_receipt_digest:digest(saved),plan_digest:plan.plan_digest,policy_sha256:intent.database_target.reservation_policy.sha256,ingress_restricted:true}
    }
    const proof=await verify()
    const setup=plan.target.site_origin+(intent.manifest.locale==='ar'?'/ar':'')+'/dashboard/setup'
    if(mutating){
      await step(directory,intent,'final-verification',async()=>proof)
      const latest=(await chain(directory,intent)).at(-1)
      if(latest.stage!=='complete')await append(directory,intent,'complete','complete',proof)
      const completion=(await chain(directory,intent)).at(-1)
      await writeAtomic(directory,'receipt.json',receiptFor(completion))
    }else{const completion=(await chain(directory,intent)).at(-1);ensure(completion.stage==='complete'&&digest(await readProtected(join(directory,'receipt.json')))===digest(receiptFor(completion)),'checkpoint_changed')}
    return{ok:true,stage:'complete',complete:true,mutated:mutating,setup_url:setup,ingress_restricted:true,hosted_accepted:false}
  }finally{await release()}
}
