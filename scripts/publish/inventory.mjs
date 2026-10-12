import { readFile, readdir, lstat, readlink, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { ensure, fail, digest, hash } from './contracts.mjs'

export async function inventory(root,{secrets=[],owner=null}={}){
  const actual=await realpath(root);ensure(actual===root,'unsafe_file')
  const entries=[],candidates=secrets.filter(value=>typeof value==='string'&&value.length>=12).map(value=>Buffer.from(value))
  async function walk(path){
    const file=path?join(root,path):root,stat=await lstat(file),mode=stat.mode&0o7777
    ensure((stat.isSymbolicLink()||!(mode&0o6022))&&(owner==null||stat.uid===owner),'unsafe_file')
    ensure(!/[\x00-\x1f\x7f\\]/.test(path)&&!path.split('/').includes('..'),'unsafe_file')
    if(stat.isSymbolicLink()){
      const target=await readlink(file);ensure(!target.startsWith('/')&&!/[\x00-\x1f\\]/.test(target),'unsafe_file')
      const resolved=await realpath(file);ensure(resolved.startsWith(root+'/'),'unsafe_file')
      entries.push({path,type:'link',mode:0o777,target,sha256:hash(target)})
    }else if(stat.isDirectory()){
      entries.push({path,type:'directory',mode})
      for(const name of(await readdir(file)).sort())await walk(path?path+'/'+name:name)
    }else if(stat.isFile()){
      const bytes=await readFile(file)
      ensure(!candidates.some(secret=>bytes.includes(secret)),'runtime_changed')
      const text=bytes.toString('utf8')
      ensure(!/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----|sb_secret_[A-Za-z0-9_-]{16,}/.test(text),'runtime_changed')
      for(const token of text.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)||[]){
        try{ensure(JSON.parse(Buffer.from(token.split('.')[1],'base64url')).role!=='service_role','runtime_changed')}catch(error){if(error.code)throw error}
      }
      ensure(!/\.(?:node|so|dylib|dll|exe)$/.test(path)&&!['feedfacf','cffaedfe','7f454c46'].includes(bytes.subarray(0,4).toString('hex')),'prerequisite_missing')
      ensure(!/(^|\/)(?:\.env(?:\..*)?|\.git|\.publish)(\/|$)/.test(path)&&!/^(?:public\/uploads|storage\/uploads|uploads)(?:\/|$)/.test(path),'unsafe_file')
      entries.push({path,type:'file',mode,size:stat.size,sha256:hash(bytes)})
    }else fail('unsafe_file')
  }
  await walk('');ensure(entries.some(entry=>entry.path==='server/index.mjs'&&entry.type==='file'),'source_changed')
  return entries
}
