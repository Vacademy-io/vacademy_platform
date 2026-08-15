import { getInstituteId } from '@/constants/helper';
import {
    MetaWhatsAppTemplate,
    WhatsAppTemplateMapping,
    CreateMappingRequest,
    VacademyDataField,
    VACADEMY_DATA_FIELDS,
    PlaceholderMapping
} from '@/types/message-template-types';

import { MESSAGE_TEMPLATE_BASE, NOTIFICATION_SERVICE_BASE } from '@/constants/urls';
import { validateTemplateVariables, ValidationResult } from '@/utils/template-validation';

const API_BASE_URL = MESSAGE_TEMPLATE_BASE;
const NOTIFICATION_API_BASE = `${NOTIFICATION_SERVICE_BASE}/whatsapp-templates`;

// Get access token from localStorage or cookies
const getAccessToken = (): string | null => {
    // Try to get from localStorage first
    const token = localStorage.getItem('accessToken');
    if (token) return token;

    // Try to get from cookies
    const cookies = document.cookie.split(';');
    const tokenCookie = cookies.find((cookie) => cookie.trim().startsWith('accessToken='));
    if (tokenCookie) {
        const tokenValue = tokenCookie.split('=')[1];
        return tokenValue ? tokenValue : null;
    }

    return null;
};

/**
 * Pull the readable reason out of a failed response. The template endpoints answer with
 * `{ message, hint, code }`; older platform endpoints use `{ ex }`. Falls back to the raw body so a
 * non-JSON error page still tells you something.
 */
const describeFailure = async (response: Response): Promise<string> => {
    const raw = await response.text().catch(() => '');
    try {
        const body = JSON.parse(raw) as { message?: string; hint?: string; ex?: string };
        const base = body.message || body.ex;
        if (base) return body.hint ? `${base} ${body.hint}` : base;
    } catch {
        /* not JSON — fall through to the raw text */
    }
    return raw?.trim()
        ? `WhatsApp templates request failed (${response.status}): ${raw.slice(0, 300)}`
        : `WhatsApp templates request failed (${response.status}).`;
};

/** notification_service returns its own DTO shape; the settings tab is written against Meta's. */
const toMetaTemplate = (dto: {
    id?: string;
    name: string;
    language?: string;
    status?: string;
    category?: string;
    headerType?: string;
    headerText?: string;
    bodyText?: string;
    footerText?: string;
    buttons?: Array<{ type?: string; text?: string; url?: string; phoneNumber?: string }>;
    createdAt?: string;
    submittedAt?: string;
    approvedAt?: string;
}): MetaWhatsAppTemplate => {
    const components: MetaWhatsAppTemplate['components'] = [];
    if (dto.headerType && dto.headerType !== 'NONE') {
        components.push({
            type: 'HEADER',
            format: dto.headerType as 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT',
            ...(dto.headerText ? { text: dto.headerText } : {}),
        });
    }
    components.push({ type: 'BODY', text: dto.bodyText || '' });
    if (dto.footerText) components.push({ type: 'FOOTER', text: dto.footerText });
    if (dto.buttons?.length) {
        components.push({
            type: 'BUTTONS',
            buttons: dto.buttons.map((b) => ({
                type: (b.type || 'QUICK_REPLY') as 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY',
                text: b.text || '',
                ...(b.url ? { url: b.url } : {}),
                ...(b.phoneNumber ? { phone_number: b.phoneNumber } : {}),
            })),
        });
    }
    return {
        id: dto.id || dto.name,
        name: dto.name,
        language: dto.language || 'en',
        status: (dto.status || 'PENDING') as MetaWhatsAppTemplate['status'],
        category: (dto.category || 'UTILITY') as MetaWhatsAppTemplate['category'],
        components,
        createdAt: dto.createdAt || '',
        updatedAt: dto.approvedAt || dto.submittedAt || dto.createdAt || '',
    };
};

// Service for managing WhatsApp templates and mappings
export class WhatsAppTemplateService {
    private static instance: WhatsAppTemplateService;
    private metaTemplatesCache: MetaWhatsAppTemplate[] = [];
    private mappingsCache: WhatsAppTemplateMapping[] = [];
    private lastSyncTime: Date | null = null;

    public static getInstance(): WhatsAppTemplateService {
        if (!WhatsAppTemplateService.instance) {
            WhatsAppTemplateService.instance = new WhatsAppTemplateService();
        }
        return WhatsAppTemplateService.instance;
    }

    // Sync approved templates from Meta WhatsApp Business API
    async syncMetaTemplates(): Promise<MetaWhatsAppTemplate[]> {
        try {
            const accessToken = getAccessToken();
            if (!accessToken) {
                throw new Error('Access token not found. Please login again.');
            }

            const instituteId = getInstituteId();
            const url = `${NOTIFICATION_API_BASE}/sync`;

            const response = await fetch(`${url}?instituteId=${instituteId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                // The endpoint answers a failure with { message, hint } (or the platform's
                // { ex } shape). Quote it — "Meta access token is expired" is actionable in a way
                // that "Failed to sync templates: 400" is not.
                throw new Error(await describeFailure(response));
            }

            // /sync answers {synced, instituteId} — it does not return the templates themselves.
            // Reading result.templates left the cache empty on every successful sync, which is why
            // this method only ever produced anything via its mock fallback. Fetch the list.
            this.metaTemplatesCache = await this.fetchTemplateList(accessToken, instituteId);
            this.lastSyncTime = new Date();

            return this.metaTemplatesCache;
        } catch (error) {
            // Previously this swallowed every failure and returned four hard-coded sample
            // templates, so a broken sync looked like a successful one and admins picked
            // template names that do not exist on their WABA. Fail loudly instead.
            console.error('[whatsapp-templates] sync failed:', error);
            throw error instanceof Error ? error : new Error('Could not sync WhatsApp templates.');
        }
    }

    /** Read this institute's stored templates (post-sync, or on their own). */
    private async fetchTemplateList(
        accessToken: string,
        instituteId: string | null | undefined
    ): Promise<MetaWhatsAppTemplate[]> {
        const response = await fetch(
            `${NOTIFICATION_API_BASE}/list?instituteId=${instituteId}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!response.ok) {
            throw new Error(await describeFailure(response));
        }
        const list = (await response.json()) as Parameters<typeof toMetaTemplate>[0][];
        return (Array.isArray(list) ? list : [])
            .filter((t) => t.status !== 'DELETED')
            .map(toMetaTemplate);
    }

    // Get approved templates from Meta
    async getMetaTemplates(forceRefresh = false): Promise<MetaWhatsAppTemplate[]> {
        if (!forceRefresh && this.metaTemplatesCache.length > 0) {
            return this.metaTemplatesCache;
        }
        const accessToken = getAccessToken();
        if (!accessToken) {
            throw new Error('Access token not found. Please login again.');
        }
        // Read the stored list rather than forcing a Meta round trip. Opening a tab should not
        // re-poll Meta; that is what the explicit "Sync" action is for.
        this.metaTemplatesCache = await this.fetchTemplateList(accessToken, getInstituteId());
        return this.metaTemplatesCache;
    }

    // Get template mappings for a specific template
    async getTemplateMappings(templateId: string): Promise<WhatsAppTemplateMapping | null> {
        try {
            const accessToken = getAccessToken();
            if (!accessToken) {
                throw new Error('Access token not found. Please login again.');
            }

            const instituteId = getInstituteId();
            const url = `${API_BASE_URL}/whatsapp/mappings/${templateId}?instituteId=${instituteId}`;

            console.log('🔍 Fetching template mappings:', {
                templateId,
                instituteId,
                url
            });

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': '*/*',
                    'Authorization': `Bearer ${accessToken}`,
                    'Origin': window.location.origin,
                    'Referer': window.location.origin + '/',
                },
            });

            console.log('📡 API Response:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            if (response.status === 404) {
                console.log('ℹ️ No mapping found for template:', templateId);
                return null; // No mapping exists yet
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ API Error:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorText
                });
                throw new Error(`Failed to get mappings: ${response.status} ${errorText}`);
            }

            const result = await response.json();
            console.log('✅ Mapping data received:', result);

            // Handle different response structures
            if (result.mapping) {
                return result.mapping;
            } else if (result.data) {
                return result.data;
            } else if (result.templateId) {
                // If the result itself is the mapping
                return result;
            } else {
                console.warn('⚠️ Unexpected response structure:', result);
                return null;
            }
        } catch (error) {
            console.error('❌ Error fetching template mappings:', error);
            return null;
        }
    }

    // Save template mapping
    async saveTemplateMapping(mappingData: CreateMappingRequest): Promise<WhatsAppTemplateMapping> {
        try {
            const accessToken = getAccessToken();
            if (!accessToken) {
                throw new Error('Access token not found. Please login again.');
            }

            const instituteId = getInstituteId();
            const url = `${API_BASE_URL}/whatsapp/mappings`;

            const payload = {
                ...mappingData,
                instituteId,
            };

            console.log('💾 Saving template mapping:', {
                templateId: mappingData.templateId,
                templateName: mappingData.templateName,
                instituteId,
                url,
                payload
            });

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': '*/*',
                    'Authorization': `Bearer ${accessToken}`,
                    'Origin': window.location.origin,
                    'Referer': window.location.origin + '/',
                },
                body: JSON.stringify(payload),
            });

            console.log('📡 Save mapping response:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Save mapping error:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorText
                });
                throw new Error(`Failed to save mapping: ${response.status} ${errorText}`);
            }

            const result = await response.json();
            console.log('✅ Mapping saved successfully:', result);

            // Handle different response structures
            let savedMapping: WhatsAppTemplateMapping;
            if (result.mapping) {
                savedMapping = result.mapping;
            } else if (result.data) {
                savedMapping = result.data;
            } else if (result.templateId) {
                savedMapping = result;
            } else {
                throw new Error('Unexpected response structure from save mapping API');
            }

            // Update cache
            const existingIndex = this.mappingsCache.findIndex(m => m.templateId === mappingData.templateId);
            if (existingIndex >= 0) {
                this.mappingsCache[existingIndex] = savedMapping;
            } else {
                this.mappingsCache.push(savedMapping);
            }

            return savedMapping;
        } catch (error) {
            const mockMapping: WhatsAppTemplateMapping = {
                id: `mock-${Date.now()}`,
                templateName: mappingData.templateName,
                templateId: mappingData.templateId,
                language: mappingData.language,
                mappings: mappingData.mappings.map((m: Omit<PlaceholderMapping, 'fieldLabel' | 'dataType'>): PlaceholderMapping => ({
                    metaPlaceholder: m.metaPlaceholder,
                    vacademyField: m.vacademyField,
                    fieldLabel: this.getFieldLabel(m.vacademyField),
                    dataType: this.getFieldDataType(m.vacademyField),
                })),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                instituteId: getInstituteId() || 'unknown',
            };

            // Update cache
            this.mappingsCache.push(mockMapping);
            return mockMapping;
        }
    }

    // Helper method to get field label
    private getFieldLabel(vacademyField: string): string {
        const field = VACADEMY_DATA_FIELDS.find((f: VacademyDataField) => f.value === vacademyField);
        return field?.label || vacademyField;
    }

    // Helper method to get field data type
    private getFieldDataType(vacademyField: string): 'text' | 'number' | 'date' | 'boolean' {
        const field = VACADEMY_DATA_FIELDS.find((f: VacademyDataField) => f.value === vacademyField);
        return field?.dataType || 'text';
    }

    // Update template mapping
    async updateTemplateMapping(mappingId: string, mappingData: CreateMappingRequest): Promise<WhatsAppTemplateMapping> {
        try {
            const accessToken = getAccessToken();
            if (!accessToken) {
                throw new Error('Access token not found. Please login again.');
            }

            const instituteId = getInstituteId();
            const url = `${API_BASE_URL}/whatsapp/mappings/${mappingId}`;

            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': '*/*',
                    'Authorization': `Bearer ${accessToken}`,
                    'Origin': window.location.origin,
                    'Referer': window.location.origin + '/',
                },
                body: JSON.stringify({
                    ...mappingData,
                    instituteId,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to update mapping: ${response.status} ${errorText}`);
            }

            const result = await response.json();

            // Update cache
            const existingIndex = this.mappingsCache.findIndex(m => m.id === mappingId);
            if (existingIndex >= 0) {
                this.mappingsCache[existingIndex] = result.mapping;
            }

            return result.mapping;
        } catch (error) {
            const existingIndex = this.mappingsCache.findIndex(m => m.id === mappingId);
            if (existingIndex >= 0) {
                const existingMapping = this.mappingsCache[existingIndex];
                if (existingMapping) {
                    const updatedMapping: WhatsAppTemplateMapping = {
                        id: existingMapping.id,
                        templateName: mappingData.templateName,
                        templateId: mappingData.templateId,
                        language: mappingData.language,
                        mappings: mappingData.mappings.map((m: Omit<PlaceholderMapping, 'fieldLabel' | 'dataType'>): PlaceholderMapping => ({
                            metaPlaceholder: m.metaPlaceholder,
                            vacademyField: m.vacademyField,
                            fieldLabel: this.getFieldLabel(m.vacademyField),
                            dataType: this.getFieldDataType(m.vacademyField),
                        })),
                        createdAt: existingMapping.createdAt,
                        updatedAt: new Date().toISOString(),
                        instituteId: existingMapping.instituteId,
                    };
                    this.mappingsCache[existingIndex] = updatedMapping;
                    return updatedMapping;
                }
            }
            throw error;
        }
    }

    // Delete template mapping
    async deleteTemplateMapping(mappingId: string): Promise<void> {
        try {
            const accessToken = getAccessToken();
            if (!accessToken) {
                throw new Error('Access token not found. Please login again.');
            }

            const url = `${API_BASE_URL}/whatsapp/mappings/${mappingId}`;

            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to delete mapping: ${response.status} ${errorText}`);
            }

            // Remove from cache
            this.mappingsCache = this.mappingsCache.filter(m => m.id !== mappingId);
        } catch (error) {
            throw error;
        }
    }

    // Get all template mappings for the institute
    async getAllMappings(): Promise<WhatsAppTemplateMapping[]> {
        try {
            const accessToken = getAccessToken();
            if (!accessToken) {
                throw new Error('Access token not found. Please login again.');
            }

            const instituteId = getInstituteId();
            const url = `${API_BASE_URL}/whatsapp/mappings?instituteId=${instituteId}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': '*/*',
                    'Authorization': `Bearer ${accessToken}`,
                    'Origin': window.location.origin,
                    'Referer': window.location.origin + '/',
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to get mappings: ${response.status} ${errorText}`);
            }

            const result = await response.json();
            this.mappingsCache = result.mappings || [];
            return this.mappingsCache;
        } catch (error) {
            return this.getMockMappings();
        }
    }

    // Mock mappings for development when API is not available
    private getMockMappings(): WhatsAppTemplateMapping[] {
        const mockMappings: WhatsAppTemplateMapping[] = [
            {
                id: 'mock-mapping-1',
                templateName: 'course_enrollment_confirmation',
                templateId: 'course_enrollment_confirmation',
                language: 'en',
                mappings: [
                    {
                        metaPlaceholder: '1',
                        vacademyField: 'learner.firstName',
                        fieldLabel: 'First Name',
                        dataType: 'text'
                    },
                    {
                        metaPlaceholder: '2',
                        vacademyField: 'course.name',
                        fieldLabel: 'Course Name',
                        dataType: 'text'
                    },
                    {
                        metaPlaceholder: '3',
                        vacademyField: 'batch.startDate',
                        fieldLabel: 'Start Date',
                        dataType: 'date'
                    }
                ],
                createdAt: '2024-01-20T10:00:00Z',
                updatedAt: '2024-01-20T10:00:00Z',
                instituteId: getInstituteId() || 'unknown',
            },
            {
                id: 'mock-mapping-3',
                templateName: 'batch_completion_congratulations',
                templateId: 'batch_completion_congratulations',
                language: 'en',
                mappings: [
                    {
                        metaPlaceholder: '1',
                        vacademyField: 'learner.fullName',
                        fieldLabel: 'Full Name',
                        dataType: 'text'
                    },
                    {
                        metaPlaceholder: '2',
                        vacademyField: 'batch.name',
                        fieldLabel: 'Batch Name',
                        dataType: 'text'
                    }
                ],
                createdAt: '2024-01-18T10:00:00Z',
                updatedAt: '2024-01-18T10:00:00Z',
                instituteId: getInstituteId() || 'unknown',
            }
        ];

        this.mappingsCache = mockMappings;
        return mockMappings;
    }

    // Get Vacademy data fields for mapping
    getVacademyDataFields(): VacademyDataField[] {
        return VACADEMY_DATA_FIELDS;
    }

    // Get fields by category
    getFieldsByCategory(category: string): VacademyDataField[] {
        return VACADEMY_DATA_FIELDS.filter((field: VacademyDataField) => field.category === category);
    }

    // Get available categories
    getAvailableCategories(): string[] {
        const categories = new Set(VACADEMY_DATA_FIELDS.map((field: VacademyDataField) => field.category));
        return Array.from(categories);
    }

    // Validate WhatsApp template variables
    async validateTemplate(
        template: MetaWhatsAppTemplate,
        context?: {
            studentId?: string;
            courseId?: string;
            batchId?: string;
            instituteId?: string;
        }
    ): Promise<ValidationResult> {
        const templateContent = template.components
            .map(component => component.text || '')
            .join(' ');

        const validationContext = {
            ...context,
            instituteId: context?.instituteId || getInstituteId() || undefined
        };

        return await validateTemplateVariables(templateContent, validationContext);
    }

    // Clear cache
    clearCache(): void {
        this.metaTemplatesCache = [];
        this.mappingsCache = [];
        this.lastSyncTime = null;
    }

    // Get last sync time
    getLastSyncTime(): Date | null {
        return this.lastSyncTime;
    }
}

// Export singleton instance
export const whatsappTemplateService = WhatsAppTemplateService.getInstance();
