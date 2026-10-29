// Checks that your machine is ready: Node version, .env, MongoDB, Redis, mock services.
import { existsSync } from 'node:fs';
import Redis from 'ioredis';
import { config, connectMongo, disconnectMongo, mongoose } from '@edgegate/shared';

const ok = (msg) => console.log(`  [ok]   ${msg}`);
const warn = (msg) => console.log(`  [warn] ${msg}`);
const fail = (msg) => console.log(`  [fail] ${msg}`);
let failed = false;

console.log('EdgeGate doctor\n');

// 1. Node.js
const [major, minor] = process.versions.node.split('.').map(Number);
if (major > 20 || (major === 20 && minor >= 12)) ok(`Node.js ${process.versions.node}`);
else {
  fail(`Node.js ${process.versions.node}: need 20.12 or newer (22 recommended)`);
  failed = true;
}

// 2. .env
existsSync('.env') ? ok('.env file found') : warn('.env missing, using defaults (run: cp .env.example .env)');

// 3. MongoDB
try {
  await connectMongo();
  await mongoose.connection.db.admin().ping();
  ok(`MongoDB reachable at ${redactUrl(config.MONGO_URL)}`);
  const services = await mongoose.connection.db.collection('services').countDocuments();
  services > 0 ? ok(`${services} services registered`) : warn('No services yet (run: npm run seed)');
} catch (err) {
  fail(`MongoDB not reachable at ${redactUrl(config.MONGO_URL)}: ${err.message}`);
  console.log('         Local: npm run infra:up');
  console.log('         Atlas: check MONGO_URL in .env and that your IP is allowed under Network Access');
  failed = true;
} finally {
  await disconnectMongo().catch(() => {});
}

// 4. Redis
const redis = new Redis(config.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 0, connectTimeout: 2000 });
redis.on('error', () => {});
try {
  await redis.connect();
  const pong = await redis.ping();
  ok(`Redis reachable at ${redactUrl(config.REDIS_URL)} (${pong})`);
} catch (err) {
  fail(`Redis not reachable at ${redactUrl(config.REDIS_URL)}: ${err.message}`);
  console.log('         Docker: npm run infra:up:redis (Docker Desktop must be running)');
  console.log('         WSL:    wsl -u root service redis-server start');
  failed = true;
} finally {
  redis.disconnect();
}

// 5. Mock services (optional; only needed when running the gateway)
for (const url of ['http://127.0.0.1:4001', 'http://127.0.0.1:4002', 'http://127.0.0.1:5001', 'http://127.0.0.1:6001']) {
  try {
    const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) });
    const body = await r.json();
    r.ok ? ok(`mock ${body.instance} healthy`) : warn(`mock at ${url} unhealthy (mode: fail)`);
  } catch {
    warn(`mock at ${url} not running (start with: npm run mocks)`);
  }
}

console.log(failed ? '\nSome checks failed.' : '\nAll required checks passed.');
process.exit(failed ? 1 : 0);

function redactUrl(url) {
  return url.replace(/\/\/([^@/]+)@/, '//***@');
}