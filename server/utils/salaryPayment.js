import { createError, setHeader } from 'h3'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const keys = ['command_id', 'employee_id', 'amount', 'salary_period', 'paid_at', 'reference_number', 'notes']
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number(value.slice(0, 4)) > 0 && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value

export function salaryPaymentCommand(body) {
  let valid = false
  try {
    valid = body && typeof body === 'object' && !Array.isArray(body)
      && Object.keys(body).length === keys.length && keys.every(key => Object.hasOwn(body, key))
      && uuid.test(body.command_id) && uuid.test(body.employee_id)
      && typeof body.amount === 'number' && Number.isFinite(body.amount) && body.amount > 0 && body.amount < 1e10
      && date(body.salary_period) && date(body.paid_at)
      && typeof body.reference_number === 'string' && body.reference_number.length <= 200
      && typeof body.notes === 'string' && body.notes.length <= 2000
  } catch { /* Invalid calendar dates fail closed. */ }
  if (!valid) throwSalaryPaymentError({ message: 'salary:invalid' })
  return { ...body, command_id: body.command_id.toLowerCase(), employee_id: body.employee_id.toLowerCase() }
}

export function salaryPaymentResponse(event) {
  setHeader(event, 'cache-control', 'private, no-store')
  setHeader(event, 'pragma', 'no-cache')
}

export function throwSalaryPaymentError(error) {
  const reason = error?.message?.match(/^salary:(permission|invalid|reused|reset|employee)$/)?.[1]
    || (error?.code === '42501' ? 'permission' : 'unknown')
  const statusCode = reason === 'permission' ? 403 : ['reused', 'reset'].includes(reason) ? 409
    : ['invalid', 'employee'].includes(reason) ? 400 : 503
  const messages = {
    permission: 'You do not have permission to record salary payments.',
    invalid: 'Check the salary payment details.',
    reused: 'This payment command has different details.',
    reset: 'This payment was cleared by System Reset.',
    employee: 'The employee no longer exists.',
    unknown: 'Payment result unknown. Retry the same payment.'
  }
  throw createError({ statusCode, statusMessage: messages[reason], data: { salaryPaymentError: reason } })
}
