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
      order(key, options = {}) { state.orders.push(`${key} ${options.ascending === false ? 'desc' : 'asc'}`); return query },
      limit(limit) { state.limit = limit; return query },
      range(start, end) { state.offset = start; state.limit = end - start + 1; return query },
      single() { state.single = true; state.required = true; return query },
      maybeSingle() { state.single = true; return query },
      async then(resolve, reject) {
        try {
          let columns = state.columns
          if (columns.includes('sms_messages(')) columns = "id,traffic_type,triggered_by,trigger_source,template_id,external_trx_id,status,attempts,result_status,error_code,failure_category,created_at,submitted_at,(select coalesce(jsonb_agg(to_jsonb(m)-'body'),'[]') from public.sms_messages m where m.batch_id=sms_batches.id) sms_messages,(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.sms_attempts a where a.batch_id=sms_batches.id) sms_attempts"
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
  return { from, rpc: async (name, args = {}) => {
    try {
      const parameters = Object.keys(args).map((key, index) => `${key} => $${index + 1}`)
      const values = Object.values(args).map(value => typeof value === 'object' && value !== null ? JSON.stringify(value) : value)
      const call = `public.${name}(${parameters.join(',')})`
      return { data: (await db.query(`select ${name === 'sms_claim' ? `to_jsonb(${call})` : call} as value`, values)).rows[0].value, error: null }
    } catch (error) { return { data: null, error: { code: error.code, message: error.message } } }
  } }
}
