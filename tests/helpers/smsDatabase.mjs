// Supabase query shape backed by the isolated application's actual SQL.
export const smsDatabaseClient = db => {
  const from = table => {
    const state = { action: 'select', columns: '*', filters: [], orders: [], params: [] }
    const parameter = value => { state.params.push(value); return '$' + state.params.length }
    const query = {
      select(columns = '*', options = {}) { state.columns = columns; state.options = options; return query },
      update(data) { state.action = 'update'; state.data = data; return query },
      insert(data) { state.action = 'insert'; state.data = data; return query },
      eq(key, value) { state.filters.push(`${key}=${parameter(value)}`); return query },
      or() { return query },
      ilike(key, value) { state.filters.push(`${key} ilike ${parameter(value)}`); return query },
      abortSignal() { return query },
      order(key, options = {}) { state.orders.push(`${key} ${options.ascending === false ? 'desc' : 'asc'}`); return query },
      limit(limit) { state.limit = limit; return query },
      range(start, end) { state.offset = start; state.limit = end - start + 1; return query },
      single() { state.single = true; state.required = true; return query },
      maybeSingle() { state.single = true; return query },
      async then(resolve, reject) {
        try {
          let columns = state.columns
          if (table === 'sms_order_events' && columns.includes('sms_batches(')) columns = "id,order_number,shipment_awb,provider_event_at,event_type,locale,template_id,sender,recipient_masked,status,reason,batch_id,created_at,updated_at,(select jsonb_build_object('id',b.id,'external_trx_id',b.external_trx_id,'status',b.status,'attempts',b.attempts,'result_status',b.result_status,'error_code',b.error_code,'failure_category',b.failure_category,'submitted_at',b.submitted_at,'sms_messages',(select coalesce(jsonb_agg(jsonb_build_object('encoding',m.encoding,'units',m.units,'segments',m.segments,'provider_status',m.provider_status,'error_code',m.error_code)),'[]') from public.sms_messages m where m.batch_id=b.id)) from public.sms_batches b where b.id=sms_order_events.batch_id) sms_batches"
          else if (columns.includes('sms_messages(')) columns = "id,traffic_type,triggered_by,trigger_source,template_id,external_trx_id,status,attempts,result_status,error_code,failure_category,created_at,submitted_at,(select coalesce(jsonb_agg(to_jsonb(m)-'body'),'[]') from public.sms_messages m where m.batch_id=sms_batches.id) sms_messages,(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.sms_attempts a where a.batch_id=sms_batches.id) sms_attempts"
          const where = state.filters.length ? ' where ' + state.filters.join(' and ') : ''
          let sql
          if (state.action === 'update') sql = `update public.${table} set ` + Object.entries(state.data).map(([key, value]) => `${key}=${parameter(value)}`).join(',') + where + ' returning *'
          else if (state.action === 'insert') sql = `insert into public.${table}(${Object.keys(state.data).join(',')}) values (${Object.values(state.data).map(parameter).join(',')}) returning *`
          else sql = `select ${columns} from public.${table}` + where + (state.orders.length ? ' order by ' + state.orders.join(',') : '') + (state.limit ? ' limit ' + state.limit : '') + (state.offset ? ' offset ' + state.offset : '')
          const result = await db.query(sql, state.params)
          if (state.required && !result.rows.length) throw Error('Missing record')
          resolve({ data: state.single ? result.rows[0] || null : result.rows, count: result.rows.length, error: null })
        } catch (error) { resolve({ error: { code: error.code, message: error.message }, data: null }) }
      }
    }
    return query
  }
  return { from, rpc: (name, args = {}) => {
    const request = (async () => {
    try {
      const parameters = Object.keys(args).map((key, index) => `${key} => $${index + 1}`)
      const values = Object.values(args).map(value => typeof value === 'object' && value !== null ? JSON.stringify(value) : value)
      const call = `public.${name}(${parameters.join(',')})`
      return { data: (await db.query(`select ${['sms_claim', 'sms_claim_order_event'].includes(name) ? `to_jsonb(${call})` : call} as value`, values)).rows[0].value, error: null }
    } catch (error) { return { data: null, error: { code: error.code, message: error.message } } }
    })()
    request.abortSignal = () => request
    return request
  } }
}
