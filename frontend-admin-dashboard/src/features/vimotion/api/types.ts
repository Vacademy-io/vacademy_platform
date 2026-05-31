export type VimotionAccountType = 'individual' | 'studio' | 'agency';

export type CompanySize = '1-10' | '11-50' | '51-200' | '201+';

export interface VimotionRequestOtpPayload {
    phone_number: string;
    invite_code?: string;
}

export interface VimotionVerifyOtpPayload {
    full_name: string;
    email: string;
    phone_number: string;
    otp: string;
    invite_code?: string;
}

export interface ValidateInviteCodePayload {
    code: string;
}

export interface ValidateInviteCodeResponse {
    valid: boolean;
    kind: 'locked' | 'open';
    prefill_email?: string | null;
    prefill_phone?: string | null;
}

export interface VimotionConfigResponse {
    invite_only: boolean;
}

export interface VimotionVerifyOtpResponse {
    signup_token: string;
    expires_at: number;
}

export interface VimotionSignupPayload {
    signup_token: string;
    full_name: string;
    email: string;
    phone_number: string;
    password?: string;
    account_type: VimotionAccountType;
    studio_name?: string;
    logo_file_id?: string;
    brand_color?: string;
    company_size?: CompanySize;
}

export interface JwtResponseDto {
    accessToken: string;
    refreshToken: string;
}

export interface VimotionLoginPayload {
    email: string;
    password: string;
}
