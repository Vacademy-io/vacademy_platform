import { useState, useEffect } from 'react';
import { getMessageTemplate } from '@/services/message-template-service';
import type { MessageTemplate } from '@/types/message-template-types';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';

interface TemplateFormData {
    name: string;
    type: 'EMAIL' | 'WHATSAPP';
    subject: string;
    templateType: 'marketing' | 'utility' | 'transactional';
    isDefault: boolean;
}

export const useTemplateData = (templateId: string | null) => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(!!templateId);
    const [template, setTemplate] = useState<MessageTemplate | null>(null);
    const [formData, setFormData] = useState<TemplateFormData>({
        name: '',
        type: 'EMAIL',
        subject: '',
        templateType: 'utility',
        isDefault: false,
    });

    useEffect(() => {
        const loadTemplate = async () => {
            if (!templateId) return;

            try {
                setIsLoading(true);
                const loadedTemplate = await getMessageTemplate(templateId);
                setTemplate(loadedTemplate);
                setFormData({
                    name: loadedTemplate.name,
                    type: loadedTemplate.type,
                    subject: loadedTemplate.subject || '',
                    templateType: loadedTemplate.templateType || 'utility',
                    isDefault: loadedTemplate.isDefault || false,
                });
            } catch (error: any) {
                console.error('Error loading template:', error);
                toast.error(`Failed to load template: ${error?.message || 'Unknown error'}`);
                setTimeout(() => {
                    navigate({ to: '/settings', search: { selectedTab: 'templates' } });
                }, 2000);
            } finally {
                setIsLoading(false);
            }
        };

        loadTemplate();
    }, [templateId, navigate]);

    return {
        isLoading,
        template,
        formData,
        setFormData,
    };
};
