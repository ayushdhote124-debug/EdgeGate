import mongoose from 'mongoose';

// Monthly request total per tenant: the billing record. Redis holds the live counter.
const usageSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    month: { type: String, required: true, match: /^\d{6}$/ }, // YYYYMM
    requests: { type: Number, default: 0 },
  },
  { timestamps: true }
);

usageSchema.index({ tenantId: 1, month: 1 }, { unique: true });

export const Usage = mongoose.models.Usage || mongoose.model('Usage', usageSchema, 'usage');