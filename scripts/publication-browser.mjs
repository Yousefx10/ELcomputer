// Real compiled Nuxt, PM2, Auth and database on owned macOS loopback.
// Linux, SSH and operator ingress are explicit fixtures, not hosted acceptance.
import assert from 'node:assert/strict'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { connectPlatform } from './install/platform.mjs'
import { createPublicationFixture } from '../tests/helpers/publicationPlatform.mjs'
import { fixturePolicy } from '../tests/helpers/reservationPolicy.mjs'
const {chromium}=await import(pathToFileURL('/private/tmp/elcomputer-final-browser-tools/node_modules/playwright/index.mjs'))
const directory=process.env.PUBLICATION_REVIEW_ARTIFACTS||'/private/tmp/elcomputer-publication-browser'
await mkdir(directory,{recursive:true,mode:0o700})
const guided=process.env.GUIDED_REVIEW==='true'
const fixture=await createPublicationFixture({initialize:!guided,siteOrigin:guided?'https://independent-brand.example.invalid':'https://fresh.example.invalid'}),external=[],errors=[]
let browser,assertions=0,screenshots=0
const check=(value,message)=>{assert.ok(value,message);assertions++}
try{
  let site
  if(guided){
    const preparedSite=await fixture.site('guided-browser',{guided:true}),root=preparedSite.root,workspace=root+'/guided'
    const manifest={format:1,database_target_file:fixture.lab.targetFile,publication_target_file:root+'/target.json',legacy_registry_file:root+'/registry.fixture.json',reservation_policy_file:root+'/additional-policy.json',credentials_file:fixture.lab.credentialsFile,owner_file:fixture.lab.ownerFile,key_record_directory:root+'/keys',locale:'en'}
    for(const[file,value]of[['target.json',{...preparedSite.target,release_sha256:null}],['registry.fixture.json',preparedSite.registry],['additional-policy.json',fixturePolicy()],['manifest.json',manifest]])await writeFile(root+'/'+file,JSON.stringify(value),{mode:0o600})
    const workflow=await import(pathToFileURL(fixture.source.directory+'/scripts/guided/workflow.mjs')),contracts=await import(pathToFileURL(fixture.source.directory+'/scripts/publish/contracts.mjs'))
    const{cp}=await import('node:fs/promises')
    const overrides={publicationTarget:(target,registry)=>contracts.validateTarget(target,registry,{laboratory:true}),remoteFactory:preparedSite.remoteFactory,ingressCheck:preparedSite.ingressCheck,buildPackage:({directory})=>cp(fixture.directory+'/bundle',directory,{recursive:true,verbatimSymlinks:true})}
    const planned=await workflow.prepareGuided({manifestFile:root+'/manifest.json',directory:workspace,overrides})
    const publication=await workflow.runGuided({command:'apply',directory:workspace,confirmDatabase:planned.confirmation,overrides})
    const completed=await workflow.runGuided({command:'apply',directory:workspace,confirmPublication:publication.confirmation,overrides})
    check(completed.complete&&completed.hosted_accepted===false,'guided final verification completed before browser traffic')
    check((await workflow.runGuided({command:'verify',directory:workspace,overrides})).complete,'guided original receipts verified')
    site={...preparedSite,runtimeFile:workspace+'/runtime/runtime.json'}
  }else{site=await fixture.site('browser');await site.apply();await site.verify()}
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
  const context=await browser.newContext({ignoreHTTPSErrors:true}) // owned lab CA only
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():(external.push(new URL(route.request().url()).origin),route.abort()))
  const page=await context.newPage(),origin='http://127.0.0.1:'+site.target.site.port
  page.on('pageerror',error=>errors.push(error.message))
  for(const locale of ['en','ar'])for(const width of [1440,390])for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:1000});await page.goto(origin+(locale==='ar'?'/ar':'/'),{waitUntil:'domcontentloaded'})
    await page.evaluate(theme=>{localStorage.setItem('nuxt-color-mode',theme);document.documentElement.classList.toggle('dark',theme==='dark')},theme)
    check(await page.locator('html').getAttribute('dir')===(locale==='ar'?'rtl':'ltr'),'locale direction')
    await page.locator('main').waitFor();check(await page.locator('main').count()>0,'storefront rendered')
    check(await page.locator('[src*="placehold"],[src*="setup-hero"]').count()===0,'no demo hero')
    check(!/Computer accessories|ملحقات الكمبيوتر/.test(await page.locator('h1').first().textContent()),'brand-independent homepage heading')
    check(await page.locator('link[rel=icon]').getAttribute('href')==='/favicon.svg','neutral favicon')
    check(!await page.locator('[href^="/products/"]').count(),'empty product catalog')
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'responsive overflow')
    await page.screenshot({path:directory+'/'+locale+'-'+width+'-'+theme+'.png',fullPage:true});screenshots++
  }
  await page.goto(origin+'/dashboard/setup',{waitUntil:'domcontentloaded'})
  check(new URL(page.url()).pathname.includes('/dashboard/login'),'anonymous dashboard protected')
  await page.waitForFunction(()=>document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating===false)
  await page.locator('input[type=email]').fill(fixture.lab.owner.email)
  await page.locator('input[type=password]').fill(fixture.lab.owner.password)
  await page.locator('form:has(input[type=password]) button[type=submit]').click()
  try{await page.waitForURL(url=>url.pathname.endsWith('/dashboard'), {timeout:30000,waitUntil:'domcontentloaded'})}catch(error){console.log(JSON.stringify({diagnostic:'owned browser login',path:new URL(page.url()).pathname,errors,external,requests:fixture.lab.requests.slice(-15),message:(await page.locator('p.text-red-600').allTextContents()).map(s=>s.slice(0,200))}));throw error}
  await page.goto(origin+'/dashboard/setup',{waitUntil:'domcontentloaded'});await page.locator('.setup-page').waitFor({timeout:30000})
  check(await page.locator('.setup-page').count()===1,'actual new owner enters Quick Setup')
  check(await page.locator('.setup-header h1').innerText()!=='','existing Phase 1/2 guide rendered')
  await page.screenshot({path:directory+'/owner-setup.png',fullPage:true});screenshots++
  // Demote the same disposable identity, exercise actual server authorization,
  // then restore it. No ordinary customer or second owner is introduced.
  const id=(await fixture.lab.db.query('select auth_subject from private.installation_bootstrap')).rows[0].auth_subject
  await fixture.lab.db.query("update public.admin_users set role='admin' where id=$1",[id])
  const platform=await connectPlatform(fixture.lab.target,fixture.lab.credentials)
  let token
  try{const signed=await platform.anon.auth.signInWithPassword(fixture.lab.owner);check(!signed.error,'non-owner Auth session');token=signed.data.session.access_token}finally{await platform.close()}
  const status=await page.evaluate(async token=>(await fetch('/api/admin-setup/status',{headers:{authorization:'Bearer '+token}})).status,token)
  check(status===403,'actual non-owner setup denied')
  await fixture.lab.db.query("update public.admin_users set role='owner' where id=$1",[id])
  const runtime=JSON.parse(await readFile(site.runtimeFile)),html=await page.content()
  for(const secret of[fixture.lab.credentials.service_role_key,runtime.env.NUXT_CREDENTIALS_ENCRYPTION_KEY,runtime.env.NUXT_SHIPPING_CREDENTIALS_ENCRYPTION_KEY])check(!html.includes(secret),'private runtime absent from browser')
  check((await fixture.lab.db.query('select count(*)::int n from public.products')).rows[0].n===0,'catalog remains empty')
  check((await fixture.lab.db.query('select count(*)::int n from public.quick_setup_revisions where revision<>0')).rows[0].n===0,'Phase 2 metadata remains neutral')
  check(external.length===0,'no unexpected external browser requests');check(errors.length===0,'no page errors')
  await writeFile(directory+'/results.json',JSON.stringify({ok:true,assertions,screenshots,page_errors:errors,external_requests:external,actual:[...(guided?['guided coordinator']:[]),'Node22','Nuxt production','PM2 isolated','Auth','PostgREST','Storage','PG17/Supautils','owner login'],fixtures:['macOS target','SSH','Linux/Nginx/TLS ingress'],hosted_acceptance:false},null,2)+'\n',{mode:0o600})
  console.log(JSON.stringify({ok:true,assertions,screenshots,external_requests:external.length,page_errors:errors.length}))
}finally{await browser?.close();await fixture.close()}
