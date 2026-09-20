import test from 'node:test'
import assert from 'node:assert/strict'
import { chatContactValid, chatMobileValid, chatSecondsRemaining, mergeChatMessages } from '../app/utils/liveChat.js'

test('reconnect reconciliation preserves order and does not duplicate messages', () => {
  const first = [{ id: 'a', sequence_number: 10, body: 'Earlier' },
    { id: 'b', sequence_number: 12, body: 'Current' }]
  const replay = [{ id: 'b', sequence_number: 12, body: 'Current' },
    { id: 'c', sequence_number: 13, body: 'Reply' }]
  assert.deepEqual(mergeChatMessages(first, replay).map(item => item.id), ['a', 'b', 'c'])
  assert.deepEqual(mergeChatMessages(replay, first).map(item => item.id), ['a', 'b', 'c'])
})

test('contact choices follow saved rule and reject invalid details', () => {
  assert.equal(chatContactValid('Guest', 'guest@example.test', '', 'either'), true)
  assert.equal(chatContactValid('Guest', '', '+20 100 123 4567', 'either'), true)
  assert.equal(chatContactValid('Guest', 'guest@example.test', '', 'both'), false)
  assert.equal(chatContactValid('Guest', '', '+20 100 123 4567', 'mobile'), true)
  assert.equal(chatContactValid('Guest', 'bad', '', 'either'), false)
  assert.equal(chatContactValid('', 'guest@example.test', '', 'either'), false)
  assert.equal(chatMobileValid('+20 100 123 4567'), true)
  assert.equal(chatMobileValid('abc'), false)
})

test('cooldown countdown is based on server message time and ends at zero', () => {
  const sentAt = '2026-09-20T12:00:00.000Z'
  assert.equal(chatSecondsRemaining(sentAt, 4, Date.parse(sentAt) + 100), 4)
  assert.equal(chatSecondsRemaining(sentAt, 4, Date.parse(sentAt) + 3100), 1)
  assert.equal(chatSecondsRemaining(sentAt, 4, Date.parse(sentAt) + 4000), 0)
  assert.equal(chatSecondsRemaining(sentAt, 0, Date.parse(sentAt) + 100), 0)
})
