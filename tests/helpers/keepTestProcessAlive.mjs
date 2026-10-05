// Node 22 unreferences AbortSignal.timeout timers. Existing provider mocks have
// no socket to keep their test process alive until that timer aborts them.
// Optional NODE_OPTIONS preload; this does not alter application behavior.
import { after } from 'node:test'
const timer = setInterval(() => {}, 1000)
after(() => clearInterval(timer))
