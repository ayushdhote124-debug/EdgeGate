import mongoose from 'mongoose';

// Per-minute rollup written by the worker. The dashboard reads this, not raw logs.
// tenantId is null for the service-wide total row.
const metric1mSchema = new mongoose.Schema(
  {
    minute: { type: Date, required: true },
    service: { type: String, required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    count: { type: Number, default: 0 },
    errors4xx: { type: Number, default: 0 },
    errors5xx: { type: Number, default: 0 },
    rejected: { type: Number, default: 0 }, // rate limit, quota, breaker, no instance
    latency: {
      p50: Number,
      p95: Number,
      p99: Number,
    },
  },
  { versionKey: false }
);

metric1mSchema.index({ service: 1, minute: -1 });
metric1mSchema.index({ tenantId: 1, minute: -1 });
metric1mSchema.index({ minute: 1, service: 1, tenantId: 1 }, { unique: true });

export const Metric1m = mongoose.models.Metric1m || mongoose.model('Metric1m', metric1mSchema, 'metrics_1m');