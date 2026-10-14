import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { salaryPaymentCommand, throwSalaryPaymentError } from '../server/utils/salaryPayment.js'

const input = () => ({ command_id: randomUUID(), employee_id: randomUUID(), amount: 10,
  salary_period: '2026-10-01', paid_at: '2026-10-14', reference_number: '', notes: '' })
test('salary boundary rejects spoofed authority, invalid dates and nonfinite amounts', () => {
  for (const change of [{ command_id: 'x' }, { employee_id: null }, { amount: '10' }, { amount: NaN },
    { amount: Infinity }, { amount: 0 }, { amount: 1e10 }, { salary_period: '2026-02-30' },
    { paid_at: '0000-01-01' }, { notes: 'x'.repeat(2001) }, { reference_number: 'x'.repeat(201) },
    { actor_id: randomUUID() }, { approved: true }, { transaction_id: randomUUID() }]) {
    assert.throws(() => salaryPaymentCommand({ ...input(), ...change }), e => e.statusCode === 400)
  }
  for (const body of [null, [], {}, 'payment']) assert.throws(() => salaryPaymentCommand(body))
  const command = input(); command.command_id = command.command_id.toUpperCase()
  assert.equal(salaryPaymentCommand(command).command_id, command.command_id.toLowerCase())
})
test('salary errors distinguish committed-reset/conflict outcomes from uncertainty', () => {
  for (const [reason, status] of [['permission', 403], ['invalid', 400], ['employee', 400], ['reused', 409], ['reset', 409], ['unknown', 503]]) {
    assert.throws(() => throwSalaryPaymentError({ message: 'salary:' + reason }), e => e.statusCode === status && e.data.salaryPaymentError === reason)
  }
  assert.throws(() => throwSalaryPaymentError({ message: 'private database details', code: 'XX000' }), e => e.statusCode === 503 && !e.message.includes('private database'))
})
