import {
    MessageTemplate,
    CreateTemplateRequest,
    UpdateTemplateRequest,
    TemplateListResponse,
} from '@/types/message-template-types';
import { getInstituteId } from '@/constants/helper';
import {
    CREATE_MESSAGE_TEMPLATE,
    GET_MESSAGE_TEMPLATES,
    GET_MESSAGE_TEMPLATE,
    UPDATE_MESSAGE_TEMPLATE,
    DELETE_MESSAGE_TEMPLATE,
    SEARCH_MESSAGE_TEMPLATES,
    MESSAGE_TEMPLATE_BASE,
} from '@/constants/urls';

import { getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

// Get access token from cookies using the standard method
const getAccessToken = (): string | null => {
    return getTokenFromCookie(TokenKey.accessToken);
};

// Helper function to safely parse settingJson
const parseSettingJson = (
    settingJson: string | object | undefined
): { variables: string[]; isDefault: boolean; templateType: 'marketing' | 'utility' | 'transactional'; mjml?: string } => {
    if (!settingJson) {
        return { variables: [], isDefault: false, templateType: 'utility' };
    }

    // If it's already an object, return it directly
    if (typeof settingJson === 'object') {
        return {
            variables: (settingJson as any).variables || [],
            isDefault: (settingJson as any).isDefault || false,
            templateType: ((settingJson as any).templateType as 'marketing' | 'utility' | 'transactional') || 'utility',
            mjml: (settingJson as any).mjml || undefined,
        };
    }

    // If it's a string, try to parse it
    if (typeof settingJson === 'string') {
        try {
            const settings = JSON.parse(settingJson);
            return {
                variables: settings.variables || [],
                isDefault: settings.isDefault || false,
                templateType: (settings.templateType as 'marketing' | 'utility' | 'transactional') || 'utility',
                mjml: settings.mjml || undefined,
            };
        } catch (error) {
            return { variables: [], isDefault: false, templateType: 'utility' };
        }
    }

    return { variables: [], isDefault: false, templateType: 'utility' };
};

export const createMessageTemplate = async (
    template: CreateTemplateRequest
): Promise<MessageTemplate> => {
    try {
        const accessToken = getAccessToken();
        if (!accessToken) {
            throw new Error('Access token not found. Please login again.');
        }

        const instituteId = getInstituteId();
        if (!instituteId) {
            throw new Error('Institute ID not found. Please login again.');
        }
        
        const payload = {
            type: template.type?.toLowerCase() || 'email',
            vendorId: 'default',
            instituteId: instituteId,
            name: template.name,
            subject: template.subject || '',
            content: template.content, // HTML content from GrapesJS editor
            contentType: 'text/html', // HTML content with base64 images for email templates
            settingJson: {
                variables: template.variables || [],
                isDefault: template.isDefault || false,
                templateType: template.templateType || 'utility',
                mjml: template.mjml || undefined, // MJML JSON data for editor state
            },
            dynamicParameters: {},
            canDelete: true,
            createdBy: 'current-user',
            updatedBy: 'current-user',
        };

        const response = await fetch(CREATE_MESSAGE_TEMPLATE, {
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

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Create template API error:', {
                status: response.status,
                statusText: response.statusText,
                errorText,
                hasToken: !!accessToken,
                hasInstituteId: !!instituteId,
            });
            throw new Error(`Failed to create template: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        const parsedSettings = parseSettingJson(result.settingJson);

        // Transform the API response to match our MessageTemplate interface
        return {
            id: result.id || result.templateId,
            name: result.name,
            type: result.type?.toUpperCase() || 'EMAIL', // Normalize type to uppercase
            subject: result.subject || '',
            content: result.content,
            variables: parsedSettings.variables,
            isDefault: parsedSettings.isDefault,
            templateType: parsedSettings.templateType,
            mjml: parsedSettings.mjml,
            createdAt: result.createdAt || new Date().toISOString(),
            updatedAt: result.updatedAt || new Date().toISOString(),
        };
    } catch (error) {
        throw error;
    }
};

export const getMessageTemplates = async (
    type?: 'EMAIL' | 'WHATSAPP',
    page = 0,
    size = 10
): Promise<TemplateListResponse> => {
    try {
        const accessToken = getAccessToken();
        if (!accessToken) {
            throw new Error('Access token not found. Please login again.');
        }

        const instituteId = getInstituteId();

        // Build URL with pagination parameters
        const baseUrl = `${GET_MESSAGE_TEMPLATES}/${instituteId}`;
        const url = new URL(baseUrl);
        url.searchParams.append('page', page.toString());
        url.searchParams.append('size', size.toString());
        if (type) {
            url.searchParams.append('type', type);
        }

        const response = await fetch(url.toString(), {
            headers: {
                'Accept': '*/*',
                'Authorization': `Bearer ${accessToken}`,
                'Origin': window.location.origin,
                'Referer': window.location.origin + '/',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch templates: ${response.status} ${errorText}`);
        }

        const result = await response.json();

        // Handle new API response structure with content array and pagination
        let templates: Record<string, unknown>[] = [];
        let totalElements = 0;
        let pageNumber = page;
        let pageSize = size;
        let totalPages = 1;
        let isLast = true;
        let isFirst = true;

        if (result.content && Array.isArray(result.content)) {
            // New paginated response structure
            templates = result.content;
            totalElements = result.total_elements || result.totalElements || 0;
            pageNumber = result.page_number !== undefined ? result.page_number : (result.pageNumber !== undefined ? result.pageNumber : page);
            pageSize = result.page_size || result.pageSize || size;
            totalPages = result.total_pages || result.totalPages || 1;
            isLast = result.last !== undefined ? result.last : (result.isLast !== undefined ? result.isLast : true);
            isFirst = result.first !== undefined ? result.first : (result.isFirst !== undefined ? result.isFirst : true);
        } else if (Array.isArray(result)) {
            // Fallback: old response structure (array directly)
            templates = result;
            totalElements = result.length;
        } else {
            // Fallback: other response structures
            templates = result.templates || result.data || [];
            totalElements = templates.length;
        }

        // Type filtering is handled by the API via query parameter
        // No need for client-side filtering when type is provided

        // Transform templates to match our MessageTemplate interface
        const transformedTemplates = templates.map((template: Record<string, unknown>) => {
            const parsedSettings = parseSettingJson(template.settingJson as string);

            // Map templateCategory to templateType if needed
            let mappedTemplateType = parsedSettings.templateType;
            if (!mappedTemplateType && template.templateCategory) {
                const category = (template.templateCategory as string).toLowerCase();
                if (category === 'marketing' || category === 'utility' || category === 'transactional') {
                    mappedTemplateType = category as 'marketing' | 'utility' | 'transactional';
                }
            }

            const normalizedType = ((template.type as string)?.toUpperCase() || 'EMAIL') as 'EMAIL' | 'WHATSAPP';
            
            return {
                id: (template.id || template.templateId) as string,
                name: template.name as string,
                type: normalizedType,
                subject: (template.subject as string) || '',
                content: (template.content as string) || '', // Content might not be in list response
                variables: parsedSettings.variables,
                isDefault: parsedSettings.isDefault,
                templateType: mappedTemplateType,
                mjml: parsedSettings.mjml,
                createdAt: (template.createdAt as string) || new Date().toISOString(),
                updatedAt: (template.updatedAt as string) || new Date().toISOString(),
                createdBy: template.createdBy as string | undefined,
                instituteId: template.instituteId as string | undefined,
            };
        });

        return {
            templates: transformedTemplates,
            total: totalElements,
            page: pageNumber,
            limit: pageSize,
            totalPages: totalPages,
            isLast: isLast,
            isFirst: isFirst,
        };
    } catch (error) {
        throw error;
    }
};

export const getMessageTemplate = async (id: string): Promise<MessageTemplate> => {
    try {
        const accessToken = getAccessToken();
        if (!accessToken) {
            throw new Error('Access token not found. Please login again.');
        }

        if (!id || id.trim() === '') {
            throw new Error('Template ID is required');
        }

        // Use the correct endpoint: /admin-core-service/institute/template/v1/{template-id}
        const url = `${MESSAGE_TEMPLATE_BASE}/${id}`;

        const response = await fetch(url, {
            headers: {
                'Accept': '*/*',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'Origin': window.location.origin,
                'Referer': window.location.origin + '/',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch template: ${response.status} ${errorText || response.statusText}`);
        }

        const result = await response.json();
        console.log('Template API response:', result);

        // Parse settingJson to extract variables, isDefault, templateType, mjml
        const parsedSettings = parseSettingJson(result.settingJson);

        // Map templateCategory to templateType if needed
        let mappedTemplateType = parsedSettings.templateType;
        if (!mappedTemplateType && result.templateCategory) {
            const category = (result.templateCategory as string).toLowerCase();
            // Map API categories to our template types
            if (category === 'marketing' || category === 'utility' || category === 'transactional') {
                mappedTemplateType = category as 'marketing' | 'utility' | 'transactional';
            } else if (category === 'notification' || category === 'workflow_admin') {
                mappedTemplateType = 'utility'; // Default mapping
            }
        }

        // Transform the API response to match our MessageTemplate interface
        const transformed: MessageTemplate = {
            id: result.id || result.templateId || id,
            name: result.name || '',
            type: ((result.type as string)?.toUpperCase() || 'EMAIL') as 'EMAIL' | 'WHATSAPP',
            subject: result.subject || '',
            content: result.content || '',
            variables: parsedSettings.variables,
            isDefault: parsedSettings.isDefault,
            templateType: mappedTemplateType,
            mjml: parsedSettings.mjml,
            createdAt: result.createdAt || new Date().toISOString(),
            updatedAt: result.updatedAt || new Date().toISOString(),
            createdBy: result.createdBy,
            instituteId: result.instituteId,
        };

        console.log('Transformed template:', {
            id: transformed.id,
            name: transformed.name,
            type: transformed.type,
            hasContent: !!transformed.content,
            contentLength: transformed.content?.length || 0,
            hasMjml: !!transformed.mjml,
        });

        return transformed;
    } catch (error) {
        console.error('Error in getMessageTemplate:', error);
        throw error;
    }
};

export const updateMessageTemplate = async (
    template: UpdateTemplateRequest
): Promise<MessageTemplate> => {
    try {
        const accessToken = getAccessToken();
        if (!accessToken) {
            throw new Error('Access token not found. Please login again.');
        }

        const instituteId = getInstituteId();
        if (!instituteId) {
            throw new Error('Institute ID not found. Please login again.');
        }
        
        const { id, ...updateData } = template;

        const payload = {
            id: id,
            type: updateData.type?.toLowerCase() || 'email',
            vendorId: 'default',
            instituteId: instituteId,
            name: updateData.name || '',
            subject: updateData.subject || '',
            content: updateData.content || '', // HTML content from GrapesJS editor
            contentType: 'text/html', // HTML content with base64 images for email templates
            settingJson: {
                variables: updateData.variables || [],
                isDefault: updateData.isDefault || false,
                templateType: updateData.templateType || 'utility',
                mjml: updateData.mjml || undefined, // MJML JSON data for editor state
            },
            dynamicParameters: {},
            canDelete: true,
            updatedBy: 'current-user',
        };


        const response = await fetch(UPDATE_MESSAGE_TEMPLATE, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': '*/*',
                'Authorization': `Bearer ${accessToken}`,
                'Origin': window.location.origin,
                'Referer': window.location.origin + '/',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Update template API error:', {
                status: response.status,
                statusText: response.statusText,
                errorText,
                hasToken: !!accessToken,
                hasInstituteId: !!instituteId,
            });
            throw new Error(`Failed to update template: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        const parsedSettings = parseSettingJson(result.settingJson);

        // Transform the API response to match our MessageTemplate interface
        return {
            id: result.id || result.templateId,
            name: result.name,
            type: result.type?.toUpperCase() || 'EMAIL', // Normalize type to uppercase
            subject: result.subject || '',
            content: result.content,
            variables: parsedSettings.variables,
            isDefault: parsedSettings.isDefault,
            templateType: parsedSettings.templateType,
            mjml: parsedSettings.mjml,
            createdAt: result.createdAt || new Date().toISOString(),
            updatedAt: result.updatedAt || new Date().toISOString(),
        };
    } catch (error) {
        throw error;
    }
};

export const deleteMessageTemplate = async (id: string): Promise<void> => {
    try {
        const accessToken = getAccessToken();
        if (!accessToken) {
            throw new Error('Access token not found. Please login again.');
        }

        // Use correct URL structure: base URL + ID (matching your curl command)
        const deleteUrl = `${MESSAGE_TEMPLATE_BASE}/${id}`;

        // Check if template has deletion restrictions
        try {
            const template = await getMessageTemplate(id);
            if (template.isDefault) {
                throw new Error('Cannot delete default template');
            }
        } catch (error) {
            // Continue with deletion even if template fetch fails
        }

        const response = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
                'Accept': '*/*',
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to delete template: ${response.status} ${errorText}`);
        }
    } catch (error) {
        throw error;
    }
};

export const setDefaultTemplate = async (
    id: string,
    type: 'EMAIL' | 'WHATSAPP'
): Promise<MessageTemplate> => {
    try {
        const accessToken = getAccessToken();
        if (!accessToken) {
            throw new Error('Access token not found. Please login again.');
        }

        const response = await fetch(`${MESSAGE_TEMPLATE_BASE}/set-default/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Accept: '*/*',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ type }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to set default template: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        const parsedSettings = parseSettingJson(result.settingJson);

        // Transform the API response to match our MessageTemplate interface
        return {
            id: result.id || result.templateId,
            name: result.name,
            type: result.type?.toUpperCase() || 'EMAIL', // Normalize type to uppercase
            subject: result.subject || '',
            content: result.content,
            variables: parsedSettings.variables,
            isDefault: parsedSettings.isDefault,
            templateType: parsedSettings.templateType,
            mjml: parsedSettings.mjml,
            createdAt: result.createdAt || new Date().toISOString(),
            updatedAt: result.updatedAt || new Date().toISOString(),
        };
    } catch (error) {
        throw error;
    }
};

export const duplicateTemplate = async (id: string): Promise<MessageTemplate> => {
    try {
        const accessToken = getAccessToken();
        if (!accessToken) {
            throw new Error('Access token not found. Please login again.');
        }

        const response = await fetch(`${MESSAGE_TEMPLATE_BASE}/duplicate/${id}`, {
            method: 'POST',
            headers: {
                Accept: '*/*',
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to duplicate template: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        const parsedSettings = parseSettingJson(result.settingJson);

        // Transform the API response to match our MessageTemplate interface
        return {
            id: result.id || result.templateId,
            name: result.name,
            type: result.type?.toUpperCase() || 'EMAIL', // Normalize type to uppercase
            subject: result.subject || '',
            content: result.content,
            variables: parsedSettings.variables,
            isDefault: parsedSettings.isDefault,
            templateType: parsedSettings.templateType,
            mjml: parsedSettings.mjml,
            createdAt: result.createdAt || new Date().toISOString(),
            updatedAt: result.updatedAt || new Date().toISOString(),
        };
    } catch (error) {
        throw error;
    }
};

// Search templates with filters
export const searchMessageTemplates = async (searchParams: {
    type?: 'EMAIL' | 'WHATSAPP';
    searchText?: string;
    canDelete?: boolean;
    contentType?: string;
    page?: number;
    size?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
}): Promise<TemplateListResponse> => {
    try {
        const accessToken = getAccessToken();
        if (!accessToken) {
            throw new Error('Access token not found. Please login again.');
        }

        const instituteId = getInstituteId();
        const searchData = {
            instituteId: instituteId,
            type: searchParams.type || '',
            vendorId: 'default',
            searchText: searchParams.searchText || '',
            canDelete: searchParams.canDelete ?? true,
            contentType: searchParams.contentType || 'text/plain',
            page: searchParams.page || 0,
            size: searchParams.size || 50,
            sortBy: searchParams.sortBy || 'createdAt',
            sortDirection: searchParams.sortDirection || 'desc',
        };

        const response = await fetch(SEARCH_MESSAGE_TEMPLATES, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: '*/*',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(searchData),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to search templates: ${response.status} ${errorText}`);
        }

        const result = await response.json();

        // Transform the API response to match our TemplateListResponse interface
        const templates = (result.content || result.templates || result.data || []).map(
            (template: Record<string, unknown>) => {
                const parsedSettings = parseSettingJson(template.settingJson as string);
                return {
                    id: (template.id || template.templateId) as string,
                    name: template.name as string,
                    type: (template.type as string)?.toUpperCase() || 'EMAIL', // Normalize type to uppercase
                    subject: (template.subject as string) || '',
                    content: template.content as string,
                    variables: parsedSettings.variables,
                    isDefault: parsedSettings.isDefault,
                    templateType: parsedSettings.templateType,
                    mjml: parsedSettings.mjml,
                    createdAt: (template.createdAt as string) || new Date().toISOString(),
                    updatedAt: (template.updatedAt as string) || new Date().toISOString(),
                };
            }
        );

        return {
            templates,
            total: result.totalElements || result.total || 0,
            page: result.number || result.page || 0,
            limit: result.size || result.limit || 50,
        };
    } catch (error) {
        throw error;
    }
};
