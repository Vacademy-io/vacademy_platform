import axios from 'axios';
import {
    VIMOTION_CONFIG,
    VIMOTION_LOGIN,
    VIMOTION_REQUEST_SIGNUP_OTP,
    VIMOTION_SIGNUP,
    VIMOTION_VALIDATE_INVITE_CODE,
    VIMOTION_VERIFY_SIGNUP_OTP,
} from '@/constants/urls';
import type {
    JwtResponseDto,
    ValidateInviteCodePayload,
    ValidateInviteCodeResponse,
    VimotionConfigResponse,
    VimotionLoginPayload,
    VimotionRequestOtpPayload,
    VimotionSignupPayload,
    VimotionVerifyOtpPayload,
    VimotionVerifyOtpResponse,
} from './types';

export async function requestSignupOtp(payload: VimotionRequestOtpPayload): Promise<string> {
    const { data } = await axios.post<string>(VIMOTION_REQUEST_SIGNUP_OTP, payload);
    return data;
}

export async function verifySignupOtp(
    payload: VimotionVerifyOtpPayload
): Promise<VimotionVerifyOtpResponse> {
    const { data } = await axios.post<VimotionVerifyOtpResponse>(
        VIMOTION_VERIFY_SIGNUP_OTP,
        payload
    );
    return data;
}

export async function vimotionSignup(payload: VimotionSignupPayload): Promise<JwtResponseDto> {
    const { data } = await axios.post<JwtResponseDto>(VIMOTION_SIGNUP, payload);
    return data;
}

export async function vimotionLogin(payload: VimotionLoginPayload): Promise<JwtResponseDto> {
    const { data } = await axios.post<JwtResponseDto>(VIMOTION_LOGIN, payload);
    return data;
}

export async function validateInviteCode(
    payload: ValidateInviteCodePayload
): Promise<ValidateInviteCodeResponse> {
    const { data } = await axios.post<ValidateInviteCodeResponse>(
        VIMOTION_VALIDATE_INVITE_CODE,
        payload
    );
    return data;
}

export async function getVimotionConfig(timeoutMs?: number): Promise<VimotionConfigResponse> {
    const { data } = await axios.get<VimotionConfigResponse>(VIMOTION_CONFIG, {
        timeout: timeoutMs,
    });
    return data;
}
