// Inactive application-only capability. Bind exact deployed schema90 read-only.
import {migrations as schema90Migrations,checkDatabase as schema90Check,connect,hash,assertPreserved} from '../pdc-shipment-contract-release/database.mjs'
export {connect,hash,assertPreserved}
export const applicationCommit='32f152f3e75380db1f7ca9c054098231dbbd3226'
export const previousApplicationCommit='aa5d2f31a1d1f286a34e275d133a0c475e4f8238'
export const migrations=schema90Migrations
export const checkDatabase=schema90Check
