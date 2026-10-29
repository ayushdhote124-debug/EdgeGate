import mongoose from 'mongoose';

// One document per request. A MongoDB time-series collection stores this kind of
// append-only, time-ordered data compactly, and the TTL removes it after 30 days.
const requestLogSchema = new mongoose.Schema(
  {
    ts: { type: Date, required: true },
    meta: {
      tenantId: { type: mongoose.Schema.Types.ObjectId },
      service: { type: String },
    },
    requestId: { type: String, required: true },
    keyId: { type: mongoose.Schema.Types.ObjectId },
    route: { type: String },
    method: { type: String },
    status: { type: Number },
    latencyMs: { type: Number },
    upstreamMs: { type: Number },
    instance: { type: String },
    errorCode: { type: String },
  },
  {
    versionKey: false,
    timeseries: { timeField: 'ts', metaField: 'meta', granularity: 'seconds' },
    expireAfterSeconds: 60 * 60 * 24 * 30,
    // Created explicitly by `npm run seed` (see models/index.js), not on first import.
    autoCreate: false,
  }
);

export const RequestLog =
  mongoose.models.RequestLog || mongoose.model('RequestLog', requestLogSchema, 'request_logs');