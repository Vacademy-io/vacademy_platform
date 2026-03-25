import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmailRichTextEditor } from './EmailRichTextEditor';
import { TemplatePreview } from './TemplatePreview';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    MessageTemplate,
    CreateTemplateRequest,
    TEMPLATE_VARIABLES,
} from '@/types/message-template-types';
import {
    Info,
    Edit,
    Plus,
    BookOpen,
    Users,
    Calendar,
    GraduationCap,
    School,
    Award,
    Database,
    Video,
    Gift,
    Menu,
    X,
} from 'lucide-react';
import { extractVariablesFromContent } from './TemplateEditorUtils';
import { createMessageTemplate, updateMessageTemplate } from '@/services/message-template-service';
import { templateCacheService } from '@/services/template-cache-service';
import { toast } from 'sonner';

interface TemplateEditorDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave?: (template: MessageTemplate) => void;
    onSaveAndSend?: (template: MessageTemplate) => void;
    template?: MessageTemplate | null;
    isSaving?: boolean;
    isSending?: boolean;
    primaryButtonText?: string;
    showPreviewButton?: boolean;
}

export const TemplateEditorDialog: React.FC<TemplateEditorDialogProps> = ({
    isOpen,
    onClose,
    onSave,
    onSaveAndSend,
    template = null,
    isSaving = false,
    isSending = false,
    primaryButtonText = 'Save',
    showPreviewButton = true,
}) => {
    const [formData, setFormData] = useState<CreateTemplateRequest>({
        name: '',
        type: 'EMAIL',
        subject: '',
        content: '',
        variables: [],
        isDefault: false,
        templateType: 'utility',
    });
    const [templateType, setTemplateType] = useState<string>('utility');
    const [showPreview, setShowPreview] = useState(false);
    const [isInSourceView, setIsInSourceView] = useState(false);
    const [isManualTypeChange, setIsManualTypeChange] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);

    useEffect(() => {
        if (template) {
            const templateTypeValue = template.templateType || 'utility';
            setFormData({
                name: template.name,
                type: template.type,
                subject: template.subject || '',
                content: template.content,
                variables: template.variables,
                isDefault: template.isDefault,
                templateType: templateTypeValue,
            });
            setTemplateType(templateTypeValue);
            setIsManualTypeChange(false);
        } else {
            setFormData({
                name: '',
                type: 'EMAIL',
                subject: '',
                content: '',
                variables: [],
                isDefault: false,
                templateType: 'utility',
            });
            setTemplateType('utility');
            setIsManualTypeChange(false);
        }
    }, [template]);

    // Auto-update template type when name changes (only if not manually changed and not editing existing template)
    useEffect(() => {
        if (formData.name && !isManualTypeChange && !template) {
            const autoType = getTemplateTypeOptions(formData.name);
            setTemplateType(autoType);
            setFormData(prev => ({ ...prev, templateType: autoType }));
        }
    }, [formData.name, isManualTypeChange, template]);

    const handleInputChange = (field: keyof CreateTemplateRequest, value: string | boolean) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleTemplateTypeChange = (value: string) => {
        console.log('Manual template type change:', value);
        setTemplateType(value);
        setFormData(prev => ({ ...prev, templateType: value as 'marketing' | 'utility' | 'transactional' }));
        setIsManualTypeChange(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.content.trim()) {
            return;
        }
        handleSave();
    };

    const handleContentChange = (content: string) => {
        setFormData((prev) => ({ ...prev, content }));
        const extractedVariables = extractVariablesFromContent(content);
        const subjectVariables = formData.subject
            ? extractVariablesFromContent(formData.subject)
            : [];
        const allVariables = [...new Set([...extractedVariables, ...subjectVariables])];
        setFormData((prev) => ({ ...prev, variables: allVariables }));
    };

    const handleSubjectChange = (subject: string) => {
        setFormData((prev) => ({ ...prev, subject }));
        const extractedVariables = subject ? extractVariablesFromContent(subject) : [];
        const contentVariables = extractVariablesFromContent(formData.content);
        const allVariables = [...new Set([...extractedVariables, ...contentVariables])];
        setFormData((prev) => ({ ...prev, variables: allVariables }));
    };

    const handleInsertVariable = (variable: string) => {
        // For rich text editor, we'll insert the variable directly
        const currentContent = formData.content;
        const newContent = currentContent + (currentContent ? ' ' : '') + variable;
        setFormData((prev) => ({ ...prev, content: newContent }));
    };

    const getTemplateTypeOptions = (name?: string): 'marketing' | 'utility' | 'transactional' => {
        const templateName = (name || formData.name).toLowerCase();

        if (templateName.includes('welcome') || templateName.includes('enrollment'))
            return 'marketing';
        if (templateName.includes('assignment') || templateName.includes('reminder'))
            return 'utility';
        if (templateName.includes('certificate') || templateName.includes('completion'))
            return 'transactional';

        return 'utility';
    };

    const getCategoryIcon = (category: string) => {
        const iconMap: Record<string, React.ReactNode> = {
            student: <GraduationCap className="size-4 text-blue-600" />,
            course: <BookOpen className="size-4 text-green-600" />,
            batch: <Users className="size-4 text-purple-600" />,
            institute: <School className="size-4 text-orange-600" />,
            'live class': <Video className="size-4 text-red-600" />,
            referral: <Gift className="size-4 text-yellow-600" />,
            attendance: <Award className="size-4 text-indigo-600" />,
            custom: <Edit className="size-4 text-teal-600" />,
            general: <Database className="size-4 text-gray-600" />,
        };
        return iconMap[category.toLowerCase()] || <Database className="size-4 text-gray-600" />;
    };

    const getVariableDescription = (variable: string): string => {
        const descriptions: Record<string, string> = {
            '{{name}}': "Student's name",
            '{{student_name}}': "Student's name",
            '{{email}}': "Student's email address",
            '{{student_email}}': "Student's email address",
            '{{mobile_number}}': "Student's phone number",
            '{{student_phone}}': "Student's phone number",
            '{{student_id}}': "Student's unique ID",
            '{{enrollment_number}}': 'Enrollment number',
            '{{username}}': 'Login username',
            '{{registration_date}}': 'Registration date',
            '{{student_unique_link}}': 'Student unique link',
            '{{student_referral_code}}': 'Student referral code',
            '{{course_name}}': 'Course name',
            '{{course_description}}': 'Course description',
            '{{course_duration}}': 'Course duration',
            '{{course_price}}': 'Course price',
            '{{batch_name}}': 'Batch name',
            '{{batch_id}}': 'Batch identifier',
            '{{batch_start_date}}': 'Batch start date',
            '{{batch_end_date}}': 'Batch end date',
            '{{institute_name}}': 'Institute name',
            '{{institute_address}}': 'Institute address',
            '{{institute_phone}}': 'Institute phone number',
            '{{institute_email}}': 'Institute email',
            '{{institute_website}}': 'Institute website',
            '{{attendance_status}}': 'Attendance status',
            '{{attendance_date}}': 'Attendance date',
            '{{attendance_percentage}}': 'Attendance percentage',
            '{{live_class_title}}': 'Live class session title',
            '{{live_class_date}}': 'Live class date',
            '{{live_class_time}}': 'Live class time',
            '{{live_class_duration}}': 'Live class duration',
            '{{live_class_instructor}}': 'Live class instructor name',
            '{{live_class_meeting_link}}': 'Live class meeting link',
            '{{live_class_meeting_id}}': 'Live class meeting ID',
            '{{live_class_password}}': 'Live class password',
            '{{live_class_platform}}': 'Live class platform (Zoom, Google Meet, etc.)',
            '{{live_class_room}}': 'Live class room/venue',
            '{{live_class_notes}}': 'Live class notes/agenda',
            '{{live_class_recording_link}}': 'Live class recording link',
            '{{live_class_status}}': 'Live class status (upcoming, live, completed)',
            '{{next_live_class_date}}': 'Next live class date',
            '{{next_live_class_time}}': 'Next live class time',
            '{{referral_code}}': "Student's referral code",
            '{{referral_link}}': "Student's referral link",
            '{{referral_count}}': 'Number of successful referrals',
            '{{referral_rewards}}': 'Referral rewards earned',
            '{{referral_bonus}}': 'Referral bonus amount',
            '{{referral_status}}': 'Referral status (active, inactive)',
            '{{referred_by}}': 'Who referred this student',
            '{{referred_by_name}}': 'Name of the person who referred',
            '{{referral_program_start}}': 'When referral program started',
            '{{referral_program_end}}': 'When referral program ends',
            '{{referral_terms}}': 'Referral terms and conditions',
            '{{referral_benefits}}': 'Referral benefits description',
            '{{custom_message_text}}': 'Custom message placeholder',
            '{{custom_field_1}}': 'Custom field 1',
            '{{custom_field_2}}': 'Custom field 2',
            '{{current_date}}': 'Current date',
            '{{current_time}}': 'Current time',
            '{{year}}': 'Current year',
            '{{month}}': 'Current month',
            '{{day}}': 'Current day',
        };
        return descriptions[variable] || 'Dynamic value';
    };

    const handleSave = async () => {
        if (!formData.name.trim() || !formData.content.trim()) {
            toast.error('Template name and content are required.');
            return;
        }

        console.log('Saving template with formData:', formData);
        console.log('Current templateType state:', templateType);

        try {
            let savedTemplate: MessageTemplate;
            if (template) {
                // Update existing template
                const updatedTemplate = await updateMessageTemplate({
                    id: template.id,
                    ...formData,
                });
                savedTemplate = updatedTemplate;
                toast.success('Template updated successfully!');
            } else {
                // Create new template
                savedTemplate = await createMessageTemplate(formData);
                toast.success('Template created successfully!');
            }

            // Clear cache to ensure fresh data
            templateCacheService.clearCache('EMAIL');

            // Call the appropriate callback
            if (onSaveAndSend) {
                onSaveAndSend(savedTemplate);
            } else if (onSave) {
                onSave(savedTemplate);
            }

            onClose();
        } catch (error) {
            console.error('Error saving template:', error);
            toast.error(template ? 'Failed to update template.' : 'Failed to create template.');
        }
    };

    const handleClose = () => {
        if (isSaving || isSending) return;
        onClose();
    };

    const handlePreview = () => {
        const previewTemplate = {
            id: template?.id || 'preview',
            name: formData.name,
            type: formData.type,
            subject: formData.subject,
            content: formData.content,
            variables: formData.variables,
            isDefault: formData.isDefault,
            createdAt: template?.createdAt || new Date().toISOString(),
            updatedAt: template?.updatedAt || new Date().toISOString(),
            instituteId: template?.instituteId || '',
        };

        setShowPreview(true);
    };

    const handleSourceViewChange = (isSourceView: boolean) => {
        setIsInSourceView(isSourceView);
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="max-h-[95vh] w-[95vw] max-w-7xl overflow-hidden p-0 sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] 2xl:max-w-7xl">
                    <DialogHeader className="border-b border-gray-200 px-4 py-4 sm:px-6">
                        <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                            {template ? (
                                <>
                                    <Edit className="size-4 sm:size-5" />
                                    Edit Template
                                </>
                            ) : (
                                <>
                                    <Plus className="size-4 sm:size-5" />
                                    Create Template
                                </>
                            )}
                        </DialogTitle>
                        <DialogDescription className="text-sm sm:text-base">
                            {template ? 'Modify your email template content and settings' : 'Create a new email template with dynamic variables'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex h-[calc(95vh-120px)] flex-col lg:flex-row">
                        {/* Main Content Area */}
                        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Template Name */}
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-sm font-medium">
                                        Template Name
                                    </Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => handleInputChange('name', e.target.value)}
                                        placeholder="Enter template name..."
                                        className="w-full"
                                    />
                                </div>

                                {/* Email Subject */}
                                {formData.type === 'EMAIL' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="subject" className="text-sm font-medium">
                                            Email Subject
                                        </Label>
                                        <Input
                                            id="subject"
                                            value={formData.subject}
                                            onChange={(e) => handleSubjectChange(e.target.value)}
                                            placeholder="Enter email subject..."
                                            className="w-full"
                                        />
                                    </div>
                                )}

                                {/* Email Body */}
                                <div className="space-y-2">
                                    <Label htmlFor="content" className="text-sm font-medium">
                                        Email Body
                                    </Label>
                                    <EmailRichTextEditor
                                        value={formData.content}
                                        onChange={handleContentChange}
                                        placeholder="Enter email body content..."
                                        minHeight={200}
                                        className="w-full"
                                        subject={formData.subject}
                                        onSourceViewChange={handleSourceViewChange}
                                        showPreviewButton={true}
                                        onPreview={handlePreview}
                                    />
                                </div>

                                {/* Template Type and Status */}
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium">Email Type</Label>
                                        <Select
                                            value={templateType}
                                            onValueChange={handleTemplateTypeChange}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select email type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="marketing">
                                                    <div className="flex items-center gap-2">
                                                        <div className="size-3 rounded-full bg-blue-500"></div>
                                                        Marketing
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="utility">
                                                    <div className="flex items-center gap-2">
                                                        <div className="size-3 rounded-full bg-orange-500"></div>
                                                        Utility
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="transactional">
                                                    <div className="flex items-center gap-2">
                                                        <div className="size-3 rounded-full bg-purple-500"></div>
                                                        Transactional
                                                    </div>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Info Alert */}
                                <Alert>
                                    <Info className="size-4" />
                                    <AlertDescription>
                                        Use variables like {'{{name}}'} to personalize your
                                        messages. Variables will be replaced with actual data when
                                        sending messages.
                                    </AlertDescription>
                                </Alert>

                                {/* Actions */}
                                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:justify-end sm:pt-6">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleClose}
                                        className="h-10 px-4 sm:px-6 order-2 sm:order-1"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={
                                            isSaving ||
                                            isSending ||
                                            !formData.name.trim() ||
                                            !formData.content.trim()
                                        }
                                        className="hover:bg-primary-600 h-10 bg-primary-500 px-4 sm:px-6 text-white disabled:bg-gray-300 disabled:text-gray-500 order-1 sm:order-2"
                                    >
                                        {isSaving
                                            ? 'Saving...'
                                            : isSending
                                              ? 'Sending...'
                                              : primaryButtonText}
                                    </Button>
                                </div>
                            </form>
                        </div>

                        {/* Sidebar - Dynamic Values */}
                        <div className={`w-full overflow-y-auto border-t border-gray-200 bg-gray-50/50 p-3 sm:p-4 md:p-6 lg:w-80 lg:border-l lg:border-t-0 ${showSidebar ? 'block' : 'hidden lg:block'}`}>
                            <div className="space-y-4 sm:space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="mb-1 text-base sm:text-lg font-semibold text-gray-900">
                                            Insert Dynamic Values
                                        </h3>
                                        <p className="text-xs sm:text-sm text-gray-600">
                                            Click on any variable to insert it into your template
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowSidebar(false)}
                                        className="lg:hidden p-2"
                                    >
                                        <X className="size-4" />
                                    </Button>
                                </div>

                                {/* Variable Categories */}
                                {Object.entries(TEMPLATE_VARIABLES).map(([category, variables]) => (
                                    <div key={category} className="space-y-3">
                                        <h4 className="flex items-center gap-2 text-sm font-medium capitalize text-gray-900">
                                            {getCategoryIcon(category)}
                                            {category}
                                        </h4>
                                        <div className="space-y-2">
                                            {variables.map((variable) => (
                                                <div
                                                    key={variable}
                                                    className="group cursor-pointer rounded-lg border border-gray-200 bg-white p-2 sm:p-3 transition-colors hover:border-primary-300 hover:bg-primary-50/50"
                                                    onClick={() => handleInsertVariable(variable)}
                                                >
                                                    <div className="flex items-start gap-2 sm:gap-3">
                                                        <div className="shrink-0 mt-0.5">
                                                            <Plus className="size-3 sm:size-4 text-gray-400 transition-all group-hover:scale-110 group-hover:text-primary-500" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-primary-600 group-hover:text-primary-700 font-mono text-xs sm:text-sm break-all">
                                                                {variable}
                                                            </div>
                                                            <div className="mt-1 text-xs text-gray-500 line-clamp-2">
                                                                {getVariableDescription(variable)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Mobile Sidebar Toggle Button */}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSidebar(true)}
                        className="fixed bottom-4 right-4 z-50 lg:hidden shadow-lg"
                    >
                        <Menu className="size-4 mr-2" />
                        Variables
                    </Button>
                </DialogContent>
            </Dialog>

            {/* Template Preview Dialog */}
            {showPreview && (
                <>
                    <TemplatePreview
                        isOpen={showPreview}
                        onClose={() => setShowPreview(false)}
                        template={{
                            id: template?.id || 'preview',
                            name: formData.name,
                            type: formData.type,
                            subject: formData.subject,
                            content: formData.content,
                            variables: formData.variables,
                            isDefault: formData.isDefault || false,
                            createdAt: template?.createdAt || new Date().toISOString(),
                            updatedAt: template?.updatedAt || new Date().toISOString(),
                            instituteId: template?.instituteId || '',
                        }}
                    />
                </>
            )}
        </>
    );
};
