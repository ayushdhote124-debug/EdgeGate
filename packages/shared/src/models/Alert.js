import mongoose from 'mongoose';

export const ALERT_METRICS = ['error_rate', 'p95_latency', 'breaker_open', 'quota_usage'];

const alertRuleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    metric: { type: String, enum: ALERT_METRICS, required: true },
    scope: {
      service: { type: String },
      tenantId: { type: mongoose.Schema.Types.ObjectId },
    },
    op: { type: String, enum: ['>', '>=', '<', '<='], default: '>' },
    threshold: { type: Number, required: true },
    windowMin: { type: Number, min: 1, max: 60, default: 5 },
    channels: [
      {
        _id: false,
        type: { type: String, enum: ['webhook'], required: true },
        url: { type: String, required: true },
      },
    ],
    enabled: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

const alertSchema = new mongoose.Schema(
  {
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'AlertRule', required: true },
    state: { type: String, enum: ['firing', 'resolved'], required: true },
    value: { type: Number },
    startedAt: { type: Date, required: true },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

alertSchema.index({ ruleId: 1, state: 1 });
alertSchema.index({ startedAt: -1 });

export const AlertRule = mongoose.models.AlertRule || mongoose.model('AlertRule', alertRuleSchema, 'alert_rules');
export const Alert = mongoose.models.Alert || mongoose.model('Alert', alertSchema, 'alerts');