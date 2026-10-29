import mongoose from 'mongoose';
import { PLANS } from '../plans.js';

// Optional overrides; null/undefined means "use the plan default".
const limitsSchema = new mongoose.Schema(
  {
    rate: { type: Number, min: 1 },
    burst: { type: Number, min: 1 },
    monthlyQuota: { type: Number, min: 1 },
  },
  { _id: false }
);

const tenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    plan: { type: String, enum: Object.keys(PLANS), default: 'free' },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    limits: { type: limitsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export const Tenant = mongoose.models.Tenant || mongoose.model('Tenant', tenantSchema, 'tenants');