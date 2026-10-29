import mongoose from 'mongoose';

const apiKeySchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    keyHash: { type: String, required: true, unique: true }, // sha256 of the raw key
    prefix: { type: String, required: true }, // first 12 chars, for display only
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    limits: {
      rate: { type: Number, min: 1 },
      burst: { type: Number, min: 1 },
      monthlyQuota: { type: Number, min: 1 },
    },
    lastUsedAt: { type: Date },
    revokedAt: { type: Date },
  },
  { timestamps: true }
);

// The hash must never leave the server in API responses.
apiKeySchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.keyHash;
    return ret;
  },
});

export const ApiKey = mongoose.models.ApiKey || mongoose.model('ApiKey', apiKeySchema, 'api_keys');