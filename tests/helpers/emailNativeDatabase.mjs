import { spawn,execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'node:net'
import { prepareResetDatabase } from './resetDatabase.mjs'

// Deliberately accepts executable paths only, never a database URL or existing cluster.
export const emailNativeAvailable=!!process.env.EMAIL_REVIEW_PG_BIN&&!!process.env.EMAIL_REVIEW_PG_DRIVER
export const nativeWaitFor=async predicate=>{
 for(let i=0;i<100;i++){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,50))}
 throw Error('Native email audit barrier timed out.')
}
export const createEmailNativeDatabase=async({stopBefore=null}={})=>{
 const {default:pg}=await import(pathToFileURL(process.env.EMAIL_REVIEW_PG_DRIVER).href)
 const directory=await mkdtemp(join(tmpdir(),'email-audit-pg-')),bin=process.env.EMAIL_REVIEW_PG_BIN,clients=[]
 const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve))
 const port=probe.address().port;await new Promise(resolve=>probe.close(resolve))
 let server,db,logs=''
 const connect=async(role=null)=>{
  const c=new pg.Client({host:'127.0.0.1',port,user:'email_audit',database:'postgres',connectionTimeoutMillis:1000})
  clients.push(c);await c.connect();await c.query("set statement_timeout='10s';select set_config('request.jwt.claim.role','service_role',false)")
  if(role)await c.query('set role '+role)
  return c
 }
 const close=async()=>{
  await Promise.allSettled(clients.map(c=>c.end()))
  if(server&&server.exitCode===null){const ended=new Promise(resolve=>server.once('exit',resolve));server.kill('SIGTERM');await ended}
  await rm(directory,{recursive:true,force:true})
 }
 try{
  await promisify(execFile)(join(bin,'initdb'),['-D',directory,'-U','email_audit','-A','trust','--no-sync','--locale=C','--encoding=UTF8'])
  server=spawn(join(bin,'postgres'),['-D',directory,'-h','127.0.0.1','-p',String(port),'-k',directory],{stdio:['ignore','ignore','pipe']})
  server.stderr.on('data',chunk=>{logs=(logs+chunk).slice(-3000)})
  await nativeWaitFor(async()=>{try{db=await connect();return true}catch{return false}})
  await prepareResetDatabase({exec:sql=>db.query(sql)},{stopBefore})
  return {query:(sql,parameters)=>db.query(sql,parameters),exec:sql=>db.query(sql),connect,close,version:(await db.query('show server_version')).rows[0].server_version}
 }catch(error){if(!db)error.message+='\n'+logs;await close();throw error}
}
