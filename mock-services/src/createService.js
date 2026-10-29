// A tiny fake backend. Each instance can be switched at runtime between modes:
//   normal  - answers quickly
//   slow    - waits SLOW_MS before answering (a stuck dependency)
//   fail    - returns 500 for everything, including /health (a crashed service)
//   flaky   - fails about half of the requests, /health stays OK (a partly broken service)
import express from 'express';

const MODES = ['normal', 'slow', 'fail', 'flaky'];

export function createService({ name, port, slowMs = 5000, handlers }) {
  const app = express();
  app.use(express.json());

  const state = { mode: 'normal', requests: 0 };
  const instance = `${name}@${port}`;

  app.get('/health', (_req, res) => {
    if (state.mode === 'fail') return res.status(500).json({ ok: false, instance });
    res.json({ ok: true, instance, mode: state.mode });
  });

  // Demo control: switch mode. Only for local demos; never expose this in production.
  app.post('/__mock/mode', (req, res) => {
    const mode = req.body?.mode;
    if (!MODES.includes(mode)) return res.status(400).json({ error: `mode must be one of ${MODES.join(', ')}` });
    state.mode = mode;
    console.log(`[${instance}] mode -> ${mode}`);
    res.json({ instance, mode });
  });

  app.get('/__mock/stats', (_req, res) => res.json({ instance, ...state }));

  // Simulated behaviour runs before the real handlers.
  app.use(async (req, res, next) => {
    if (req.path.startsWith('/__mock')) return next();
    state.requests++;
    if (state.mode === 'slow') await sleep(slowMs);
    if (state.mode === 'fail') return res.status(500).json({ error: `${name} is down`, instance });
    if (state.mode === 'flaky' && Math.random() < 0.5) {
      return res.status(503).json({ error: `${name} is flaky`, instance });
    }
    res.set('x-instance', instance);
    next();
  });

  handlers(app, { instance });

  app.use((req, res) => res.status(404).json({ error: 'Not found', path: req.path, instance }));

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`${name.padEnd(9)} listening on :${port}`);
      resolve(server);
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));