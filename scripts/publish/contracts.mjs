import { createHash } from 'node:crypto'
import { resolve, isAbsolute } from 'node:path'
import { hostname, userInfo } from 'node:os'
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
const protectedProjectRefs=['zsqhuwgoasrexdnamlks']

const messages={invalid_input:'Use the strict publication manifest and documented options.',protected_target:'This infrastructure is reserved. Use a separately prepared fresh target.',receipt_unverified:'The completed fresh-installation receipt cannot be verified.',source_changed:'The frozen release source or output changed. Preserve the evidence.',target_changed:'The approved host, domain or process identity changed.',unsafe_file:'Use canonical owned paths and private files without symlink escapes.',occupied_target:'The application, port or process target is occupied.',runtime_changed:'The private approved runtime configuration does not match.',prerequisite_missing:'The approved Linux, Node, PM2, restricted ingress or startup prerequisite is missing.',confirmation_required:'Confirm the exact project, domain, SSH host key and publication digest.',lock_busy:'Another publication holds this target or workspace.',checkpoint_changed:'The publication checkpoint chain is invalid.',stage_uncertain:'The publication outcome is uncertain. Preserve evidence and reconcile the exact plan.',health_failed:'Application acceptance failed. The new site remains restricted.',already_complete:'Publication is complete. Use verify; apply cannot run again.'}
export class PublicationError extends Error{constructor(code){const safe=Object.hasOwn(messages,code)?code:'stage_uncertain';super(messages[safe]);this.code=safe}}
export const fail=code=>{throw new PublicationError(code)}
export const ensure=(value,code='invalid_input')=>{if(!value)fail(code)}
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
export const json=value=>JSON.stringify(value,null,2)+'\n'
export const digest=value=>hash(json(value))
export function object(value,keys,required=keys){ensure(value&&typeof value==='object'&&!Array.isArray(value));ensure(Object.keys(value).every(key=>keys.includes(key))&&required.every(key=>Object.hasOwn(value,key)))}
export const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
export const fingerprint=value=>typeof value==='string'&&/^SHA256:[A-Za-z0-9+/]{43}$/.test(value)
export const canonical=value=>typeof value==='string'&&isAbsolute(value)&&resolve(value)===value&&!/[\x00-\x20\x7f'"`$\\]/.test(value)
export const nodeVersion='22.23.1'
export const pm2Version='6.0.14'
export function cleanEnvironment(){ensure(!Object.keys(process.env).some(key=>/^(PG[A-Z_]*|DATABASE_URL|SUPABASE.*|NODE_OPTIONS|NODE_TLS_REJECT_UNAUTHORIZED|NODE_EXTRA_CA_CERTS|SSLKEYLOGFILE|PM2_.*|DEPLOY_.*|SSH_AUTH_SOCK|SSH_AGENT_PID|BASH_ENV|ENV|NITRO_.*|NUXT_.*|CREDENTIALS_.*|SHIPPING_.*|DAFTRA_.*)$/.test(key)&&process.env[key]),'invalid_input');ensure(process.versions.node===nodeVersion,'prerequisite_missing')}
export function validateRegistry(registry){
  object(registry,['format','production','reserved'])
  object(registry.production,['project_refs','ssh_hosts','ssh_fingerprints','domains','users','paths','pm2_names','ports'])
  object(registry.reserved,Object.keys(registry.production))
  ensure(registry.format===1)
  for(const group of[registry.production,registry.reserved])for(const list of Object.values(group))ensure(Array.isArray(list)&&list.every(value=>typeof value==='string'||Number.isInteger(value)))
  ensure(registry.production.project_refs.includes(protectedProjectRefs[0])&&registry.production.ssh_hosts.length>0&&registry.production.ssh_fingerprints.length>0&&registry.production.ssh_fingerprints.every(fingerprint),'protected_target')
  ensure(registry.production.domains.includes('new.elcomputer.net')&&registry.production.users.includes('newelcomputer')&&registry.production.pm2_names.includes('new-elcomputer')&&registry.production.ports.includes(3001),'protected_target')
  ensure(registry.production.paths.includes('/home/newelcomputer/htdocs/new.elcomputer.net'),'protected_target')
  return registry
}
export function validateTarget(target,registry,{laboratory=false}={}){
  object(target,['format','publication_id','installation_id','project_ref','site_origin','release_sha256','ssh','site','runtime','ingress'])
  ensure(target.format===1&&uuid.test(target.publication_id)&&uuid.test(target.installation_id)&&/^[a-z0-9]{20}$/.test(target.project_ref)&&sha(target.release_sha256))
  let origin;try{origin=new URL(target.site_origin)}catch{fail('invalid_input')}
  ensure(origin.origin===target.site_origin&&origin.protocol==='https:'&&!origin.username&&!origin.password&&origin.pathname==='/'&&!origin.search&&!origin.hash&&!origin.port&&/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(origin.hostname))
  object(target.ssh,['host','port','user','host_key_sha256','known_hosts_file','identity_file','machine_id'])
  ensure(/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(target.ssh.host)&&Number.isInteger(target.ssh.port)&&target.ssh.port>=1&&target.ssh.port<=65535&&fingerprint(target.ssh.host_key_sha256)&&/^[a-f0-9]{32}$/.test(target.ssh.machine_id))
  ensure(/^[a-z][a-z0-9_-]{1,30}$/.test(target.ssh.user)&&target.ssh.user!=='root')
  ensure(canonical(target.ssh.known_hosts_file)&&canonical(target.ssh.identity_file))
  object(target.site,['app_path','uploads_path','pm2_home','pm2_name','port'])
  ensure(Object.values(target.site).filter(value=>typeof value==='string').every(value=>!/[\x00-\x20'"`$\\]/.test(value)))
  ensure(/^[a-z][a-z0-9-]{1,50}$/.test(target.site.pm2_name)&&Number.isInteger(target.site.port)&&target.site.port>=1024&&target.site.port<=65535)
  for(const key of['app_path','uploads_path','pm2_home'])ensure(canonical(target.site[key]))
  if(!laboratory){const home='/home/'+target.ssh.user;ensure(target.site.app_path===home+'/htdocs/'+origin.hostname&&target.site.uploads_path===home+'/data/'+origin.hostname+'/uploads'&&target.site.pm2_home===home+'/.elcomputer-pm2')}
  ensure(!target.site.uploads_path.startsWith(target.site.app_path+'/')&&!target.site.app_path.startsWith(target.site.uploads_path+'/'))
  object(target.runtime,['node_path','pm2_package'])
  ensure(canonical(target.runtime.node_path)&&target.runtime.node_path.endsWith('/node')&&canonical(target.runtime.pm2_package))
  object(target.ingress,['nginx_file','certificate_file','certificate_key_file','operator_ipv4','startup_unit','ca_file'],['nginx_file','certificate_file','certificate_key_file','operator_ipv4','startup_unit'])
  ensure([target.ingress.nginx_file,target.ingress.certificate_file,target.ingress.certificate_key_file].every(canonical)&&/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(target.ingress.operator_ipv4)&&target.ingress.operator_ipv4.split('.').every(part=>Number(part)<=255))
  ensure(target.ingress.startup_unit==='pm2-'+target.ssh.user+'.service'&&(!target.ingress.ca_file||canonical(target.ingress.ca_file)))
  const exclusions=key=>[...registry.production[key],...registry.reserved[key]]
  ensure(!protectedProjectRefs.includes(target.project_ref)&&!exclusions('project_refs').includes(target.project_ref)&&!/(^|\.)elcomputer\.net$/.test(origin.hostname),'protected_target')
  for(const[key,value]of[['ssh_hosts',target.ssh.host],['ssh_fingerprints',target.ssh.host_key_sha256],['domains',origin.hostname],['users',target.ssh.user],['paths',target.site.app_path],['pm2_names',target.site.pm2_name],['ports',target.site.port]])ensure(!exclusions(key).includes(value),'protected_target')
  return target
}

export function nginxConfiguration(target){
  const domain=new URL(target.site_origin).hostname
  return `# ELcomputer first-publication restricted site\nserver {\n  listen 443 ssl;\n  server_name ${domain};\n  ssl_certificate ${target.ingress.certificate_file};\n  ssl_certificate_key ${target.ingress.certificate_key_file};\n  ssl_protocols TLSv1.2 TLSv1.3;\n  client_max_body_size 550M;\n  add_header X-ELcomputer-Publication "${target.publication_id}" always;\n  location / {\n    allow 127.0.0.1;\n    allow ::1;\n    allow ${target.ingress.operator_ipv4};\n    deny all;\n    proxy_pass http://127.0.0.1:${target.site.port};\n    proxy_set_header Host $host;\n    proxy_set_header X-Forwarded-Proto $scheme;\n    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n  }\n}\n`
}

export function startupConfiguration(target){
  const command=target.runtime.node_path+' '+target.runtime.pm2_package+'/bin/pm2'
  return `# ELcomputer dedicated first-publication PM2\n[Unit]\nDescription=ELcomputer ${target.site.pm2_name}\nAfter=network-online.target\nWants=network-online.target\n\n[Service]\nType=forking\nUser=${target.ssh.user}\nEnvironment=PATH=${target.runtime.node_path.slice(0,-5)}:/usr/bin:/bin\nEnvironment=PM2_HOME=${target.site.pm2_home}\nEnvironment=PM2_PROGRAMMATIC=true\nEnvironment=PM2_NO_INTERACTION=true\nPIDFile=${target.site.pm2_home}/pm2.pid\nExecStart=${command} resurrect\nExecStop=${command} kill\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n`
}

export function freshUserProcesses(rows,pid){
  const processes=rows.trim().split('\n').filter(Boolean).map(line=>{const[id,parent,command]=line.trim().split(/\s+/);return{pid:Number(id),parent:Number(parent),command}}),ancestors=new Set([pid])
  let cursor=processes.find(item=>item.pid===pid)
  while(cursor&&!ancestors.has(cursor.parent)){ancestors.add(cursor.parent);cursor=processes.find(item=>item.pid===cursor.parent)}
  return processes.every(item=>item.pid===pid||(item.parent===pid&&item.command==='ps')||(/^(?:systemd|\(?sd-pam\)?)$/.test(item.command))||(ancestors.has(item.pid)&&/^(?:sshd|sshd-session|bash|dash|sh|zsh)$/.test(item.command)))
}
