// Application-only PDC correction over the accepted schema89/Premium release.
// Reuse the qualified read-only database, Auth and preservation contracts.
export {hash,migrations,connect,checkDatabase,assertPreserved} from '../premium-product-finishing-release/database.mjs'
export const applicationCommit='82ec667c03cbea1e350ddef92eaaddf3335aafed'
export const previousApplicationCommit='d01649a36c1725b290050b99d20066a05778bdfa'
