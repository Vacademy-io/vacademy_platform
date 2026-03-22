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
            placeholder: 'Enter Meta Access Token',
            type: 'password',
        },
        { key: 'app_id', label: 'App ID', placeholder: 'Enter Meta App ID', type: 'text' },
        {
            key: 'phoneNumberId',
            label: 'Phone Number ID',
            placeholder: 'Enter Phone Number ID',
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
