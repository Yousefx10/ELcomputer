import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, readFile, realpath, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateResetInput, verifyResetPassword, finishResetCleanup } from '../server/utils/systemReset.js'
import { listResetMediaFiles, removeResetMediaFiles, assertResetUploadRoot } from '../server/utils/systemResetFiles.js'

const validInput = () => ({ scope:'orders', operationId:randomUUID(), confirmation:'RESET ORDERS', password:' exact password ' })

test('reset input rejects unknown scopes, missing passwords and mismatched confirmations', () => {
  assert.equal(validateResetInput(validInput()).key,'orders')
  for(const change of [{scope:'anything'},{operationId:'1'},{password:''},{confirmation:'RESET FULL'}]) {
    assert.throws(()=>validateResetInput({...validInput(),...change}))
  }
})

test('password verification uses the signed-in owner identity and an isolated client', async () => {
  const calls=[]
  await verifyResetPassword({
    authUser:{id:'owner',email:'owner@test.invalid'},password:' exact password ',
    config:{public:{supabaseUrl:'test-url'},supabaseServiceRoleKey:'test-key'},
    createAuthClient:(url,key,options)=>{
      assert.equal(url,'test-url');assert.equal(key,'test-key');assert.equal(options.auth.persistSession,false)
      return {auth:{signInWithPassword:async input=>{calls.push(input);return {data:{user:{id:'owner'},session:{access_token:'temporary'}},error:null}},signOut:async input=>calls.push(input)}}
    }
  })
  assert.deepEqual(calls,[{email:'owner@test.invalid',password:' exact password '},{scope:'local'}])
})

test('wrong passwords or mismatched identities never pass verification', async () => {
  for(const response of [{error:new Error('bad password')},{data:{user:{id:'another-owner'},session:{access_token:'temporary'}}}]) {
    await assert.rejects(()=>verifyResetPassword({
      authUser:{id:'owner',email:'owner@test.invalid'},password:'bad',config:{public:{supabaseUrl:'url'},supabaseServiceRoleKey:'key'},
      createAuthClient:()=>({auth:{signInWithPassword:async()=>response,signOut:async()=>{}}})
    }),/Password verification failed/)
  }
})

test('completion logging occurs only after document and account cleanup', async () => {
  const calls=[]
  const supabaseAdmin={
    storage:{from:()=>({remove:async paths=>{calls.push(['documents',paths]);return {error:null}}})},
    auth:{admin:{deleteUser:async id=>{calls.push(['account',id]);return {error:null}}}},
    rpc:async(name)=>{calls.push(['rpc',name]);return {data:{status:'completed'},error:null}}
  }
  const run={id:randomUUID(),status:'cleanup_pending',manifest:{documents:['root/example.pdf'],users:['customer']}}
  await finishResetCleanup({supabaseAdmin,run,ownerId:'owner',uploadsRoot:'/tmp/elcomputer-empty-uploads'})
  assert.deepEqual(calls,[['documents',['root/example.pdf']],['account','customer'],['rpc','system_reset_finish']])
  calls.length=0
  supabaseAdmin.auth.admin.deleteUser=async()=>({error:{status:500}})
  await assert.rejects(()=>finishResetCleanup({supabaseAdmin,run,ownerId:'owner',uploadsRoot:'/tmp/elcomputer-empty-uploads'}),/Account cleanup failed/)
  assert.equal(calls.some(([kind])=>kind==='rpc'),false)
})

test('full reset removes only captured private support and chat attachments', async () => {
  const calls = []
  const supabaseAdmin = {
    storage: { from: bucket => ({ remove: async paths => { calls.push([bucket, paths]); return { error: null } } }) },
    auth: { admin: { deleteUser: async () => ({ error: null }) } },
    rpc: async () => ({ data: { status: 'completed' }, error: null })
  }
  await finishResetCleanup({
    supabaseAdmin,
    run: { id: randomUUID(), scope: 'full', status: 'cleanup_pending', manifest: {
      support: ['ticket/old.pdf'], chat: ['chat/old.pdf']
    } },
    ownerId: 'owner', uploadsRoot: '/tmp/elcomputer-empty-uploads'
  })
  assert.deepEqual(calls, [
    ['support-attachments', ['ticket/old.pdf']],
    ['chat-attachments', ['chat/old.pdf']]
  ])
})

test('a completed request never deletes files or accounts again', async () => {
  const result=await finishResetCleanup({supabaseAdmin:{},run:{id:randomUUID(),status:'completed',scope:'full'},ownerId:'owner',uploadsRoot:'/'})
  assert.equal(result.status,'completed')
})

test('cleanup never deletes the surviving owner account', async () => {
  let deleted=false
  await assert.rejects(()=>finishResetCleanup({supabaseAdmin:{auth:{admin:{deleteUser:async()=>{deleted=true}}}},run:{id:randomUUID(),manifest:{users:['owner']}},ownerId:'owner',uploadsRoot:'/tmp/elcomputer-empty-uploads'}),/cannot delete the current owner/)
  assert.equal(deleted,false)
})

test('media reset removes only the captured image files and supports retries', async () => {
  const directory=await realpath(await mkdtemp(join(tmpdir(),'elcomputer-reset-files-')))
  try {
    const uploads=join(directory,'uploads')
    await mkdir(uploads)
    await writeFile(join(uploads,'old.png'),'old image')
    await writeFile(join(uploads,'keep.txt'),'configuration')
    const snapshot=await listResetMediaFiles(uploads)
    await writeFile(join(uploads,'new.png'),'new image')
    assert.equal(snapshot.length,1)
    await removeResetMediaFiles(uploads,snapshot)
    await removeResetMediaFiles(uploads,snapshot)
    assert.equal(await readFile(join(uploads,'new.png'),'utf8'),'new image')
    assert.equal(await readFile(join(uploads,'keep.txt'),'utf8'),'configuration')
    await assert.rejects(()=>readFile(join(uploads,'old.png')),/ENOENT/)
    await assert.rejects(()=>removeResetMediaFiles(uploads,[{root:uploads,path:'../outside.png'}]),/Invalid reset upload path/)
    await symlink(join(uploads,'new.png'),join(uploads,'linked.png'))
    await assert.rejects(()=>listResetMediaFiles(uploads),/symlinks/)
  } finally { await rm(directory,{recursive:true,force:true}) }
  assert.throws(()=>assertResetUploadRoot('/'),/not safe/)
  assert.throws(()=>assertResetUploadRoot(process.cwd()),/not safe/)
})
