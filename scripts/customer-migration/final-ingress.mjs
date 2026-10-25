import assert from 'node:assert/strict'
export function extendHistoryIngress(text,sourceId,matcher='customer_access'){
 assert.match(sourceId,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
 assert.match(matcher,/^[a-z][a-z0-9_]*$/)
 const lines=text.split('\n'),found=lines.map((line,index)=>({line,index})).filter(x=>x.line.trim().startsWith('@'+matcher+' expression '))
 assert.equal(found.length,1,'Expected one existing customer access matcher')
 const row=found[0],parsed=row.line.match(/^(\s*@\S+ expression\s+`)(.*)(`\s*)$/)
 assert.ok(parsed,'Review this deployment matcher format before changing it')
 assert.ok(!parsed[2].includes('/api/account/history'),'History ingress already changed; do not reapply')
 const detail='^/api/account/history/'+sourceId+'/[1-9][0-9]{0,17}$'
 const addition="({method} == 'GET' && ({path} == '/api/account/history' || {path}.matches('"+detail+"'))) || ({method} == 'POST' && {path} == '/api/account/history/claim')"
 lines[row.index]=parsed[1]+'('+parsed[2]+') || ('+addition+')'+parsed[3]
 return {text:lines.join('\n'),matcher,source_id:sourceId,detail_regex:detail,added_routes:[{method:'GET',path:'/api/account/history'},{method:'GET',path_regex:detail},{method:'POST',path:'/api/account/history/claim'}],changed_lines:1,unchanged_proxy_headers_and_other_rules:true}
}

export function allowedHistoryRoute(method,path,sourceId){
 const base='/api/account/history'
 return method==='GET'&&(path===base||new RegExp('^'+base+'/'+sourceId+'/[1-9][0-9]{0,17}$').test(path))||method==='POST'&&path===base+'/claim'
}
