import { useEffect, useRef } from 'react';
import type { Editor } from 'grapesjs';

interface UseGrapesJSEditorProps {
    containerId: string;
    onReady?: (editor: Editor) => void;
    templateContent?: string;
}

export const useGrapesJSEditor = ({
    containerId,
    onReady,
    templateContent
}: UseGrapesJSEditorProps) => {
    const editorRef = useRef<Editor | null>(null);
    const isEditorInitialized = useRef(false);

    useEffect(() => {
        const editorContainer = document.getElementById(containerId);
        if (!editorContainer || isEditorInitialized.current) return;

        let isMounted = true;

        const initGrapesJS = async () => {
            try {
                if (!isMounted || !editorContainer) return;

                // Dynamic imports for GrapesJS
                const [grapesjsModule, presetNewsletterModule] = await Promise.all([
                    import('grapesjs'),
                    import('grapesjs-preset-newsletter'),
                    import('grapesjs/dist/css/grapes.min.css'),
                ]);

                if (!isMounted || isEditorInitialized.current) return;

                const grapesjs = grapesjsModule.default || grapesjsModule;
                const presetNewsletter = presetNewsletterModule.default || presetNewsletterModule;

                const editor = grapesjs.init({
                    container: `#${containerId}`,
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
                            { id: 'desktop', name: 'Desktop', width: '' },
                            { id: 'tablet', name: 'Tablet', width: '768px', widthMedia: '992px' },
                            { id: 'mobile', name: 'Mobile', width: '320px', widthMedia: '768px' },
                        ],
                    },
                    layerManager: {
                        multipleSelection: false,
                    } as any,
                    plugins: [presetNewsletter],
                    pluginsOpts: {
                        [presetNewsletter as unknown as string]: {
                            modalImportTitle: '',
                            modalImportLabel: '',
                        },
                    },
                });

                editorRef.current = editor;
                isEditorInitialized.current = true;

                // Load template content if provided
                if (templateContent) {
                    editor.on('load', () => {
                        setTimeout(() => {
                            editor.setComponents(templateContent);
                        }, 100);
                    });
                }

                // Call onReady callback
                if (onReady) {
                    onReady(editor);
                }
            } catch (error) {
                if (isMounted) {
                    console.error('Error loading GrapesJS:', error);
                }
            }
        };

        initGrapesJS();

        return () => {
            isMounted = false;
            if (editorRef.current) {
                try {
                    editorRef.current.destroy();
                } catch (error) {
                    console.error('Error destroying editor:', error);
                }
                editorRef.current = null;
                isEditorInitialized.current = false;
            }
        };
    }, [containerId, templateContent]);

    return editorRef;
};
