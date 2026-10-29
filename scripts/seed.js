// Seeds a fresh local database: 1 admin, 2 tenants, 3 API keys, 3 services.
// Safe to run again: it replaces the seeded data. Raw API keys are printed once
// and saved to .seed-keys.json (git-ignored) for the demo scripts.
import { writeFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import Redis from 'ioredis';
import { config, connectMongo, disconnectMongo, generateApiKey, resolveLimits } from '@edgegate/shared';
import { Tenant, ApiKey, Service, Admin, ensureCollections } from '@edgegate/shared/models';

const TENANTS = [
  { name: 'Acme Travel', plan: 'pro' },
  { name: 'Demo Free App', plan: 'free' },
];

const KEYS = [
  { tenant: 'Acme Travel', name: 'production' },
  { tenant: 'Acme Travel', name: 'staging', limits: { rate: 10, burst: 20 } },
  { tenant: 'Demo Free App', name: 'default' },
];

const SERVICES = [
  {
    name: 'orders',
    routePrefix: '/orders',
    instances: [{ url: 'http://127.0.0.1:4001' }, { url: 'http://127.0.0.1:4002' }],
    lbStrategy: 'round-robin',
    timeoutMs: 3000,
  },
  {
    name: 'payments',
    routePrefix: '/payments',
    instances: [{ url: 'http://127.0.0.1:5001' }],
    timeoutMs: 2000,
    // Shorter open period than the default so the demo recovers quickly.
    breaker: { windowSize: 20, minCalls: 5, failureRate: 0.5, openMs: 10_000, halfOpenProbes: 1 },
  },
  {
    name: 'users',
    routePrefix: '/users',
    instances: [{ url: 'http://127.0.0.1:6001' }],
    timeoutMs: 3000,
  },
];

async function main() {
  await connectMongo();
  await ensureCollections({ info: (m) => console.log(m), warn: (m) => console.log('Note:', m) });

  await Promise.all([Admin.deleteMany({}), Tenant.deleteMany({}), ApiKey.deleteMany({}), Service.deleteMany({})]);

  await Admin.create({
    email: config.ADMIN_EMAIL,
    passwordHash: await bcrypt.hash(config.ADMIN_PASSWORD, 10),
    role: 'owner',
  });

  const tenants = {};
  for (const t of TENANTS) tenants[t.name] = await Tenant.create(t);

  const issued = [];
  for (const k of KEYS) {
    const tenant = tenants[k.tenant];
    const { rawKey, keyHash, prefix } = generateApiKey();
    await ApiKey.create({ tenantId: tenant._id, name: k.name, keyHash, prefix, limits: k.limits });
    const limits = resolveLimits(tenant.plan, tenant.limits, k.limits);
    issued.push({ tenant: tenant.name, plan: tenant.plan, keyName: k.name, rawKey, ...limits });
  }

  await Service.insertMany(SERVICES);

  await clearRedisCaches();
  await writeFile('.seed-keys.json', JSON.stringify(issued, null, 2) + '\n');

  console.log('\nSeed complete');
  console.log(`  admin:    ${config.ADMIN_EMAIL}`);
  console.log(`  tenants:  ${TENANTS.length}`);
  console.log(`  services: ${SERVICES.map((s) => `${s.name} (${s.routePrefix})`).join(', ')}`);
  console.log('\nAPI keys (shown once, also saved to .seed-keys.json):');
  console.table(
    issued.map((k) => ({
      tenant: k.tenant,
      key: k.keyName,
      'rate/s': k.rate,
      burst: k.burst,
      'monthly quota': k.monthlyQuota,
      'raw key': k.rawKey,
    }))
  );
}

// Old cached keys or rate-limit buckets would not match the new seed.
async function clearRedisCaches() {
  const redis = new Redis(config.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 0, connectTimeout: 2000 });
  redis.on('error', () => {});
  try {
    await redis.connect();
    let removed = 0;
    for (const pattern of ['apikey:*', 'rl:*', 'quota:*']) {
      const stream = redis.scanStream({ match: pattern, count: 200 });
      for await (const keys of stream) {
        if (keys.length) removed += await redis.del(...keys);
      }
    }
    console.log(`Cleared ${removed} cached Redis keys`);
  } catch {
    console.log('Note: Redis not reachable, skipped cache cleanup');
  } finally {
    redis.disconnect();
  }
}

main()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectMongo());