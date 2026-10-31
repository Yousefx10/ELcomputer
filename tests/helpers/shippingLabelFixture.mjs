import {deflateSync} from 'node:zlib'
// Owned PDF bytes only. No order, customer or provider is contacted/created.
export function shippingLabelFixture({awb='FIXTURE-AWB-123',reference='FIXTURE-REF-456',pages=1,compressed=false,texts=null,javascript=false,width=283.465,height=425.197}={}){
 const objects=['','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'],pageIds=[]
 const literal=s=>s.replaceAll('\\','\\\\').replaceAll('(','\\(').replaceAll(')','\\)')
 for(let n=0;n<pages;n++){
  const pageId=objects.length+1;pageIds.push(pageId);const contentId=pageId+1
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`)
  const text=texts?.[n]??`AWB: ${awb}\nRef: ${reference}`
  const content=Buffer.from('BT /F1 10 Tf 10 '+(height-30)+' Td '+text.split('\n').map((line,i)=>(i?'0 -18 Td ':'')+'('+literal(line)+') Tj').join('\n')+' ET','latin1'),bytes=compressed?deflateSync(content):content
  objects.push(Buffer.concat([Buffer.from(`<< /Length ${bytes.length}${compressed?' /Filter /FlateDecode':''} >>\nstream\n`),bytes,Buffer.from('\nendstream')]))
 }
 let action='';if(javascript){objects.push('<< /S /JavaScript /JS (throw new Error\\(untrusted\\)) >>');action=` /OpenAction ${objects.length} 0 R`}
 objects[0]=`<< /Type /Catalog /Pages 2 0 R${action} >>`;objects[1]=`<< /Type /Pages /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] /Count ${pages} >>`
 const chunks=[Buffer.from('%PDF-1.7\n')],offsets=[0];let length=chunks[0].length
 for(let n=0;n<objects.length;n++){offsets.push(length);const b=Buffer.concat([Buffer.from(`${n+1} 0 obj\n`),Buffer.isBuffer(objects[n])?objects[n]:Buffer.from(objects[n],'latin1'),Buffer.from('\nendobj\n')]);chunks.push(b);length+=b.length}
 chunks.push(Buffer.from(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`))
 return Buffer.concat(chunks)
}
