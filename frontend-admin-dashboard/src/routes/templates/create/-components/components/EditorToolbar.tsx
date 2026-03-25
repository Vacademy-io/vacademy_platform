import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Info, Save, X, Loader2 } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface TemplateFormData {
    name: string;
    type: 'EMAIL' | 'WHATSAPP';
    subject: string;
    templateType: 'marketing' | 'utility' | 'transactional';
    isDefault: boolean;
}

interface EditorToolbarProps {
    formData: TemplateFormData;
    onFormDataChange: (data: TemplateFormData) => void;
    onSave: () => void;
    onCancel: () => void;
    onShowVariables: () => void;
    isSaving: boolean;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
    formData,
    onFormDataChange,
    onSave,
    onCancel,
    onShowVariables,
    isSaving,
}) => {
    return (
        <div className="bg-[#1e1e1e] border-b border-gray-700 px-4 py-2 flex-shrink-0">
            <div className="flex items-center gap-3 flex-wrap">
                {/* Template Name */}
                <div className="flex items-center gap-2 min-w-[200px]">
                    <Label htmlFor="name" className="text-xs text-gray-300 whitespace-nowrap">
                        Name *
                    </Label>
                    <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
                        placeholder="Template name"
                        className="h-8 text-sm bg-[#2d2d2d] border-gray-600 text-white placeholder:text-gray-500"
                    />
                </div>

                {/* Type */}
                <div className="flex items-center gap-2 min-w-[140px]">
                    <Label htmlFor="type" className="text-xs text-gray-300 whitespace-nowrap">
                        Type
                    </Label>
                    <Select
                        value={formData.type}
                        onValueChange={(value: 'EMAIL' | 'WHATSAPP') =>
                            onFormDataChange({ ...formData, type: value })
                        }
                    >
                        <SelectTrigger id="type" className="h-8 text-sm bg-[#2d2d2d] border-gray-600 text-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="EMAIL">Email</SelectItem>
                            <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Subject (only for EMAIL) */}
                {formData.type === 'EMAIL' && (
                    <div className="flex items-center gap-2 min-w-[200px]">
                        <Label htmlFor="subject" className="text-xs text-gray-300 whitespace-nowrap">
                            Subject
                        </Label>
                        <Input
                            id="subject"
                            value={formData.subject}
                            onChange={(e) =>
                                onFormDataChange({ ...formData, subject: e.target.value })
                            }
                            placeholder="Email subject"
                            className="h-8 text-sm bg-[#2d2d2d] border-gray-600 text-white placeholder:text-gray-500"
                        />
                    </div>
                )}

                {/* Template Type */}
                <div className="flex items-center gap-2 min-w-[160px]">
                    <Label htmlFor="templateType" className="text-xs text-gray-300 whitespace-nowrap">
                        Category
                    </Label>
                    <Select
                        value={formData.templateType}
                        onValueChange={(value: 'marketing' | 'utility' | 'transactional') =>
                            onFormDataChange({ ...formData, templateType: value })
                        }
                    >
                        <SelectTrigger id="templateType" className="h-8 text-sm bg-[#2d2d2d] border-gray-600 text-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="utility">Utility</SelectItem>
                            <SelectItem value="marketing">Marketing</SelectItem>
                            <SelectItem value="transactional">Transactional</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onShowVariables}
                                    className="h-8 w-8 p-0 bg-[#2d2d2d] hover:bg-[#3a3a3a] text-white"
                                >
                                    <Info className="size-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>View available template variables</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <Button
                        size="sm"
                        onClick={onSave}
                        disabled={isSaving}
                        className="h-8 px-3 text-sm bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="size-4 mr-1 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="size-4 mr-1" />
                                Save
                            </>
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onCancel}
                        className="h-8 w-8 p-0 bg-[#2d2d2d] hover:bg-[#3a3a3a] text-white"
                    >
                        <X className="size-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
