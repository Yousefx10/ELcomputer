import { readFile, writeFile, readdir, lstat, readlink, realpath, mkdir, cp, symlink, chmod, unlink } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { resolve, join, dirname, relative } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { create as tarCreate } from 'tar'
import { frozenSource, sourceRoot } from '../install/contracts.mjs'
import { createWorkspace, readProtected, writeAtomic, privateDirectory } from '../install/files.mjs'
import { digest, hash, ensure, fail, object, sha } from './contracts.mjs'

export { inventory } from './inventory.mjs'
import { inventory } from './inventory.mjs'
const run=promisify(execFile)
export async function buildPackage({directory,secrets=[],sourceReader=frozenSource}){
  const source=await sourceReader();await createWorkspace(directory)
  const buildRoot=join(directory,'build-source');await mkdir(buildRoot,{mode:0o700})
  const{stdout}=await run('git',['ls-files','-z'],{cwd:sourceRoot,env:{PATH:process.env.PATH,LANG:'C'},maxBuffer:4*1024*1024})
  for(const name of stdout.split('\0').filter(Boolean)){
    ensure(name!=='.env'&&name!=='.deploy.env','source_changed')
    ensure((await lstat(resolve(sourceRoot,name))).isFile(),'source_changed')
    const destination=join(buildRoot,name);await mkdir(dirname(destination),{recursive:true});await cp(resolve(sourceRoot,name),destination)
  }
  await symlink(resolve(sourceRoot,'node_modules'),join(buildRoot,'node_modules'))
  const empty=join(directory,'empty.env');await writeFile(empty,'',{mode:0o600})
  await run(process.execPath,[resolve(sourceRoot,'node_modules/nuxt/bin/nuxt.mjs'),'build','--dotenv',empty],{cwd:buildRoot,env:{PATH:dirname(process.execPath)+':/usr/bin:/bin',LANG:'C',NODE_ENV:'production'},maxBuffer:8*1024*1024})
  ensure(digest(await sourceReader())===digest(source),'source_changed')
  const output=join(buildRoot,'.output')
  // Fresh publisher only: a legacy merchant wordmark is not release media.
  for(const legacyAsset of ['images/dashboard-logo.png','images/storefront/setup-hero.png','favicon.ico'])await unlink(join(output,'public',legacyAsset)).catch(error=>{if(error.code!=='ENOENT')throw error})
  const entries=await inventory(output,{secrets}),archive=join(directory,'release.tar.gz')
  await tarCreate({cwd:buildRoot,file:archive,gzip:true,portable:true,noMtime:true,follow:false},['.output'])
  await chmod(archive,0o600)
  const body={format:1,kind:'elcomputer-output',source,archive_sha256:hash(await readFile(archive)),inventory_sha256:digest(entries),entries,node:'22.23.1',content:'output only; no runtime secrets, source or merchant uploads'}
  const manifest={...body,release_sha256:digest(body)}
  await writeAtomic(directory,'bundle.json',manifest,{exclusive:true})
  return{ok:true,command:'package',release_sha256:manifest.release_sha256,bundle_file:join(directory,'bundle.json'),files:entries.length}
}
export async function loadBundle(file,{secrets=[]}={}){
  const manifest=await readProtected(file,{maxBytes:4*1024*1024})
  object(manifest,['format','kind','source','archive_sha256','inventory_sha256','entries','node','content','release_sha256'])
  const{release_sha256,...body}=manifest
  ensure(manifest.format===1&&manifest.kind==='elcomputer-output'&&sha(release_sha256)&&digest(body)===release_sha256&&Array.isArray(manifest.entries)&&manifest.entries.length>0&&manifest.inventory_sha256===digest(manifest.entries)&&manifest.node==='22.23.1','source_changed')
  const archive=join(dirname(file),'release.tar.gz'),stat=await lstat(archive);ensure(stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===process.getuid()&&!(stat.mode&0o077),'unsafe_file')
  const bytes=await readFile(archive);ensure(hash(bytes)===manifest.archive_sha256,'source_changed')
  const output=join(dirname(file),'build-source/.output');ensure(digest(await inventory(output,{secrets}))===manifest.inventory_sha256,'source_changed')
  return{manifest,archive,bytes,bundle_file:file}
}
