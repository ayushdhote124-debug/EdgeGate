// Starts the fake backends used by EdgeGate.
//   orders   :4001, :4002  (two instances, to show load balancing)
//   payments :5001         (switch to slow/fail to show the circuit breaker)
//   users    :6001
//
// Start only some instances (to simulate one being down):
//   node src/index.js orders:4001 payments:5001
import { randomUUID } from 'node:crypto';
import { createService } from './createService.js';

const SLOW_MS = Number(process.env.MOCK_SLOW_MS || 5000);

const DEFINITIONS = {
  orders: (app, { instance }) => {
    app.get('/orders', (req, res) => {
      res.json({
        instance,
        tenant: req.get('x-tenant-id') ?? null,
        orders: [
          { id: '1001', item: 'Train ticket: Bhopal to Delhi', status: 'CONFIRMED' },
          { id: '1002', item: 'Train ticket: Delhi to Jaipur', status: 'WAITLISTED' },
        ],
      });
    });
    app.get('/orders/:id', (req, res) => {
      res.json({ instance, tenant: req.get('x-tenant-id') ?? null, order: { id: req.params.id, status: 'CONFIRMED' } });
    });
    app.post('/orders', (req, res) => {
      res.status(201).json({ instance, order: { id: randomUUID().slice(0, 8), ...req.body, status: 'CREATED' } });
    });
  },

  payments: (app, { instance }) => {
    app.post('/payments', (req, res) => {
      const amount = Number(req.body?.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ instance, error: 'amount must be a positive number' });
      }
      res.status(201).json({ instance, payment: { id: 'pay_' + randomUUID().slice(0, 8), amount, status: 'SUCCESS' } });
    });
    app.get('/payments/:id', (req, res) => {
      res.json({ instance, payment: { id: req.params.id, status: 'SUCCESS' } });
    });
  },

  users: (app, { instance }) => {
    app.get('/users/:id', (req, res) => {
      res.json({ instance, user: { id: req.params.id, name: 'Rahul Sharma', city: 'Bhopal' } });
    });
  },
};

const DEFAULT_INSTANCES = ['orders:4001', 'orders:4002', 'payments:5001', 'users:6001'];
const requested = process.argv.slice(2);
const toStart = requested.length ? requested : DEFAULT_INSTANCES;

for (const spec of toStart) {
  const [name, portStr] = spec.split(':');
  const handlers = DEFINITIONS[name];
  const port = Number(portStr);
  if (!handlers || !Number.isInteger(port)) {
    console.error(`Unknown instance "${spec}". Use name:port with name in ${Object.keys(DEFINITIONS).join(', ')}`);
    process.exit(1);
  }
  await createService({ name, port, slowMs: SLOW_MS, handlers });
}

console.log('\nSwitch a mode:  curl -X POST localhost:5001/__mock/mode -H "content-type: application/json" -d \'{"mode":"slow"}\'');