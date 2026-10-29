import { Tenant } from './Tenant.js';
import { ApiKey } from './ApiKey.js';
import { Service } from './Service.js';
import { RequestLog } from './RequestLog.js';
import { Metric1m } from './Metric1m.js';
import { Usage } from './Usage.js';
import { AlertRule, Alert, ALERT_METRICS } from './Alert.js';
import { Admin } from './Admin.js';

export { Tenant, ApiKey, Service, RequestLog, Metric1m, Usage, AlertRule, Alert, Admin, ALERT_METRICS };

/**
 * Creates collections and indexes. The request log is a time-series collection;
 * if the database does not support that (e.g. a MongoDB-compatible engine),
 * it falls back to a normal collection with the same indexes and TTL.
 */
export async function ensureCollections(log = console) {
  const regular = [Tenant, ApiKey, Service, Metric1m, Usage, AlertRule, Alert, Admin];
  for (const model of regular) {
    await model.createCollection().catch(ignoreExists);
    await model.syncIndexes();
  }

  const db = RequestLog.db.db;
  const exists = await db.listCollections({ name: 'request_logs' }).hasNext();
  if (!exists) {
    try {
      await RequestLog.createCollection();
      log.info?.('request_logs created as a time-series collection');
    } catch (err) {
      log.warn?.(`time-series not supported (${err.codeName || err.message}); using a regular collection`);
      await db.createCollection('request_logs');
      try {
        await db.collection('request_logs').createIndex({ ts: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
      } catch {
        log.warn?.('TTL indexes not supported; old request logs will not expire automatically');
        await db.collection('request_logs').createIndex({ ts: 1 });
      }
      await db.collection('request_logs').createIndex({ 'meta.tenantId': 1, ts: -1 });
      await db.collection('request_logs').createIndex({ 'meta.service': 1, ts: -1 });
    }
  }
}

function ignoreExists(err) {
  if (err?.codeName === 'NamespaceExists' || err?.code === 48) return;
  throw err;
}