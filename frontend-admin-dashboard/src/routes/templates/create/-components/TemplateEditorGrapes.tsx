import React, { useEffect, useRef, useState } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info, Save, X, Loader2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
    getMessageTemplate,
    createMessageTemplate,
    updateMessageTemplate,
} from '@/services/message-template-service';
import type { MessageTemplate, CreateTemplateRequest } from '@/types/message-template-types';
import { ALL_TEMPLATE_VARIABLES, TEMPLATE_VARIABLES } from '@/types/message-template-types';
import { extractVariablesFromContent } from '@/components/templates/shared/TemplateEditorUtils';
import { templateCacheService } from '@/services/template-cache-service';
import { UploadFileInS3, getPublicUrl } from '@/services/upload_file';
import { getInstituteId } from '@/constants/helper';
import { getUserId } from '@/utils/userDetails';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { VariablesDialog } from './components/VariablesDialog';

interface TemplateEditorGrapesProps {
    templateId: string | null;
}

export const TemplateEditorGrapes: React.FC<TemplateEditorGrapesProps> = ({ templateId }) => {
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<any>(null);
    const isEditorInitialized = useRef(false);
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(!!templateId);
    const [isSaving, setIsSaving] = useState(false);
    const [template, setTemplate] = useState<MessageTemplate | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'EMAIL' as 'EMAIL' | 'WHATSAPP',
        subject: '',
        templateType: 'utility' as 'marketing' | 'utility' | 'transactional',
        isDefault: false,
    });
    // Text placeholder that survives GrapesJS re-renders and sanitation
    const CURSOR_PLACEHOLDER = '[[__CURSOR__]]';
    const [showVariablesDialog, setShowVariablesDialog] = useState(false);
    const savedRange = useRef<Range | null>(null);

    const handleDialogClose = (open: boolean) => {
        if (!open) {
            // Cleanup: Remove placeholder if it exists (user cancelled)
            if (editorRef.current) {
                const editor = editorRef.current;
                const selected = editor.getSelected();

                if (selected) {
                    const content = selected.get('content') || '';
                    if (content.includes(CURSOR_PLACEHOLDER)) {
                        // Remove placeholder
                        const newContent = content.replace(CURSOR_PLACEHOLDER, '');
                        selected.set('content', newContent);
                    }
                }
            }
        }
        setShowVariablesDialog(open);
    };

    const openVariablesDialog = () => {
        // Simply open the dialog.
        // We no longer try to insert cursor placeholders as it was causing text corruption.
        // The handleVariableSelect function now defaults to safely appending to the end of the selected component.
        setShowVariablesDialog(true);
    };

    const handleVariableSelect = (variable: string) => {
        if (!editorRef.current) return;
        const editor = editorRef.current;
        const selected = editor.getSelected();
        const varText = ' ' + variable; // Add space

        if (selected) {
            // UNIVERSAL SAFE STRATEGY:
            // 1. If User is actively typing (RichTextEditor is active), insert at cursor.
            //    This is the "Natural" behavior and works perfectly for text.
            if (editor.RichTextEditor && editor.RichTextEditor.active) {
                editor.RichTextEditor.insertHTML(varText);
            }
            else {
                // 2. If not typing (just selected a block), APPEND to the end.
                //    We use .append() because it adds a child/content safely WITHOUT
                //    overwriting (replacing) the existing content.
                try {
                    selected.append(varText);
                } catch (e) {
                    console.error("Simple append failed", e);
                    // Last resort: Native append to ensure we don't wipe data
                    const el = selected.getEl();
                    if (el) el.insertAdjacentHTML('beforeend', varText);
                }
            }

            // Visual feedback
            const el = selected.getEl();
            if (el) {
                el.style.outline = '2px solid #3b82f6';
                setTimeout(() => el.style.outline = '', 500);
            }
        } else {
            toast.warning("Please select a component to add the variable.");
        }
    };

    // Load template if editing
    useEffect(() => {
        const loadTemplate = async () => {
            if (templateId) {
                try {
                    setIsLoading(true);
                    console.log('Loading template with ID:', templateId);
                    const loadedTemplate = await getMessageTemplate(templateId);
                    console.log('Template loaded successfully:', {
                        id: loadedTemplate.id,
                        name: loadedTemplate.name,
                        hasContent: !!loadedTemplate.content,
                        contentLength: loadedTemplate.content?.length || 0,
                    });
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
                    const errorMessage = error?.message || 'Unknown error occurred';
                    console.error('Error details:', {
                        templateId,
                        errorMessage,
                        errorType: error?.constructor?.name,
                    });
                    toast.error(`Failed to load template: ${errorMessage}`);
                    // Don't navigate away immediately, let user see the error
                    setTimeout(() => {
                        navigate({ to: '/settings', search: { selectedTab: 'templates' } });
                    }, 2000);
                } finally {
                    setIsLoading(false);
                }
            }
        };

        loadTemplate();
    }, [templateId, navigate]);

    // Initialize GrapesJS editor
    useEffect(() => {
        if (!editorContainerRef.current || isLoading) return;
        if (templateId && !template) return; // Wait for template to load
        if (isEditorInitialized.current) return; // Don't initialize twice

        let isMounted = true; // Track if component is still mounted

        // Handle window resize to refresh editor
        const handleResize = () => {
            if (editorRef.current && isMounted) {
                editorRef.current.refresh();
            }
        };

        // Dynamically import GrapesJS only when needed
        const initGrapesJS = async () => {
            try {
                // Check if component is still mounted before importing
                if (!isMounted || !editorContainerRef.current) return;

                // Dynamic imports for GrapesJS
                const [grapesjsModule, presetNewsletterModule] = await Promise.all([
                    import('grapesjs'),
                    import('grapesjs-preset-newsletter'),
                    import('grapesjs/dist/css/grapes.min.css'),
                ]);

                // Check again after async import completes
                if (!isMounted || !editorContainerRef.current || isEditorInitialized.current) {
                    return;
                }

                const grapesjs = grapesjsModule.default || grapesjsModule;
                const presetNewsletter = presetNewsletterModule.default || presetNewsletterModule;

                // Now initialize the editor
                initializeEditor(grapesjs, presetNewsletter);
            } catch (error) {
                if (isMounted) {
                    console.error('Error loading GrapesJS:', error);
                    toast.error('Failed to load editor. Please refresh the page.');
                }
            }
        };

        // Wait for container to have dimensions
        const initializeEditor = (grapesjs: any, presetNewsletter: any) => {
            // Check if component is still mounted
            if (!isMounted) {
                console.log('Component unmounted, skipping editor initialization');
                return;
            }

            const container = editorContainerRef.current;
            if (!container) {
                console.log('Container not found during initialization');
                return;
            }

            // Check if already initialized to prevent double initialization
            if (isEditorInitialized.current) {
                console.log('Editor already initialized, skipping');
                return;
            }

            // Check if container has proper dimensions
            const containerHeight = container.offsetHeight || container.clientHeight;
            const containerWidth = container.offsetWidth || container.clientWidth;

            if (containerHeight === 0 || containerWidth === 0) {
                console.log('Container not ready, retrying...', { containerHeight, containerWidth });
                setTimeout(() => {
                    if (isMounted && !isEditorInitialized.current) {
                        initializeEditor(grapesjs, presetNewsletter);
                    }
                }, 100);
                return;
            }

            console.log('Initializing GrapesJS editor', {
                containerHeight,
                containerWidth,
            });

            const editor = grapesjs.init({
                container: container,
                height: '100%',
                width: '100%',
                fromElement: false,
                storageManager: false,
                canvas: {
                    styles: [],
                    scripts: [],
                },
                deviceManager: {
                    devices: [
                        {
                            id: 'desktop',
                            name: 'Desktop',
                            width: '',
                        },
                        {
                            id: 'tablet',
                            name: 'Tablet',
                            width: '768px',
                            widthMedia: '992px',
                        },
                        {
                            id: 'mobile',
                            name: 'Mobile',
                            width: '320px',
                            widthMedia: '768px',
                        },
                    ],
                },
                layerManager: {
                    // Only allow single selection in layer manager
                    multipleSelection: false,
                },
                plugins: [presetNewsletter],
                pluginsOpts: {
                    [presetNewsletter as unknown as string]: {
                        modalImportTitle: '',
                        modalImportLabel: '',
                    },
                },
            });

            // Store the modules for cleanup if needed
            (window as any).__grapesjs_modules__ = { grapesjs, presetNewsletter };

            // Configure canvas after editor is ready
            const configureCanvas = () => {
                try {
                    // Ensure the main GrapesJS container fills space
                    const gjsContainer = container.parentElement?.querySelector('.gjs-editor') || container.querySelector('.gjs-editor');
                    if (gjsContainer) {
                        (gjsContainer as HTMLElement).style.height = '100%';
                        (gjsContainer as HTMLElement).style.display = 'flex';
                        (gjsContainer as HTMLElement).style.flexDirection = 'column';
                        (gjsContainer as HTMLElement).style.flex = '1';
                    }

                    // Make the canvas wrapper fill available space and scrollable
                    // Try multiple ways to get the canvas wrapper element
                    let canvasWrapper: HTMLElement | null = null;

                    // Method 1: Try to get from Canvas module
                    try {
                        if ((editor.Canvas as any).getWrapperEl) {
                            canvasWrapper = (editor.Canvas as any).getWrapperEl();
                        }
                    } catch (e) {
                        // Method 1 failed, try Method 2
                    }

                    // Method 2: Try to find by class name
                    if (!canvasWrapper) {
                        canvasWrapper = container.querySelector('.gjs-cv-canvas')?.parentElement as HTMLElement || null;
                    }

                    // Method 3: Try to find canvas view and get parent
                    if (!canvasWrapper) {
                        try {
                            const canvasView = editor.Canvas.getCanvasView();
                            if (canvasView && canvasView.el) {
                                canvasWrapper = canvasView.el.parentElement as HTMLElement;
                            }
                        } catch (e) {
                            // Method 3 failed
                        }
                    }

                    if (canvasWrapper) {
                        canvasWrapper.style.height = '100%';
                        canvasWrapper.style.flex = '1';
                        canvasWrapper.style.minHeight = '0';
                        canvasWrapper.style.display = 'flex';
                        canvasWrapper.style.flexDirection = 'column';
                        canvasWrapper.style.overflowY = 'auto';
                        canvasWrapper.style.overflowX = 'hidden';

                        // Find and configure the canvas view
                        const canvasView = canvasWrapper.querySelector('.gjs-cv-canvas');
                        if (canvasView) {
                            (canvasView as HTMLElement).style.height = '100%';
                            (canvasView as HTMLElement).style.flex = '1';
                            (canvasView as HTMLElement).style.minHeight = '0';
                            (canvasView as HTMLElement).style.display = 'flex';
                            (canvasView as HTMLElement).style.flexDirection = 'column';
                            (canvasView as HTMLElement).style.overflowY = 'auto';
                            (canvasView as HTMLElement).style.overflowX = 'hidden';
                        }
                    }

                    // Configure iframe to fill space and expand with content
                    const canvasEl = editor.Canvas.getCanvasView().el;
                    if (canvasEl) {
                        const iframe = canvasEl.querySelector('iframe') as HTMLIFrameElement;
                        if (iframe) {
                            iframe.style.width = '100%';
                            iframe.style.minHeight = '100%';
                            iframe.style.height = 'auto';
                            iframe.style.display = 'block';

                            const checkIframe = () => {
                                try {
                                    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                                    if (iframeDoc) {
                                        // Add or update viewport meta tag for responsive behavior
                                        let viewportMeta = iframeDoc.querySelector('meta[name="viewport"]');
                                        if (!viewportMeta) {
                                            viewportMeta = iframeDoc.createElement('meta');
                                            viewportMeta.setAttribute('name', 'viewport');
                                            iframeDoc.head.appendChild(viewportMeta);
                                        }
                                        viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');

                                        // Set html element
                                        if (iframeDoc.documentElement) {
                                            iframeDoc.documentElement.style.height = 'auto';
                                            iframeDoc.documentElement.style.minHeight = '100%';
                                        }

                                        // Configure body to expand with content and be responsive
                                        // Don't set maxWidth as it can break absolute positioning
                                        if (iframeDoc.body) {
                                            const iframeBody = iframeDoc.body;
                                            iframeBody.style.minHeight = '100%';
                                            iframeBody.style.height = 'auto';
                                            iframeBody.style.overflowY = 'visible';
                                            iframeBody.style.overflowX = 'hidden';
                                            // Ensure responsive behavior without breaking positioning
                                            iframeBody.style.width = '100%';
                                            iframeBody.style.boxSizing = 'border-box';
                                            // Don't set maxWidth - let CSS media queries handle responsive behavior
                                        }

                                        // Add responsive CSS to head if not already present
                                        let responsiveStyle = iframeDoc.querySelector('style[data-responsive]');
                                        if (!responsiveStyle) {
                                            responsiveStyle = iframeDoc.createElement('style');
                                            responsiveStyle.setAttribute('data-responsive', 'true');
                                            responsiveStyle.textContent = `
                                                /* Responsive styles for tablet and mobile */
                                                @media screen and (max-width: 768px) {
                                                    table {
                                                        width: 100% !important;
                                                        max-width: 100% !important;
                                                    }
                                                    img {
                                                        max-width: 100% !important;
                                                        height: auto !important;
                                                    }
                                                    * {
                                                        box-sizing: border-box;
                                                    }
                                                    /* Preserve absolute positioning when switching devices */
                                                    [style*="position: absolute"],
                                                    [style*="position:absolute"],
                                                    [style*="position: relative"],
                                                    [style*="position:relative"] {
                                                        /* Keep original positioning intact */
                                                    }
                                                }
                                                @media screen and (max-width: 480px) {
                                                    table {
                                                        width: 100% !important;
                                                        font-size: 14px !important;
                                                    }
                                                    td, th {
                                                        padding: 8px !important;
                                                    }
                                                    /* Preserve positioning on mobile */
                                                    [style*="position: absolute"],
                                                    [style*="position:absolute"],
                                                    [style*="position: relative"],
                                                    [style*="position:relative"] {
                                                        /* Keep original positioning intact */
                                                    }
                                                }
                                            `;
                                            iframeDoc.head.appendChild(responsiveStyle);
                                        }
                                    }
                                } catch (e) {
                                    console.log('Iframe access handled via iframe styling');
                                }
                            };

                            if (iframe.contentDocument) {
                                checkIframe();
                            } else {
                                iframe.onload = checkIframe;
                                setTimeout(checkIframe, 500);
                            }
                        }
                    }

                    // Ensure dragging is enabled - check toolbar buttons
                    const toolbarButtons = document.querySelectorAll('.gjs-toolbar-item');
                    toolbarButtons.forEach((btn) => {
                        (btn as HTMLElement).style.pointerEvents = 'auto';
                        (btn as HTMLElement).style.cursor = 'pointer';
                    });

                    // Refresh the editor to apply changes
                    setTimeout(() => {
                        editor.refresh();
                    }, 100);
                } catch (error) {
                    console.error('Error configuring canvas:', error);
                }
            };

            // Ensure device manager is properly initialized
            const dm = editor.DeviceManager;
            if (dm) {
                const devices = dm.getDevices();
                console.log('Device Manager initialized:', devices);

                // Log available devices for debugging
                console.log('Available devices:', devices.map((d: any) => {
                    const name = d.getName ? d.getName() : d.name;
                    const width = d.getWidth ? d.getWidth() : (d.width || '');
                    const id = d.id || d.getName ? d.getName() : d.name;
                    return { name, width, id };
                }));

                // Check if mobile device exists and can be selected
                const mobileDevice = devices.find((d: any) => {
                    const name = d.getName ? d.getName() : d.name;
                    const id = d.id || '';
                    return (name && name.toLowerCase().includes('mobile')) ||
                        (id && id.toLowerCase().includes('mobile'));
                });

                if (mobileDevice) {
                    console.log('Mobile device found:', {
                        name: mobileDevice.getName ? mobileDevice.getName() : mobileDevice.name,
                        width: mobileDevice.getWidth ? mobileDevice.getWidth() : mobileDevice.width,
                        id: mobileDevice.id
                    });
                } else {
                    console.warn('Mobile device not found in device list');
                }
            }

            // Configure Style Manager with comprehensive positioning properties
            // This ensures all positioning controls are available in the sidepanel
            const configureStyleManager = () => {
                try {
                    const styleManager = editor.StyleManager;
                    if (!styleManager) {
                        console.warn('Style Manager not available');
                        return;
                    }

                    // Get all existing sectors
                    const sectors = styleManager.getSectors();

                    // Helper function to check if property exists in ANY sector
                    const propertyExistsInAnySector = (propName: string): boolean => {
                        try {
                            for (const sector of sectors) {
                                const existingProps = sector.getProperties();
                                const exists = existingProps.some((p: any) => {
                                    const pProperty = p.getProperty ? p.getProperty() : p.property;
                                    const pName = p.getName ? p.getName() : p.name;
                                    return pProperty === propName || pName === propName;
                                });
                                if (exists) return true;
                            }
                            return false;
                        } catch (error) {
                            return false;
                        }
                    };

                    // Helper function to add property if it doesn't exist in ANY sector
                    const addPropertyIfNotExists = (sector: any, prop: any) => {
                        const propName = prop.property || prop.name;
                        if (propertyExistsInAnySector(propName)) {
                            // Property already exists, don't add it
                            return;
                        }

                        try {
                            const existingProps = sector.getProperties();
                            const exists = existingProps.some((p: any) => {
                                const pProperty = p.getProperty ? p.getProperty() : p.property;
                                const pName = p.getName ? p.getName() : p.name;
                                return pProperty === propName || pName === propName;
                            });
                            if (!exists) {
                                sector.addProperty(prop);
                            }
                        } catch (error) {
                            console.warn('Error checking property existence:', error);
                            // Don't add if there's an error - might conflict with existing
                        }
                    };

                    // Find or create Dimension sector
                    let dimensionSector = sectors.find((s: any) => {
                        const id = s.getId ? s.getId() : s.id;
                        const name = s.getName ? s.getName() : s.name;
                        return id === 'dimension' || name === 'Dimension';
                    });
                    if (!dimensionSector) {
                        dimensionSector = styleManager.addSector('dimension', {
                            name: 'Dimension',
                            open: true,
                        });
                    }

                    // Add dimension properties - only add if they don't already exist
                    // Skip width and height if preset-newsletter already provides them
                    const widthExists = propertyExistsInAnySector('width');
                    const heightExists = propertyExistsInAnySector('height');

                    const dimensionProps = [];

                    // Only add width if it doesn't exist
                    if (!widthExists) {
                        dimensionProps.push({
                            name: 'width',
                            type: 'integer',
                            units: ['px', '%', 'em', 'rem', 'vw', 'vh', 'auto'],
                            defaults: 'auto',
                            min: 0,
                            unit: 'px',
                            property: 'width',
                        });
                    }

                    // Only add height if it doesn't exist
                    if (!heightExists) {
                        dimensionProps.push({
                            name: 'height',
                            type: 'integer',
                            units: ['px', '%', 'em', 'rem', 'vh', 'vw', 'auto'],
                            defaults: 'auto',
                            min: 0,
                            unit: 'px',
                            property: 'height',
                        });
                    }

                    // Always try to add min/max properties (these are usually not in preset-newsletter)
                    dimensionProps.push(
                        {
                            name: 'min-width',
                            type: 'integer',
                            units: ['px', '%', 'em', 'rem', 'vw', 'auto'],
                            defaults: '0',
                            min: 0,
                            unit: 'px',
                            property: 'min-width',
                        },
                        {
                            name: 'max-width',
                            type: 'integer',
                            units: ['px', '%', 'em', 'rem', 'vw', 'none'],
                            defaults: 'none',
                            min: 0,
                            unit: 'px',
                            property: 'max-width',
                        },
                        {
                            name: 'min-height',
                            type: 'integer',
                            units: ['px', '%', 'em', 'rem', 'vh', 'auto'],
                            defaults: '0',
                            min: 0,
                            unit: 'px',
                            property: 'min-height',
                        },
                        {
                            name: 'max-height',
                            type: 'integer',
                            units: ['px', '%', 'em', 'rem', 'vh', 'none'],
                            defaults: 'none',
                            min: 0,
                            unit: 'px',
                            property: 'max-height',
                        }
                    );

                    dimensionProps.forEach((prop) => addPropertyIfNotExists(dimensionSector, prop));

                    // Find or create Spacing sector
                    let spacingSector = sectors.find((s: any) => {
                        const id = s.getId ? s.getId() : s.id;
                        const name = s.getName ? s.getName() : s.name;
                        return id === 'spacing' || name === 'Spacing';
                    });
                    if (!spacingSector) {
                        spacingSector = styleManager.addSector('spacing', {
                            name: 'Spacing',
                            open: true,
                        });
                    }

                    // Add spacing properties (margin and padding)
                    const spacingProps = [
                        {
                            type: 'composite',
                            name: 'margin',
                            property: 'margin',
                            properties: [
                                { name: 'margin-top', type: 'integer', units: ['px', '%', 'em', 'rem', 'auto'], defaults: '0', min: 0, unit: 'px' },
                                { name: 'margin-right', type: 'integer', units: ['px', '%', 'em', 'rem', 'auto'], defaults: '0', min: 0, unit: 'px' },
                                { name: 'margin-bottom', type: 'integer', units: ['px', '%', 'em', 'rem', 'auto'], defaults: '0', min: 0, unit: 'px' },
                                { name: 'margin-left', type: 'integer', units: ['px', '%', 'em', 'rem', 'auto'], defaults: '0', min: 0, unit: 'px' },
                            ],
                        },
                        {
                            type: 'composite',
                            name: 'padding',
                            property: 'padding',
                            properties: [
                                { name: 'padding-top', type: 'integer', units: ['px', '%', 'em', 'rem'], defaults: '0', min: 0, unit: 'px' },
                                { name: 'padding-right', type: 'integer', units: ['px', '%', 'em', 'rem'], defaults: '0', min: 0, unit: 'px' },
                                { name: 'padding-bottom', type: 'integer', units: ['px', '%', 'em', 'rem'], defaults: '0', min: 0, unit: 'px' },
                                { name: 'padding-left', type: 'integer', units: ['px', '%', 'em', 'rem'], defaults: '0', min: 0, unit: 'px' },
                            ],
                        },
                    ];

                    spacingProps.forEach((prop) => addPropertyIfNotExists(spacingSector, prop));

                    // Find or create Position sector
                    let positionSector = sectors.find((s: any) => {
                        const id = s.getId ? s.getId() : s.id;
                        const name = s.getName ? s.getName() : s.name;
                        return id === 'position' || name === 'Position';
                    });
                    if (!positionSector) {
                        positionSector = styleManager.addSector('position', {
                            name: 'Position',
                            open: false,
                        });
                    }

                    // Add position properties
                    const positionProps = [
                        {
                            name: 'position',
                            type: 'select',
                            defaults: 'static',
                            options: [
                                { value: 'static', name: 'Static' },
                                { value: 'relative', name: 'Relative' },
                                { value: 'absolute', name: 'Absolute' },
                                { value: 'fixed', name: 'Fixed' },
                                { value: 'sticky', name: 'Sticky' },
                            ],
                            property: 'position',
                        },
                        {
                            name: 'top',
                            type: 'integer',
                            units: ['px', '%', 'em', 'rem', 'auto'],
                            defaults: 'auto',
                            unit: 'px',
                            property: 'top',
                        },
                        {
                            name: 'right',
                            type: 'integer',
                            units: ['px', '%', 'em', 'rem', 'auto'],
                            defaults: 'auto',
                            unit: 'px',
                            property: 'right',
                        },
                        {
                            name: 'bottom',
                            type: 'integer',
                            units: ['px', '%', 'em', 'rem', 'auto'],
                            defaults: 'auto',
                            unit: 'px',
                            property: 'bottom',
                        },
                        {
                            name: 'left',
                            type: 'integer',
                            units: ['px', '%', 'em', 'rem', 'auto'],
                            defaults: 'auto',
                            unit: 'px',
                            property: 'left',
                        },
                        {
                            name: 'z-index',
                            type: 'integer',
                            defaults: 'auto',
                            property: 'z-index',
                        },
                    ];

                    positionProps.forEach((prop) => addPropertyIfNotExists(positionSector, prop));

                    console.log('Style Manager configured with comprehensive positioning properties');
                } catch (error) {
                    console.error('Error configuring Style Manager:', error);
                }
            };

            // Store editor reference and mark as initialized
            editorRef.current = editor;
            isEditorInitialized.current = true;

            // Verify editor has required methods for saving
            if (typeof editor.getHtml !== 'function' || typeof editor.getCss !== 'function') {
                console.error('Editor initialized but save methods not available', {
                    hasGetHtml: typeof editor.getHtml,
                    hasGetCss: typeof editor.getCss,
                });
                toast.error('Editor initialized but save functionality may not work. Please refresh.');
            } else {
                console.log('Editor initialized successfully - save methods available');
            }

            const bm = editor.BlockManager;

            // Add custom email blocks
            bm.add('email-header', {
                label: 'Header',
                category: 'Email',
                content:
                    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7"><tr><td data-email-cell="true" align="center" style="padding:20px;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:bold"><div data-gjs-type="text">Company</div></td></tr></table>',
            });

            bm.add('email-hero', {
                label: 'Hero',
                category: 'Email',
                content:
                    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td data-email-cell="true" style="padding:0"><img data-email-img="true" src="https://via.placeholder.com/800x250" width="100%" style="display:block;border:0;outline:0;text-decoration:none" alt="" /></td></tr><tr><td data-email-cell="true" align="center" style="padding:20px 15px;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.5"><div data-gjs-type="text">Welcome to our newsletter</div></td></tr></table>',
            });

            bm.add('email-two-cols', {
                label: 'Two Columns',
                category: 'Email',
                content:
                    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td data-email-cell="true" valign="top" width="50%" style="padding:10px;font-family:Arial,Helvetica,sans-serif"><div data-gjs-type="text">Left content</div></td><td data-email-cell="true" valign="top" width="50%" style="padding:10px;font-family:Arial,Helvetica,sans-serif"><div data-gjs-type="text">Right content</div></td></tr></table>',
            });

            bm.add('email-cta', {
                label: 'Button',
                category: 'Email',
                content:
                    '<table role="presentation" align="center" cellpadding="0" cellspacing="0"><tr><td data-email-cell="true" align="center" bgcolor="#4f46e5" style="border-radius:4px"><a data-email-link="true" href="#" style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none !important;font-weight:bold;border:none"><span data-gjs-type="text" style="text-decoration:none !important">Call to action</span></a></td></tr></table>',
            });

            bm.add('email-footer', {
                label: 'Footer',
                category: 'Email',
                content:
                    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7"><tr><td data-email-cell="true" align="center" style="padding:16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#555"><div data-gjs-type="text">You received this email because you signed up on our website.<br/>Unsubscribe</div></td></tr></table>',
            });

            bm.add('email-bullet-list', {
                label: 'Bullet List',
                category: 'Email',
                content:
                    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td data-email-cell="true" style="padding:15px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;line-height:1.6"><ul style="margin:0;padding-left:20px;list-style-type:disc"><li style="margin-bottom:8px"><span data-gjs-type="text">First bullet point item</span></li><li style="margin-bottom:8px"><span data-gjs-type="text">Second bullet point item</span></li><li style="margin-bottom:8px"><span data-gjs-type="text">Third bullet point item</span></li></ul></td></tr></table>',
            });

            bm.add('email-numbered-list', {
                label: 'Numbered List',
                category: 'Email',
                content:
                    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td data-email-cell="true" style="padding:15px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;line-height:1.6"><ol style="margin:0;padding-left:20px;list-style-type:decimal"><li style="margin-bottom:8px"><span data-gjs-type="text">First numbered item</span></li><li style="margin-bottom:8px"><span data-gjs-type="text">Second numbered item</span></li><li style="margin-bottom:8px"><span data-gjs-type="text">Third numbered item</span></li></ol></td></tr></table>',
            });

            // Add alignment traits dynamically on selection
            const setCellTraits = (cmp: any) => {
                const traits = [
                    {
                        type: 'select',
                        name: 'align',
                        label: 'Align',
                        options: [
                            { id: 'left', name: 'Left' },
                            { id: 'center', name: 'Center' },
                            { id: 'right', name: 'Right' },
                        ],
                    },
                    {
                        type: 'select',
                        name: 'valign',
                        label: 'V Align',
                        options: [
                            { id: 'top', name: 'Top' },
                            { id: 'middle', name: 'Middle' },
                            { id: 'bottom', name: 'Bottom' },
                        ],
                    },
                    {
                        type: 'text',
                        name: 'width',
                        label: 'Width',
                        placeholder: 'e.g., 50%, 100%',
                    },
                    {
                        type: 'select',
                        name: 'colspan',
                        label: 'Colspan',
                        options: [
                            { id: '1', name: '1 Column' },
                            { id: '2', name: '2 Columns (1/2)' },
                            { id: '3', name: '3 Columns (1/3)' },
                            { id: '4', name: '4 Columns (1/4)' },
                        ],
                    },
                ];
                cmp.get('traits').reset(traits);

                // Enable resizing for cells
                cmp.set('resizable', true);
            };

            const setImageTraits = (cmp: any) => {
                const traits = [
                    'src',
                    'alt',
                    {
                        type: 'select',
                        name: 'align',
                        label: 'Align',
                        options: [
                            { id: 'left', name: 'Left' },
                            { id: 'center', name: 'Center' },
                            { id: 'right', name: 'Right' },
                        ],
                    },
                    { name: 'width' },
                ];
                cmp.get('traits').reset(traits);
                cmp.addStyle({ display: 'block', border: '0', outline: '0', 'text-decoration': 'none' });
            };

            const setLinkTraits = (cmp: any) => {
                const traits = [
                    { type: 'text', name: 'href', label: 'Href' },
                    {
                        type: 'select',
                        name: 'target',
                        label: 'Target',
                        options: [
                            { id: '', name: 'Same tab' },
                            { id: '_blank', name: 'New tab' },
                        ],
                    },
                    { type: 'text', name: 'rel', label: 'rel' },
                ];
                cmp.get('traits').reset(traits);
            };

            const setButtonTraits = (cmp: any) => {
                const traits = [
                    { type: 'text', name: 'href', label: 'Link URL' },
                    {
                        type: 'select',
                        name: 'target',
                        label: 'Target',
                        options: [
                            { id: '', name: 'Same tab' },
                            { id: '_blank', name: 'New tab' },
                        ],
                    },
                    {
                        type: 'color',
                        name: 'text-color',
                        label: 'Text Color',
                        changeProp: 1,
                    },
                    {
                        type: 'color',
                        name: 'bg-color',
                        label: 'Background Color',
                        changeProp: 1,
                    },
                ];
                cmp.get('traits').reset(traits);

                // Handle text color change
                cmp.on('change:text-color', () => {
                    const color = cmp.get('text-color');
                    if (color) {
                        // Apply color to the link and find the span inside to apply color
                        cmp.addStyle({ 'color': color + ' !important' });

                        // Also update the span inside if it exists
                        const span = cmp.find('span')[0];
                        if (span) {
                            span.addStyle({ 'color': color + ' !important' });
                        }
                    }
                });

                // Handle background color change
                cmp.on('change:bg-color', () => {
                    const bgColor = cmp.get('bg-color');
                    if (bgColor) {
                        // Find the parent TD (button container) and update its bgcolor
                        const parentTd = cmp.parent();
                        if (parentTd && parentTd.get('tagName') === 'td') {
                            parentTd.addAttribute('bgcolor', bgColor);
                        }
                    }
                });
            };

            const setListTraits = (cmp: any) => {
                // Determine the actual list component and the reference item based on selection
                let listCmp = cmp;
                let templateLi: any = null;

                if (cmp.get('tagName') === 'li') {
                    // Selected an LI
                    listCmp = cmp.parent();
                    templateLi = cmp;
                } else if (cmp.get('tagName') !== 'ul' && cmp.get('tagName') !== 'ol') {
                    // Selected text inside LI?
                    const parent = cmp.parent();
                    if (parent && parent.get('tagName') === 'li') {
                        listCmp = parent.parent();
                        templateLi = parent;
                    }
                } else {
                    // Selected the UL/OL itself
                    const items = cmp.find('li');
                    if (items && items.length > 0) {
                        templateLi = items[0];
                    }
                }

                // Safety check - make sure we found a list
                if (!listCmp || (listCmp.get('tagName') !== 'ul' && listCmp.get('tagName') !== 'ol')) {
                    if (cmp.get('tagName') === 'ul' || cmp.get('tagName') === 'ol') {
                        // Fallback if logic failed but cmp is list
                        listCmp = cmp;
                    } else {
                        return;
                    }
                }

                const listType = listCmp.get('tagName') === 'ul' ? 'Bullet' : 'Numbered';

                const traits = [
                    {
                        type: 'button',
                        name: 'add-item',
                        label: 'List Actions',
                        text: '+ Add Item',
                        command: (editor: any) => {
                            // Clone the reference item to preserve exact padding and styles
                            if (templateLi) {
                                const newItem = templateLi.clone();

                                // Reset text content for the new item
                                const span = newItem.find('span')[0];
                                if (span) {
                                    span.components('New item');
                                    // CRITICAL: Enforce text type and editability
                                    span.set({
                                        type: 'text',
                                        editable: true,
                                        selectable: true,
                                        hoverable: true
                                    });
                                    // Ensure attributes don't block editing
                                    span.addAttributes({ 'data-gjs-type': 'text' });
                                } else {
                                    // If no span found, add one with correct type
                                    newItem.append(`<span data-gjs-type="text">New item</span>`);
                                }

                                // Append to the actual list
                                listCmp.append(newItem);

                                // Automatically select the new text to make it ready for editing
                                const newSpan = newItem.find('span')[0] || newItem;
                                setTimeout(() => {
                                    editor.select(newSpan);
                                    // Optional: Trigger active state to highlight it
                                    // newSpan.trigger('active'); 
                                }, 50);

                            } else {
                                // Fallback if list is empty
                                const fallback = `<li style="margin-bottom:8px"><span data-gjs-type="text">New item</span></li>`;
                                const appended = listCmp.append(fallback)[0];

                                // Select the fallback item
                                if (appended) {
                                    const span = appended.find('span')[0];
                                    if (span) {
                                        setTimeout(() => editor.select(span), 50);
                                    }
                                }
                            }
                        },
                    },
                    {
                        type: 'button',
                        name: 'remove-item',
                        label: ' ',
                        text: '− Remove Last',
                        command: (editor: any) => {
                            const items = listCmp.components();
                            if (items.length > 1) {
                                items.at(items.length - 1).remove();
                            } else {
                                alert('List must have at least one item');
                            }
                        },
                    },
                    {
                        type: 'select',
                        name: 'list-style-type',
                        label: 'List Style',
                        options: listType === 'Bullet' ? [
                            { id: 'disc', name: '• Disc' },
                            { id: 'circle', name: '○ Circle' },
                            { id: 'square', name: '▪ Square' },
                        ] : [
                            { id: 'decimal', name: '1. Numbers' },
                            { id: 'lower-alpha', name: 'a. Lowercase' },
                            { id: 'upper-alpha', name: 'A. Uppercase' },
                            { id: 'lower-roman', name: 'i. Roman Lower' },
                            { id: 'upper-roman', name: 'I. Roman Upper' },
                        ],
                        changeProp: 1,
                    },
                ];

                // Set traits on the SELECTED component
                cmp.get('traits').reset(traits);

                // Initialize trait value from actual list style
                const currentStyle = listCmp.getStyle()['list-style-type'];
                if (currentStyle) {
                    cmp.set('list-style-type', currentStyle);
                }

                // Handle list style type change
                cmp.on('change:list-style-type', () => {
                    const styleType = cmp.get('list-style-type');
                    if (styleType) {
                        listCmp.addStyle({ 'list-style-type': styleType });
                    }
                });
            };

            // Ensure only single selection in layer manager
            editor.on('component:selected', (cmp: any) => {
                // Clear other selections to ensure only one item is selected at a time
                try {
                    const selected = editor.getSelected();
                    if (selected && selected.length > 1) {
                        // Keep only the last selected component
                        const lastSelected = selected[selected.length - 1];
                        selected.forEach((comp: any) => {
                            if (comp !== lastSelected) {
                                comp.set('selected', false);
                            }
                        });
                    }
                } catch (e) {
                    console.log('Error managing single selection:', e);
                }

                const anchorCmp = cmp.closest && cmp.closest('a');
                const targetCmp = anchorCmp || cmp;
                const el = targetCmp.getEl && targetCmp.getEl();

                if (!el) return;

                // Ensure component is draggable and selectable
                targetCmp.set('draggable', true);
                targetCmp.set('selectable', true);

                // Set traits based on element type
                if (el.hasAttribute && el.hasAttribute('data-email-cell')) {
                    setCellTraits(targetCmp);
                    // Enable resizing for table cells
                    targetCmp.set('resizable', {
                        tl: 0,
                        tc: 0,
                        tr: 0,
                        cl: 1, // horizontal resize from left
                        cr: 1, // horizontal resize from right
                        bl: 0,
                        bc: 0,
                        br: 0,
                        minDim: 50,
                        maxDim: '100%',
                    });
                } else if (el.hasAttribute && el.hasAttribute('data-email-img')) {
                    setImageTraits(targetCmp);
                } else if (el.hasAttribute && el.hasAttribute('data-email-link')) {
                    // This is a button (email CTA)
                    setButtonTraits(targetCmp);
                } else if (el.tagName === 'A') {
                    // Regular link
                    setLinkTraits(targetCmp);
                } else if (el.tagName === 'UL' || el.tagName === 'OL' || el.tagName === 'LI') {
                    // List (bullet or numbered) or List Item
                    setListTraits(targetCmp);
                } else if (el.tagName === 'SPAN' || el.tagName === 'DIV') {
                    // Check if it's text inside a list item
                    try {
                        const parent = targetCmp.parent();
                        if (parent && parent.get('tagName') === 'li') {
                            setListTraits(targetCmp);
                        }
                    } catch (e) {
                        // Ignore errors if parent check fails
                    }
                } else if (el.tagName === 'TABLE') {
                    // Enable full resizing for tables (all corners and edges)
                    setTimeout(() => {
                        targetCmp.set('resizable', {
                            tl: 1, // top-left corner
                            tc: 1, // top-center edge
                            tr: 1, // top-right corner
                            cl: 1, // center-left edge
                            cr: 1, // center-right edge
                            bl: 1, // bottom-left corner
                            bc: 1, // bottom-center edge
                            br: 1, // bottom-right corner
                            minDim: 100,
                            maxDim: '100%',
                        });

                        // Force refresh to show resizers
                        editor.refresh();
                    }, 50);

                    // Update width and height on resize
                    targetCmp.on('resize', () => {
                        const width = targetCmp.getStyle('width');
                        const height = targetCmp.getStyle('height');
                        if (width && typeof width === 'string') {
                            targetCmp.addAttribute('width', width);
                        }
                        if (height && typeof height === 'string') {
                            targetCmp.addStyle({ height: height });
                        }
                    });

                    // For tables, also enable resizing for all nested cells
                    enableResizingForNestedCells(targetCmp);
                } else if (el.tagName === 'TD' || el.tagName === 'TH') {
                    // Enable resizing for ALL table cells with all corners (including preset-newsletter blocks)
                    setTimeout(() => {
                        targetCmp.set('resizable', {
                            tl: 1, // top-left corner
                            tc: 1, // top-center edge
                            tr: 1, // top-right corner
                            cl: 1, // center-left edge
                            cr: 1, // center-right edge
                            bl: 1, // bottom-left corner
                            bc: 1, // bottom-center edge
                            br: 1, // bottom-right corner
                            minDim: 50,
                            maxDim: '100%',
                        });

                        // Force refresh to show resizers
                        editor.refresh();
                    }, 50);

                    // Update width and height on resize
                    targetCmp.on('resize', () => {
                        const width = targetCmp.getStyle('width');
                        const height = targetCmp.getStyle('height');
                        if (width && typeof width === 'string') {
                            targetCmp.addAttribute('width', width);
                        }
                        if (height && typeof height === 'string') {
                            targetCmp.addStyle({ height: height });
                        }
                    });

                    // Also set cell traits if not already set
                    if (!el.hasAttribute('data-email-cell')) {
                        // Add data-email-cell attribute for consistency
                        targetCmp.addAttributes({ 'data-email-cell': 'true' });
                        setCellTraits(targetCmp);
                    }
                } else if (el.tagName === 'TR') {
                    // Enable full resizing for table rows
                    targetCmp.set('resizable', {
                        tl: 1,
                        tc: 1,
                        tr: 1,
                        cl: 1,
                        cr: 1,
                        bl: 1,
                        bc: 1,
                        br: 1,
                        minDim: 50,
                        maxDim: '100%',
                    });

                    // For table rows, also enable resizing for all nested cells
                    enableResizingForNestedCells(targetCmp);
                } else if (el.tagName === 'DIV' || el.tagName === 'SECTION') {
                    // Enable resizing for divs and sections
                    targetCmp.set('resizable', true);
                }

                // Enable move command toolbar button
                setTimeout(() => {
                    const toolbarButtons = document.querySelectorAll('.gjs-toolbar-item');
                    toolbarButtons.forEach((btn) => {
                        const title = (btn as HTMLElement).getAttribute('title') || '';
                        if (title.toLowerCase().includes('move')) {
                            (btn as HTMLElement).style.pointerEvents = 'auto';
                            (btn as HTMLElement).style.cursor = 'pointer';
                            (btn as HTMLElement).style.opacity = '1';
                        }
                    });
                }, 50);
            });

            // Handle block drop from block manager (preset-newsletter blocks)
            editor.on('block:drag:stop', () => {
                // After a block is dropped, enable resizing for all table elements and cells
                setTimeout(() => {
                    const allComponents = editor.getComponents();
                    const traverseAndEnable = (components: any) => {
                        components.each((component: any) => {
                            const el = component.getEl && component.getEl();
                            if (el) {
                                if (el.tagName === 'TABLE') {
                                    // Enable full resizing for tables
                                    component.set('resizable', {
                                        tl: 1,
                                        tc: 1,
                                        tr: 1,
                                        cl: 1,
                                        cr: 1,
                                        bl: 1,
                                        bc: 1,
                                        br: 1,
                                        minDim: 100,
                                        maxDim: '100%',
                                    });
                                    enableResizingForNestedCells(component);
                                } else if (el.tagName === 'TD' || el.tagName === 'TH') {
                                    component.set('resizable', {
                                        tl: 1,
                                        tc: 1,
                                        tr: 1,
                                        cl: 1,
                                        cr: 1,
                                        bl: 1,
                                        bc: 1,
                                        br: 1,
                                        minDim: 50,
                                        maxDim: '100%',
                                    });
                                } else if (el.tagName === 'TR') {
                                    component.set('resizable', {
                                        tl: 1,
                                        tc: 1,
                                        tr: 1,
                                        cl: 1,
                                        cr: 1,
                                        bl: 1,
                                        bc: 1,
                                        br: 1,
                                        minDim: 50,
                                        maxDim: '100%',
                                    });
                                }
                            }
                            if (component.components) {
                                traverseAndEnable(component.components());
                            }
                        });
                    };
                    traverseAndEnable(allComponents);
                }, 100);
            });

            const applyCellAlign = (cmp: any) => {
                const align = cmp.getAttributes().align;
                if (align) cmp.addStyle({ 'text-align': align });

                // Apply width if set
                const width = cmp.getAttributes().width;
                if (width) {
                    cmp.addStyle({ width: width });
                    cmp.addAttribute('width', width);
                }

                // Apply colspan if set
                const colspan = cmp.getAttributes().colspan;
                if (colspan && cmp.is('td')) {
                    cmp.addAttribute('colspan', colspan);
                    // Adjust width based on colspan
                    const table = cmp.closest('table');
                    if (table) {
                        const cols = table.components().length > 0
                            ? table.components().at(0).components().length
                            : 1;
                        const percentWidth = (100 / cols) * parseInt(colspan);
                        cmp.addStyle({ width: `${percentWidth}%` });
                    }
                }
            };

            const applyImgAlign = (cmp: any) => {
                const align = cmp.getAttributes().align;
                if (align === 'center') {
                    cmp.addStyle({ display: 'block', margin: '0 auto', float: 'none' });
                } else if (align === 'right') {
                    cmp.addStyle({ display: 'block', margin: '0 0 0 auto', float: 'none' });
                } else if (align === 'left') {
                    cmp.addStyle({ display: 'block', margin: '0 auto 0 0', float: 'none' });
                }
            };

            editor.on('component:update:attributes:align', (cmp: any) => {
                const el = cmp.getEl && cmp.getEl();
                if (!el) return;

                if (el.hasAttribute && el.hasAttribute('data-email-cell')) applyCellAlign(cmp);
                if (el.hasAttribute && el.hasAttribute('data-email-img')) applyImgAlign(cmp);
            });

            // ============================================================
            // LIVE CURSOR TRACKING - The missing link for variable insertion
            // ============================================================
            const updateSavedRange = () => {
                try {
                    const frame = editor.Canvas.getFrameEl();
                    if (!frame) return;

                    const win = frame.contentWindow;
                    if (!win) return;

                    const doc = frame.contentDocument || win.document;
                    const selection = win.getSelection() || doc.getSelection();

                    if (selection && selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);

                        // Check if selection is valid and inside the editor
                        if (doc.body.contains(range.commonAncestorContainer)) {
                            // Only save if it's not the entire body (default selection)
                            // unless it is collapsed (cursor)
                            if (range.commonAncestorContainer !== doc.body || range.collapsed) {
                                savedRange.current = range.cloneRange();
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error tracking cursor:', e);
                }
            };

            // Attach listeners once editor is loaded
            editor.on('load', () => {
                const frame = editor.Canvas.getFrameEl();
                const win = frame.contentWindow;
                const doc = frame.contentDocument || win.document;

                // Robust set of events to catch every cursor movement
                doc.addEventListener('mouseup', updateSavedRange);
                doc.addEventListener('keyup', updateSavedRange);
                doc.addEventListener('click', updateSavedRange);
                // 'selectionchange' on document is the most reliable modern way
                doc.addEventListener('selectionchange', updateSavedRange);
            });

            // Also update on GrapesJS specific events
            editor.on('rte:enable', updateSavedRange);
            editor.on('component:selected', updateSavedRange);
            // ============================================================

            // Handle width and colspan updates
            editor.on('component:update:attributes:width', (cmp: any) => {
                const el = cmp.getEl && cmp.getEl();
                if (!el) return;
                if (el.hasAttribute && el.hasAttribute('data-email-cell')) applyCellAlign(cmp);
            });

            editor.on('component:update:attributes:colspan', (cmp: any) => {
                const el = cmp.getEl && cmp.getEl();
                if (!el) return;
                if (el.hasAttribute && el.hasAttribute('data-email-cell')) applyCellAlign(cmp);
            });

            // Helper function to enable resizing for all nested table cells with all corners
            const enableResizingForNestedCells = (component: any) => {
                // Check if this component is a table cell
                const el = component.getEl && component.getEl();
                // Ensure el is a DOM element before checking attributes
                if (el && typeof el === 'object' && el.nodeType && el.nodeType === 1) {
                    // Check if it's a table cell or has the data attribute
                    const isTableCell = el.tagName === 'TD' || el.tagName === 'TH';
                    const hasDataAttr = el.hasAttribute && typeof el.hasAttribute === 'function' && el.hasAttribute('data-email-cell');

                    if (isTableCell || hasDataAttr) {
                        setTimeout(() => {
                            component.set('resizable', {
                                tl: 1, // top-left corner
                                tc: 1, // top-center edge
                                tr: 1, // top-right corner
                                cl: 1, // center-left edge
                                cr: 1, // center-right edge
                                bl: 1, // bottom-left corner
                                bc: 1, // bottom-center edge
                                br: 1, // bottom-right corner
                                minDim: 50,
                                maxDim: '100%',
                            });

                            // Force refresh to show resizers
                            editor.refresh();
                        }, 50);

                        // Update width and height on resize
                        component.on('resize', () => {
                            const width = component.getStyle('width');
                            const height = component.getStyle('height');
                            if (width && typeof width === 'string') {
                                component.addAttribute('width', width);
                            }
                            if (height && typeof height === 'string') {
                                component.addStyle({ height: height });
                            }
                        });
                    }
                }

                // Recursively check children - with error handling
                if (component && component.components) {
                    try {
                        const children = component.components().models || [];
                        if (children && children.length > 0) {
                            children.forEach((child: any) => {
                                if (child) {
                                    enableResizingForNestedCells(child);
                                }
                            });
                        }
                    } catch (e) {
                        // Ignore errors in recursive traversal
                        console.warn('Error in recursive cell resizing:', e);
                    }
                }
            };

            // Enable resizing for all table cells and common elements
            editor.on('component:add', (component: any) => {
                const el = component.getEl && component.getEl();
                if (!el) return;

                // Enable resizing for table elements (tables, rows, cells)
                if (el.tagName === 'TABLE') {
                    // Force enable resizing for the table itself
                    setTimeout(() => {
                        // Enable full resizing for the table itself (all corners and edges)
                        component.set('resizable', {
                            tl: 1, // top-left corner
                            tc: 1, // top-center edge
                            tr: 1, // top-right corner
                            cl: 1, // center-left edge
                            cr: 1, // center-right edge
                            bl: 1, // bottom-left corner
                            bc: 1, // bottom-center edge
                            br: 1, // bottom-right corner
                            minDim: 100,
                            maxDim: '100%',
                        });

                        // Force refresh to show resizers
                        editor.refresh();
                    }, 50);

                    // Update width and height on resize
                    component.on('resize', () => {
                        const width = component.getStyle('width');
                        const height = component.getStyle('height');
                        if (width && typeof width === 'string') {
                            component.addAttribute('width', width);
                        }
                        if (height && typeof height === 'string') {
                            component.addStyle({ height: height });
                        }
                    });

                    // Enable resizing for all cells in the table
                    enableResizingForNestedCells(component);

                    // Also enable resizing for rows
                    const rows = component.components ? component.components().models : [];
                    rows.forEach((row: any) => {
                        enableResizingForNestedCells(row);
                    });
                }
                // Enable resizing for table cells (all corners and edges)
                else if (el.tagName === 'TD' || el.tagName === 'TH' || el.hasAttribute('data-email-cell')) {
                    setTimeout(() => {
                        component.set('resizable', {
                            tl: 1, // top-left corner
                            tc: 1, // top-center edge
                            tr: 1, // top-right corner
                            cl: 1, // center-left edge
                            cr: 1, // center-right edge
                            bl: 1, // bottom-left corner
                            bc: 1, // bottom-center edge
                            br: 1, // bottom-right corner
                            minDim: 50,
                            maxDim: '100%',
                        });

                        // Force refresh to show resizers
                        editor.refresh();
                    }, 50);

                    // Update width and height on resize
                    component.on('resize', () => {
                        const width = component.getStyle('width');
                        const height = component.getStyle('height');
                        if (width && typeof width === 'string') {
                            component.addAttribute('width', width);
                        }
                        if (height && typeof height === 'string') {
                            component.addStyle({ height: height });
                        }
                    });

                    // Also enable for nested cells
                    enableResizingForNestedCells(component);
                }
                // Enable resizing for table rows (all corners)
                else if (el.tagName === 'TR') {
                    component.set('resizable', {
                        tl: 1,
                        tc: 1,
                        tr: 1,
                        cl: 1,
                        cr: 1,
                        bl: 1,
                        bc: 1,
                        br: 1,
                        minDim: 50,
                        maxDim: '100%',
                    });
                    enableResizingForNestedCells(component);
                }
                // Enable resizing for divs and sections
                else if (el.tagName === 'DIV' || el.tagName === 'SECTION') {
                    component.set('resizable', true);
                }
            });

            // Load template content if editing - wait for editor to be fully ready
            if (template && template.content) {
                // Wait for editor to be ready before loading content
                const loadTemplateContent = () => {
                    try {
                        let htmlContent = template.content;
                        let cssContent = '';

                        // Check if this is a complete HTML document or just body content
                        const isCompleteDocument = htmlContent.trim().startsWith('<!DOCTYPE html>') ||
                            htmlContent.trim().startsWith('<html>');

                        if (isCompleteDocument) {
                            // Extract CSS from style tag in head if present
                            const headMatch = htmlContent.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
                            if (headMatch && headMatch[1]) {
                                const styleMatch = headMatch[1].match(/<style[^>]*>([\s\S]*?)<\/style>/i);
                                if (styleMatch && styleMatch[1]) {
                                    cssContent = styleMatch[1];
                                }
                            }

                            // Extract body content
                            const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
                            if (bodyMatch && bodyMatch[1]) {
                                htmlContent = bodyMatch[1];
                            } else {
                                // Fallback: try to extract content between body tags or remove DOCTYPE/html tags
                                htmlContent = htmlContent
                                    .replace(/<!DOCTYPE[^>]*>/gi, '')
                                    .replace(/<html[^>]*>/gi, '')
                                    .replace(/<\/html>/gi, '')
                                    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
                                    .replace(/<body[^>]*>/gi, '')
                                    .replace(/<\/body>/gi, '');
                            }
                        } else {
                            // Old format: Extract CSS from style tag if present (for backward compatibility)
                            if (template.content.includes('<style>')) {
                                const styleMatch = template.content.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
                                if (styleMatch && styleMatch[1]) {
                                    cssContent = styleMatch[1];
                                    // Remove style tag from HTML
                                    htmlContent = template.content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
                                }
                            }
                        }

                        // Check for base64 images in the content
                        const hasBase64Images = htmlContent.includes('data:image');
                        const base64Count = (htmlContent.match(/data:image/g) || []).length;
                        console.log('Loading template:', {
                            htmlLength: htmlContent.length,
                            hasBase64Images,
                            base64Count,
                            hasCss: !!cssContent,
                            sampleBase64: htmlContent.includes('data:image') ? htmlContent.substring(htmlContent.indexOf('data:image'), htmlContent.indexOf('data:image') + 100) : 'none',
                        });

                        // Set HTML content in GrapesJS - this will include base64 images
                        editor.setComponents(htmlContent.trim());

                        // Set CSS if we extracted any
                        if (cssContent) {
                            editor.setStyle(cssContent);
                        }

                        // Force refresh multiple times to ensure base64 images are displayed
                        const refreshImages = () => {
                            try {
                                editor.refresh();

                                // Try to access iframe and ensure images load
                                const canvas = editor.Canvas;
                                const frameEl = canvas.getFrameEl();
                                if (frameEl) {
                                    const iframe = frameEl.querySelector('iframe') as HTMLIFrameElement;
                                    if (iframe) {
                                        try {
                                            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                                            if (iframeDoc) {
                                                // Find all base64 images and ensure they load
                                                const images = iframeDoc.querySelectorAll('img');
                                                images.forEach((imgEl) => {
                                                    const imgSrc = imgEl.getAttribute('src');
                                                    if (imgSrc && imgSrc.startsWith('data:image')) {
                                                        // Create new image to force load
                                                        const newImg = new Image();
                                                        newImg.onload = () => {
                                                            (imgEl as HTMLImageElement).src = imgSrc;
                                                        };
                                                        newImg.src = imgSrc;
                                                    }
                                                });
                                            }
                                        } catch (e) {
                                            // CORS - images should still work
                                            console.log('CORS on iframe access (expected):', e);
                                        }
                                    }
                                }
                            } catch (e) {
                                console.error('Error refreshing images:', e);
                            }
                        };

                        // Refresh immediately and multiple times to ensure images appear
                        refreshImages();
                        setTimeout(refreshImages, 300);
                        setTimeout(refreshImages, 800);
                        setTimeout(refreshImages, 1500);

                        console.log('Template loaded successfully with base64 images:', {
                            htmlPreview: htmlContent.substring(0, 100),
                            hasCss: !!cssContent,
                            hasBase64Images,
                            base64Count,
                        });
                    } catch (error) {
                        console.error('Error loading template content:', error);
                        toast.error('Failed to load template content');
                    }
                };

                // Load content after a delay to ensure editor is ready
                setTimeout(loadTemplateContent, 300);
            }

            // Configure Style Manager after a delay to ensure editor is ready
            setTimeout(() => {
                configureStyleManager();
            }, 300);

            // Wait for editor to be fully loaded
            editor.on('load', () => {
                console.log('GrapesJS editor loaded successfully');

                // Ensure device manager has proper devices after load
                // This handles cases where preset-newsletter might modify devices
                setTimeout(() => {
                    const dm = editor.DeviceManager;
                    if (dm) {
                        const devices = dm.getDevices();
                        console.log('Devices after load:', devices.map((d: any) => ({
                            id: d.id,
                            name: d.getName ? d.getName() : d.name,
                            width: d.getWidth ? d.getWidth() : d.width
                        })));

                        // Ensure mobile device exists and can be selected
                        const mobileDevice = devices.find((d: any) => {
                            const name = d.getName ? d.getName() : d.name;
                            const id = d.id || '';
                            const nameLower = name ? name.toLowerCase() : '';
                            return nameLower.includes('mobile') || id.toLowerCase().includes('mobile');
                        });

                        if (mobileDevice) {
                            console.log('Mobile device available after load:', {
                                id: mobileDevice.id,
                                name: mobileDevice.getName ? mobileDevice.getName() : mobileDevice.name,
                                width: mobileDevice.getWidth ? mobileDevice.getWidth() : mobileDevice.width
                            });
                        }
                    }
                }, 200);

                // Configure Style Manager after load to ensure it's available
                setTimeout(() => {
                    configureStyleManager();
                }, 100);

                // Enable resizing for all existing table elements and cells after load
                const allComponents = editor.getComponents();
                const traverseComponents = (components: any) => {
                    components.each((component: any) => {
                        const el = component.getEl && component.getEl();
                        if (el) {
                            // Enable full resizing for tables
                            if (el.tagName === 'TABLE') {
                                component.set('resizable', {
                                    tl: 1,
                                    tc: 1,
                                    tr: 1,
                                    cl: 1,
                                    cr: 1,
                                    bl: 1,
                                    bc: 1,
                                    br: 1,
                                    minDim: 100,
                                    maxDim: '100%',
                                });
                            }
                            // Enable full resizing for table cells
                            else if (el.tagName === 'TD' || el.tagName === 'TH' || el.hasAttribute('data-email-cell')) {
                                component.set('resizable', {
                                    tl: 1,
                                    tc: 1,
                                    tr: 1,
                                    cl: 1,
                                    cr: 1,
                                    bl: 1,
                                    bc: 1,
                                    br: 1,
                                    minDim: 50,
                                    maxDim: '100%',
                                });
                            }
                            // Enable full resizing for table rows
                            else if (el.tagName === 'TR') {
                                component.set('resizable', {
                                    tl: 1,
                                    tc: 1,
                                    tr: 1,
                                    cl: 1,
                                    cr: 1,
                                    bl: 1,
                                    bc: 1,
                                    br: 1,
                                    minDim: 50,
                                    maxDim: '100%',
                                });
                            }
                        }

                        // Recursively check children
                        if (component.components) {
                            traverseComponents(component.components());
                        }
                    });
                };
                traverseComponents(allComponents);

                // Configure canvas after load
                setTimeout(() => {
                    configureCanvas();
                }, 100);
            });

            // Also try to configure immediately if already loaded
            setTimeout(() => {
                try {
                    if (editor.getHtml && typeof editor.getHtml === 'function') {
                        configureCanvas();
                    }
                } catch (e) {
                    // Editor might not be fully ready yet
                }
            }, 200);

            // Handle device change - ensure responsive behavior without breaking positioning
            editor.on('change:device', () => {
                const currentDevice = editor.getDevice();
                const deviceName = currentDevice?.getName ? currentDevice.getName() : (currentDevice?.name || currentDevice || '');
                console.log('Device changed:', deviceName, currentDevice);

                // Normalize device name for comparison (handle "Mobile portrait", "Mobile", etc.)
                const deviceNameLower = deviceName.toLowerCase();

                // Verify device is actually selected and get device width
                const dm = editor.DeviceManager;
                let deviceWidth = '';
                let selectedDevice = null;

                if (dm) {
                    selectedDevice = dm.getSelected();
                    console.log('Device Manager selected device:', selectedDevice?.getName ? selectedDevice.getName() : selectedDevice?.name || selectedDevice);
                    console.log('Current device from editor:', editor.getDevice()?.getName ? editor.getDevice().getName() : editor.getDevice()?.name || editor.getDevice());

                    // If device is not selected but editor has it, try to select it
                    if (!selectedDevice && currentDevice) {
                        try {
                            // Try multiple ways to get device ID
                            let deviceId = currentDevice.id;
                            if (!deviceId && currentDevice.getName) {
                                deviceId = currentDevice.getName();
                            }
                            if (!deviceId && currentDevice.name) {
                                deviceId = currentDevice.name;
                            }

                            // Also try to find device by name in device list
                            if (!deviceId) {
                                const devices = dm.getDevices();
                                const matchingDevice = devices.find((d: any) => {
                                    const dName = d.getName ? d.getName() : d.name;
                                    return dName && dName.toLowerCase() === deviceNameLower;
                                });
                                if (matchingDevice) {
                                    deviceId = matchingDevice.id || matchingDevice.getName ? matchingDevice.getName() : matchingDevice.name;
                                    selectedDevice = matchingDevice;
                                }
                            }

                            if (deviceId && !selectedDevice) {
                                try {
                                    dm.select(deviceId);
                                    console.log('Attempted to select device by ID:', deviceId);
                                    selectedDevice = dm.getSelected();
                                } catch (selectError) {
                                    console.warn('Failed to select device by ID, trying by name:', selectError);
                                    // If selecting by ID fails, try to find and select by name
                                    if (deviceNameLower.includes('mobile')) {
                                        const devices = dm.getDevices();
                                        const mobileDevice = devices.find((d: any) => {
                                            const dId = d.id || '';
                                            return dId.toLowerCase() === 'mobile';
                                        });
                                        if (mobileDevice) {
                                            try {
                                                dm.select('mobile');
                                                selectedDevice = dm.getSelected();
                                                console.log('Successfully selected mobile device by ID "mobile"');
                                            } catch (e) {
                                                console.warn('Could not select mobile device:', e);
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn('Could not select device:', e);
                        }
                    }

                    // If still no selected device and it's a mobile device, try to select our configured mobile device
                    if (!selectedDevice && deviceNameLower.includes('mobile')) {
                        try {
                            const devices = dm.getDevices();
                            const mobileDevice = devices.find((d: any) => {
                                const dId = d.id || '';
                                return dId.toLowerCase() === 'mobile';
                            });
                            if (mobileDevice) {
                                dm.select('mobile');
                                selectedDevice = dm.getSelected();
                                console.log('Force selected mobile device');
                            }
                        } catch (e) {
                            console.warn('Could not force select mobile device:', e);
                        }
                    }

                    // Use selected device if available, otherwise use current device
                    const deviceToUse = selectedDevice || currentDevice;

                    // Get device width - try multiple methods
                    if (deviceToUse) {
                        if (typeof deviceToUse.getWidth === 'function') {
                            deviceWidth = deviceToUse.getWidth() || '';
                        } else if (deviceToUse.width) {
                            deviceWidth = deviceToUse.width || '';
                        }

                        // If still no width, try to find device in device list
                        if (!deviceWidth) {
                            const devices = dm.getDevices();
                            // Try to find device by exact match first, then partial match
                            let matchingDevice = devices.find((d: any) => {
                                const dName = d.getName ? d.getName() : d.name;
                                const dId = d.id || '';
                                const dNameLower = dName ? dName.toLowerCase() : '';
                                const dIdLower = dId ? dId.toLowerCase() : '';
                                return (dNameLower === deviceNameLower) || (dIdLower === deviceNameLower);
                            });

                            // If no exact match, try partial match
                            if (!matchingDevice) {
                                matchingDevice = devices.find((d: any) => {
                                    const dName = d.getName ? d.getName() : d.name;
                                    const dId = d.id || '';
                                    const dNameLower = dName ? dName.toLowerCase() : '';
                                    const dIdLower = dId ? dId.toLowerCase() : '';
                                    return (dName && deviceNameLower.includes(dNameLower)) ||
                                        (dName && dNameLower.includes(deviceNameLower)) ||
                                        (dId && deviceNameLower.includes(dIdLower)) ||
                                        (dId && dIdLower.includes(deviceNameLower));
                                });
                            }

                            if (matchingDevice) {
                                if (typeof matchingDevice.getWidth === 'function') {
                                    deviceWidth = matchingDevice.getWidth() || '';
                                } else if (matchingDevice.width) {
                                    deviceWidth = matchingDevice.width || '';
                                }

                                // If still no width, use default for mobile
                                if (!deviceWidth && deviceNameLower.includes('mobile')) {
                                    deviceWidth = '320px';
                                }
                            } else if (deviceNameLower.includes('mobile')) {
                                // Fallback: use default mobile width
                                deviceWidth = '320px';
                            }
                        }
                    }
                }

                // Fallback: if we still don't have width and it's mobile, use default
                if (!deviceWidth && deviceNameLower.includes('mobile')) {
                    deviceWidth = '320px';
                }

                console.log('Device width (final):', deviceWidth);

                // Use a small delay to let GrapeJS finish its device change handling
                setTimeout(() => {
                    // Re-configure canvas - this ensures responsive styles are applied
                    // Wrap in try-catch to prevent errors from breaking device switching
                    try {
                        configureCanvas();
                    } catch (e) {
                        console.warn('Error configuring canvas on device change (non-critical):', e);
                    }

                    // Only update the canvas preview iframe, NOT any wrapper/container elements
                    // This ensures the editor UI (toolbar, panels) stays at full width
                    try {
                        const canvasEl = editor.Canvas.getCanvasView().el;
                        if (canvasEl) {
                            const iframe = canvasEl.querySelector('iframe') as HTMLIFrameElement;
                            if (iframe) {
                                // Only constrain the iframe width (the preview area), not wrapper containers
                                if (deviceWidth) {
                                    iframe.style.width = deviceWidth;
                                    iframe.style.maxWidth = deviceWidth;
                                    iframe.style.margin = '0 auto';
                                    iframe.style.display = 'block';
                                    console.log('Updated iframe width to:', deviceWidth);
                                } else {
                                    // Desktop - full width
                                    iframe.style.width = '100%';
                                    iframe.style.maxWidth = '100%';
                                    iframe.style.margin = '0';
                                }
                            }
                        }

                        // Ensure frame container stays at 100% width (so editor UI doesn't shrink)
                        const frameEl = editor.Canvas.getFrameEl();
                        if (frameEl) {
                            frameEl.style.width = '100%';
                            frameEl.style.maxWidth = '100%';
                            frameEl.style.display = 'flex';
                            frameEl.style.justifyContent = 'center';
                            frameEl.style.alignItems = 'flex-start';
                        }
                    } catch (e) {
                        console.warn('Error updating canvas iframe width:', e);
                    }

                    // Force canvas to update/refresh after width change
                    try {
                        // Small delay then refresh to ensure width changes are applied
                        setTimeout(() => {
                            editor.refresh();
                        }, 50);
                    } catch (e) {
                        console.warn('Error refreshing canvas:', e);
                    }

                    // Ensure Style Manager is still configured after device change
                    configureStyleManager();

                    // Re-apply responsive styles when device changes
                    try {
                        const canvasEl = editor.Canvas.getCanvasView().el;
                        if (canvasEl) {
                            const iframe = canvasEl.querySelector('iframe') as HTMLIFrameElement;
                            if (iframe) {
                                // Update iframe width to match device (only the preview, not editor UI)
                                if (deviceWidth) {
                                    iframe.style.width = deviceWidth;
                                    iframe.style.maxWidth = deviceWidth;
                                    iframe.style.margin = '0 auto';
                                    iframe.style.display = 'block';
                                } else {
                                    iframe.style.width = '100%';
                                    iframe.style.maxWidth = '100%';
                                    iframe.style.margin = '0';
                                }

                                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                                if (iframeDoc) {
                                    // Update viewport meta tag
                                    let viewportMeta = iframeDoc.querySelector('meta[name="viewport"]');
                                    if (!viewportMeta) {
                                        viewportMeta = iframeDoc.createElement('meta');
                                        viewportMeta.setAttribute('name', 'viewport');
                                        iframeDoc.head.appendChild(viewportMeta);
                                    }
                                    // Set appropriate viewport for mobile/tablet
                                    // Handle both "Mobile" and "Mobile portrait" device names
                                    const deviceNameLower = deviceName.toLowerCase();
                                    const isMobile = deviceNameLower.includes('mobile');
                                    const isTablet = deviceNameLower.includes('tablet');
                                    viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');

                                    // Update body styles for responsive behavior - but don't break positioning
                                    if (iframeDoc.body) {
                                        // Don't set maxWidth on body - it breaks absolute positioning
                                        // Let GrapeJS handle the device width through its canvas
                                        iframeDoc.body.style.width = '100%';
                                        iframeDoc.body.style.boxSizing = 'border-box';
                                        // Remove any maxWidth that might have been set previously
                                        iframeDoc.body.style.maxWidth = '';
                                    }

                                    // Ensure responsive CSS is present and update it if needed
                                    let responsiveStyle = iframeDoc.querySelector('style[data-responsive]') as HTMLStyleElement;
                                    if (!responsiveStyle) {
                                        responsiveStyle = iframeDoc.createElement('style');
                                        responsiveStyle.setAttribute('data-responsive', 'true');
                                        iframeDoc.head.appendChild(responsiveStyle);
                                    }

                                    // Update responsive CSS content
                                    responsiveStyle.textContent = `
                                        /* Responsive styles for tablet and mobile */
                                        @media screen and (max-width: 768px) {
                                            table {
                                                width: 100% !important;
                                                max-width: 100% !important;
                                            }
                                            img {
                                                max-width: 100% !important;
                                                height: auto !important;
                                            }
                                            * {
                                                box-sizing: border-box;
                                            }
                                            /* Preserve absolute positioning when switching devices */
                                            [style*="position: absolute"],
                                            [style*="position:absolute"],
                                            [style*="position: relative"],
                                            [style*="position:relative"] {
                                                /* Keep original positioning intact */
                                            }
                                        }
                                        @media screen and (max-width: 480px) {
                                            table {
                                                width: 100% !important;
                                                font-size: 14px !important;
                                            }
                                            td, th {
                                                padding: 8px !important;
                                            }
                                            /* Preserve positioning on mobile */
                                            [style*="position: absolute"],
                                            [style*="position:absolute"],
                                            [style*="position: relative"],
                                            [style*="position:relative"] {
                                                /* Keep original positioning intact */
                                            }
                                        }
                                    `;
                                }
                            }
                        }
                    } catch (e) {
                        console.log('Error applying responsive styles on device change:', e);
                    }
                }, 150);
            });

            // Update canvas configuration when content changes
            editor.on('component:add', () => {
                setTimeout(() => {
                    configureCanvas();
                }, 100);
            });

            editor.on('component:remove', () => {
                setTimeout(() => {
                    configureCanvas();
                }, 100);
            });


            window.addEventListener('resize', handleResize);
        };

        // Initialize with a small delay to ensure DOM is ready, then load GrapesJS
        const timeoutId = setTimeout(() => {
            initGrapesJS();
        }, 100);

        return () => {
            isMounted = false; // Mark as unmounted to prevent further operations
            clearTimeout(timeoutId);
            window.removeEventListener('resize', handleResize);
            if (editorRef.current && isEditorInitialized.current) {
                try {
                    editorRef.current.destroy();
                } catch (error) {
                    console.error('Error destroying editor:', error);
                }
                isEditorInitialized.current = false;
            }
        };
    }, [isLoading, template, templateId]);

    // Helper function to upload images to S3 and replace URLs in HTML and CSS
    const uploadImagesToS3 = async (html: string, css?: string): Promise<{ html: string; css: string }> => {
        // Get user credentials for S3 upload
        const userId = getUserId();
        const instituteId = getInstituteId();

        if (!userId || !instituteId) {
            console.error('Missing user credentials for image upload');
            toast.error('Unable to upload images. Please refresh and try again.');
            return { html, css: css || '' };
        }

        let processedCss = css || '';

        // Create a temporary DOM element to parse HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Find all img tags - only collect base64 images for S3 upload
        const allImages = tempDiv.querySelectorAll('img');
        const images: Element[] = [];
        allImages.forEach((img) => {
            const src = img.getAttribute('src');
            // Only collect base64 images for S3 upload
            // External URLs (http/https) will be kept as-is
            if (src && src.startsWith('data:')) {
                // Skip if already an S3 URL (shouldn't happen, but safety check)
                if (!src.includes('s3.') && !src.includes('amazonaws.com') && !src.includes('cloudfront.net')) {
                    images.push(img);
                }
            }
        });

        // Find all elements with background-image styles - only collect base64 images
        const allElements = tempDiv.querySelectorAll('*');
        const elementsWithBgImages: Array<{ element: Element; bgImage: string }> = [];

        // Helper function to extract background-image URL from style string
        const extractBgImageUrl = (styleString: string): string | null => {
            // Match various formats: url('data:...'), url("data:..."), url(data:...), etc.
            const patterns = [
                /background-image:\s*url\(['"]?([^'")]+)['"]?\)/i,
                /background:\s*[^;]*url\(['"]?([^'")]+)['"]?\)/i,
            ];

            for (const pattern of patterns) {
                const match = styleString.match(pattern);
                if (match && match[1]) {
                    return match[1];
                }
            }
            return null;
        };

        allElements.forEach((element) => {
            const el = element as HTMLElement;
            const style = el.getAttribute('style') || '';

            // Check inline style
            const bgUrl = extractBgImageUrl(style);
            if (bgUrl) {
                // Only collect base64 images for S3 upload
                // External URLs (http/https) will be kept as-is
                if (bgUrl.startsWith('data:')) {
                    // Skip if already an S3 URL (shouldn't happen, but safety check)
                    if (!bgUrl.includes('s3.') && !bgUrl.includes('amazonaws.com') && !bgUrl.includes('cloudfront.net')) {
                        elementsWithBgImages.push({ element: el, bgImage: bgUrl });
                    }
                }
            }
        });

        // Also check for background images in style tags (CSS)
        const styleTags = tempDiv.querySelectorAll('style');
        const styleTagBgImages: Array<{ selector: string; bgImage: string; styleTag: Element; fullMatch: string }> = [];

        styleTags.forEach((styleTag) => {
            const cssContent = styleTag.textContent || '';
            // Find all background-image declarations in CSS
            // Match both background-image: url(...) and background: ... url(...) ...
            const bgImageRegex = /([^{}]+)\{([^}]*)\}/gi;
            let ruleMatch: RegExpExecArray | null;
            while ((ruleMatch = bgImageRegex.exec(cssContent)) !== null) {
                const selector = ruleMatch[1];
                const declarations = ruleMatch[2];
                if (selector && declarations) {
                    // Check for background-image: url(...)
                    let bgImageMatch = declarations.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/i);
                    if (!bgImageMatch) {
                        // Check for background: ... url(...) (shorthand)
                        bgImageMatch = declarations.match(/background:\s*[^;]*url\(['"]?([^'")]+)['"]?\)/i);
                    }

                    if (bgImageMatch && bgImageMatch[1]) {
                        const bgUrl = bgImageMatch[1];
                        if (bgUrl.startsWith('data:') ||
                            (bgUrl.startsWith('http') && !bgUrl.includes('s3.') && !bgUrl.includes('amazonaws.com') && !bgUrl.includes('cloudfront.net'))) {
                            styleTagBgImages.push({
                                selector: selector.trim(),
                                bgImage: bgUrl,
                                styleTag,
                                fullMatch: ruleMatch[0]
                            });
                        }
                    }
                }
            }
        });

        // Process CSS content for background images
        const cssBgImages: Array<{ bgImage: string; fullMatch: string }> = [];
        if (processedCss) {
            console.log('Processing CSS for background images, CSS length:', processedCss.length);

            // First, try to find all background-image URLs directly in CSS (more comprehensive)
            // This handles cases where CSS might have background-image on multiple lines or in different formats
            const directBgImageRegex = /background(?:-image)?:\s*[^;]*url\(['"]?([^'")]+)['"]?\)/gi;
            let directMatch: RegExpExecArray | null;
            while ((directMatch = directBgImageRegex.exec(processedCss)) !== null) {
                if (directMatch[1]) {
                    const bgUrl = directMatch[1];
                    // Check if it's base64 or external URL (not already S3)
                    if (bgUrl.startsWith('data:') ||
                        (bgUrl.startsWith('http') && !bgUrl.includes('s3.') && !bgUrl.includes('amazonaws.com') && !bgUrl.includes('cloudfront.net'))) {
                        // Check if we already have this URL to avoid duplicates
                        const exists = cssBgImages.some(item => item.bgImage === bgUrl);
                        if (!exists) {
                            cssBgImages.push({
                                bgImage: bgUrl,
                                fullMatch: directMatch[0]
                            });
                            console.log('Found background image in CSS:', bgUrl.substring(0, 60));
                        }
                    }
                }
            }

            // Also try the rule-based approach for completeness
            const bgImageRegex = /([^{}]+)\{([^}]*)\}/gi;
            let ruleMatch: RegExpExecArray | null;
            while ((ruleMatch = bgImageRegex.exec(processedCss)) !== null) {
                const declarations = ruleMatch[2];
                if (declarations) {
                    // Check for background-image: url(...)
                    let bgImageMatch = declarations.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/i);
                    if (!bgImageMatch) {
                        // Check for background: ... url(...) (shorthand)
                        bgImageMatch = declarations.match(/background:\s*[^;]*url\(['"]?([^'")]+)['"]?\)/i);
                    }

                    if (bgImageMatch && bgImageMatch[1]) {
                        const bgUrl = bgImageMatch[1];
                        if (bgUrl.startsWith('data:') ||
                            (bgUrl.startsWith('http') && !bgUrl.includes('s3.') && !bgUrl.includes('amazonaws.com') && !bgUrl.includes('cloudfront.net'))) {
                            // Check if we already have this URL
                            const exists = cssBgImages.some(item => item.bgImage === bgUrl);
                            if (!exists) {
                                cssBgImages.push({
                                    bgImage: bgUrl,
                                    fullMatch: ruleMatch[0]
                                });
                            }
                        }
                    }
                }
            }

            console.log(`Found ${cssBgImages.length} background image(s) in CSS content`);
        }

        const totalImages = images.length + elementsWithBgImages.length + styleTagBgImages.length + cssBgImages.length;

        if (totalImages === 0) {
            console.log('No images found in HTML or CSS, skipping S3 upload');
            return { html, css: processedCss };
        }

        console.log(`Found ${images.length} img tag(s), ${elementsWithBgImages.length} inline background-image(s), ${styleTagBgImages.length} style tag background-image(s), and ${cssBgImages.length} CSS background-image(s) to process for S3 upload`);

        const imagePromises: Promise<void>[] = [];

        let uploadedCount = 0;
        let failedCount = 0;
        let base64Count = 0;

        // Helper function to convert image URL/Blob to File
        const urlToFile = async (url: string, filename: string): Promise<File | null> => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error('Failed to fetch image');
                const blob = await response.blob();
                return new File([blob], filename, { type: blob.type || 'image/png' });
            } catch (error) {
                console.error('Error converting URL to File:', error);
                return null;
            }
        };

        // Helper function to convert base64 to File
        const base64ToFile = (base64Data: string, mimeType: string, filename: string): File | null => {
            try {
                // Remove data:image/xxx;base64, prefix if present
                const base64String = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
                if (!base64String) {
                    throw new Error('Invalid base64 data');
                }
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

        // Helper function to upload a single image to S3
        const uploadImageToS3 = async (img: Element, originalSrc: string): Promise<string | null> => {
            try {
                let file: File | null = null;
                let mimeType = 'image/png';

                // Determine filename and file object based on source type
                const timestamp = Date.now();
                const randomId = Math.random().toString(36).substring(2, 15);

                if (originalSrc.startsWith('data:')) {
                    // Base64 image - convert to File and upload to S3
                    console.log('Processing base64 image for S3 upload...');
                    const match = originalSrc.match(/data:([^;]+);base64,(.+)/);
                    if (match && match[1] && match[2]) {
                        mimeType = match[1];
                        const base64Data: string = match[2]; // Type assertion since we checked match[2] exists
                        const extension = mimeType.split('/')[1] || 'png';
                        const filename = `template-image-${timestamp}-${randomId}.${extension}`;
                        console.log('Converting base64 to File:', { mimeType, extension, filename });
                        file = base64ToFile(base64Data, mimeType, filename);
                        if (!file) {
                            console.error('Failed to convert base64 to File');
                            return null;
                        }
                        console.log('Base64 converted to File successfully, size:', file.size, 'bytes');
                    } else {
                        console.error('Invalid base64 image format:', originalSrc.substring(0, 50));
                        return null;
                    }
                } else if (originalSrc.startsWith('http://') || originalSrc.startsWith('https://') || originalSrc.startsWith('//')) {
                    // External URL - download and convert to File
                    const fullUrl = originalSrc.startsWith('//') ? `https:${originalSrc}` : originalSrc;
                    let urlPath: string;
                    try {
                        urlPath = new URL(fullUrl).pathname;
                    } catch (e) {
                        console.error('Invalid URL:', fullUrl);
                        return null;
                    }
                    const extension = urlPath.split('.').pop() || 'png';
                    const filename = `template-image-${timestamp}-${randomId}.${extension}`;

                    // Try to determine mime type from extension
                    const mimeTypes: Record<string, string> = {
                        jpg: 'image/jpeg',
                        jpeg: 'image/jpeg',
                        png: 'image/png',
                        gif: 'image/gif',
                        webp: 'image/webp',
                        svg: 'image/svg+xml',
                    };
                    mimeType = mimeTypes[extension.toLowerCase()] || 'image/png';

                    file = await urlToFile(fullUrl, filename);
                } else {
                    // Skip relative paths or other formats
                    console.log('Skipping image (not a URL or base64):', originalSrc.substring(0, 50));
                    return null;
                }

                if (!file) {
                    console.error('Failed to create File object for image');
                    return null;
                }

                // Upload to S3
                console.log('Uploading file to S3:', { filename: file.name, size: file.size, type: file.type });
                const fileId = await UploadFileInS3(
                    file,
                    () => { }, // Progress callback
                    userId,
                    instituteId,
                    'ADMIN', // source
                    true // Generate public URL
                );

                if (!fileId) {
                    console.error('UploadFileInS3 returned null fileId');
                    throw new Error('Failed to upload image to S3');
                }

                console.log('File uploaded to S3, fileId:', fileId);

                // Get public URL
                const publicUrl = await getPublicUrl(fileId);
                if (!publicUrl) {
                    console.error('getPublicUrl returned null for fileId:', fileId);
                    throw new Error('Failed to get public URL from S3');
                }

                console.log('✓ Successfully uploaded image to S3:', {
                    original: originalSrc.substring(0, 50),
                    s3Url: publicUrl.substring(0, 50),
                    fileId,
                });

                return publicUrl;
            } catch (error) {
                console.error('Error uploading image to S3:', error);
                return null;
            }
        };

        images.forEach((img) => {
            const src = img.getAttribute('src');

            // Skip if no src
            if (!src) {
                console.log('Skipping image (no src attribute)');
                return;
            }

            // Skip if already an S3 URL (check for common S3 URL patterns)
            // This prevents re-uploading images that are already in S3
            if (src.includes('s3.') || src.includes('amazonaws.com') || src.includes('cloudfront.net')) {
                console.log('Skipping image (already S3 URL):', src.substring(0, 50));
                return;
            }

            // Count base64 images
            if (src.startsWith('data:')) {
                base64Count++;
            }

            // Upload image (base64 or external URL) to S3
            const promise = uploadImageToS3(img, src)
                .then((s3Url) => {
                    if (s3Url) {
                        img.setAttribute('src', s3Url);
                        uploadedCount++;
                        console.log('✓ Image uploaded to S3, replaced src:', {
                            original: src.substring(0, 50),
                            newUrl: s3Url.substring(0, 50)
                        });
                    } else {
                        failedCount++;
                        console.warn('✗ Failed to upload image to S3, keeping original URL:', src.substring(0, 50));
                        // If upload failed and it's base64, we should still try to save it
                        // But ideally we want S3 URLs, so log a warning
                        if (src.startsWith('data:')) {
                            console.error('CRITICAL: Base64 image failed to upload to S3. Image will be saved as base64:', src.substring(0, 100));
                        }
                    }
                })
                .catch((error) => {
                    failedCount++;
                    console.error('✗ Error in image upload promise:', error);
                    if (src.startsWith('data:')) {
                        console.error('CRITICAL: Base64 image upload error. Image will be saved as base64:', src.substring(0, 100));
                    }
                });

            imagePromises.push(promise);
        });

        // Process background images
        elementsWithBgImages.forEach(({ element, bgImage }) => {
            // Skip if already an S3 URL
            if (bgImage.includes('s3.') || bgImage.includes('amazonaws.com') || bgImage.includes('cloudfront.net')) {
                console.log('Skipping background-image (already S3 URL):', bgImage.substring(0, 50));
                return;
            }

            // Count base64 background images
            if (bgImage.startsWith('data:')) {
                base64Count++;
            }

            // Upload background image (base64 or external URL) to S3
            const promise = uploadImageToS3(element, bgImage)
                .then((s3Url) => {
                    if (s3Url) {
                        // Update the style attribute with new S3 URL
                        const currentStyle = element.getAttribute('style') || '';
                        // Replace the background-image URL in the style
                        const updatedStyle = currentStyle.replace(
                            /background-image:\s*url\(['"]?[^'")]+['"]?\)/gi,
                            `background-image: url('${s3Url}')`
                        );
                        // If no background-image was found, add it
                        if (updatedStyle === currentStyle) {
                            element.setAttribute('style', `${currentStyle}; background-image: url('${s3Url}')`.trim());
                        } else {
                            element.setAttribute('style', updatedStyle);
                        }
                        uploadedCount++;
                        console.log('✓ Background image uploaded to S3, replaced style:', {
                            original: bgImage.substring(0, 50),
                            newUrl: s3Url.substring(0, 50)
                        });
                    } else {
                        failedCount++;
                        console.warn('✗ Failed to upload background image to S3, keeping original URL:', bgImage.substring(0, 50));
                        if (bgImage.startsWith('data:')) {
                            console.error('CRITICAL: Base64 background image failed to upload to S3. Image will be saved as base64:', bgImage.substring(0, 100));
                        }
                    }
                })
                .catch((error) => {
                    failedCount++;
                    console.error('✗ Error in background image upload promise:', error);
                    if (bgImage.startsWith('data:')) {
                        console.error('CRITICAL: Base64 background image upload error. Image will be saved as base64:', bgImage.substring(0, 100));
                    }
                });

            imagePromises.push(promise);
        });

        // Process background images in style tags (CSS)
        styleTagBgImages.forEach(({ selector, bgImage, styleTag, fullMatch }) => {
            // Skip if already an S3 URL
            if (bgImage.includes('s3.') || bgImage.includes('amazonaws.com') || bgImage.includes('cloudfront.net')) {
                console.log('Skipping CSS background-image (already S3 URL):', bgImage.substring(0, 50));
                return;
            }

            // Count base64 background images
            if (bgImage.startsWith('data:')) {
                base64Count++;
            }

            // Upload background image (base64 or external URL) to S3
            const promise = uploadImageToS3(styleTag, bgImage)
                .then((s3Url) => {
                    if (s3Url) {
                        // Update the CSS in the style tag
                        const cssContent = styleTag.textContent || '';
                        // Replace the background-image URL in CSS
                        // Handle both background-image: url(...) and background: ... url(...) formats
                        let updatedCss = cssContent;

                        // Replace background-image: url(...)
                        updatedCss = updatedCss.replace(
                            new RegExp(`background-image:\\s*url\\(['"]?${bgImage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]?\\)`, 'gi'),
                            `background-image: url('${s3Url}')`
                        );

                        // Replace background: ... url(...) (shorthand)
                        updatedCss = updatedCss.replace(
                            new RegExp(`background:\\s*([^;]*?)url\\(['"]?${bgImage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]?\\)([^;]*)`, 'gi'),
                            `background: $1url('${s3Url}')$2`
                        );

                        styleTag.textContent = updatedCss;
                        uploadedCount++;
                        console.log('✓ CSS background image uploaded to S3, replaced in style tag:', {
                            selector,
                            original: bgImage.substring(0, 50),
                            newUrl: s3Url.substring(0, 50)
                        });
                    } else {
                        failedCount++;
                        console.warn('✗ Failed to upload CSS background image to S3, keeping original URL:', bgImage.substring(0, 50));
                        if (bgImage.startsWith('data:')) {
                            console.error('CRITICAL: Base64 CSS background image failed to upload to S3. Image will be saved as base64:', bgImage.substring(0, 100));
                        }
                    }
                })
                .catch((error) => {
                    failedCount++;
                    console.error('✗ Error in CSS background image upload promise:', error);
                    if (bgImage.startsWith('data:')) {
                        console.error('CRITICAL: Base64 CSS background image upload error. Image will be saved as base64:', bgImage.substring(0, 100));
                    }
                });

            imagePromises.push(promise);
        });

        // Helper function to escape special regex characters
        // This escapes all characters that have special meaning in regex
        const escapeRegex = (string: string): string => {
            // Escape all special regex characters
            return string.replace(/[.*+?^${}()|[\]\\\/\-]/g, (match) => {
                // Double escape backslashes and forward slashes
                if (match === '\\' || match === '/') {
                    return '\\' + match;
                }
                return '\\' + match;
            });
        };

        // Process background images in CSS content
        cssBgImages.forEach(({ bgImage }) => {
            // Skip if already an S3 URL
            if (bgImage.includes('s3.') || bgImage.includes('amazonaws.com') || bgImage.includes('cloudfront.net')) {
                console.log('Skipping CSS background-image (already S3 URL):', bgImage.substring(0, 50));
                return;
            }

            // Count base64 background images
            if (bgImage.startsWith('data:')) {
                base64Count++;
            }

            // Upload background image (base64 or external URL) to S3
            const promise = uploadImageToS3(document.createElement('div'), bgImage)
                .then((s3Url) => {
                    if (s3Url) {
                        // Replace the background-image URL in CSS using simple string replacement
                        // This avoids regex escaping issues with base64 data

                        // Try different URL formats that might exist in CSS
                        const urlFormats = [
                            `url('${bgImage}')`,
                            `url("${bgImage}")`,
                            `url(${bgImage})`,
                        ];

                        let replaced = false;

                        // First, try exact string replacement for each format
                        for (const urlFormat of urlFormats) {
                            if (processedCss.includes(urlFormat)) {
                                // Replace with the same quote style
                                const quoteChar = urlFormat.includes(`'${bgImage}'`) ? "'" :
                                    urlFormat.includes(`"${bgImage}"`) ? '"' : '';
                                const replacement = quoteChar ? `url(${quoteChar}${s3Url}${quoteChar})` : `url(${s3Url})`;
                                processedCss = processedCss.split(urlFormat).join(replacement);
                                replaced = true;
                                break;
                            }
                        }

                        // If exact match failed, try replacing just the URL part (handles various quote styles)
                        if (!replaced) {
                            // Find all occurrences of the bgImage URL in the CSS
                            // This handles cases where quotes might be different or missing
                            const urlPatterns = [
                                new RegExp(`url\\(['"]?${escapeRegex(bgImage)}['"]?\\)`, 'gi'),
                                new RegExp(`url\\(['"]?${escapeRegex(bgImage.replace(/[\/\\]/g, '\\$&'))}['"]?\\)`, 'gi'),
                            ];

                            for (const pattern of urlPatterns) {
                                try {
                                    if (pattern.test(processedCss)) {
                                        processedCss = processedCss.replace(pattern, `url('${s3Url}')`);
                                        replaced = true;
                                        break;
                                    }
                                } catch (e) {
                                    // Pattern might be invalid, try next one
                                    continue;
                                }
                            }
                        }

                        // Final fallback: direct string replacement (less precise but safer)
                        if (!replaced) {
                            console.warn('Using fallback string replacement for background image');
                            processedCss = processedCss.split(bgImage).join(s3Url);
                        }

                        uploadedCount++;
                        console.log('✓ CSS background image uploaded to S3, replaced in CSS:', {
                            original: bgImage.substring(0, 50),
                            newUrl: s3Url.substring(0, 50),
                            replaced
                        });
                    } else {
                        failedCount++;
                        console.warn('✗ Failed to upload CSS background image to S3, keeping original URL:', bgImage.substring(0, 50));
                        if (bgImage.startsWith('data:')) {
                            console.error('CRITICAL: Base64 CSS background image failed to upload to S3. Image will be saved as base64:', bgImage.substring(0, 100));
                        }
                    }
                })
                .catch((error) => {
                    failedCount++;
                    console.error('✗ Error in CSS background image upload promise:', error);
                    if (bgImage.startsWith('data:')) {
                        console.error('CRITICAL: Base64 CSS background image upload error. Image will be saved as base64:', bgImage.substring(0, 100));
                    }
                });

            imagePromises.push(promise);
        });

        // Wait for all image uploads with timeout
        try {
            await Promise.race([
                Promise.all(imagePromises),
                new Promise<void>((resolve) => {
                    setTimeout(() => {
                        console.warn('Image upload timeout - continuing with available uploads');
                        resolve();
                    }, 60000); // 60 seconds timeout
                })
            ]);
        } catch (error) {
            console.warn('Some images failed to upload:', error);
        }

        if (uploadedCount > 0 || failedCount > 0 || base64Count > 0) {
            console.log(`Image upload complete: ${uploadedCount} uploaded, ${failedCount} failed, ${base64Count} base64 found`);
            if (uploadedCount > 0) {
                toast.success(`${uploadedCount} image${uploadedCount > 1 ? 's' : ''} uploaded to S3`, { duration: 2000 });
            }
            if (failedCount > 0) {
                toast.warning(`${failedCount} image${failedCount > 1 ? 's' : ''} failed to upload`, { duration: 3000 });
            }
        }

        // Return the modified HTML and CSS with S3 URLs (or original if upload failed)
        const finalHtml = tempDiv.innerHTML;
        const hasBase64InFinal = finalHtml.includes('data:image') || processedCss.includes('data:image');
        const hasS3InFinal = finalHtml.includes('s3.') || finalHtml.includes('amazonaws.com') || finalHtml.includes('cloudfront.net') ||
            processedCss.includes('s3.') || processedCss.includes('amazonaws.com') || processedCss.includes('cloudfront.net');

        console.log('Final HTML and CSS status:', {
            hasBase64: hasBase64InFinal,
            hasS3: hasS3InFinal,
            uploadedCount,
            failedCount,
            cssLength: processedCss.length
        });

        if (hasBase64InFinal && !hasS3InFinal && base64Count > 0) {
            console.warn('WARNING: Final HTML/CSS still contains base64 images. S3 upload may have failed for all images.');
        }

        return { html: finalHtml, css: processedCss };
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error('Please enter a template name');
            return;
        }

        // Check if editor is initialized
        if (!editorRef.current) {
            console.error('Editor not initialized when trying to save', {
                isEditorInitialized: isEditorInitialized.current,
                editorRef: !!editorRef.current,
                container: !!editorContainerRef.current,
            });
            toast.error('Editor not initialized. Please wait for the editor to load.');
            return;
        }

        // Verify editor methods exist
        if (typeof editorRef.current.getHtml !== 'function' || typeof editorRef.current.getCss !== 'function') {
            console.error('Editor methods not available', {
                hasGetHtml: typeof editorRef.current.getHtml,
                hasGetCss: typeof editorRef.current.getCss,
            });
            toast.error('Editor methods not available. Please refresh the page.');
            return;
        }

        setIsSaving(true);
        try {
            let htmlContent = editorRef.current.getHtml();
            const cssContent = editorRef.current.getCss();

            console.log('Saving template (before conversion):', {
                hasHtml: !!htmlContent,
                hasCss: !!cssContent,
                htmlLength: htmlContent?.length || 0,
                cssLength: cssContent?.length || 0,
                hasImages: htmlContent?.includes('<img') || false,
            });

            // Upload images to S3 instead of converting to base64
            toast.info('Saving the metadata', { duration: 2000 });
            const { html: processedHtml, css: processedCss } = await uploadImagesToS3(htmlContent, cssContent);
            htmlContent = processedHtml;
            const finalCssContent = processedCss;

            const finalSize = htmlContent.length;
            const sizeMB = (finalSize / 1024 / 1024).toFixed(2);

            console.log('Saving template (after S3 upload):', {
                htmlLength: htmlContent?.length || 0,
                sizeMB: sizeMB,
                hasS3Images: htmlContent?.includes('amazonaws.com') || htmlContent?.includes('cloudfront.net') || htmlContent?.includes('s3.') || false,
                hasBase64Images: htmlContent?.includes('data:image') || false,
            });

            // Warn if content is very large, but still allow saving for email templates
            if (finalSize > 10 * 1024 * 1024) { // 10MB
                const errorMsg = `Template content is very large (${sizeMB}MB). The server may reject it. Consider optimizing images.`;
                console.warn(errorMsg);
                toast.warning(errorMsg, { duration: 5000 });
            }

            // Build complete HTML document structure for email
            // This creates a full HTML document that can be sent as-is in emails
            const completeHtmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>${formData.name || 'Email Template'}</title>
    ${finalCssContent ? `<style type="text/css">${finalCssContent}</style>` : ''}
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff;">
    ${htmlContent}
</body>
</html>`;

            // Use complete HTML document for variable extraction and storage
            const finalContent = completeHtmlDocument;

            // Extract variables from content and subject
            const contentVariables = extractVariablesFromContent(finalContent);
            const subjectVariables = formData.subject
                ? extractVariablesFromContent(formData.subject)
                : [];
            // Combine and deduplicate variables
            const allVariableNames = [...new Set([...contentVariables, ...subjectVariables])];
            // Convert to full variable format with {{ }}
            const variables = allVariableNames.map((name) => `{{${name}}}`);

            const templateData: CreateTemplateRequest = {
                name: formData.name,
                type: formData.type,
                subject: formData.subject,
                content: finalContent,
                variables: variables,
                isDefault: formData.isDefault,
                templateType: formData.templateType,
            };

            if (templateId && template) {
                await updateMessageTemplate({
                    id: templateId,
                    ...templateData,
                });
                // Clear cache to force refresh
                templateCacheService.clearCache(formData.type);
                toast.success('Template updated successfully!');
            } else {
                await createMessageTemplate(templateData);
                // Clear cache to force refresh
                templateCacheService.clearCache(formData.type);
                toast.success('Template created successfully!');
            }

            // Navigate back to settings
            navigate({ to: '/settings', search: { selectedTab: 'templates' } });
        } catch (error: any) {
            console.error('Error saving template:', error);
            const errorMessage = error?.message || error?.toString() || 'Unknown error';
            console.error('Full error details:', {
                error,
                message: errorMessage,
                stack: error?.stack,
            });

            // Show more detailed error message
            const userMessage = errorMessage.includes('401') || errorMessage.includes('Unauthorized')
                ? 'Authentication failed. Please login again.'
                : errorMessage.includes('403') || errorMessage.includes('Forbidden')
                    ? 'You do not have permission to save templates.'
                    : errorMessage.includes('400') || errorMessage.includes('Bad Request')
                        ? `Invalid data: ${errorMessage}`
                        : templateId
                            ? `Failed to update template: ${errorMessage}`
                            : `Failed to create template: ${errorMessage}`;

            toast.error(userMessage);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        navigate({ to: '/settings', search: { selectedTab: 'templates' } });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen w-screen bg-background">
                <Loader2 className="size-6 animate-spin" />
                <span className="ml-2">Loading template...</span>
            </div>
        );
    }

    return (
        <div className="w-screen h-screen bg-background overflow-hidden flex flex-col">
            {/* Form Section - Above Editor with matching background - Compact Single Line */}
            <div className="mx-4 mt-4 mb-0 bg-[#f8f9fa] border border-gray-200 rounded-t-lg px-3 py-2 flex-shrink-0">
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Template Name */}
                    <div className="flex items-center gap-1.5 min-w-[180px]">
                        <Label htmlFor="name" className="text-xs text-gray-600 whitespace-nowrap">Name *</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Template name"
                            className="h-7 text-xs bg-white flex-1"
                        />
                    </div>

                    {/* Type */}
                    <div className="flex items-center gap-1.5 min-w-[120px]">
                        <Label htmlFor="type" className="text-xs text-gray-600 whitespace-nowrap">Type</Label>
                        <Select
                            value={formData.type}
                            onValueChange={(value: 'EMAIL' | 'WHATSAPP') =>
                                setFormData({ ...formData, type: value })
                            }
                        >
                            <SelectTrigger id="type" className="h-7 text-xs bg-white">
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
                        <div className="flex items-center gap-1.5 min-w-[180px]">
                            <Label htmlFor="subject" className="text-xs text-gray-600 whitespace-nowrap">Subject</Label>
                            <Input
                                id="subject"
                                value={formData.subject}
                                onChange={(e) =>
                                    setFormData({ ...formData, subject: e.target.value })
                                }
                                placeholder="Email subject"
                                className="h-7 text-xs bg-white flex-1"
                            />
                        </div>
                    )}

                    {/* Template Type */}
                    <div className="flex items-center gap-1.5 min-w-[140px]">
                        <Label htmlFor="templateType" className="text-xs text-gray-600 whitespace-nowrap">Category</Label>
                        <Select
                            value={formData.templateType}
                            onValueChange={(value: 'marketing' | 'utility' | 'transactional') =>
                                setFormData({ ...formData, templateType: value })
                            }
                        >
                            <SelectTrigger id="templateType" className="h-7 text-xs bg-white">
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
                    <div className="flex items-center gap-1.5">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onMouseDown={(e) => {
                                            // Capture cursor position BEFORE focus is lost
                                            e.preventDefault(); // Prevent focus stealing if possible
                                            openVariablesDialog();
                                        }}
                                        onClick={(e) => e.preventDefault()} // Handle in MouseDown
                                        className="h-7 w-7 p-0 bg-white hover:bg-gray-100"
                                    >
                                        <Info className="size-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>View available template variables</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="h-7 px-2 text-xs"
                        >
                            {isSaving ? (
                                <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                                <Save className="size-3.5" />
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancel}
                            className="h-7 w-7 p-0 bg-white hover:bg-gray-100"
                        >
                            <X className="size-3.5" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* GrapesJS Editor - Full Viewport Height with Scrollable Canvas */}
            <div
                className="border border-gray-200 border-t-0 mx-4 mb-4 rounded-b-lg bg-white flex-1 min-h-0"
                style={{
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <style>{`
                    /* Ensure GrapesJS editor fills container */
                    #gjs {
                        height: 100% !important;
                        width: 100% !important;
                        flex: 1 !important;
                        min-height: 0 !important;
                        display: flex !important;
                        flex-direction: column !important;
                    }
                    
                    /* Ensure GrapesJS main container fills space */
                    .gjs-editor {
                        height: 100% !important;
                        display: flex !important;
                        flex-direction: column !important;
                        flex: 1 !important;
                    }
                    
                    /* Ensure GrapesJS canvas wrapper fills available space */
                    .gjs-cv-canvas {
                        flex: 1 !important;
                        min-height: 0 !important;
                        height: 100% !important;
                        overflow-y: auto !important;
                        overflow-x: hidden !important;
                        display: flex !important;
                        flex-direction: column !important;
                    }
                    
                    /* Make canvas frame container always full width - centers the iframe preview */
                    .gjs-frame {
                        flex: 1 !important;
                        min-height: 100% !important;
                        height: auto !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        display: flex !important;
                        justify-content: center !important;
                        align-items: flex-start !important;
                    }
                    
                    /* Iframe can be constrained to device width, but frame container stays 100% */
                    .gjs-frame iframe {
                        min-height: 100% !important;
                        height: auto !important;
                        display: block !important;
                        /* Width is set dynamically by device change handler */
                        /* Default to 100% for desktop, constrained for mobile/tablet */
                    }
                    
                    /* Enable proper dragging for components */
                    .gjs-comp-selected {
                        outline: 2px solid #3b82f6 !important;
                        outline-offset: 2px !important;
                    }
                    
                    /* Ensure toolbar buttons work */
                    .gjs-toolbar-item {
                        cursor: pointer !important;
                    }
                    
                    /* Fix for move button */
                    .gjs-toolbar-item[title*="Move"] {
                        pointer-events: auto !important;
                    }
                    
                    /* Resize handles styling - all corners and edges */
                    .gjs-resizer {
                        border: 2px solid #3b82f6 !important;
                        background: #3b82f6 !important;
                        width: 8px !important;
                        height: 8px !important;
                        z-index: 1000 !important;
                    }
                    
                    /* Horizontal edges (left and right) */
                    .gjs-resizer-h,
                    .gjs-resizer-cl,
                    .gjs-resizer-cr {
                        cursor: ew-resize !important;
                    }
                    
                    /* Vertical edges (top and bottom) */
                    .gjs-resizer-v,
                    .gjs-resizer-tc,
                    .gjs-resizer-bc {
                        cursor: ns-resize !important;
                    }
                    
                    /* Diagonal corners */
                    .gjs-resizer-tl {
                        cursor: nwse-resize !important;
                    }
                    
                    .gjs-resizer-tr {
                        cursor: nesw-resize !important;
                    }
                    
                    .gjs-resizer-bl {
                        cursor: nesw-resize !important;
                    }
                    
                    .gjs-resizer-br {
                        cursor: nwse-resize !important;
                    }
                    
                    /* Enable resize for table cells and tables */
                    .gjs-comp-selected[data-email-cell],
                    .gjs-comp-selected table,
                    .gjs-comp-selected[data-gjs-type="table"] {
                        position: relative !important;
                    }
                    
                    /* Show resize handles */
                    .gjs-comp-selected .gjs-resizer {
                        opacity: 1 !important;
                        visibility: visible !important;
                        display: block !important;
                    }
                    
                    /* Ensure resizers are visible and clickable */
                    .gjs-resizer:hover {
                        background: #2563eb !important;
                        border-color: #2563eb !important;
                    }
                `}</style>
                <div id="gjs" ref={editorContainerRef} style={{ height: '100%', width: '100%', flex: 1 }} />
            </div>

            {/* Variables Dialog */}
            {/* Variables Dialog */}
            <VariablesDialog
                open={showVariablesDialog}
                onOpenChange={handleDialogClose}
                onVariableSelect={handleVariableSelect}
            />
        </div>
    );
};

