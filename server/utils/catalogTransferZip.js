import { deflateRawSync, inflateRawSync } from 'node:zlib'
import { TRANSFER_LIMITS as L, failTransfer } from './catalogTransferContract.js'
export function crc32(bytes) {
  let n = 0xffffffff
  for (const byte of bytes) {
    n ^= byte
    for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0)
  }
  return (n ^ 0xffffffff) >>> 0
}
const invalid = () => failTransfer('workbook')
export function writeZip(parts) {
  const local = [],
    central = []
  let offset = 0,
    total = 0
  for (const [name, value] of Object.entries(parts)) {
    const data = Buffer.from(value),
      filename = Buffer.from(name),
      compressed = deflateRawSync(data),
      checksum = crc32(data)
    total += data.length
    if (data.length > L.part || total > L.inflated) failTransfer('limit')
    const h = Buffer.alloc(30)
    h.writeUInt32LE(0x04034b50)
    h.writeUInt16LE(20, 4)
    h.writeUInt16LE(0x800, 6)
    h.writeUInt16LE(8, 8)
    h.writeUInt16LE(33, 12)
    h.writeUInt32LE(checksum, 14)
    h.writeUInt32LE(compressed.length, 18)
    h.writeUInt32LE(data.length, 22)
    h.writeUInt16LE(filename.length, 26)
    const c = Buffer.alloc(46)
    c.writeUInt32LE(0x02014b50)
    c.writeUInt16LE(20, 4)
    c.writeUInt16LE(20, 6)
    c.writeUInt16LE(0x800, 8)
    c.writeUInt16LE(8, 10)
    c.writeUInt16LE(33, 14)
    c.writeUInt32LE(checksum, 16)
    c.writeUInt32LE(compressed.length, 20)
    c.writeUInt32LE(data.length, 24)
    c.writeUInt16LE(filename.length, 28)
    c.writeUInt32LE(offset, 42)
    local.push(h, filename, compressed)
    central.push(c, filename)
    offset += h.length + filename.length + compressed.length
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22),
    count = Object.keys(parts).length
  end.writeUInt32LE(0x06054b50)
  end.writeUInt16LE(count, 8)
  end.writeUInt16LE(count, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  const result = Buffer.concat([...local, directory, end])
  if (result.length > L.output) failTransfer('limit')
  return result
}
export function readZip(b) {
  if (
    !Buffer.isBuffer(b) ||
    b.length < 22 ||
    b.length > L.upload ||
    b.readUInt32LE(0) !== 0x04034b50
  )
    invalid()
  let end = -1
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--)
    if (b.readUInt32LE(i) === 0x06054b50 && i + 22 + b.readUInt16LE(i + 20) === b.length) {
      end = i
      break
    }
  if (end < 0 || b.readUInt16LE(end + 4) || b.readUInt16LE(end + 6)) invalid()
  const count = b.readUInt16LE(end + 10),
    size = b.readUInt32LE(end + 12),
    start = b.readUInt32LE(end + 16)
  if (count < 3 || count > 32 || count !== b.readUInt16LE(end + 8) || start + size !== end)
    invalid()
  const parts = new Map(),
    spans = []
  let pos = start,
    total = 0
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || b.readUInt32LE(pos) !== 0x02014b50) invalid()
    const flags = b.readUInt16LE(pos + 8),
      method = b.readUInt16LE(pos + 10),
      crc = b.readUInt32LE(pos + 16),
      compressed = b.readUInt32LE(pos + 20),
      length = b.readUInt32LE(pos + 24),
      namesize = b.readUInt16LE(pos + 28),
      extra = b.readUInt16LE(pos + 30),
      comment = b.readUInt16LE(pos + 32),
      offset = b.readUInt32LE(pos + 42)
    if ([0, 0x8000].includes((b.readUInt32LE(pos + 38) >>> 16) & 0xf000) === false) invalid()
    if (
      flags & ~0x808 ||
      ![0, 8].includes(method) ||
      b.readUInt16LE(pos + 34) ||
      pos + 46 + namesize + extra + comment > end ||
      length > L.part ||
      (total += length) > L.inflated
    )
      invalid()
    const rawname = b.subarray(pos + 46, pos + 46 + namesize),
      name = rawname.toString('utf8')
    if (
      !rawname.equals(Buffer.from(name)) ||
      !/^(\[Content_Types\]\.xml|_rels\/\.rels|xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|worksheets\/sheet[1-9][0-9]*\.xml|sharedStrings\.xml|styles\.xml|theme\/theme[1-9][0-9]*\.xml)|docProps\/(core|app)\.xml)$/.test(
        name,
      ) ||
      parts.has(name.toLowerCase())
    )
      invalid()
    if (
      offset + 30 > start ||
      b.readUInt32LE(offset) !== 0x04034b50 ||
      b.readUInt16LE(offset + 6) !== flags ||
      b.readUInt16LE(offset + 8) !== method
    )
      invalid()
    const localname = b.readUInt16LE(offset + 26),
      localextra = b.readUInt16LE(offset + 28),
      dataStart = offset + 30 + localname + localextra,
      dataEnd = dataStart + compressed
    if (
      localname !== namesize ||
      !b.subarray(offset + 30, offset + 30 + localname).equals(rawname) ||
      dataEnd > start
    )
      invalid()
    let spanEnd = dataEnd
    if (flags & 8) {
      const signed = dataEnd + 4 <= start && b.readUInt32LE(dataEnd) === 0x08074b50,
        descriptor = dataEnd + (signed ? 4 : 0)
      spanEnd = descriptor + 12
      if (
        spanEnd > start ||
        b.readUInt32LE(descriptor) !== crc ||
        b.readUInt32LE(descriptor + 4) !== compressed ||
        b.readUInt32LE(descriptor + 8) !== length
      )
        invalid()
    } else if (
      b.readUInt32LE(offset + 14) !== crc ||
      b.readUInt32LE(offset + 18) !== compressed ||
      b.readUInt32LE(offset + 22) !== length
    )
      invalid()
    // ZIP64, encryption and unknown extra fields are unnecessary for this contract.
    for (const [at, n] of [
      [pos + 46 + namesize, extra],
      [offset + 30 + localname, localextra],
    ]) {
      let cursor = at
      while (cursor < at + n) {
        if (cursor + 4 > at + n) invalid()
        const id = b.readUInt16LE(cursor),
          s = b.readUInt16LE(cursor + 2)
        if (![0x5455, 0x000a].includes(id) || cursor + 4 + s > at + n) invalid()
        cursor += 4 + s
      }
    }
    let data
    try {
      data =
        method === 0
          ? Buffer.from(b.subarray(dataStart, dataEnd))
          : inflateRawSync(b.subarray(dataStart, dataEnd), {
              maxOutputLength: Math.max(1, length),
              info: true,
            })
      if (method === 8) {
        if (data.engine.bytesWritten !== compressed) invalid()
        data = data.buffer
      }
    } catch {
      invalid()
    }
    if (data.length !== length || crc32(data) !== crc) invalid()
    parts.set(name.toLowerCase(), data)
    spans.push([offset, spanEnd])
    pos += 46 + namesize + extra + comment
  }
  if (pos !== end) invalid()
  spans.sort((a, b) => a[0] - b[0])
  let cursor = 0
  for (const [a, z] of spans) {
    if (a !== cursor) invalid()
    cursor = z
  }
  if (cursor !== start) invalid()
  return parts
}
