export const ENABLE_LIVE_CLASS_SAFETY_MODAL = false;

/**
 * Email OTP Verification Feature Flag
 * 
 * When set to `false`:
 * - Email OTP verification will be skipped
 * - Users will proceed directly without OTP verification
 * - Use this when email service (SES) is experiencing issues
 * 
 * When set to `true`:
 * - Normal email OTP verification flow is active
 * - Users must verify their email via OTP
 * 
 * @default true
 */
export const EMAIL_OTP_VERIFICATION_ENABLED = false;
