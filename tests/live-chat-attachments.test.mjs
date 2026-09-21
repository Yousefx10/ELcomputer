import test from 'node:test'
import assert from 'node:assert/strict'
import { parseChatMultipart, validateChatAttachmentFile } from '../server/utils/chatAttachmentValidation.js'

const policy = {
  enabled: true,
  allowedMimes: ['image/jpeg','image/png','image/webp','application/pdf'],
  maxBytes: 1024,
  maxPerMessage: 3
}

test('chat attachment validation requires matching MIME, extension and signature', () => {
  const pdf = validateChatAttachmentFile({
    filename: 'proof.PDF', type: 'application/pdf', data: Buffer.from('%PDF-1.7\nhello')
  }, policy)
  assert.equal(pdf.mime, 'application/pdf')
  assert.equal(pdf.extension, 'pdf')
  assert.match(pdf.sha256, /^[0-9a-f]{64}$/)
  assert.throws(() => validateChatAttachmentFile({
    filename: 'proof.jpg', type: 'application/pdf', data: Buffer.from('%PDF-1.7\nhello')
  }, policy), /CHAT_ATTACHMENT_TYPE/)
  assert.throws(() => validateChatAttachmentFile({
    filename: 'proof.pdf', type: 'application/pdf', data: Buffer.from('<script>alert(1)</script>')
  }, policy), /CHAT_ATTACHMENT_TYPE/)
  assert.throws(() => validateChatAttachmentFile({
    filename: 'large.pdf', type: 'application/pdf', data: Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(1024)])
  }, policy), /CHAT_ATTACHMENT_SIZE/)
})

test('chat multipart parser accepts one generated file and bounded identifiers', async () => {
  const form = new FormData()
  form.append('messageId', '00000000-0000-4000-8000-000000000001')
  form.append('attachmentId', '00000000-0000-4000-8000-000000000002')
  form.append('file', new Blob([Buffer.from('%PDF-1.7\nhello')], { type: 'application/pdf' }), 'proof.pdf')
  const request = new Request('http://local.test', { method: 'POST', body: form })
  const parsed = parseChatMultipart(Buffer.from(await request.arrayBuffer()),
    request.headers.get('content-type'))
  assert.equal(parsed.fields.messageId, '00000000-0000-4000-8000-000000000001')
  assert.equal(parsed.fields.attachmentId, '00000000-0000-4000-8000-000000000002')
  assert.equal(parsed.file.filename, 'proof.pdf')
  assert.equal(parsed.file.type, 'application/pdf')
  assert.equal(parsed.file.data.toString(), '%PDF-1.7\nhello')
  assert.throws(() => parseChatMultipart(Buffer.from('not multipart'),
    'multipart/form-data; boundary=abc'), /CHAT_MULTIPART/)
})
