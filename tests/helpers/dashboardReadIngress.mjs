import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { request } from 'node:http'

// Owned loopback Nginx -> real H3 handlers -> disposable native PostgREST/SQL.
// No production binding, dotenv, remote host, service operation or credential.
export async function createDashboardReadIngress(upstream) {
  const dir = await mkdtemp(join(tmpdir(), 'dashboard-reads-edge-'))
  const probe = createServer()
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
  const port = probe.address().port
  await new Promise(resolve => probe.close(resolve))
  let child
  const close = async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      const ended = new Promise(resolve => child.once('exit', resolve))
      child.kill('SIGTERM'); await ended
    }
    await rm(dir, { recursive: true, force: true })
  }
  try {
    const { stdout } = await promisify(execFile)('/usr/bin/python3', ['-B', '-c', `
import sys
sys.path.insert(0,'scripts/nginx');sys.path.insert(0,'tests')
from dashboard_access_test import fixture
from dashboard_access import render,render_reads,digest
source,binding=fixture(edge=int(sys.argv[1]),upstream=int(sys.argv[2]))
accepted,_=render(source,binding)
print(render_reads(accepted,{**binding,'source_sha256':digest(accepted)})[0])
`, String(port), new URL(upstream).port], { maxBuffer: 200000 })
    const path = join(dir, 'nginx.conf')
    await writeFile(path, `daemon off; worker_processes 1; error_log ${dir}/error.log; pid ${dir}/nginx.pid;
events { worker_connections 128; }
http { access_log off; client_body_temp_path ${dir}/body; proxy_temp_path ${dir}/proxy; ${stdout} }
`)
    const args = ['-p', dir + '/', '-c', path]
    await promisify(execFile)(process.env.DASHBOARD_REVIEW_NGINX, [...args, '-t'])
    child = spawn(process.env.DASHBOARD_REVIEW_NGINX, args, { stdio: 'ignore' })
    const origin = 'http://127.0.0.1:' + port
    const call = (path, { token, method = 'GET', headers = {} } = {}) => new Promise((resolve, reject) => {
      const req = request(origin + path, { method, headers: { host: 'orchard.example.test', ...headers,
        ...(token ? { authorization: 'Bearer ' + token } : {}) } }, response => {
        const chunks = []
        response.on('data', chunk => chunks.push(chunk))
        response.on('end', () => {
          const raw = Buffer.concat(chunks).toString()
          resolve({ status: response.statusCode, headers: new Headers(response.headers),
            data: raw && response.headers['content-type']?.includes('application/json') ? JSON.parse(raw) : raw })
        })
      })
      req.on('error', reject); req.setTimeout(5000, () => req.destroy(Error('Owned edge timeout'))); req.end()
    })
    let ready = false
    for (let i = 0; i < 100; i++) {
      try { if ((await call('/api/admin-users')).status === 401) { ready = true; break } } catch {}
      if (child.exitCode !== null) throw Error('Owned Nginx exited')
      await new Promise(resolve => setTimeout(resolve, 30))
    }
    if (!ready) throw Error('Owned Nginx readiness timed out')
    return { close, call }
  } catch (error) { await close(); throw error }
}
