import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Eye, Plus, FileText, MessageCircle } from 'lucide-react';
import { MessageTemplate } from '@/types/message-template-types';
import { templateCacheService } from '@/services/template-cache-service';
import { toast } from 'sonner';
import { TemplateEditor } from './shared/TemplateEditor';

interface TemplateSelectorProps {
    templateType: 'EMAIL' | 'WHATSAPP';
    selectedTemplate: MessageTemplate | null;
    onTemplateSelect: (template: MessageTemplate | null) => void;
    onTemplateCreate?: () => void;
    onTemplatePreview?: (template: MessageTemplate) => void;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    variant?: 'dialog' | 'dropdown';
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
    templateType,
    selectedTemplate,
    onTemplateSelect,
    onTemplateCreate,
    onTemplatePreview,
    disabled = false,
    placeholder = 'Select a template',
    className = '',
    variant = 'dialog',
}) => {
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const loadTemplates = async () => {
        setIsLoading(true);
        try {
            const loadedTemplates = await templateCacheService.getTemplates(templateType);
            setTemplates(loadedTemplates);
        } catch (error) {
            console.error(`Error loading ${templateType.toLowerCase()} templates:`, error);
            toast.error(`Failed to load ${templateType.toLowerCase()} templates`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (variant === 'dropdown' || isOpen) {
            loadTemplates();
        }
    }, [variant, isOpen, templateType]);

    const handleTemplateSelect = (template: MessageTemplate) => {
        onTemplateSelect(template);
        setIsOpen(false);
    };

    const handleDropdownSelect = (templateId: string) => {
        if (templateId === 'none') {
            onTemplateSelect(null);
        } else {
            const template = templates.find((t) => t.id === templateId);
            if (template) {
                onTemplateSelect(template);
            }
        }
    };

    const handleClearSelection = () => {
        onTemplateSelect(null);
    };

    const handlePreview = (template: MessageTemplate) => {
        if (onTemplatePreview) {
            onTemplatePreview(template);
        }
    };

    const handleCreateNew = () => {
        if (templateType === 'EMAIL') {
            setShowEditor(true);
            setIsOpen(false);
        } else if (templateType === 'WHATSAPP') {
            toast.error(
                'WhatsApp templates cannot be created from here. Please use the Template Settings.'
            );
        } else if (onTemplateCreate) {
            onTemplateCreate();
            setIsOpen(false);
        }
    };

    const handleSaveTemplate = async (templateData: any) => {
        setIsSaving(true);

        try {
            // Import the create function dynamically to avoid circular imports
            const { createMessageTemplate } = await import('@/services/message-template-service');
            const newTemplate = await createMessageTemplate({
                ...templateData,
                type: templateType,
            });

            // Refresh templates list
            await loadTemplates();

            // Select the newly created template
            onTemplateSelect(newTemplate);

            // Close editor
            setShowEditor(false);

            toast.success(`${templateType} template created successfully`);
        } catch (error) {
            console.error('Error creating template:', error);
            toast.error(`Failed to create ${templateType.toLowerCase()} template`);
        } finally {
            setIsSaving(false);
        }
    };

    const getIcon = () => {
        return templateType === 'EMAIL' ? (
            <FileText className="size-4" />
        ) : (
            <MessageCircle className="size-4" />
        );
    };

    const getTemplateTypeLabel = () => {
        return templateType === 'EMAIL' ? 'Email' : 'WhatsApp';
    };

    if (variant === 'dropdown') {
        return (
            <div className={`space-y-2 ${className}`}>
                <Label className="text-sm font-medium">{getTemplateTypeLabel()} Template</Label>

                <div className="flex items-center gap-2">
                    <Select
                        value={selectedTemplate?.id || 'none'}
                        onValueChange={handleDropdownSelect}
                        disabled={disabled || isLoading}
                    >
                        <SelectTrigger className="flex-1">
                            <SelectValue placeholder={isLoading ? 'Loading...' : placeholder}>
                                {selectedTemplate ? (
                                    <div className="flex items-center gap-2">
                                        {getIcon()}
                                        <span className="font-medium">{selectedTemplate.name}</span>
                                    </div>
                                ) : (
                                    placeholder
                                )}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">No template selected</SelectItem>
                            {templates.map((template) => (
                                <SelectItem key={template.id} value={template.id}>
                                    <div className="flex items-center gap-2">
                                        {getIcon()}
                                        <div className="flex-1">
                                            <div className="font-medium">{template.name}</div>
                                            {template.subject && (
                                                <div className="text-xs text-gray-500">
                                                    {template.subject}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {selectedTemplate && onTemplatePreview && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreview(selectedTemplate)}
                            disabled={disabled}
                            className="size-10 p-0"
                        >
                            <Eye className="size-4" />
                        </Button>
                    )}

                    {templateType === 'EMAIL' && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCreateNew}
                            disabled={disabled}
                            className="h-10 px-3"
                        >
                            <Plus className="mr-1 size-4" />
                            Create
                        </Button>
                    )}
                </div>

                {/* Template Editor Dialog */}
                {showEditor && (
                    <TemplateEditor
                        template={null}
                        onSave={handleSaveTemplate}
                        onClose={() => {
                            setShowEditor(false);
                        }}
                        isSaving={isSaving}
                    />
                )}
            </div>
        );
    }

    return (
        <div className={`space-y-2 ${className}`}>
            <Label className="text-sm font-medium">{getTemplateTypeLabel()} Template</Label>

            {/* Selected Template Display */}
            {selectedTemplate ? (
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center gap-2">
                        {getIcon()}
                        <div>
                            <div className="text-sm font-medium text-gray-900">
                                {selectedTemplate.name}
                            </div>
                            {selectedTemplate.subject && (
                                <div className="text-xs text-gray-600">
                                    Subject: {selectedTemplate.subject}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {onTemplatePreview && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePreview(selectedTemplate)}
                                disabled={disabled}
                                className="size-8 p-0"
                            >
                                <Eye className="size-4" />
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClearSelection}
                            disabled={disabled}
                            className="size-8 p-0 text-gray-500 hover:text-red-600"
                        >
                            ×
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setIsOpen(true)}
                        disabled={disabled || isLoading}
                        className="flex-1 justify-start"
                    >
                        {getIcon()}
                        <span className="ml-2">{isLoading ? 'Loading...' : placeholder}</span>
                    </Button>
                    {templateType === 'EMAIL' && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCreateNew}
                            disabled={disabled}
                            className="px-3"
                        >
                            <Plus className="mr-1 size-4" />
                            Create
                        </Button>
                    )}
                </div>
            )}

            {/* Template Selection Dialog */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="max-h-[80vh] w-full max-w-2xl rounded-lg bg-white shadow-lg">
                        <div className="flex items-center justify-between border-b p-4">
                            <h3 className="text-lg font-semibold">
                                Select {getTemplateTypeLabel()} Template
                            </h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsOpen(false)}
                                className="size-8 p-0"
                            >
                                ×
                            </Button>
                        </div>

                        <div className="max-h-96 overflow-y-auto p-4">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="text-sm text-gray-500">
                                        Loading templates...
                                    </div>
                                </div>
                            ) : templates.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <div className="mb-4 text-sm text-gray-500">
                                        No {templateType.toLowerCase()} templates found
                                    </div>
                                    {templateType === 'EMAIL' && (
                                        <Button
                                            variant="outline"
                                            onClick={handleCreateNew}
                                            className="flex items-center gap-2"
                                        >
                                            <Plus className="size-4" />
                                            Create First Template
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {templates.map((template) => (
                                        <div
                                            key={template.id}
                                            onClick={() => handleTemplateSelect(template)}
                                            className="cursor-pointer rounded-lg border border-gray-200 p-3 transition-colors hover:border-blue-300 hover:bg-blue-50"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="mb-1 flex items-center gap-2">
                                                        {getIcon()}
                                                        <span className="font-medium text-gray-900">
                                                            {template.name}
                                                        </span>
                                                        <Badge
                                                            variant="secondary"
                                                            className="text-xs"
                                                        >
                                                            {template.type}
                                                        </Badge>
                                                    </div>
                                                    {template.subject && (
                                                        <div className="mb-1 text-sm text-gray-600">
                                                            Subject: {template.subject}
                                                        </div>
                                                    )}
                                                    <div className="line-clamp-2 text-xs text-gray-500">
                                                        {template.content.replace(/<[^>]*>/g, '')}
                                                    </div>
                                                </div>
                                                {onTemplatePreview && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handlePreview(template);
                                                        }}
                                                        className="ml-2 size-8 p-0"
                                                    >
                                                        <Eye className="size-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Template Editor Dialog */}
            {showEditor && (
                <TemplateEditor
                    template={null}
                    onSave={handleSaveTemplate}
                    onClose={() => {
                        setShowEditor(false);
                    }}
                    isSaving={isSaving}
                />
            )}
        </div>
    );
};

export default TemplateSelector;
