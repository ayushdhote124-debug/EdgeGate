import mongoose from 'mongoose';

const instanceSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    weight: { type: Number, min: 1, default: 1 },
  },
  { _id: false }
);

const breakerSchema = new mongoose.Schema(
  {
    windowSize: { type: Number, min: 5, default: 20 }, // rolling window of last N calls
    minCalls: { type: Number, min: 1, default: 10 }, // don't judge until this many calls
    failureRate: { type: Number, min: 0.05, max: 1, default: 0.5 }, // open at >= 50% failures
    openMs: { type: Number, min: 1000, default: 30_000 }, // stay open this long
    halfOpenProbes: { type: Number, min: 1, default: 3 }, // trial requests in half-open
  },
  { _id: false }
);

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    routePrefix: {
      type: String,
      required: true,
      unique: true,
      match: [/^\/[a-z0-9\-\/]*$/, 'routePrefix must start with / and use lowercase letters, digits, - or /'],
    },
    instances: {
      type: [instanceSchema],
      validate: [(v) => v.length > 0, 'A service needs at least one instance'],
    },
    lbStrategy: { type: String, enum: ['round-robin', 'weighted', 'least-connections'], default: 'round-robin' },
    timeoutMs: { type: Number, min: 100, max: 60_000, default: 3000 },
    breaker: { type: breakerSchema, default: () => ({}) },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Service = mongoose.models.Service || mongoose.model('Service', serviceSchema, 'services');