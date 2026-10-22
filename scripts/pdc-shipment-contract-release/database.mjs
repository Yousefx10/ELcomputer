// App-only correction. Reuse the deployed schema90 validation; never write SQL.
import assert from 'node:assert/strict'
import {migrations as rpcMigrations,checkDatabase as checkSchema90,connect,hash} from '../pdc-v6-rpc-release/database.mjs'
export {connect,hash}
export {assertPreserved} from '../premium-product-finishing-release/database.mjs'
export const applicationCommit='aa5d2f31a1d1f286a34e275d133a0c475e4f8238'
export const previousApplicationCommit='82ec667c03cbea1e350ddef92eaaddf3335aafed'
export async function migrations(repo){const r=await rpcMigrations(repo);return {history:[...r.history,...r.pending],certificate_history:r.certificate_history}}
export async function checkDatabase(db,release){assert.equal((await db.query('show transaction_read_only')).rows[0].transaction_read_only,'on');return checkSchema90(db,{...release,history:release.history.slice(0,89),pending:release.history.slice(89)},{after:true})}
