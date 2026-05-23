import axios from 'axios';
import {
    VIMOTION_WAITLIST_COUNT,
    VIMOTION_WAITLIST_JOIN,
    VIMOTION_WAITLIST_STATUS,
} from '@/constants/urls';

export type WaitlistStatus = 'pending' | 'invited' | 'converted' | 'rejected';

export interface JoinWaitlistPayload {
    full_name: string;
    email: string;
    phone_number: string;
    referral_code?: string;
    source?: string;
}

export interface WaitlistStatusResponse {
    id: string;
    full_name: string;
    email: string;
    status: WaitlistStatus;
    referral_code: string;
    referral_count: number;
    position: number;
    effective_position: number;
    total_count: number;
}

export interface WaitlistCountResponse {
    total: number;
}

export async function joinWaitlist(payload: JoinWaitlistPayload): Promise<WaitlistStatusResponse> {
    const { data } = await axios.post<WaitlistStatusResponse>(VIMOTION_WAITLIST_JOIN, payload);
    return data;
}

export async function getWaitlistStatus(email: string): Promise<WaitlistStatusResponse> {
    const { data } = await axios.get<WaitlistStatusResponse>(VIMOTION_WAITLIST_STATUS, {
        params: { email },
    });
    return data;
}

export async function getWaitlistCount(): Promise<WaitlistCountResponse> {
    const { data } = await axios.get<WaitlistCountResponse>(VIMOTION_WAITLIST_COUNT);
    return data;
}
