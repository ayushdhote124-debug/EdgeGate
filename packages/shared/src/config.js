// Loads and validates environment variables once, for every app.
// A wrong or missing value fails fast at startup with a clear message,
// instead of failing later in the middle of a request.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

// Load the repo-root .env if present (Node 20.12+ has this built in).
// Real environment variables always win over the file.
const envPath = findEnvFile();
if (envPath) process.loadEnvFile(envPath);

function findEnvFile() {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = resolve(dir, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// MongoDB URLs get extra checks with helpful messages, because a pasted
// Atlas connection string is the most common setup mistake.
const mongoUrl = z
  .string()
  .trim()
  .refine((v) => /^mongodb(\+srv)?:\/\//.test(v), 'must start with mongodb:// or mongodb+srv://')
  .refine((v) => !/[<>]/.test(v), 'still contains a <placeholder>; replace <db_password> with your real password')
  .refine((v) => !/\s/.test(v), 'contains a space or line break')
  .refine(
    (v) => parseMongoUrl(v) !== null,
    'is not a valid URL; if your password has special characters (# / ? @ : %), URL-encode them or create a password with only letters and digits'
  )
  .refine(
    (v) => {
      const url = parseMongoUrl(v);
      return url === null || url.pathname.length > 1;
    },
    'has no database name; add /edgegate right before the "?" (otherwise data goes to a database called "test")'
  );

// MongoDB allows several hosts separated by commas (host1:27017,host2:27017),
// which the standard URL parser rejects. Parse with only the first host instead.
function parseMongoUrl(value) {
  try {
    return new URL(value.replace(/@([^/?]+)/, (_m, hosts) => '@' + hosts.split(',')[0]));
  } catch {
    return null;
  }
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  MONGO_URL: mongoUrl.default('mongodb://127.0.0.1:27017/edgegate'),
  REDIS_URL: z.string().url().default('redis://127.0.0.1:6379'),

  GATEWAY_PORT: z.coerce.number().int().positive().default(8080),
  ADMIN_API_PORT: z.coerce.number().int().positive().default(4000),
  DASHBOARD_PORT: z.coerce.number().int().positive().default(3000),

  ADMIN_EMAIL: z.string().email().default('admin@edgegate.local'),
  ADMIN_PASSWORD: z.string().min(8).default('change-me-please'),
  JWT_SECRET: z.string().min(32).default('dev-only-secret-change-me-0123456789abcdef'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Invalid environment configuration:\n${problems}`);
  process.exit(1);
}

export const config = Object.freeze({
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
});