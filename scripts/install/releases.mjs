// Dispatch by explicit versioned authority; never reinterpret an older receipt.
import assert from 'node:assert/strict'
import * as historical from './release79.mjs'
import * as current from './release82.mjs'
import {assertRelease79Source,release79Stages} from '../lib/release79Certification.mjs'
import {assertRelease82Source,release82Stages} from '../lib/release82Certification.mjs'
import {fail} from './contracts.mjs'
export const releasePlan=plan=>[2,3].includes(plan.engine)
export const releaseStagesFor=source=>source.release?.id==='release-82-v1'?release82Stages:source.release?.id==='release-79-v1'?release79Stages:[]
export function assertReleaseSource(source,engine){
 assert.ok(engine===2||engine===3)
 return engine===3?assertRelease82Source(source):assertRelease79Source(source)
}
const authority=plan=>{assertReleaseSource(plan.source,plan.engine);return plan.engine===3?current:historical}
export const releaseObservation=historical.releaseObservation
export const assertFreshRelease=historical.assertFresh79
export const releaseHistory=(plan,...args)=>authority(plan).releaseHistory(plan,...args)
export const verifyReleaseSchema=(platform,plan,...args)=>authority(plan).verifyReleaseSchema(platform,plan,...args)
export const observeReleaseOwner=(platform,plan,...args)=>authority(plan).observeReleaseOwner(platform,plan,...args)
export async function matchReleaseTarget(platform,plan){
 if(!releasePlan(plan)){try{assert.deepEqual(platform.identity,plan.observation)}catch{fail('target_changed')}return}
 return authority(plan).matchReleaseTarget(platform,plan)
}
