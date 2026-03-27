import { BASE_URL } from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

const WHATSAPP_CONFIG_BASE = `${BASE_URL}/admin-core-service/institute/whatsapp-config/v1`;

export interface ProviderDetails {
    name: string;
    isConfigured: boolean;
    isActive: boolean;
    credentials: Record<string, string> | null;
}

export interface WhatsAppProviderStatusResponse {
    instituteId: string;
    activeProvider: string;
    providers: ProviderDetails[];
}

export interface WhatsAppProviderCredentials {
    providerName: string;
    credentials: Record<string, string>;
}

// Provider credential field definitions
export interface CredentialField {
    key: string;
    label: string;
    placeholder: string;
    type: 'text' | 'password';
}

export const PROVIDER_CREDENTIAL_FIELDS: Record<string, CredentialField[]> = {
    COMBOT: [
        { key: 'apiKey', label: 'API Key', placeholder: 'Enter Combot API Key', type: 'password' },
        { key: 'apiUrl', label: 'API URL', placeholder: 'https://api.combot.io/v1', type: 'text' },
        {
            key: 'phone_number_id',
            label: 'Phone Number ID',
            placeholder: 'Enter Phone Number ID',
            type: 'text',
        },
    ],
    WATI: [
        { key: 'apiKey', label: 'API Key', placeholder: 'Enter WATI API Key', type: 'password' },
        {
            key: 'apiUrl',
            label: 'API URL',
            placeholder: 'https://live-server.wati.io',
            type: 'text',
        },
        {
            key: 'whatsappNumber',
            label: 'WhatsApp Number',
            placeholder: '919876543210',
            type: 'text',
        },
    ],
    META: [
        {
            key: 'access_token',
            label: 'Access Token',
            placeholder: 'Enter System User Access Token',
            type: 'password',
        },
        { key: 'app_id', label: 'App ID', placeholder: 'Enter Meta App ID', type: 'text' },
        {
            key: 'app_secret',
            label: 'App Secret',
            placeholder: 'Enter Meta App Secret',
            type: 'password',
        },
        {
            key: 'phoneNumberId',
            label: 'Phone Number ID',
            placeholder: 'Enter Phone Number ID',
            type: 'text',
        },
        {
            key: 'wabaId',
            label: 'WABA ID',
            placeholder: 'Enter WhatsApp Business Account ID',
            type: 'text',
        },
    ],
};

export async function getWhatsAppProviderStatus(): Promise<WhatsAppProviderStatusResponse> {
    const instituteId = getInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: `${WHATSAPP_CONFIG_BASE}/status`,
        params: { instituteId },
    });
    return response.data;
}

export async function switchWhatsAppProvider(newProvider: string): Promise<void> {
    const instituteId = getInstituteId();
    await authenticatedAxiosInstance({
        method: 'PUT',
        url: `${WHATSAPP_CONFIG_BASE}/provider`,
        params: { instituteId },
        data: { newProvider },
    });
}

export async function updateWhatsAppCredentials(
    request: WhatsAppProviderCredentials
): Promise<void> {
    const instituteId = getInstituteId();
    await authenticatedAxiosInstance({
        method: 'PUT',
        url: `${WHATSAPP_CONFIG_BASE}/credentials`,
        params: { instituteId },
        data: request,
    });
}

export async function removeWhatsAppCredentials(providerName: string): Promise<void> {
    const instituteId = getInstituteId();
    await authenticatedAxiosInstance({
        method: 'DELETE',
        url: `${WHATSAPP_CONFIG_BASE}/credentials/${providerName}`,
        params: { instituteId },
    });
}

// ==================== Channel Mapping & Webhook Registration ====================

const CHANNEL_MAPPING_BASE = `${BASE_URL}/notification-service/v1/channel-mapping`;

export interface ChannelMapping {
    channelId: string;
    channelType: string;
    displayChannelNumber: string;
    instituteId: string;
    active: boolean;
}

export async function getChannelMappings(): Promise<ChannelMapping[]> {
    const instituteId = getInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: CHANNEL_MAPPING_BASE,
        params: { instituteId },
    });
    return response.data;
}

export async function createChannelMapping(mapping: {
    channelId: string;
    channelType: string;
    displayChannelNumber: string;
}): Promise<ChannelMapping> {
    const instituteId = getInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: CHANNEL_MAPPING_BASE,
        data: { ...mapping, instituteId },
    });
    return response.data;
}

export async function deleteChannelMapping(channelId: string): Promise<void> {
    await authenticatedAxiosInstance({
        method: 'DELETE',
        url: `${CHANNEL_MAPPING_BASE}/${channelId}`,
    });
}

export async function registerWatiWebhook(
    watiApiUrl: string,
    watiApiKey: string,
    webhookUrl: string
): Promise<{ success: boolean; message: string }> {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: `${CHANNEL_MAPPING_BASE}/register-webhook/wati`,
        data: { watiApiUrl, watiApiKey, webhookUrl },
    });
    return response.data;
}

export async function registerMetaWebhook(
    webhookUrl: string
): Promise<{ success: boolean; message: string; steps?: string[] }> {
    const instituteId = getInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: `${CHANNEL_MAPPING_BASE}/register-webhook/meta`,
        data: { instituteId, webhookUrl },
    });
    return response.data;
}

export async function verifyWebhookEndpoint(
    webhookUrl: string
): Promise<{ success: boolean; message: string }> {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: `${CHANNEL_MAPPING_BASE}/verify-webhook`,
        data: { webhookUrl },
    });
    return response.data;
}

/**
 * Generate the correct webhook URL for a given provider.
 */
export function getWebhookUrl(provider: string, channelId?: string): string {
    switch (provider.toUpperCase()) {
        case 'WATI':
            return `${BASE_URL}/notification-service/webhook/v1/wati/${channelId || 'YOUR_CHANNEL_ID'}`;
        case 'META':
            return `${BASE_URL}/notification-service/v1/webhook/whatsapp`;
        case 'COMBOT':
            return `${BASE_URL}/notification-service/v1/webhook/whatsapp`;
        default:
            return `${BASE_URL}/notification-service/v1/webhook/whatsapp`;
    }
}

/**
 * Map provider name to channel type for channel_to_institute_mapping.
 */
export function providerToChannelType(provider: string): string {
    switch (provider.toUpperCase()) {
        case 'WATI': return 'WHATSAPP_WATI';
        case 'META': return 'WHATSAPP_META';
        case 'COMBOT': return 'WHATSAPP_COMBOT';
        default: return 'WHATSAPP';
    }
}
