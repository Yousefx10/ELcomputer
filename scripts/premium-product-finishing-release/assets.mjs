import assert from 'node:assert/strict'
import {readFile,lstat,mkdir,copyFile} from 'node:fs/promises'
import {constants} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {createHash} from 'node:crypto'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
async function safePath(root,name) {
  assert.ok(name && !name.includes('\\') && !name.split('/').some(part=>!part||part==='.'||part==='..'))
  const path=resolve(root,name);assert.ok(path.startsWith(resolve(root)+'/'))
  let parent=dirname(path)
  while(parent.startsWith(resolve(root))) {
    try { const stat=await lstat(parent);assert.ok(stat.isDirectory()&&!stat.isSymbolicLink()) }
    catch(error) { if(error.code!=='ENOENT')throw error }
    if(parent===resolve(root))break
    parent=dirname(parent)
  }
  return path
}
// Nuxt cleans generated asset directories during build. Merge retained assets
// afterwards, preserving every current client URL and never replacing new bytes.
export async function retainClientAssets(source,output,expected) {
  for(const [name,proof]of Object.entries(expected)) {
    const from=await safePath(source,name),to=await safePath(output,name),stat=await lstat(from)
    assert.ok(stat.isFile()&&!stat.isSymbolicLink());assert.equal(hash(await readFile(from)),proof.sha256)
    try { const current=await lstat(to);assert.ok(current.isFile()&&!current.isSymbolicLink());assert.equal(hash(await readFile(to)),proof.sha256,'Retained/new asset collision: '+name) }
    catch(error) { if(error.code!=='ENOENT')throw error;await mkdir(dirname(to),{recursive:true,mode:0o755});await copyFile(from,to,constants.COPYFILE_EXCL) }
  }
}
