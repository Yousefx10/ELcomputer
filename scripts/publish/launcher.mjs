// Published outside .output. PM2 stores only identifiers and this interpreter.
import { readFile, lstat, realpath } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const state=dirname(fileURLToPath(import.meta.url)),file=resolve(state,'runtime.json')
try{
  const stat=await lstat(file)
  if(!stat.isFile()||stat.uid!==process.getuid()||(stat.mode&0o077)||await realpath(file)!==file)throw Error()
  const runtime=JSON.parse(await readFile(file,'utf8')),record=JSON.parse(await readFile(resolve(state,'state.json'),'utf8'))
  if(runtime.publication_id!==process.env.ELCOMPUTER_PUBLICATION_ID||record.plan_digest!==process.env.ELCOMPUTER_PLAN_DIGEST||runtime.runtime_id!==record.runtime_id||process.versions.node!=='22.23.1')throw Error()
  const inherited={PATH:process.env.PATH,LANG:'C',ELCOMPUTER_PUBLICATION_ID:process.env.ELCOMPUTER_PUBLICATION_ID,ELCOMPUTER_PLAN_DIGEST:process.env.ELCOMPUTER_PLAN_DIGEST}
  if(process.env.NODE_EXTRA_CA_CERTS){if(await realpath(process.env.NODE_EXTRA_CA_CERTS)!==resolve(state,'api-ca.pem'))throw Error();inherited.NODE_EXTRA_CA_CERTS=process.env.NODE_EXTRA_CA_CERTS}
  for(const key of Object.keys(process.env))delete process.env[key]
  Object.assign(process.env,inherited,runtime.env)
  const app=resolve(state,'../.output/server/index.mjs')
  if(runtime.env.NODE_ENV!=='production'||runtime.env.NITRO_HOST!=='127.0.0.1'||runtime.env.NUXT_SHIPPING_LIVE_REQUESTS_ENABLED!=='false'||runtime.env.NUXT_PAYMOB_ENABLED!=='false')throw Error()
  for(const key of['NUXT_SMS_WORKER_SECRET','NUXT_EMAIL_WORKER_SECRET','NUXT_SHIPPING_WORKER_SECRET','NUXT_ERP_WORKER_SECRET','NUXT_DAFTRA_API_KEY','NUXT_DAFTRA_ACCOUNT_URL'])if(runtime.env[key])throw Error()
  await import(pathToFileURL(app))
}catch{
  process.stderr.write('Fresh application runtime validation failed.\n')
  process.exitCode=1
}
