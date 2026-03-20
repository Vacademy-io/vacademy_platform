import React, { useCallback, useState, useMemo } from 'react';
import { BlockManager, BasicType, JsonToMjml } from 'easy-email-core';
import type { IBlockData } from 'easy-email-core';
import { EmailEditor, EmailEditorProvider } from 'easy-email-editor';
import { SimpleLayout } from 'easy-email-extensions';
import { useForm, useFormState } from 'react-final-form';
import mjml2html from 'mjml-browser';
// FormApi type from react-final-form
type FormApi<T, U> = {
    submit: () => void;
    change: (name: keyof T, value: any) => void;
    getState: () => { values: T };
};
import AssetPicker from './AssetPicker';
import { MessageTemplate } from '@/types/message-template-types';
import { UploadFileInS3, getPublicUrl } from '@/services/upload_file';
import { getUserId } from '@/utils/userDetails';
import { getInstituteId } from '@/constants/helper';
import { toast } from 'sonner';

import 'easy-email-editor/lib/style.css';
import 'easy-email-extensions/lib/style.css';
import '@arco-themes/react-easy-email-theme/css/arco.css';

// Define the email template interface
interface IEmailTemplate {
    subject: string;
    subTitle: string;
    content: IBlockData;
}

interface EmailBuilderProps {
    template?: MessageTemplate | null;
    onBack: () => void;
    onSave: (template: MessageTemplate) => Promise<void>;
    isSaving?: boolean;
}

// Merge tags configuration
const mergeTags = {
    User: {
        Name: '{{name}}',
        Email: '{{email}}',
        Phone: '{{phone}}',
        ID: '{{user_id}}',
    },
    Company: {
        'Company Name': '{{company_name}}',
        Address: '{{company_address}}',
        Website: '{{company_website}}',
    },
    Date: {
        'Current Date': '{{date}}',
        'Current Year': '{{year}}',
    },
};

// Inner toolbar component to access form context
const EditorToolbar: React.FC<{
    onBack: () => void;
    templateName: string;
    setTemplateName: (name: string) => void;
    onOpenAssets: () => void;
    isSaving: boolean;
    templateType?: 'marketing' | 'utility' | 'transactional';
    onTemplateTypeChange?: (type: 'marketing' | 'utility' | 'transactional') => void;
}> = ({
    onBack,
    templateName,
    setTemplateName,
    onOpenAssets,
    isSaving,
    templateType = 'utility',
    onTemplateTypeChange,
}) => {
    const form = useForm();
    const { dirty, values } = useFormState({
        subscription: {
            dirty: true,
            values: true,
        },
    });
    const [isNameEditing, setIsNameEditing] = useState(false);
    const [showMergeTags, setShowMergeTags] = useState(false);
    const currentSubject = values?.subject || '';

    // Warn on tab close/refresh
    React.useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (dirty) {
                e.preventDefault();
                e.returnValue = ''; // Chrome requires this to be set
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [dirty]);

    const handleSave = () => {
        form.submit();
    };

    const handleCopyHtml = () => {
        try {
            const values = form.getState().values;
            // 1. Convert to MJML
            const mjml = JsonToMjml({
                data: values.content,
                mode: 'production',
                context: values.content,
            });

            // 2. Convert MJML to HTML
            const { html, errors } = mjml2html(mjml);

            if (errors && errors.length > 0) {
                console.warn('MJML compilation errors:', errors);
            }

            navigator.clipboard.writeText(html);
            toast.success('Copied full HTML to clipboard!');
        } catch (e) {
            console.error('Failed to generate HTML:', e);
            toast.error('Failed to generate HTML. Check console for details.');
        }
    };

    const handleBack = () => {
        if (dirty) {
            if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
                onBack();
            }
        } else {
            onBack();
        }
    };

    const handleMergeTagClick = (value: string) => {
        // Try to insert at cursor position
        if (
            document.activeElement?.getAttribute('contenteditable') === 'true' ||
            document.activeElement?.tagName === 'TEXTAREA' ||
            document.activeElement?.tagName === 'INPUT'
        ) {
            const success = document.execCommand('insertText', false, value);
            if (success) {
                setShowMergeTags(false);
                return;
            }
        }
        navigator.clipboard.writeText(value);
        toast.info(`Copied ${value} to clipboard! (Click inside a text block to insert directly)`);
        setShowMergeTags(false);
    };

    return (
        <div style={styles.toolbar}>
            <div style={styles.toolbarLeft}>
                <button style={styles.backButton} onClick={handleBack}>
                    ← Back
                </button>
                <div style={styles.nameContainer}>
                    {isNameEditing ? (
                        <input
                            type="text"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            onBlur={() => setIsNameEditing(false)}
                            onKeyDown={(e) => e.key === 'Enter' && setIsNameEditing(false)}
                            style={styles.nameInput}
                            autoFocus
                        />
                    ) : (
                        <h2 style={styles.templateTitle} onClick={() => setIsNameEditing(true)}>
                            {templateName}
                            {dirty && (
                                <span style={styles.unsavedIndicator} title="Unsaved changes">
                                    •
                                </span>
                            )}
                            <span style={styles.editIcon}>✏️</span>
                        </h2>
                    )}
                </div>
            </div>
            <div style={styles.toolbarCenter}>
                <div style={styles.subjectContainer}>
                    <label style={styles.subjectLabel}>Subject:</label>
                    <input
                        type="text"
                        value={currentSubject}
                        onChange={(e) => {
                            form.change('subject', e.target.value);
                        }}
                        placeholder="Email subject"
                        style={styles.subjectInput}
                    />
                </div>
                <div style={styles.categoryContainer}>
                    <label style={styles.categoryLabel}>Category:</label>
                    <select
                        value={templateType}
                        onChange={(e) => {
                            const newType = e.target.value as
                                | 'marketing'
                                | 'utility'
                                | 'transactional';
                            if (onTemplateTypeChange) {
                                onTemplateTypeChange(newType);
                            }
                        }}
                        style={styles.categorySelect}
                    >
                        <option value="utility">Utility</option>
                        <option value="marketing">Marketing</option>
                        <option value="transactional">Transactional</option>
                    </select>
                </div>
            </div>
            <div style={styles.toolbarRight}>
                <button style={styles.secondaryButton} onClick={handleCopyHtml}>
                    {`</>`} Copy HTML
                </button>
                <div style={{ position: 'relative' }}>
                    <button
                        style={styles.secondaryButton}
                        onClick={() => setShowMergeTags(!showMergeTags)}
                    >
                        {'{ }'} Dynamic Values
                    </button>
                    {showMergeTags && (
                        <div style={styles.dropdownMenu}>
                            {Object.entries(mergeTags).map(([category, tags]) => (
                                <div key={category} style={styles.dropdownCategory}>
                                    <div style={styles.categoryTitle}>{category}</div>
                                    {Object.entries(tags).map(([label, value]) => (
                                        <div
                                            key={label}
                                            style={styles.dropdownItem}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => handleMergeTagClick(value)}
                                        >
                                            <span>{label}</span>
                                            <code style={styles.tagCode}>{value}</code>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <button style={styles.assetButton} onClick={onOpenAssets}>
                    📁 Assets
                </button>
                <button style={styles.saveButton} onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : '💾 Save Template'}
                </button>
            </div>
        </div>
    );
};

const EmailBuilder: React.FC<EmailBuilderProps> = ({
    template,
    onBack,
    onSave,
    isSaving: externalIsSaving = false,
}) => {
    const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
    const [imageResolve, setImageResolve] = useState<((url: string) => void) | null>(null);
    const [templateName, setTemplateName] = useState(template?.name || 'Untitled Template');
    const [templateType, setTemplateType] = useState<'marketing' | 'utility' | 'transactional'>(
        template?.templateType || 'utility'
    );
    const [isSaving, setIsSaving] = useState(false);

    // Helper to convert base64 to File
    const base64ToFile = (base64Data: string, mimeType: string, filename: string): File | null => {
        try {
            const base64String = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
            if (!base64String) throw new Error('Invalid base64 data');

            const binaryString = atob(base64String);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: mimeType });
            return new File([blob], filename, { type: mimeType });
        } catch (error) {
            console.error('Error converting base64 to File:', error);
            return null;
        }
    };

    // Helper to upload image to S3
    const uploadImageToS3 = async (base64Data: string): Promise<string> => {
        try {
            const match = base64Data.match(/data:([^;]+);base64,(.+)/);
            if (!match || !match[1] || !match[2]) {
                throw new Error('Invalid base64 format');
            }

            const mimeType = match[1];
            const extension = mimeType.split('/')[1] || 'png';
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2, 15);
            const filename = `email-template-image-${timestamp}-${randomId}.${extension}`;

            const file = base64ToFile(match[2], mimeType, filename);
            if (!file) throw new Error('Failed to convert base64 to file');

            const userId = getUserId();
            const instituteId = getInstituteId();

            if (!userId || !instituteId) {
                throw new Error('Missing user credentials');
            }

            // Upload to S3
            const fileId = await UploadFileInS3(
                file,
                () => {},
                userId,
                'EMAIL_TEMPLATES',
                instituteId,
                true // Get public URL
            );

            if (!fileId) {
                throw new Error('Failed to upload to S3');
            }

            const publicUrl = await getPublicUrl(fileId);
            if (!publicUrl) {
                throw new Error('Failed to get public URL');
            }

            return publicUrl;
        } catch (error) {
            console.error('Error uploading image to S3:', error);
            throw error;
        }
    };

    // Process HTML to upload all base64 images to S3
    const processHtmlImages = async (html: string): Promise<string> => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        const images = Array.from(tempDiv.querySelectorAll('img'));
        const base64Images: Array<{ img: HTMLImageElement; src: string }> = [];

        images.forEach((img) => {
            const src = img.getAttribute('src');
            if (src && src.startsWith('data:')) {
                base64Images.push({ img, src });
            }
        });

        if (base64Images.length === 0) {
            return html;
        }

        // Upload all images in parallel
        const uploadPromises = base64Images.map(async ({ img, src }) => {
            try {
                const s3Url = await uploadImageToS3(src);
                img.setAttribute('src', s3Url);
            } catch (error) {
                console.error('Failed to upload image:', error);
                // Keep the base64 image if upload fails
            }
        });

        await Promise.all(uploadPromises);

        return tempDiv.innerHTML;
    };

    // Initial template data
    const initialValues: IEmailTemplate = useMemo(() => {
        if (template && template.id) {
            // Load MJML JSON from the template.mjml field (stored in settingJson on backend)
            if (template.mjml) {
                try {
                    const contentData = typeof template.mjml === 'string' 
                        ? JSON.parse(template.mjml) 
                        : template.mjml;
                    console.log('Loaded MJML from API settingJson:', { hasContent: !!contentData });
                    return {
                        subject: template.subject || 'Welcome to Easy-email',
                        subTitle: 'Nice to meet you!',
                        content: contentData,
                    };
                } catch (e) {
                    console.warn('Failed to parse MJML JSON from API:', e);
                }
            }

            // Fallback: Try to load from localStorage (for backwards compatibility)
            const mjmlJsonKey = `email_template_mjml_${template.id}`;
            const storedMjml = localStorage.getItem(mjmlJsonKey);

            if (storedMjml) {
                try {
                    const contentData = JSON.parse(storedMjml);
                    console.log('Loaded MJML from localStorage (legacy):', { hasContent: !!contentData });
                    return {
                        subject: template.subject || 'Welcome to Easy-email',
                        subTitle: 'Nice to meet you!',
                        content: contentData,
                    };
                } catch (e) {
                    console.warn('Failed to parse stored MJML JSON from localStorage:', e);
                }
            }

            // If no stored MJML, check if content is JSON
            if (template.content) {
                try {
                    // Try to parse content as JSON (MJML block data)
                    const contentData =
                        typeof template.content === 'string'
                            ? JSON.parse(template.content)
                            : template.content;

                    // Check if it's actually HTML (starts with <)
                    if (
                        typeof template.content === 'string' &&
                        template.content.trim().startsWith('<')
                    ) {
                        // It's HTML, can't load it - show blank template
                        console.warn(
                            'Template content is HTML, cannot load into editor. Please recreate the template.'
                        );
                        toast.warning(
                            'This template was created with a different editor. Please recreate it using the new editor.'
                        );
                        return {
                            subject: template.subject || 'Welcome to Easy-email',
                            subTitle: 'Nice to meet you!',
                            content: BlockManager.getBlockByType(BasicType.PAGE)!.create({}),
                        };
                    }

                    return {
                        subject: template.subject || 'Welcome to Easy-email',
                        subTitle: 'Nice to meet you!',
                        content: contentData,
                    };
                } catch (e) {
                    // If parsing fails, create a new page
                    console.warn('Failed to parse template content, creating new template');
                    return {
                        subject: template.subject || 'Welcome to Easy-email',
                        subTitle: 'Nice to meet you!',
                        content: BlockManager.getBlockByType(BasicType.PAGE)!.create({}),
                    };
                }
            }
        }
        return {
            subject: 'Welcome to Easy-email',
            subTitle: 'Nice to meet you!',
            content: BlockManager.getBlockByType(BasicType.PAGE)!.create({}),
        };
    }, [template]);

    // Handle form submission (save template)
    const onSubmit = useCallback(
        async (values: IEmailTemplate, _form: any) => {
            setIsSaving(true);
            try {
                // 1. Convert to MJML string
                const mjmlString = JsonToMjml({
                    data: values.content,
                    mode: 'production',
                    context: values.content,
                });

                // 2. Convert MJML to HTML
                const { html, errors } = mjml2html(mjmlString);

                if (errors && errors.length > 0) {
                    console.warn('MJML compilation errors:', errors);
                    toast.warning('Some MJML errors occurred. Please check the template.');
                }

                // 3. Process and upload images to S3
                const processedHtml = await processHtmlImages(html);

                // 4. Serialize MJML JSON for storage in settingJson
                const mjmlJsonString = JSON.stringify(values.content);

                // 5. Create template object with MJML stored in mjml field
                const savedTemplate: MessageTemplate = {
                    id: template?.id || '',
                    name: templateName,
                    type: 'EMAIL',
                    subject: values.subject,
                    content: processedHtml, // Save as HTML for sending emails
                    variables: template?.variables || [],
                    isDefault: template?.isDefault || false,
                    templateType: templateType,
                    mjml: mjmlJsonString, // Store MJML JSON in settingJson via API
                    createdAt: template?.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };

                console.log('Saving template with MJML:', { 
                    hasId: !!savedTemplate.id, 
                    hasMjml: !!savedTemplate.mjml,
                    mjmlLength: savedTemplate.mjml?.length || 0
                });

                // 6. Save via API (mjml will be stored in settingJson on the backend)
                await onSave(savedTemplate);

                // 7. Also store in localStorage as backup for backwards compatibility
                const mjmlJsonKey = template?.id ? `email_template_mjml_${template.id}` : null;
                if (mjmlJsonKey) {
                    localStorage.setItem(mjmlJsonKey, mjmlJsonString);
                }

                toast.success('Template saved successfully!');
            } catch (error) {
                console.error('Failed to save template:', error);
                toast.error('Failed to save template. Please try again.');
            } finally {
                setIsSaving(false);
            }
        },
        [template, templateName, templateType, onSave]
    );

    // Handle image upload (for drag and drop in editor)
    // Return base64 immediately for editor to work, then upload to S3 when saving
    const onUploadImage = useCallback(async (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result as string;
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }, []);

    // Open asset picker
    const openAssetPicker = useCallback(() => {
        return new Promise<string>((resolve) => {
            setImageResolve(() => resolve);
            setIsAssetPickerOpen(true);
        });
    }, []);

    // Handle asset selection
    const handleAssetSelect = useCallback(
        (imageUrl: string) => {
            if (imageResolve) {
                imageResolve(imageUrl);
                setImageResolve(null);
            }
        },
        [imageResolve]
    );

    // Close asset picker
    const handleAssetPickerClose = useCallback(() => {
        setIsAssetPickerOpen(false);
        if (imageResolve) {
            imageResolve('');
            setImageResolve(null);
        }
    }, [imageResolve]);

    const handleOpenAssets = () => {
        openAssetPicker().then((url) => {
            if (url) {
                navigator.clipboard.writeText(url);
                toast.info('Image URL copied to clipboard! Paste it in an image block.');
            }
        });
    };

    return (
        <>
            <EmailEditorProvider
                data={initialValues}
                height={'calc(100vh - 56px)'}
                autoComplete
                dashed={false}
                mergeTags={mergeTags}
                onSubmit={onSubmit}
                onUploadImage={onUploadImage}
            >
                {({ values: _values }) => {
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <EditorToolbar
                                onBack={onBack}
                                templateName={templateName}
                                setTemplateName={setTemplateName}
                                onOpenAssets={handleOpenAssets}
                                isSaving={isSaving || externalIsSaving}
                                templateType={templateType}
                                onTemplateTypeChange={setTemplateType}
                            />
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <SimpleLayout showSourceCode={true}>
                                    <EmailEditor />
                                </SimpleLayout>
                            </div>
                        </div>
                    );
                }}
            </EmailEditorProvider>

            {/* Asset Picker Modal */}
            <AssetPicker
                isOpen={isAssetPickerOpen}
                onClose={handleAssetPickerClose}
                onSelect={handleAssetSelect}
            />
        </>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    toolbar: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 20px',
        backgroundColor: '#1e293b',
        color: '#fff',
        height: '56px',
        minHeight: '56px',
        boxSizing: 'border-box',
        borderBottom: '1px solid #334155',
        position: 'relative',
        zIndex: 1000,
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    },
    toolbarLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
    },
    toolbarCenter: {
        display: 'flex',
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        margin: '0 20px',
    },
    subjectContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    subjectLabel: {
        fontSize: '14px',
        color: '#fff',
        whiteSpace: 'nowrap',
    },
    subjectInput: {
        padding: '6px 12px',
        fontSize: '14px',
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: '6px',
        outline: 'none',
        backgroundColor: 'rgba(255,255,255,0.1)',
        color: '#fff',
        minWidth: '300px',
        maxWidth: '500px',
        transition: 'border-color 0.2s',
    },
    categoryContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginLeft: '20px',
    },
    categoryLabel: {
        fontSize: '14px',
        color: '#fff',
        whiteSpace: 'nowrap',
    },
    categorySelect: {
        padding: '6px 12px',
        fontSize: '14px',
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: '6px',
        outline: 'none',
        backgroundColor: '#fff',
        color: '#1e293b',
        minWidth: '150px',
        cursor: 'pointer',
        transition: 'border-color 0.2s',
    },
    toolbarRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    backButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        backgroundColor: 'transparent',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: '8px',
        fontSize: '14px',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    nameContainer: {
        display: 'flex',
        alignItems: 'center',
    },
    templateTitle: {
        margin: 0,
        fontSize: '16px',
        fontWeight: 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    editIcon: {
        fontSize: '12px',
        opacity: 0.6,
    },
    nameInput: {
        padding: '6px 12px',
        fontSize: '16px',
        fontWeight: 500,
        border: '1px solid #667eea',
        borderRadius: '6px',
        outline: 'none',
        backgroundColor: '#fff',
        color: '#1e293b',
        minWidth: '200px',
    },
    assetButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        backgroundColor: '#3b82f6',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
    },
    saveButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        backgroundColor: '#10b981',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    secondaryButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        backgroundColor: '#475569',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    dropdownMenu: {
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: '8px',
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        width: '280px',
        maxHeight: '400px',
        overflowY: 'auto',
        zIndex: 2000,
        border: '1px solid #e2e8f0',
        color: '#1e293b',
        padding: '8px 0',
    },
    dropdownCategory: {
        borderBottom: '1px solid #f1f5f9',
    },
    categoryTitle: {
        padding: '8px 16px',
        fontSize: '12px',
        fontWeight: 600,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        backgroundColor: '#f8fafc',
    },
    dropdownItem: {
        padding: '10px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer',
        fontSize: '14px',
        transition: 'background-color 0.1s',
    },
    tagCode: {
        fontSize: '12px',
        fontFamily: 'monospace',
        backgroundColor: '#f1f5f9',
        padding: '2px 6px',
        borderRadius: '4px',
        color: '#667eea',
    },
    unsavedIndicator: {
        color: '#fbbf24',
        fontSize: '20px',
        marginLeft: '4px',
    },
};

export default EmailBuilder;
