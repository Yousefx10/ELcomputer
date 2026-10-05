// Vodafone V5 section 8. Keep codes that concern reporting for diagnostics only;
// their presence does not establish an inquiry endpoint.
export const vodafoneErrors = Object.freeze({
  9001: ['batch_limit', 'SMS list exceeds the provider limit.'],
  9002: ['mandatory_field', 'A mandatory field is empty.'],
  9003: ['international_disabled', 'International recipients are disabled on the account.'],
  9004: ['invalid_dates', 'Invalid dates.'], 9005: ['mandatory_field', 'Empty request fields.'],
  9006: ['credentials_missing', 'Required credentials are missing.'],
  9007: ['invalid_dates', 'Start date is required.'], 9008: ['invalid_dates', 'End date is required.'],
  9009: ['invalid_message', 'No valid SMS details.'], 9010: ['report_rate', 'Report request interval exceeded.'],
  9011: ['account_missing', 'Account not found.'], 9012: ['activation', 'Account is not registered for SMS API.'],
  9013: ['trusted_ip', 'Source IP is not trusted.'], 9014: ['password', 'Incorrect provider password.'],
  9015: ['invalid_request', 'Invalid request.'], 9016: ['invalid_message', 'SMS ID is empty.'],
  9017: ['mandatory_field', 'Required fields are empty.'], 9018: ['invalid_dates', 'Date ranges are unsupported.'],
  9019: ['invalid_dates', 'Dates are not ordered.'], 9020: ['invalid_dates', 'Invalid date format.'],
  9021: ['secure_hash', 'SecureHash authorization failed.'], 9022: ['recipient_missing', 'Recipient is empty.'],
  9023: ['invalid_msisdn', 'Invalid MSISDN.'], 9024: ['inquiry', 'Provider inquiry failed.'],
  9025: ['provider_logs', 'Provider log retrieval failed.'], 9028: ['provider_logs', 'Provider actions unavailable.'],
  9032: ['eligibility', 'Account is not eligible for SMS API.'], 9033: ['interface', 'SMS API interface is inaccessible.'],
  9034: ['sender', 'Sender is not configured on this account.'], 9035: ['invalid_action', 'Invalid action format.'],
  9036: ['provider_logs', 'No provider logs found.'], 9037: ['provider_logs', 'Report index exceeds results.'],
  9038: ['quota', 'Account quota is unavailable.'], 9039: ['provider_logs', 'Provider log retrieval failed.']
})
export const normalizeVodafoneError = code => {
  const numeric = /^\d{4}$/.test(String(code)) ? Number(code) : null
  const [category, description] = vodafoneErrors[numeric] || ['provider_error', 'Provider rejected the request.']
  return { code: numeric, category, description }
}
