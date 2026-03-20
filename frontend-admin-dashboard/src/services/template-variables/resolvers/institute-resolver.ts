/**
 * Resolver for institute-related variables
 */

import { VariableResolver, ResolvedVariable, VariableContext, VariableCategory } from '../types';
import { fetchInstituteDetails } from '@/services/student-list-section/getInstituteDetails';
import { variableCache } from '../cache';

export class InstituteVariableResolver implements VariableResolver {
    private readonly supportedVariables = [
        'institute_name',
        'institute_address',
        'institute_phone',
        'institute_email',
        'institute_website',
        'institute_logo',
        'support_email',
        'support_link',
        'custom_message_text'
    ];

    canResolve(variableName: string): boolean {
        // Handle both with and without brackets
        const cleanName = variableName.replace(/[{}]/g, '');
        return this.supportedVariables.includes(cleanName) || this.supportedVariables.includes(variableName);
    }

    async resolve(variableName: string, context?: VariableContext): Promise<ResolvedVariable | null> {
        if (!this.canResolve(variableName)) {
            return null;
        }

        // Clean the variable name (remove brackets if present)
        const cleanName = variableName.replace(/[{}]/g, '');

        // Check cache first
        const cacheKey = `institute:${cleanName}`;
        const cached = variableCache.get(cacheKey);
        if (cached) {
            return cached.variable;
        }

        try {
            // Fetch institute data from API
            const instituteData = await fetchInstituteDetails();

            if (!instituteData) {
                return null;
            }

            let value: string | null = null;

            switch (cleanName) {
                case 'institute_name':
                    value = instituteData.institute_name || null;
                    break;
                case 'institute_address':
                    value = instituteData.address && instituteData.address.trim() !== ''
                        ? instituteData.address
                        : null;
                    break;
                case 'institute_phone':
                    value = instituteData.phone || null;
                    break;
                case 'institute_email':
                    value = instituteData.email || null;
                    break;
                case 'institute_website':
                    value = instituteData.website_url || null;
                    break;
                case 'institute_logo':
                    value = instituteData.institute_logo_file_id || null;
                    break;
                case 'support_email':
                    value = instituteData.email || null; // Use email as support email
                    break;
                case 'support_link':
                    value = instituteData.website_url || null; // Use website as support link
                    break;
                case 'custom_message_text':
                    value = instituteData.description && instituteData.description.trim() !== ''
                        ? instituteData.description
                        : null;
                    break;
            }

            if (value === null) {
                return null;
            }

            const resolved: ResolvedVariable = {
                name: variableName,
                value,
                source: 'institute-api',
                isRequired: true
            };

            // Cache the result for 10 minutes
            variableCache.set(cacheKey, resolved, 10 * 60 * 1000);

            return resolved;

        } catch (error) {
            console.warn(`Error resolving institute variable ${variableName}:`, error);
            return null;
        }
    }

    getSupportedVariables(): string[] {
        return [...this.supportedVariables];
    }

    getPriority(): number {
        return 80; // High priority - institute data is usually available
    }

    getMetadata() {
        return {
            category: 'institute' as VariableCategory,
            description: 'Institute-related information from the API',
            variables: this.supportedVariables.map(variable => ({
                name: variable,
                description: this.getVariableDescription(variable),
                example: this.getVariableExample(variable),
                required: this.isRequired(variable)
            }))
        };
    }

    private getVariableDescription(variable: string): string {
        const descriptions: Record<string, string> = {
            'institute_name': 'Name of the institute',
            'institute_address': 'Physical address of the institute',
            'institute_phone': 'Contact phone number',
            'institute_email': 'Contact email address',
            'institute_website': 'Institute website URL',
            'institute_logo': 'Institute logo file ID or URL',
            'support_email': 'Support email address (uses institute email)',
            'support_link': 'Support link (uses institute website)',
            'custom_message_text': 'Custom message or description'
        };
        return descriptions[variable] || 'Institute variable';
    }

    private getVariableExample(variable: string): string {
        const examples: Record<string, string> = {
            'institute_name': 'Aanandham Institute',
            'institute_address': '123 Education Street, City, State',
            'institute_phone': '+1234567890',
            'institute_email': 'info@institute.com',
            'institute_website': window.location.origin,
            'institute_logo': 'logo-file-id-123',
            'support_email': 'support@institute.com',
            'support_link': `${window.location.origin}/support`,
            'custom_message_text': 'Welcome to our institute!'
        };
        return examples[variable] || 'N/A';
    }

    private isRequired(variable: string): boolean {
        const requiredVariables = [
            'institute_name',
            'institute_email',
            'institute_phone'
        ];
        return requiredVariables.includes(variable);
    }
}
