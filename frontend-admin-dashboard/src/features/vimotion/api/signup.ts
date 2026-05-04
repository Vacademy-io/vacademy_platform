import axios from 'axios';
import {
    VIMOTION_LOGIN,
    VIMOTION_REQUEST_SIGNUP_OTP,
    VIMOTION_SIGNUP,
    VIMOTION_VERIFY_SIGNUP_OTP,
} from '@/constants/urls';
import type {
    JwtResponseDto,
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
