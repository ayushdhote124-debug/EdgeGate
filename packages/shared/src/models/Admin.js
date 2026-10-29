import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['owner', 'viewer'], default: 'owner' },
  },
  { timestamps: true }
);

adminSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    return ret;
  },
});

export const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema, 'admins');