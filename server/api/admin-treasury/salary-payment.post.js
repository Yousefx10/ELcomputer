import { readBody } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { salaryPaymentCommand, salaryPaymentResponse, throwSalaryPaymentError } from '../../utils/salaryPayment'

export default defineEventHandler(async event => {
  salaryPaymentResponse(event)
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'treasury.edit' })
  const command = salaryPaymentCommand(await readBody(event))
  const { data, error } = await supabaseAdmin.rpc('treasury_record_salary_payment_command', {
    p_actor_id: adminUser.id, p_command_id: command.command_id, p_employee_id: command.employee_id,
    p_amount: command.amount, p_salary_period: command.salary_period, p_paid_at: command.paid_at,
    p_reference_number: command.reference_number, p_notes: command.notes
  }).abortSignal(AbortSignal.timeout(60000))
  if (error) throwSalaryPaymentError(error)
  if (data?.status !== 'committed' || data.command_id !== command.command_id || !data.transaction_id || !data.audit_id) {
    throwSalaryPaymentError({})
  }
  return data
})
