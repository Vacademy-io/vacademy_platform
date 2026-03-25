// Shared template components
export { TemplateEditor } from './TemplateEditor';
export { TemplateEditorDialog } from './TemplateEditorDialog';
export { TemplatePreview } from './TemplatePreview';
export { TemplatePreviewDialog } from './TemplatePreviewDialog';
export { EmailRichTextEditor } from './EmailRichTextEditor';
export { TemplateTypeSelector } from './TemplateTypeSelector';
export { TemplateValidationWarning } from './TemplateValidationWarning';

// New comprehensive email sending components
export { TemplateValidationDialog } from './TemplateValidationDialog';
export { EmailSendingService } from './EmailSendingService';
export { EmailSendButton } from './EmailSendButton';
export { EmailSendingExample } from './EmailSendingExample';
export { ComprehensiveSendEmailDialog } from './ComprehensiveSendEmailDialog';

// Integration examples
export {
    EmailSendingWithValidation,
    PreValidatedEmailButton,
    BulkEmailWithValidation,
    WhatsAppTemplateWithValidation
} from './TemplateValidationIntegration';

// Page context examples
export { PageContextTemplateExample } from './PageContextTemplateExample';

// Utilities
export { extractVariablesFromContent } from './TemplateEditorUtils';

// Constants
export * from './constants';
