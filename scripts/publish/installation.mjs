import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { readProtected, checkpointRead, receipt as installationReceipt, workspaceLock } from '../install/files.mjs'
import { validatePlan, observeInstallation } from '../install/workflow.mjs'
import { connectPlatform } from '../install/platform.mjs'
import { verifyBundle } from '../lib/cleanBaseline.mjs'
import { matchReleaseTarget } from '../install/release79.mjs'
import { ensure, digest, fail } from './contracts.mjs'

export async function completedInstallation(file){
  try{
    const directory=dirname(file);ensure(file===resolve(directory,'receipt.json'),'receipt_unverified')
    const plan=validatePlan(await readProtected(resolve(directory,'plan.json'))),chain=await checkpointRead(directory,plan),latest=chain.at(-1),receipt=await readProtected(file)
    const normal=plan.engine===2?plan.source.release.normal_migrations.map(row=>row.version):['20261012160000']
    if(plan.engine===2)for(const stage of plan.stages.filter(stage=>stage!=='complete'))ensure(chain.some(row=>row.stage===stage&&row.status==='pending'),'receipt_unverified')
    ensure(latest.stage==='complete'&&latest.status==='complete'&&receipt.owner_created===true&&receipt.baseline_covered===70,'receipt_unverified')
    assert.deepEqual(receipt.later_migrations,normal)
    assert.deepEqual(receipt,installationReceipt(plan,latest))
    return{directory,plan,receipt,receipt_digest:digest(receipt),receipt_file:file}
  }catch{fail('receipt_unverified')}
}
export async function verifyInstallation(installation,credentials,{exclusive=false,platformFactory=connectPlatform}={}){
  const release=await workspaceLock(installation.directory,installation.plan)
  let platform
  try{
    platform=await platformFactory(installation.plan.target,credentials,{mutating:exclusive})
    await matchReleaseTarget(platform,installation.plan)
    const{inventory,manifest}=await verifyBundle()
    ensure(installation.receipt.source.baseline_inventory_sha256===manifest.migration_inventory_sha256,'receipt_unverified')
    const proof=await observeInstallation(platform,installation.plan,inventory,{complete:true})
    const api=await platform.client.from('quick_setup_state').select('installation_id').eq('singleton',true).single()
    ensure(!api.error&&api.data.installation_id===installation.plan.target.installation_id,'receipt_unverified')
    return{platform,proof,async recheck(){platform.lease();ensure(digest(await observeInstallation(platform,installation.plan,inventory,{complete:true}))===digest(proof),'receipt_unverified')},async close(){await platform.close();await release()}}
  }catch{await platform?.close();await release();fail('receipt_unverified')}
}
