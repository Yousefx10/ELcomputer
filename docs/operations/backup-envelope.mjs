// Streaming ELCBK01 AES-256-GCM envelopes; key material never enters arguments.
// Usage: node backup-envelope.mjs encrypt|verify|decrypt KEY_FILE ARCHIVE
// Decryption authenticates the entire envelope before releasing plaintext.
import fs from 'node:fs'
import crypto from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { Transform, Writable } from 'node:stream'

const [mode, keyPath, filePath] = process.argv.slice(2)
const magic = Buffer.from('ELCBK01\n')
const digest = () => crypto.createHash('sha256')
let fd
try {
  const keyStat = fs.lstatSync(keyPath)
  if (!keyStat.isFile() || keyStat.isSymbolicLink() || keyStat.uid !== process.getuid() || (keyStat.mode & 0o777) !== 0o600) throw Error()
  const key = fs.readFileSync(keyPath)
  if (key.length !== 32) throw Error()
  if (mode === 'encrypt') {
    const header = Buffer.concat([magic, crypto.randomBytes(12)])
    const cipher = crypto.createCipheriv('aes-256-gcm', key, header.subarray(8))
    cipher.setAAD(header)
    const plainHash = digest(), encryptedHash = digest()
    let bytes = 0
    fd = fs.openSync(filePath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600)
    fs.writeSync(fd, header); encryptedHash.update(header)
    const meter = new Transform({ transform(chunk, _, cb) { bytes += chunk.length; plainHash.update(chunk); cb(null, chunk) } })
    const encryptedMeter = new Transform({ transform(chunk, _, cb) { encryptedHash.update(chunk); cb(null, chunk) } })
    await pipeline(process.stdin, meter, cipher, encryptedMeter, fs.createWriteStream('', { fd, autoClose: false }))
    const tag = cipher.getAuthTag()
    fs.writeSync(fd, tag); encryptedHash.update(tag); fs.fsyncSync(fd)
    const result = { format: 'ELCBK01', algorithm: 'AES-256-GCM', plaintextBytes: bytes, plaintextSha256: plainHash.digest('hex'), encryptedBytes: bytes + 36, encryptedSha256: encryptedHash.digest('hex') }
    fs.closeSync(fd); fd = undefined
    process.stdout.write(JSON.stringify(result) + '\n')
  } else if (mode === 'verify' || mode === 'decrypt') {
    fd = fs.openSync(filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
    const before = fs.fstatSync(fd)
    if (!before.isFile() || before.size < 36) throw Error()
    const header = Buffer.alloc(20), tag = Buffer.alloc(16)
    if (fs.readSync(fd, header, 0, 20, 0) !== 20 || !header.subarray(0, 8).equals(magic)) throw Error()
    if (fs.readSync(fd, tag, 0, 16, before.size - 16) !== 16) throw Error()
    const plainHash = digest(), encryptedHash = digest()
    let bytes = 0
    encryptedHash.update(header)
    const decipher = () => {
      const d = crypto.createDecipheriv('aes-256-gcm', key, header.subarray(8))
      d.setAAD(header); d.setAuthTag(tag); return d
    }
    const source = () => fs.createReadStream('', { fd, start: 20, end: before.size - 17, autoClose: false })
    const meter = new Transform({ transform(chunk, _, cb) { encryptedHash.update(chunk); cb(null, chunk) } })
    // Empty ciphertext is valid; ReadStream cannot express an empty range.
    if (before.size === 36) decipher().final()
    else await pipeline(source(), meter, decipher(), new Writable({ write(chunk, _, cb) { bytes += chunk.length; plainHash.update(chunk); cb() } }))
    encryptedHash.update(tag)
    const after = fs.fstatSync(fd)
    for (const k of ['dev', 'ino', 'size', 'mtimeMs', 'ctimeMs']) if (before[k] !== after[k]) throw Error()
    if (mode === 'verify') process.stdout.write(JSON.stringify({ authenticatedDecryption: true, plaintextBytes: bytes, plaintextSha256: plainHash.digest('hex'), encryptedSha256: encryptedHash.digest('hex') }) + '\n')
    else if (before.size > 36) await pipeline(source(), decipher(), process.stdout)
    fs.closeSync(fd); fd = undefined
  } else throw Error()
} catch {
  if (fd !== undefined) fs.closeSync(fd)
  process.stderr.write('Backup envelope operation failed. Preserve the incomplete artifact.\n')
  process.exitCode = 1
}
