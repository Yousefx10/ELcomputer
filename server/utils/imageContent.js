import { inflateSync } from 'node:zlib'
import { createError } from 'h3'

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' }
const invalid = () => { throw createError({ statusCode: 400, statusMessage: 'The file is not a valid supported image.', data: { code: 'MEDIA_INVALID_IMAGE' } }) }
const dimensions = (w, h) => { if (!w || !h || w > 16384 || h > 16384 || w * h > 40000000) invalid() }
const crc32 = buffer => {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
const png = b => {
  if (!b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) invalid()
  let pos = 8, header = false, end = false, width, height, depth, color, interlace
  const compressed = []
  while (pos + 12 <= b.length) {
    const length = b.readUInt32BE(pos), type = b.toString('ascii', pos + 4, pos + 8), next = pos + 12 + length
    if (next > b.length || !/^[A-Za-z]{4}$/.test(type) || crc32(b.subarray(pos + 4, next - 4)) !== b.readUInt32BE(next - 4)) invalid()
    if (!header && (type !== 'IHDR' || length !== 13)) invalid()
    if (type === 'IHDR') {
      if (header) invalid()
      width=b.readUInt32BE(pos+8); height=b.readUInt32BE(pos+12); dimensions(width,height)
      depth=b[pos+16]; color=b[pos+17]; interlace=b[pos+20]
      if (!({ 0: [1,2,4,8,16], 2: [8,16], 3: [1,2,4,8], 4: [8,16], 6: [8,16] }[color]?.includes(depth)) || b[pos + 18] || b[pos + 19] || b[pos + 20] > 1) invalid()
      header = true
    }
    if (type === 'IDAT') compressed.push(b.subarray(pos + 8, next - 4))
    if (type === 'IEND') { if (length) invalid(); end = true; pos = next; break }
    pos = next
  }
  if (!header || !end || pos !== b.length || !compressed.length) invalid()
  const pixels=inflateSync(Buffer.concat(compressed), { maxOutputLength: 64 * 1024 * 1024 })
  const channels={0:1,2:3,3:1,4:2,6:4}[color]
  const passes=interlace ? [[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]] : [[0,0,1,1]]
  let cursor=0
  for(const[x,y,dx,dy]of passes){
    const w=Math.max(0,Math.ceil((width-x)/dx)),h=Math.max(0,Math.ceil((height-y)/dy))
    if(!w||!h)continue
    const row=Math.ceil(w*channels*depth/8)+1
    for(let line=0;line<h;line++){if(cursor+row>pixels.length||pixels[cursor]>4)invalid();cursor+=row}
  }
  if(cursor!==pixels.length)invalid()
}
const jpeg = b => {
  if (b[0] !== 255 || b[1] !== 216) invalid()
  let pos = 2, frame = false, scan = false, ended = false
  while (pos < b.length) {
    if (b[pos++] !== 255) invalid()
    while (b[pos] === 255) pos++
    const marker = b[pos++]
    if (marker === 217) { ended = true; break }
    if (!marker || marker === 216 || pos + 2 > b.length) invalid()
    const length = b.readUInt16BE(pos), next = pos + length
    if (length < 2 || next > b.length) invalid()
    if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) {
      if (length < 8) invalid()
      dimensions(b.readUInt16BE(pos + 5), b.readUInt16BE(pos + 3)); frame = true
    }
    pos = next
    if (marker === 218) {
      if (!frame || length < 6) invalid()
      scan = true
      while (pos < b.length) {
        if (b[pos] !== 255) { pos++; continue }
        if (b[pos + 1] === 0 || (b[pos + 1] >= 208 && b[pos + 1] <= 215)) { pos += 2; continue }
        break
      }
    }
  }
  if (!frame || !scan || !ended || pos !== b.length) invalid()
}
const gif = b => {
  if (!['GIF87a','GIF89a'].includes(b.toString('ascii', 0, 6)) || b.length < 14) invalid()
  dimensions(b.readUInt16LE(6), b.readUInt16LE(8))
  let pos = 13 + ((b[10] & 128) ? 3 * (2 ** ((b[10] & 7) + 1)) : 0), frames = 0
  const blocks = () => {
    let bytes = 0
    while (pos < b.length) { const length = b[pos++]; if (!length) return bytes; pos += length; bytes += length; if (pos > b.length) invalid() }
    invalid()
  }
  while (pos < b.length) {
    const type = b[pos++]
    if (type === 59) { if (!frames || pos !== b.length) invalid(); return }
    if (type === 33) { pos++; blocks(); continue }
    if (type !== 44 || pos + 9 > b.length || ++frames > 1000) invalid()
    dimensions(b.readUInt16LE(pos + 4), b.readUInt16LE(pos + 6))
    const packed = b[pos + 8]; pos += 9 + ((packed & 128) ? 3 * (2 ** ((packed & 7) + 1)) : 0)
    if (b[pos] < 2 || b[pos++] > 8 || !blocks()) invalid()
  }
  invalid()
}
const webp = b => {
  if (b.toString('ascii',0,4) !== 'RIFF' || b.toString('ascii',8,12) !== 'WEBP' || b.readUInt32LE(4) + 8 !== b.length) invalid()
  let pos = 12, image = false
  while (pos + 8 <= b.length) {
    const type = b.toString('ascii',pos,pos+4), length = b.readUInt32LE(pos+4), start=pos+8, next=start+length+(length%2)
    if (next > b.length) invalid()
    if (type === 'VP8 ') { if (length < 10 || !b.subarray(start+3,start+6).equals(Buffer.from('9d012a','hex'))) invalid(); dimensions(b.readUInt16LE(start+6)&16383,b.readUInt16LE(start+8)&16383); image=true }
    if (type === 'VP8L') { if (length < 5 || b[start] !== 47) invalid(); const bits=b.readUInt32LE(start+1); dimensions((bits&16383)+1,((bits>>>14)&16383)+1); image=true }
    if (type === 'VP8X') { if (length !== 10) invalid(); dimensions(b.readUIntLE(start+4,3)+1,b.readUIntLE(start+7,3)+1) }
    if (type === 'ANMF') { if (length < 24) invalid(); dimensions(b.readUIntLE(start+6,3)+1,b.readUIntLE(start+9,3)+1); const codec=b.toString('ascii',start+16,start+20); if (!['VP8 ','VP8L','ALPH'].includes(codec)) invalid(); image=true }
    pos = next
  }
  if (!image || pos !== b.length) invalid()
}
const avif = b => {
  let pos = 0, brand = false, metadata = false, data = false, size = false, codec = false
  const metadataBoxes=(start,end,depth=0)=>{
    if(depth>8)invalid()
    let offset=start
    while(offset+8<=end){
      const length=b.readUInt32BE(offset),type=b.toString('ascii',offset+4,offset+8)
      if(length<8||offset+length>end)invalid()
      if(type==='ispe'){if(length!==20)invalid();dimensions(b.readUInt32BE(offset+12),b.readUInt32BE(offset+16));size=true}
      if(type==='av1C'){if(length<12||b[offset+8]!==129)invalid();codec=true}
      if(['iprp','ipco'].includes(type))metadataBoxes(offset+8,offset+length,depth+1)
      offset+=length
    }
    if(offset!==end)invalid()
  }
  while (pos + 8 <= b.length) {
    const type=b.toString('ascii',pos+4,pos+8); let length=b.readUInt32BE(pos), header=8
    if (length === 1) { if (pos+16>b.length) invalid(); const wide=b.readBigUInt64BE(pos+8); if (wide>BigInt(b.length)) invalid(); length=Number(wide); header=16 }
    if (!length) length=b.length-pos
    if (length<header || pos+length>b.length) invalid()
    if (!pos && type!=='ftyp') invalid()
    if (type==='ftyp') { if (length<16 || (length-header)%4) invalid(); const brands=[]; for(let x=pos+header;x<pos+length;x+=4) if(x!==pos+header+4) brands.push(b.toString('ascii',x,x+4)); brand=brands.includes('avif')||brands.includes('avis') }
    if (type==='meta') { if(length<header+16) invalid(); metadataBoxes(pos+header+4,pos+length); metadata=true }
    if (type==='mdat') { if(length<=header) invalid(); data=true }
    pos+=length
  }
  if (!brand || !metadata || !data || !size || !codec || pos!==b.length) invalid()
}

export const validateImageContent = (data, declaredType) => {
  if (declaredType === 'image/svg+xml') throw createError({ statusCode: 400, statusMessage: 'SVG uploads are not supported. Use PNG or WebP.', data: { code: 'MEDIA_SVG_UNSUPPORTED' } })
  if (!Buffer.isBuffer(data) || !data.length) invalid()
  if (data.length > MAX_IMAGE_BYTES) throw createError({ statusCode: 413, statusMessage: 'Image size must be 8 MB or smaller.', data: { code: 'MEDIA_TOO_LARGE' } })
  if (!Object.hasOwn(IMAGE_TYPES, declaredType)) invalid()
  try { ({ 'image/png': png, 'image/jpeg': jpeg, 'image/gif': gif, 'image/webp': webp, 'image/avif': avif }[declaredType])(data) }
  catch (error) { if (error.statusCode) throw error; invalid() }
  return { mimeType: declaredType, extension: IMAGE_TYPES[declaredType] }
}
