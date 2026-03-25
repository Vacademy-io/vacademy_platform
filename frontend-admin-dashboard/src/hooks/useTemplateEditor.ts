import { useState, useEffect, useRef } from 'react';
import { CreateTemplateRequest, MessageTemplate } from '@/types/message-template-types';

interface UseTemplateEditorProps {
  template?: MessageTemplate | null;
  onSave?: (data: CreateTemplateRequest) => void;
}

export const useTemplateEditor = ({ template, onSave }: UseTemplateEditorProps) => {
  const [formData, setFormData] = useState<CreateTemplateRequest>({
    name: '',
    type: 'EMAIL',
    subject: '',
    content: '',
    variables: [],
    isDefault: false,
  });

  const [templateType, setTemplateType] = useState<string>('utility');
  const [isInSourceView, setIsInSourceView] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const isInSourceViewRef = useRef(false);

  // Initialize form data when template changes
  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        type: template.type,
        subject: template.subject || '',
        content: template.content,
        variables: template.variables,
        isDefault: template.isDefault,
      });
      setTemplateType(getTemplateTypeOptions());
    } else {
      setFormData({
        name: '',
        type: 'EMAIL',
        subject: '',
        content: '',
        variables: [],
        isDefault: false,
      });
      setTemplateType('utility');
    }
  }, [template]);

  // Auto-update template type when name changes
  useEffect(() => {
    if (formData.name) {
      const autoType = getTemplateTypeOptions(formData.name);
      setTemplateType(autoType);
    }
  }, [formData.name]);

  const handleInputChange = (field: keyof CreateTemplateRequest, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSourceViewChange = (isSourceView: boolean) => {
    isInSourceViewRef.current = isSourceView;
    setIsInSourceView(isSourceView);
  };

  const handleSave = (data: CreateTemplateRequest) => {
    onSave?.(data);
  };

  const handlePreview = () => {
    setShowPreview(true);
  };

  const createPreviewTemplate = () => ({
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
  });

  return {
    formData,
    templateType,
    isInSourceView,
    showPreview,
    isInSourceViewRef,
    setFormData,
    setShowPreview,
    handleInputChange,
    handleSourceViewChange,
    handleSave,
    handlePreview,
    createPreviewTemplate,
  };
};

// Helper function to get template type options
const getTemplateTypeOptions = (name?: string): string => {
  if (!name) return 'utility';

  const lowerName = name.toLowerCase();
  if (lowerName.includes('welcome') || lowerName.includes('greeting')) return 'greeting';
  if (lowerName.includes('reminder') || lowerName.includes('alert')) return 'reminder';
  if (lowerName.includes('notification') || lowerName.includes('update')) return 'notification';
  if (lowerName.includes('promotion') || lowerName.includes('offer')) return 'promotion';
  if (lowerName.includes('confirmation') || lowerName.includes('verify')) return 'confirmation';
  if (lowerName.includes('invitation') || lowerName.includes('invite')) return 'invitation';
  if (lowerName.includes('announcement') || lowerName.includes('news')) return 'announcement';
  if (lowerName.includes('follow') || lowerName.includes('followup')) return 'follow_up';
  if (lowerName.includes('thank') || lowerName.includes('gratitude')) return 'thank_you';
  if (lowerName.includes('goodbye') || lowerName.includes('farewell')) return 'goodbye';

  return 'utility';
};
