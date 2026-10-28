import { Schema, model, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';

/**
 * One row per issued refresh token. We store only the SHA-256 hash of the token
 * so a database compromise cannot be replayed. `familyId` links every token in
 * a rotation chain, which lets us revoke an entire chain on reuse detection.
 */
const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    jti: { type: String, required: true, index: true },
    familyId: { type: String, required: true, index: true },

    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },

    userAgent: { type: String, default: null },
    ip: { type: String, default: null },

    /** Set when this token was rotated into a successor. */
    replacedByJti: { type: String, default: null },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ userId: 1, revokedAt: 1 });
refreshTokenSchema.index({ familyId: 1, revokedAt: 1 });

export type RefreshTokenAttributes = InferSchemaType<typeof refreshTokenSchema>;
export type RefreshTokenDocument = HydratedDocument<RefreshTokenAttributes>;
export type RefreshTokenModel = Model<RefreshTokenAttributes>;

export const RefreshToken = model<RefreshTokenAttributes>(
  'RefreshToken',
  refreshTokenSchema,
) as RefreshTokenModel;

export const REVOKE_REASONS = {
  LOGOUT: 'logout',
  ROTATED: 'rotated',
  REUSE_DETECTED: 'reuse_detected',
  PASSWORD_CHANGED: 'password_changed',
  ACCOUNT_DELETED: 'account_deleted',
} as const;
