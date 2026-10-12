import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { frozenSource, sourceRoot, validateCredentials } from '../install/contracts.mjs'
import { createWorkspace, readProtected, writeAtomic, privateDirectory } from '../install/files.mjs'
import { ensure, digest, object, fail } from './contracts.mjs'
import { completedInstallation, verifyInstallation } from './installation.mjs'
import { loadBundle } from './bundle.mjs'
import { validateRuntime } from './runtime.mjs'
import { openSsh, ingress, agentSource } from './ssh.mjs'
import { checkpoint, readChain, receipt, lock } from './state.mjs'

export const confirmation=plan=>`${plan.target.project_ref}:${new URL(plan.target.site_origin).hostname}:${plan.target.ssh.host_key_sha256}:${plan.plan_digest}`
export function validatePlan(plan){object(plan,['format','kind','created_at','target','registry','installation','bundle','runtime_id','remote','ssh_identity','ingress','launcher_sha256','agent_sha256','plan_digest']);const{plan_digest,...content}=plan;ensure(plan.format===1&&plan.kind==='elcomputer-first-publication'&&digest(content)===plan_digest,'checkpoint_changed');return plan}
async function sourceUnchanged(bundle,sourceReader){ensure(digest(await sourceReader())===digest(bundle.source),'source_changed')}
function installationBinding(target,installation){ensure(target.installation_id===installation.plan.target.installation_id&&target.project_ref===installation.plan.target.project_ref&&target.site_origin===installation.plan.target.site_origin,'receipt_unverified')}
async function originalInstallation(plan){const installation=await completedInstallation(plan.installation.receipt_file);ensure(installation.receipt_digest===plan.installation.receipt_digest&&installation.plan.plan_digest===plan.installation.plan_digest,'receipt_unverified');return installation}
async function login(verified,installation,owner){
  ensure(owner&&typeof owner.email==='string'&&typeof owner.password==='string','invalid_input')
  const result=await verified.platform.anon.auth.signInWithPassword({email:owner.email,password:owner.password})
  const journal=(await verified.platform.db.query('select auth_subject from private.installation_bootstrap')).rows[0]
  ensure(!result.error&&result.data.user?.id===journal.auth_subject&&result.data.session?.access_token,'health_failed')
  return result.data.session.access_token
}
export async function planPublication({target,registry,receiptFile,bundleFile,runtimeFile,credentials,directory,sourceReader=frozenSource,remoteFactory=openSsh,ingressCheck=ingress,installationVerifier=verifyInstallation}){
  const installation=await completedInstallation(receiptFile);installationBinding(target,installation);validateCredentials(credentials,installation.plan.target)
  const runtime=await validateRuntime(await readProtected(runtimeFile),target,installation,credentials),bundle=await loadBundle(bundleFile,{secrets:[...Object.values(runtime.env),...Object.values(credentials)]})
  ensure(bundle.manifest.release_sha256===target.release_sha256,'source_changed');await sourceUnchanged(bundle.manifest,sourceReader)
  await createWorkspace(directory)
  let verified,remote
  try{
    verified=await installationVerifier(installation,credentials)
    remote=await remoteFactory(target,registry)
    const observation=await remote.call('probe',{target,fresh:true}),front=await ingressCheck(target,{before:true}),launcher=await readFile(resolve(sourceRoot,'scripts/publish/launcher.mjs'))
    const content={format:1,kind:'elcomputer-first-publication',created_at:new Date().toISOString(),target,registry,installation:{receipt_file:receiptFile,receipt_digest:installation.receipt_digest,plan_digest:installation.plan.plan_digest,proof:verified.proof},bundle:{...bundle.manifest,bundle_file:bundleFile},runtime_id:runtime.runtime_id,remote:observation,ssh_identity:remote.identity,ingress:front,launcher_sha256:(await import('./contracts.mjs')).hash(launcher),agent_sha256:remote.agent_sha256}
    const plan={...content,plan_digest:digest(content)}
    const privateRoot=join(directory,'private');await mkdir(privateRoot,{mode:0o700});await writeAtomic(privateRoot,'approved-runtime.json',runtime,{exclusive:true})
    await writeAtomic(directory,'plan.json',plan,{exclusive:true});await checkpoint(directory,plan,null,'planned','ready',{installation_verified:true,vps_fresh:true,ingress_restricted:true})
    return{ok:true,command:'plan',plan_digest:plan.plan_digest,publication_id:target.publication_id,confirmation:confirmation(plan)}
  }finally{await remote?.close();await verified?.close()}
}
export async function executePublication({command,plan,directory,credentials,runtimeFile,owner,confirm,progress=()=>{},sourceReader=frozenSource,remoteFactory=openSsh,ingressCheck=ingress,installationVerifier=verifyInstallation}){
  validatePlan(plan);await sourceUnchanged(plan.bundle,sourceReader)
  ensure(confirm===confirmation(plan),'confirmation_required')
  const installation=await originalInstallation(plan);installationBinding(plan.target,installation);validateCredentials(credentials,installation.plan.target)
  const runtime=await validateRuntime(await readProtected(runtimeFile),plan.target,installation,credentials),approved=await readProtected(join(directory,'private/approved-runtime.json'))
  try{assert.deepEqual(runtime,approved)}catch{fail('runtime_changed')}
  const bundle=await loadBundle(plan.bundle.bundle_file,{secrets:[...Object.values(runtime.env),...Object.values(credentials),owner?.password]});ensure(bundle.manifest.release_sha256===plan.target.release_sha256,'source_changed')
  const chain=await readChain(directory,plan);let current=chain.at(-1)
  if(command==='apply')ensure(current.stage==='planned'&&current.status==='ready','already_complete')
  const release=await lock(directory,plan,{resume:command==='resume'});let verified,remote
  const mark=async(stage,status,evidence={})=>{verified.platform.lease();current=await checkpoint(directory,plan,current,stage,status,evidence);progress({stage,status})}
  try{
    verified=await installationVerifier(installation,credentials,{exclusive:true})
    const token=await login(verified,installation,owner)
    remote=await remoteFactory(plan.target,plan.registry,{expectedIdentity:plan.ssh_identity})
    ensure(remote.agent_sha256===plan.agent_sha256,'source_changed')
    await ingressCheck(plan.target,{expected:plan.ingress,before:current.stage==='planned',pending:command==='resume'&&current.status!=='complete'})
    const state=await remote.call('claim',{plan,resume:command==='resume'})
    if(current.status==='complete'){
      ensure(state.complete,'checkpoint_changed');await remote.call('audit',{runtime});const health=await remote.call('health',{token,verifyOnly:true});await ingressCheck(plan.target,{expected:plan.ingress,token});await writeAtomic(directory,'receipt.json',receipt(plan,current));return{ok:true,command,publication_id:plan.target.publication_id,complete:true,health}
    }
    if(state.phase!=='claimed')ensure(chain.some(item=>item.stage==='transfer'&&item.status==='pending'),'checkpoint_changed')
    const stages=[['transfer',{base64:bundle.bytes.toString('base64')}],['artifact',{}],['runtime',{runtime,launcher:await readFile(resolve(sourceRoot,'scripts/publish/launcher.mjs'),'utf8'),extraCa:installation.plan.target.api_ca_file?await readProtected(installation.plan.target.api_ca_file,{json:false,privateMode:false}):null}],['staging',{}],['activation',{}],['process',{}],['health',{token}]]
    let health
    for(const[stage,payload]of stages){
      await sourceUnchanged(plan.bundle,sourceReader);await mark(stage,'pending')
      const result=await remote.call(stage,payload)
      if(stage==='health'){health=result;await ingressCheck(plan.target,{expected:plan.ingress,token})}
      await mark(stage,'verified',result)
    }
    // The application is running, but no normal user traffic is accepted yet.
    // Recheck neutral data and OFF controls before certifying completion.
    await verified.recheck()
    await mark('receipt','pending',{health_verified:true,ingress_restricted:true})
    // A final local completion record can be regenerated from the protected
    // remote receipt if its acknowledgement/publication was interrupted.
    const remoteReceipt={format:1,kind:'elcomputer-remote-publication',publication_id:plan.target.publication_id,installation_id:plan.target.installation_id,project_ref:plan.target.project_ref,site_origin:plan.target.site_origin,plan_digest:plan.plan_digest,release_sha256:plan.target.release_sha256,inventory_sha256:plan.bundle.inventory_sha256,completion_intent_digest:current.checkpoint_digest,health_verified:true,ingress_restricted:true,pending:['hosted/Linux/reboot acceptance','backup/commerce/provider acceptance']}
    await remote.call('receipt',{receipt:remoteReceipt})
    await mark('receipt','verified',{remote_receipt:true,ingress_restricted:true})
    await mark('complete','complete',{health_verified:true,ingress_restricted:true})
    return{ok:true,command,publication_id:plan.target.publication_id,plan_digest:plan.plan_digest,complete:true,ingress_restricted:true,health}
  }finally{await remote?.close();await verified?.close();await release()}
}
export async function readOnlyPublication({command,plan,directory,credentials,owner=null,sourceReader=frozenSource,remoteFactory=openSsh,ingressCheck=ingress,installationVerifier=verifyInstallation}){
  validatePlan(plan);await sourceUnchanged(plan.bundle,sourceReader)
  const installation=await originalInstallation(plan),chain=await readChain(directory,plan),latest=chain.at(-1),release=await lock(directory,plan)
  let verified,remote
  try{
    verified=await installationVerifier(installation,credentials);remote=await remoteFactory(plan.target,plan.registry,{expectedIdentity:plan.ssh_identity})
    const observed=await remote.call('probe',{target:plan.target,fresh:latest.stage==='planned'})
    ensure(digest(observed)===digest(plan.remote),'target_changed')
    if(command==='verify'){ensure(latest.status==='complete','checkpoint_changed');const token=await login(verified,installation,owner);await remote.call('claim',{plan,resume:true});const runtime=await readProtected(join(directory,'private/approved-runtime.json'));await remote.call('audit',{runtime});const health=await remote.call('health',{token,verifyOnly:true});await ingressCheck(plan.target,{expected:plan.ingress,token});return{ok:true,command,publication_id:plan.target.publication_id,complete:true,mutated:false,health}}
    await ingressCheck(plan.target,{expected:plan.ingress,before:latest.stage==='planned',pending:latest.stage!=='planned'&&latest.status!=='complete'})
    return{ok:true,command,publication_id:plan.target.publication_id,stage:latest.stage,mutated:false}
  }finally{await remote?.close();await verified?.close();await release()}
}
