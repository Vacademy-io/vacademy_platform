import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';
import { getInstituteId } from '@/constants/helper';
import { hasFacultyAssignedPermission } from '@/lib/auth/facultyAccessUtils';
/* eslint-disable */
import { createYooptaEditor } from '@yoopta/editor';
import React, { useEffect, useMemo, useRef, useCallback, type ChangeEvent, Suspense } from 'react';
const YooptaEditorWrapper = React.lazy(() => import('./YooptaEditorWrapper').then(module => ({ default: module.YooptaEditorWrapper })));
import '../excalidraw-z-index-fix.css';
import { MyButton } from '@/components/design-system/button';
const PDFViewer = React.lazy(() => import('./pdf-viewer'));
import { ActivityStatsSidebar } from './stats-dialog/activity-sidebar';
import { useContentStore } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-stores/chapter-sidebar-store';
import { EmptySlideMaterial } from '@/assets/svgs';
import { useState } from 'react';
import { html } from '@yoopta/exports';
import { SlidesMenuOption } from './slides-menu-options/slides-menu-option';
import { plugins, TOOLS, MARKS } from '@/constants/study-library/yoopta-editor-plugins-tools';
import { useRouter } from '@tanstack/react-router';
import { getPublicUrl } from '@/services/upload_file';
import { PublishDialog } from './publish-slide-dialog';
import { UnpublishDialog } from './unpublish-slide-dialog';
import {
    Slide,
    useSlidesMutations,
} from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-hooks/use-slides';
import { toast } from 'sonner';
import { Check, DownloadSimple, PencilSimpleLine, Trash, FloppyDisk } from '@phosphor-icons/react';
import { AlertCircle } from 'lucide-react';
import {
    converDataToAssignmentFormat,
    converDataToVideoFormat,
    convertToQuestionBackendSlideFormat,
} from '../-helper/helper';
import { StudyLibraryQuestionsPreview } from './questions-preview';
import StudyLibraryAssignmentPreview from './assignment-preview';
import VideoSlidePreview from './video-slide-preview';
import AudioSlidePreview from './audio-slide-preview';
import { handlePublishSlide } from './slide-operations/handlePublishSlide';
import { handleUnpublishSlide } from './slide-operations/handleUnpublishSlide';
import { updateHeading } from './slide-operations/updateSlideHeading';
import { formatHTMLString, stripAwsQueryParamsFromUrls } from './slide-operations/formatHtmlString';
import { handleConvertAndUpload } from './slide-operations/handleConvertUpload';
const SlideEditor = React.lazy(() => import('./SlideEditor'));
import type { JSX } from 'react/jsx-runtime';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import DoubtResolutionSidebar from './doubt-resolution/doubtResolutionSidebar';
import { ChatCircleDots } from '@phosphor-icons/react';
import { useSidebar } from '@/components/ui/sidebar';
import { JupyterNotebookSlide } from './jupyter-notebook-slide';
import { ScratchProjectSlide } from './scratch-project-slide';
import { CodeEditorSlide } from './code-editor-slide';
import { SplitScreenSlide } from './split-screen-slide';
import { getTokenFromCookie, getTokenDecodedData, getUserRoles } from '@/lib/auth/sessionUtility';
import { UploadFileInS3 } from '@/services/upload_file';
import { TokenKey } from '@/constants/auth/tokens';
import QuizPreview from './QuizPreview';
import { createQuizSlidePayload } from './quiz/utils/api-helpers';
import { getDisplaySettings, getDisplaySettingsFromCache } from '@/services/display-settings';
import {
    ADMIN_DISPLAY_SETTINGS_KEY,
    TEACHER_DISPLAY_SETTINGS_KEY, CUSTOM_ROLE_DISPLAY_SETTINGS_KEY,
    type DisplaySettingsData,
} from '@/types/display-settings';
import { processHtmlImages, containsBase64Images, getBase64ImagesSize } from '@/utils/image-processing';

/** Check if HTML content is effectively empty (shared across editor components). */
function checkIsHtmlEmpty(data: string | null): boolean {
    if (!data) return true;
    const textContent = data
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (textContent === '' || textContent.length === 0) return true;
    const trimmed = data.trim();
    return (
        trimmed === '<html><head></head><body><div></div></body></html>' ||
        trimmed === '<div></div>' ||
        trimmed === '<p></p>' ||
        trimmed === '<br>' ||
        trimmed === '<br/>' ||
        /^<p><br><\/p>$/.test(trimmed) ||
        /^<div><br><\/div>$/.test(trimmed)
    );
}

/** Lightweight page count estimation from HTML (replaces expensive jspdf+html2canvas render). */
function estimatePageCount(htmlString: string): number {
    try {
        const tmp = document.createElement('div');
        tmp.innerHTML = htmlString;
        tmp.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:210mm;padding:10mm;visibility:hidden;';
        document.body.appendChild(tmp);
        const h = tmp.scrollHeight;
        document.body.removeChild(tmp);
        // A4 at ~96dpi ≈ 1123px; use 1050 to account for margins
        return Math.max(1, Math.ceil(h / 1050));
    } catch {
        return 1;
    }
}
import ScormSlidePreview from './scorm-slide-preview';


export const SlideMaterial = ({
    setGetCurrentEditorHTMLContent,
    setSaveDraft,
    isLearnerView = false,
    hidePublishButtons = false,
    customSaveFunction,
}: {
    setGetCurrentEditorHTMLContent: (fn: () => string) => void;
    setSaveDraft: (fn: (activeItem: Slide) => Promise<void>) => void;
    isLearnerView?: boolean;
    hidePublishButtons?: boolean;
    customSaveFunction?: (slide: Slide) => Promise<void>;
}) => {
    // Role display settings for toggles like Manage Doubts visibility
    const [roleDisplay, setRoleDisplay] = useState<DisplaySettingsData | null>(null);
    useEffect(() => {
        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        const roles = getUserRoles(accessToken);
        const isAdmin = roles.includes('ADMIN');
        const hasFaculty = hasFacultyAssignedPermission(getInstituteId());
    const roleKey = getActiveRoleDisplaySettingsKey();
        const cached = getDisplaySettingsFromCache(roleKey);
        if (cached) {
            setRoleDisplay(cached);
            return;
        }
        getDisplaySettings(roleKey)
            .then(setRoleDisplay)
            .catch(() => setRoleDisplay(null));
    }, []);

    const showManageDoubts = useMemo(() => {
        const tab = roleDisplay?.sidebar.find((t) => t.id === 'study-library');
        const sub = tab?.subTabs?.find((s) => s.id === 'doubt-management');
        return sub?.visible !== false;
    }, [roleDisplay]);
    const { items, activeItem, setActiveItem } = useContentStore();
    const editor = useMemo(() => createYooptaEditor(), []);
    const selectionRef = useRef<HTMLDivElement | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [slideTitle, setSlideTitle] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const [heading, setHeading] = useState(slideTitle);
    const router = useRouter();
    const [content, setContent] = useState<JSX.Element | null>(null);
    const isAutoSavingRef = useRef(false);
    const getCurrentExcalidrawStateRef = useRef<
        (() => { elements: any[]; appState: any; files: any }) | null
    >(null);
    const isExcalidrawBusyRef = useRef(false); // Track if Excalidraw is performing intensive operations
    const pendingStateUpdateRef = useRef<any>(null); // Store pending state updates
    const stableKeyRef = useRef<string>(''); // Stable key during operations
    // Track previous DOC slide and its initial HTML for change detection
    const prevDocSlideRef = useRef<Slide | null>(null);
    const initialDocHtmlRef = useRef<{ slideId: string | null; html: string }>({
        slideId: null,
        html: '',
    });
    // Always-current editor HTML for DOC (updated on every change, not persisted to store)
    const currentDocHtmlRef = useRef<string>('');
    // Dedup guard to prevent double-save on add + switch happening together
    const lastHandledPrevSlideIdRef = useRef<string | null>(null);

    const searchParams = router.state.location.search;
    const { courseId, levelId, chapterId, slideId, moduleId, subjectId, sessionId } = searchParams;

    const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
    const [isUnpublishDialogOpen, setIsUnpublishDialogOpen] = useState(false);
    const { getPackageSessionId } = useInstituteDetailsStore();
    const { setOpen: setSidebarOpen } = useSidebar();
    const { addUpdateDocumentSlide, addUpdateQuizSlide, addUpdateAudioSlide, addUpdateScormSlide } = useSlidesMutations(
        chapterId || '',
        moduleId || '',
        subjectId || '',
        getPackageSessionId({
            courseId: courseId || '',
            levelId: levelId || '',
            sessionId: sessionId || '',
        }) || ''
    );
    const { addUpdateVideoSlide } = useSlidesMutations(
        chapterId || '',
        moduleId || '',
        subjectId || '',
        getPackageSessionId({
            courseId: courseId || '',
            levelId: levelId || '',
            sessionId: sessionId || '',
        }) || ''
    );
    const { updateQuestionOrder } = useSlidesMutations(
        chapterId || '',
        moduleId || '',
        subjectId || '',
        getPackageSessionId({
            courseId: courseId || '',
            levelId: levelId || '',
            sessionId: sessionId || '',
        }) || ''
    );
    const { updateAssignmentOrder } = useSlidesMutations(
        chapterId || '',
        moduleId || '',
        subjectId || '',
        getPackageSessionId({
            courseId: courseId || '',
            levelId: levelId || '',
            sessionId: sessionId || '',
        }) || ''
    );

    const handleHeadingChange = (e: ChangeEvent<HTMLInputElement>) => {
        setHeading(e.target.value);
    };

    // Component to manage editor with placeholder
    const EditorWithPlaceholder = ({ initialIsEmpty }: { initialIsEmpty: boolean }) => {
        const [showPlaceholder, setShowPlaceholder] = useState(initialIsEmpty);
        const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

        useEffect(() => {
            setShowPlaceholder(initialIsEmpty);
        }, [initialIsEmpty]);

        // Check emptiness from Yoopta JSON structure (no serialization needed)
        const checkIsEmptyFromEditor = (): boolean => {
            try {
                const children = editor.children;
                if (!children || typeof children !== 'object') return true;
                const blocks = Object.values(children);
                if (blocks.length === 0) return true;
                // A single paragraph block with only empty text is "empty"
                if (blocks.length === 1) {
                    const block = blocks[0] as any;
                    const vals = block?.value;
                    if (Array.isArray(vals) && vals.length === 1) {
                        const child = vals[0];
                        const textChildren = child?.children;
                        if (Array.isArray(textChildren) && textChildren.length === 1) {
                            const text = textChildren[0]?.text;
                            return !text || text.trim() === '';
                        }
                    }
                }
                return false;
            } catch {
                return false;
            }
        };

        return (
            <div className="relative w-full">
                {showPlaceholder && (
                    <div
                        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-gray-400"
                        style={{ top: '20px' }}
                    >
                        <span className="text-lg">Click to start writing here...</span>
                    </div>
                )}
                <Suspense
                    fallback={
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                        </div>
                    }
                >
                    <YooptaEditorWrapper
                        editor={editor}
                        plugins={plugins}
                        tools={TOOLS}
                        marks={MARKS}
                        value={editor.children}
                        selectionBoxRoot={selectionRef}
                        autoFocus={true}
                        onChange={() => {
                            // Check emptiness from JSON structure (instant, no serialization)
                            setShowPlaceholder(checkIsEmptyFromEditor());

                            // Debounce the expensive html.serialize for unsaved-change tracking
                            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                            debounceTimerRef.current = setTimeout(() => {
                                try {
                                    const currentContent = html.serialize(editor, editor.children);
                                    currentDocHtmlRef.current = formatHTMLString(currentContent || '');
                                } catch (error) {
                                    console.error('Error serializing content in onChange:', error);
                                }
                            }, 500);
                        }}
                        className="size-full"
                        style={{ width: '100%', height: '100%', minHeight: '200px' }}
                    />
                </Suspense>
            </div>
        );
    };

    const setEditorContent = () => {
        // Ensure plugins and blocks are registered on the editor BEFORE
        // calling html.deserialize.  On a fresh page load the YooptaEditor
        // component hasn't mounted yet so editor.plugins / editor.blocks are
        // still empty — the deserializer would silently drop every block.
        if (!editor.plugins || Object.keys(editor.plugins).length === 0) {
            const pluginDefs = plugins.map((p: any) =>
                typeof p.getPlugin === 'object' ? p.getPlugin : p,
            );

            // Build plugins map  (type → full plugin config)
            const pluginsMap: Record<string, any> = {};
            const inlineElements: Record<string, any> = {};
            pluginDefs.forEach((p: any) => {
                if (!p?.type) return;
                if (p.elements) {
                    Object.keys(p.elements).forEach((key: string) => {
                        const el = p.elements[key];
                        const nt = el?.props?.nodeType;
                        if (nt === 'inline' || nt === 'inlineVoid') {
                            inlineElements[key] = { ...el, rootPlugin: p.type };
                        }
                    });
                }
                pluginsMap[p.type] = p;
            });
            // Merge inline elements into every plugin (mirrors YooptaEditor init)
            pluginDefs.forEach((p: any) => {
                if (p?.elements) {
                    pluginsMap[p.type] = {
                        ...p,
                        elements: { ...p.elements, ...inlineElements },
                    };
                }
            });
            (editor as any).plugins = pluginsMap;

            // Build blocks map  (type → { type, elements (sans render), … })
            const blocksMap: Record<string, any> = {};
            pluginDefs.forEach((p: any) => {
                if (!p?.type || !p.elements) return;
                const rootKey = Object.keys(p.elements)[0];
                const rootEl = rootKey ? p.elements[rootKey] : undefined;
                const nodeType = rootEl?.props?.nodeType;
                if (nodeType === 'inline' || nodeType === 'inlineVoid') return;

                const elements: Record<string, any> = {};
                Object.keys(p.elements).forEach((key: string) => {
                    const { render: _render, ...rest } = p.elements[key] || {};
                    elements[key] = rest;
                });
                blocksMap[p.type] = {
                    type: p.type,
                    elements,
                    hasCustomEditor: !!p.customEditor,
                    options: p.options || {},
                };
            });
            (editor as any).blocks = blocksMap;
        }

        const docData =
            activeItem?.status == 'PUBLISHED'
                ? activeItem.document_slide?.published_data || null
                : activeItem?.document_slide?.data || null;

        // Sanitize any public S3 URLs that may contain expired signatures
        let sanitizedDocData = stripAwsQueryParamsFromUrls(docData || '');

        // Check if content contains mermaid diagrams - they need preserved newlines
        const hasMermaid = sanitizedDocData.includes('class="mermaid"') || sanitizedDocData.includes("class='mermaid'");

        // Extract inner content from full HTML documents (removes DOCTYPE, html, head, body wrappers)
        let contentForDeserialization = sanitizedDocData || '';

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(contentForDeserialization, 'text/html');

            // Get body element and its inner HTML
            if (doc.body) {
                // Unwrap media/semantic elements from wrapper divs so Yoopta
                // deserializers can find them by nodeName (IFRAME, VIDEO, IMG, A).
                // Each plugin serializes as <div style="..."><element/></div>
                // but the deserializer looks for the bare element.
                const unwrapFromDiv = (el: Element) => {
                    const parent = el.parentElement;
                    if (parent && parent.tagName === 'DIV') {
                        const fragment = document.createDocumentFragment();
                        while (parent.firstChild) {
                            fragment.appendChild(parent.firstChild);
                        }
                        if (parent.parentNode) {
                            parent.parentNode.replaceChild(fragment, parent);
                        }
                    }
                };

                doc.body.querySelectorAll('iframe').forEach(unwrapFromDiv);
                doc.body.querySelectorAll('video').forEach(unwrapFromDiv);
                doc.body.querySelectorAll('img').forEach(unwrapFromDiv);
                doc.body.querySelectorAll('a[download]').forEach(unwrapFromDiv);

                contentForDeserialization = doc.body.innerHTML.trim();

                // Recursively unwrap divs until we get to actual content
                // Yoopta needs semantic content like p, h1, a etc., not nested divs
                const wrapper = document.createElement('div');
                wrapper.innerHTML = contentForDeserialization;

                // Keep unwrapping single-child divs (but stop if div has
                // mermaid class or data-yoopta-type — those are content blocks)
                let current: Element = wrapper;
                while (current.children.length === 1) {
                    const firstChild = current.children[0];
                    if (
                        firstChild &&
                        firstChild.tagName === 'DIV' &&
                        !firstChild.classList.contains('mermaid') &&
                        !firstChild.hasAttribute('data-yoopta-type')
                    ) {
                        current = firstChild;
                    } else {
                        break;
                    }
                }

                // Get the final inner content
                contentForDeserialization = current.innerHTML.trim();

            }
        } catch (e) {
            console.error('Error parsing HTML for Yoopta:', e);
        }

        const rawEditorContent = html.deserialize(editor, contentForDeserialization || '');

        const processNode = (node: any): any => {
            const newNode = { ...node };
            // Check if node is Embed, Video, File, or Link type
            if (['Embed', 'Video', 'File', 'Link', 'embed', 'video', 'file', 'link'].includes(newNode.type)) {
                if (!newNode.data) {
                    newNode.data = { url: '', src: '' };
                }
                // Ensure url is populated (Yoopta sometimes expects url, sometimes src depending on version/plugin)
                if (!newNode.data.url && newNode.data.src) {
                    newNode.data.url = newNode.data.src;
                }
                if (!newNode.data.src && newNode.data.url) {
                    newNode.data.src = newNode.data.url;
                }
                // Fallbacks
                if (newNode.data.url === undefined) newNode.data.url = '';
                if (newNode.data.src === undefined) newNode.data.src = '';

                // For File blocks, ensure name is present and clean
                if (['File', 'file'].includes(newNode.type)) {
                    let name = newNode.data.name;

                    // 1. If name is missing, try to extract from src/url
                    if (!name) {
                        const src = newNode.data.src || newNode.data.url;
                        if (src) {
                            try {
                                const urlObj = new URL(src);
                                const parts = urlObj.pathname.split('/');
                                name = parts[parts.length - 1];
                            } catch (e) {
                                // If not a valid URL, try simple split
                                const parts = src.split('/');
                                name = parts[parts.length - 1];
                            }
                        }
                        if (!name) {
                            name = 'Attachment';
                        }
                    }

                    // 2. Clean up the name
                    if (name && typeof name === 'string') {
                        // Decode URI components (e.g. %20 -> space)
                        try {
                            name = decodeURIComponent(name);
                        } catch (e) {
                            // ignore error
                        }

                        // Remove common MIME type suffixes that might be appended (e.g. .application/pdf)
                        // This regex matches .type/subtype at the end of the string
                        name = name.replace(/\.(application|image|text|video|audio|font|model)\/[\w\.\-\+]+$/, '');

                        // Also remove generated timestamp prefixes if customary (optional, based on observation)
                        // name = name.replace(/^\d+-/, '');

                        newNode.data.name = name;
                    }
                }
            }

            if (newNode.children && Array.isArray(newNode.children)) {
                newNode.children = newNode.children.map(processNode);
            }
            return newNode;
        };

        // Sanitize nodes to ensure mandatory properties (like url for Embed/Video/File) exist to prevent crashes
        const sanitizeNodes = (content: any): any => {
            // Handle Yoopta Map structure (Record<string, Block>)
            if (content && typeof content === 'object' && !Array.isArray(content)) {
                const newContent: Record<string, any> = {};
                Object.keys(content).forEach((key) => {
                    newContent[key] = processNode(content[key]);
                });
                return newContent;
            }
            // Fallback for arrays (e.g. if structure changes or for children processing)
            if (Array.isArray(content)) {
                return content.map(processNode);
            }
            return content;
        };

        const editorContent = sanitizeNodes(rawEditorContent);

        // Fix Embed/Video provider.type & provider.id after deserialization.
        // The @yoopta/embed deserializer sets provider.type to the hostname
        // (e.g. "www.youtube.com") and provider.id to the full URL, but the
        // render component looks up by short name ("youtube", "vimeo", …).
        // The @yoopta/video deserializer doesn't reconstruct provider at all,
        // so we detect provider from the src URL and add it back.
        if (editorContent && typeof editorContent === 'object') {
            Object.values(editorContent).forEach((block: any) => {
                if (block?.type !== 'Embed' && block?.type !== 'Video') return;
                const el = block?.value?.[0];
                if (!el?.props) return;

                // For Video blocks, reconstruct provider from src if missing
                if (block.type === 'Video' && !el.props.provider?.url && el.props.src) {
                    el.props.provider = { type: null, id: '', url: el.props.src };
                }

                const prov = el.props.provider;
                if (!prov?.url) return;
                const url = prov.url;
                const detect: [string, RegExp][] = [
                    ['youtube', /(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([^?&#]+)/],
                    ['vimeo', /vimeo\.com(?:\/video)?\/(\d+)/],
                    ['dailymotion', /dailymotion\.com\/(?:embed\/)?video\/([^_?&#]+)/],
                    ['loom', /loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/],
                    ['wistia', /wistia\.(?:com|net)\/(?:embed\/iframe|medias)\/([a-zA-Z0-9]+)/],
                    ['figma', /figma\.com/],
                    ['twitter', /(?:twitter\.com|x\.com)\/.*\/status\/(\d+)/],
                    ['instagram', /instagram\.com\/(?:p|reel|tv)\/([^\/?#&]+)/],
                ];
                for (const [name, re] of detect) {
                    const m = url.match(re);
                    if (m) {
                        prov.type = name;
                        prov.id = m[1] || url;
                        break;
                    }
                }
            });
        }

        editor.setEditorValue(editorContent);

        // Check if content is empty - use shared utility
        const isEmpty = checkIsHtmlEmpty(sanitizedDocData);

        setContent(<EditorWithPlaceholder initialIsEmpty={isEmpty} />);
        // Delay focus until after React re-renders the DOM with the new editor state.
        // Calling editor.focus() synchronously after setEditorValue causes
        // "Cannot resolve a DOM node from Slate node" because the DOM hasn't updated yet.
        setTimeout(() => {
            try {
                editor.focus();
            } catch (e) {
                // Suppress focus errors — editor will still be functional
                console.warn('Editor focus failed (DOM not ready):', e);
            }
        }, 100);

        // Capture initial HTML for DOC slides to detect unsaved changes later.
        // IMPORTANT: We must capture AFTER Yoopta has loaded the content, because
        // html.deserialize → html.serialize is NOT a lossless round-trip.
        // If we compare raw stored HTML against Yoopta's serialized output, they
        // will always differ even with zero user edits → false positive dialog.
        if (
            activeItem?.source_type === 'DOCUMENT' &&
            activeItem?.document_slide?.type === 'DOC'
        ) {
            prevDocSlideRef.current = activeItem;
            // Use a short delay so Yoopta finishes rendering before we snapshot
            setTimeout(() => {
                const editorHtml = getCurrentEditorHTMLContent();
                initialDocHtmlRef.current = { slideId: activeItem.id, html: editorHtml };
                currentDocHtmlRef.current = editorHtml;
            }, 300);
        }
    };

    const getCurrentEditorHTMLContent: () => string = () => {
        const data = editor.getEditorValue();
        let htmlString = '';
        try {
            htmlString = html.serialize(editor, data);
        } catch (error) {
            console.error('Error serializing content in getCurrentEditorHTMLContent:', error);
            // Return empty string or perhaps the last known good state?
            // For now, empty string is safer than crashing
            return '';
        }
        const formattedHtmlString = formatHTMLString(htmlString);

        return formattedHtmlString;
    };

    // Unified handler to check and handle unsaved DOC changes for the previous slide
    const handleUnsavedDocIfNeeded = useCallback(() => {
        const previous = prevDocSlideRef.current;
        if (
            !previous ||
            previous.source_type !== 'DOCUMENT' ||
            previous.document_slide?.type !== 'DOC'
        ) {
            return;
        }

        // Skip if the previous slide is deleted or no longer exists (use fresh store snapshot)
        const itemsNow = useContentStore.getState().items as unknown as Slide[] | undefined;
        const stillExists = Array.isArray(itemsNow) && itemsNow.some((s) => s.id === previous.id);
        const deletedInStore = Array.isArray(itemsNow)
            ? itemsNow.find((s) => s.id === previous.id)?.status === 'DELETED'
            : false;
        if (previous.status === 'DELETED' || deletedInStore || !stillExists) {
            return;
        }

        // Deduplicate by slide id; if we already handled this previous slide recently, skip
        if (lastHandledPrevSlideIdRef.current === previous.id) {
            return;
        }

        const initialHtml =
            initialDocHtmlRef.current.slideId === previous.id
                ? initialDocHtmlRef.current.html
                : getCurrentEditorHTMLContent();
        // Always read latest editor state at the moment of handling to avoid stale saves
        const currentHtml = getCurrentEditorHTMLContent() || initialHtml;
        const hasEditorChanged = currentHtml !== initialHtml;

        // Only act if the user actually changed something in the editor
        if (!hasEditorChanged) {
            return;
        }

        // Mark as handled to avoid duplicate calls during add+switch cascades
        lastHandledPrevSlideIdRef.current = previous.id;

        // Always auto-save draft on slide switch — never show a blocking dialog
        void autoPublishDocSlide(previous, currentHtml);
    }, [autoPublishDocSlide]);

    // Snapshot-based handler to avoid stale editor reads during transitions
    const handleUnsavedDocWithSnapshot = useCallback(
        (previous: Slide | null, snapshotHtml: string) => {
            if (
                !previous ||
                previous.source_type !== 'DOCUMENT' ||
                previous.document_slide?.type !== 'DOC'
            ) {
                return;
            }

            if (lastHandledPrevSlideIdRef.current === previous.id) {
                return;
            }

            // Skip if the previous slide is deleted or no longer exists (use fresh store snapshot)
            const itemsNow = useContentStore.getState().items as unknown as Slide[] | undefined;
            const stillExists = Array.isArray(itemsNow) && itemsNow.some((s) => s.id === previous.id);
            const deletedInStore = Array.isArray(itemsNow)
                ? itemsNow.find((s) => s.id === previous.id)?.status === 'DELETED'
                : false;
            if (previous.status === 'DELETED' || deletedInStore || !stillExists) {
                return;
            }

            const initialHtml =
                initialDocHtmlRef.current.slideId === previous.id
                    ? initialDocHtmlRef.current.html
                    : snapshotHtml; // fallback: treat as unchanged if we have no baseline

            const hasEditorChanged = snapshotHtml !== initialHtml;

            // Only act if the user actually changed something
            if (!hasEditorChanged) {
                return;
            }

            lastHandledPrevSlideIdRef.current = previous.id;

            // Always auto-save draft silently — never show a blocking dialog on slide switch
            void autoPublishDocSlide(previous, snapshotHtml);
        },
        [autoPublishDocSlide]
    );

    // On slide switch, detect unsaved changes for DOC and act based on role
    useEffect(() => {
        // Cleanup runs before switching away from this slide; capture exact editor HTML
        return () => {
            const previous = prevDocSlideRef.current;
            if (!previous) return;
            const snapshot = getCurrentEditorHTMLContent();
            handleUnsavedDocWithSnapshot(previous, snapshot);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeItem?.id]);

    useEffect(() => {
        // Update previous ref for next transitions and reset dedup if new previous context
        if (
            activeItem?.source_type === 'DOCUMENT' &&
            activeItem?.document_slide?.type === 'DOC' &&
            activeItem?.status !== 'DELETED'
        ) {
            prevDocSlideRef.current = activeItem;
            lastHandledPrevSlideIdRef.current = null;
        }
    }, [activeItem]);

    // Handle Excalidraw onChange for auto-save - debounced database update only
    const handleExcalidrawChange = useCallback(
        async (elements: any[], appState: any, files: any, fileId?: string) => {
            if (!activeItem || activeItem.document_slide?.type !== 'PRESENTATION') return;

            // Only update database if we have a new fileId from auto-save
            if (fileId && fileId !== activeItem.document_slide?.data) {
                // Prevent infinite loops by tracking auto-save state
                if (isAutoSavingRef.current) {
                    return;
                }

                isAutoSavingRef.current = true;

                // Determine the correct status based on current state
                let newStatus = activeItem.status || 'DRAFT';

                // For non-admin users with hidePublishButtons=true, auto-publish presentations
                if (hidePublishButtons) {
                    newStatus = 'PUBLISHED';
                    console.log('🎨 Auto-publishing presentation for non-admin user');
                    // Show toast notification for auto-publish and trigger approval button
                    if (activeItem.status !== 'PUBLISHED') {
                        import('sonner').then(({ toast }) => {
                            toast.success('Presentation auto-published for review');
                        });
                        // Trigger approval button for non-admin users
                        localStorage.setItem('triggerApprovalButton', Date.now().toString());
                    }
                } else if (activeItem.status === 'PUBLISHED') {
                    // If the slide is PUBLISHED and being edited, change status to UNSYNC
                    newStatus = 'UNSYNC';
                }
                try {
                    await addUpdateDocumentSlide({
                        id: activeItem.id,
                        title: activeItem.title || '',
                        image_file_id: '',
                        description: activeItem.description || '',
                        slide_order: null,
                        document_slide: {
                            id: activeItem.document_slide?.id || '',
                            type: 'PRESENTATION',
                            data: fileId, // Store S3 file ID in data field
                            title: activeItem.document_slide?.title || '',
                            cover_file_id: '',
                            total_pages: 1,
                            published_data:
                                newStatus === 'PUBLISHED'
                                    ? fileId
                                    : activeItem.document_slide?.published_data || null, // Set published_data for non-admin auto-publish
                            published_document_total_pages: 1,
                        },
                        status: newStatus, // Use the determined status
                        new_slide: false,
                        notify: false,
                    });

                    // Update local activeItem state with the new fileId and status
                    // Only update if Excalidraw is not performing intensive operations
                    if (!isExcalidrawBusyRef.current) {
                        const updatedActiveItem = {
                            ...activeItem,
                            status: newStatus,
                            document_slide: activeItem.document_slide
                                ? {
                                    ...activeItem.document_slide,
                                    data: fileId, // Update local state with new fileId
                                    published_data:
                                        newStatus === 'PUBLISHED'
                                            ? fileId
                                            : activeItem.document_slide.published_data, // Update published_data for auto-publish
                                }
                                : undefined,
                        };
                        setActiveItem(updatedActiveItem);
                    } else {
                        pendingStateUpdateRef.current = {
                            ...activeItem,
                            status: newStatus,
                            document_slide: activeItem.document_slide
                                ? {
                                    ...activeItem.document_slide,
                                    data: fileId,
                                    published_data:
                                        newStatus === 'PUBLISHED'
                                            ? fileId
                                            : activeItem.document_slide.published_data, // Update published_data for auto-publish
                                }
                                : undefined,
                        };
                    }
                } catch (error) {
                    console.error('Error auto-saving Excalidraw:', error);
                } finally {
                    // Reset the flag after a short delay to allow for UI updates
                    setTimeout(() => {
                        isAutoSavingRef.current = false;
                    }, 1000);
                }
            }
        },
        [activeItem, addUpdateDocumentSlide]
    );

    // State for Admin unsaved DOC modal


    // Helper: Auto publish DOC for non-admins on slide switch/state change (hoisted function)
    async function autoPublishDocSlide(slide: Slide, htmlString: string) {
        try {
            // Final guard: ensure slide still exists and is not deleted before calling API
            const itemsNow = useContentStore.getState().items as unknown as Slide[] | undefined;
            const stillExists = Array.isArray(itemsNow) && itemsNow.some((s) => s.id === slide.id);
            const deletedInStore = Array.isArray(itemsNow)
                ? itemsNow.find((s) => s.id === slide.id)?.status === 'DELETED'
                : false;
            if (!stillExists || deletedInStore || slide.status === 'DELETED') {
                return;
            }

            // Process images in HTML content before saving
            let processedHtmlString = htmlString;
            if (containsBase64Images(htmlString)) {
                console.log('Processing base64 images in DOC content...');
                const imageSize = getBase64ImagesSize(htmlString);
                console.log(`Base64 images size: ${Math.round(imageSize / 1024)}KB`);

                const { processedHtml, uploadedImages, failedUploads } = await processHtmlImages(htmlString);
                processedHtmlString = processedHtml;

                if (failedUploads > 0) {
                    toast.error(`Warning: ${failedUploads} images failed to upload`);
                }
                if (uploadedImages > 0) {
                    console.log(`Successfully processed ${uploadedImages} images`);
                }
            }

            const totalPages = estimatePageCount(processedHtmlString);

            // Determine status and published_data based on role
            let newStatus = slide.status;
            let publishedData = slide.document_slide?.published_data || '';

            if (hidePublishButtons) {
                // Non-admin (Teacher): Auto-publish
                newStatus = 'PUBLISHED';
                publishedData = processedHtmlString;
            } else {
                // Admin: Auto-save draft
                // If currently published, it becomes UNSYNC because draft has changed
                if (slide.status === 'PUBLISHED') {
                    newStatus = 'UNSYNC';
                } else {
                    newStatus = slide.status || 'DRAFT';
                }
                // Do NOT update publishedData for admins — keep live version safe
            }

            await addUpdateDocumentSlide({
                id: slide?.id || '',
                title: slide?.title || '',
                image_file_id: '',
                description: slide?.description || '',
                slide_order: null,
                document_slide: {
                    id: slide?.document_slide?.id || '',
                    type: 'DOC',
                    data: processedHtmlString,
                    title: slide?.document_slide?.title || '',
                    cover_file_id: '',
                    total_pages: totalPages,
                    published_data: publishedData,
                    published_document_total_pages: 1,
                },
                status: newStatus,
                new_slide: false,
                notify: false,
            });
            if (!hidePublishButtons) {
                toast.success('Draft auto-saved');
            } else {
                toast.success('Changes saved and published');
            }
        } catch (error) {
            console.error('Error auto-publishing DOC slide:', error);
            toast.error('Failed to auto-save changes');
        }
    }
    interface YTPlayer {
        destroy(): void;
        getCurrentTime(): number;
        getDuration(): number;
        seekTo(seconds: number, allowSeekAhead: boolean): void;
        getPlayerState(): number;
    }

    const playerRef = useRef<YTPlayer | null>(null);

    const loadContent = async () => {
        if (activeItem == null) {
            setContent(
                <div className="flex h-[500px] flex-col items-center justify-center rounded-lg py-10">
                    <EmptySlideMaterial />
                    <p className="mt-4 text-neutral-500">No study material has been added yet</p>
                </div>
            );
            return;
        }

        // Check if the slide is deleted
        if (activeItem.status === 'DELETED') {
            setContent(
                <div className="flex h-[500px] flex-col items-center justify-center rounded-lg py-10">
                    <div className="text-center">
                        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-red-100">
                            <Trash size={24} className="text-red-500" />
                        </div>
                        <h3 className="mb-2 text-lg font-semibold text-slate-600">
                            This slide has been deleted
                        </h3>
                        <p className="text-sm text-slate-400">
                            The slide content is no longer available
                        </p>
                    </div>
                </div>
            );
            return;
        }

        // Handle HTML_VIDEO slides (AI-generated videos)
        if (activeItem.source_type === 'HTML_VIDEO') {
            setContent(<VideoSlidePreview activeItem={activeItem} />);
            return;
        }

        if (activeItem.source_type === 'VIDEO') {
            // Check if this video slide is in split-screen mode
            if (activeItem.splitScreenMode && activeItem.splitScreenData) {
                setContent(
                    <SplitScreenSlide
                        splitScreenData={activeItem.splitScreenData as any}
                        slideType={
                            activeItem.splitScreenType as
                            | 'SPLIT_JUPYTER'
                            | 'SPLIT_SCRATCH'
                            | 'SPLIT_CODE'
                        }
                        isEditable={activeItem.status !== 'PUBLISHED'}
                        currentSlideId={activeItem.id}
                        onDataChange={async (updatedSplitData) => {
                            // Update split-screen data locally and handle title changes
                            const projectName =
                                updatedSplitData.projectName || updatedSplitData.name;
                            const updatedSlide = {
                                ...activeItem,
                                title: projectName || activeItem.title,
                                splitScreenData: updatedSplitData,
                            };
                            setActiveItem(updatedSlide as any);

                            // Auto-save to backend for split-screen video slides
                            try {
                                const splitData = updatedSplitData as any;
                                const originalVideoData = splitData?.originalVideoData || {};

                                // Use the original video slide ID if available, otherwise use the slide ID
                                const originalVideoSlide = (activeItem as any).originalVideoSlide;
                                const videoSlideId =
                                    originalVideoSlide?.id ||
                                    originalVideoData.id ||
                                    activeItem.video_slide?.id ||
                                    crypto.randomUUID();

                                const videoSlidePayload = {
                                    id: activeItem.id,
                                    title: String(projectName || activeItem.title || ''),
                                    description: activeItem.description || '',
                                    image_file_id: activeItem.image_file_id || '',
                                    slide_order: activeItem.slide_order,
                                    video_slide: {
                                        id: videoSlideId,
                                        description:
                                            originalVideoData.description ||
                                            activeItem.description ||
                                            '',
                                        title: String(projectName || activeItem.title || ''),
                                        url: originalVideoData.url || '',
                                        video_length_in_millis:
                                            originalVideoData.video_length_in_millis || 0,
                                        published_url:
                                            originalVideoData.published_url ||
                                            originalVideoData.url ||
                                            '',
                                        published_video_length_in_millis:
                                            originalVideoData.published_video_length_in_millis || 0,
                                        source_type: originalVideoData.source_type || 'VIDEO',
                                        embedded_type: splitData?.splitType || 'SCRATCH',
                                        embedded_data: JSON.stringify(splitData || {}),
                                        questions: (originalVideoData.questions as any) || [],
                                    },
                                    status: activeItem.status,
                                    new_slide: false,
                                    notify: false,
                                };

                                await addUpdateVideoSlide(videoSlidePayload);
                                toast.success('Split screen project saved successfully!');
                            } catch (error) {
                                console.error('Error auto-saving split screen data:', error);
                                toast.error('Failed to save split screen data automatically');
                            }
                        }}
                    />
                );
            } else {
                setContent(<VideoSlidePreview activeItem={activeItem} />);
            }

            return;
        }

        // ✅ Handle ASSIGNMENT slides (check source_type first)
        if (activeItem.source_type === 'ASSIGNMENT') {
            try {
                if (!activeItem.assignment_slide) {
                    console.warn('[Assignment] No assignment_slide data found, showing fallback');
                    setContent(
                        <div className="flex h-[500px] flex-col items-center justify-center rounded-lg py-10">
                            <div className="text-center">
                                <h3 className="mb-2 text-lg font-semibold">Assignment Loading</h3>
                                <p className="text-gray-600">Assignment data is being loaded...</p>
                            </div>
                        </div>
                    );
                    return;
                }

                setContent(<StudyLibraryAssignmentPreview activeItem={activeItem} />);
            } catch (error) {
                console.error('Error rendering assignment preview:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                setContent(
                    <div className="flex h-[500px] flex-col items-center justify-center rounded-lg py-10">
                        <div className="text-center">
                            <h3 className="mb-2 text-lg font-semibold text-red-600">
                                Assignment Error
                            </h3>
                            <p className="text-gray-600">
                                Failed to load assignment: {errorMessage}
                            </p>
                        </div>
                    </div>
                );
            }
            return;
        }

        if (activeItem.source_type === 'DOCUMENT') {
            const documentType = activeItem.document_slide?.type;

            // Reset stableKeyRef when not on a presentation slide
            if (documentType !== 'PRESENTATION') {
                stableKeyRef.current = '';
            }

            if (documentType === 'PRESENTATION') {
                // Get the appropriate fileId based on status and learner view
                const fileId = isLearnerView
                    ? activeItem.document_slide?.published_data
                    : activeItem.status === 'PUBLISHED'
                        ? activeItem.document_slide?.published_data
                        : activeItem.document_slide?.data;
                // Only set a new key if the id changes
                if (!stableKeyRef.current || !stableKeyRef.current.includes(activeItem.id)) {
                    stableKeyRef.current = `slide-editor-${activeItem.id}-${Date.now()}`;
                }

                setContent(
                    <div className="relative z-30 size-full">
                        <Suspense fallback={<div className="flex aspect-[4/3] w-full items-center justify-center border bg-slate-50"><div className="flex flex-col items-center"><div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600"></div><span className="text-sm text-slate-500">Loading editor...</span></div></div>}>
                            <SlideEditor
                                key={stableKeyRef.current} // Use stable key during operations
                                slideId={activeItem.id}
                                initialData={{
                                    elements: [],
                                    files: {},
                                    appState: {},
                                }}
                                fileId={fileId || undefined}
                                onChange={handleExcalidrawChange}
                                editable={!isLearnerView && activeItem.status !== 'PUBLISHED'}
                                isSaving={isSaving}
                                onEditorReady={(state) => {
                                    getCurrentExcalidrawStateRef.current = state;
                                }}
                                onBusyStateChange={(isBusy) => {
                                    const wasBusy = isExcalidrawBusyRef.current;
                                    isExcalidrawBusyRef.current = isBusy;

                                    // If operation just completed and we have a pending update, apply it
                                    if (wasBusy && !isBusy && pendingStateUpdateRef.current) {
                                        const pendingUpdate = pendingStateUpdateRef.current;
                                        setActiveItem(pendingUpdate);
                                        pendingStateUpdateRef.current = null;
                                        // Keep stable key unchanged to prevent component rebuilds
                                    }
                                }}
                            />
                        </Suspense>

                    </div>
                );
                return;
            }

            if (documentType === 'PDF') {
                const data = isLearnerView
                    ? activeItem.document_slide?.published_data || null
                    : activeItem.status === 'PUBLISHED'
                        ? activeItem.document_slide?.published_data || null
                        : activeItem.document_slide?.data || '';

                const url = await getPublicUrl(data || '');
                setContent(
                    <Suspense fallback={<div className="h-full w-full animate-pulse bg-gray-100" />}>
                        <PDFViewer pdfUrl={url} />
                    </Suspense>
                );
                return;
            }

            if (documentType === 'JUPYTER') {
                try {
                    // In learner view, always use published_data, otherwise use existing logic
                    const rawData = isLearnerView
                        ? activeItem.document_slide?.published_data ||
                        activeItem.document_slide?.data
                        : activeItem.status === 'PUBLISHED'
                            ? activeItem.document_slide?.data ||
                            activeItem.document_slide?.published_data
                            : activeItem.document_slide?.data;

                    const notebookData = rawData
                        ? JSON.parse(rawData)
                        : { contentUrl: '', projectName: '' };

                    setContent(
                        <JupyterNotebookSlide
                            notebookData={notebookData}
                            // Allow editing even in PUBLISHED for non-learner
                            isEditable={!isLearnerView}
                            onDataChange={async (updatedNotebookData) => {
                                // Only allow data changes if not in learner view
                                if (isLearnerView) return;

                                // Save the notebook data to backend
                                try {
                                    const wasPublished = activeItem.status === 'PUBLISHED';
                                    const nextStatus = 'PUBLISHED';
                                    await addUpdateDocumentSlide({
                                        id: activeItem.id,
                                        title:
                                            updatedNotebookData.projectName ||
                                            activeItem.title ||
                                            '',
                                        image_file_id: '',
                                        description: activeItem.description || '',
                                        slide_order: null,
                                        document_slide: {
                                            id: activeItem.document_slide?.id || '',
                                            type: 'JUPYTER',
                                            data: JSON.stringify(updatedNotebookData),
                                            title:
                                                updatedNotebookData.projectName ||
                                                activeItem.document_slide?.title ||
                                                '',
                                            cover_file_id: '',
                                            total_pages: 1,
                                            published_data: JSON.stringify(updatedNotebookData),
                                            published_document_total_pages: 1,
                                        },
                                        status: nextStatus,
                                        new_slide: false,
                                        notify: false,
                                    });

                                    // Update activeItem with new title and data
                                    const updatedActiveItem = {
                                        ...activeItem,
                                        status: nextStatus,
                                        title: updatedNotebookData.projectName || activeItem.title,
                                        document_slide: activeItem.document_slide
                                            ? {
                                                ...activeItem.document_slide,
                                                title:
                                                    updatedNotebookData.projectName ||
                                                    activeItem.document_slide.title,
                                                data: JSON.stringify(updatedNotebookData),
                                            }
                                            : undefined,
                                    };
                                    setActiveItem(updatedActiveItem);

                                    // On first configure, trigger approval UI and toast
                                    if (!wasPublished) {
                                        localStorage.setItem(
                                            'triggerApprovalButton',
                                            Date.now().toString()
                                        );
                                        toast.success('Slide auto-published for review');
                                    }

                                    // Re-render by reloading content with fresh store data
                                    // (avoids recursive callback nesting that closes over stale activeItem)
                                    loadContent();
                                } catch (error) {
                                    console.error('Error saving Jupyter notebook data:', error);
                                    toast.error('Failed to save notebook changes');
                                }
                            }}
                        />
                    );
                } catch (error) {
                    console.error('Error loading Jupyter notebook:', error);
                    setContent(<div>Error loading Jupyter notebook</div>);
                }
                return;
            }

            if (documentType === 'SCRATCH') {
                try {
                    // Fallback: first check data field, then published_data for published slides
                    const rawData =
                        activeItem.status === 'PUBLISHED'
                            ? activeItem.document_slide?.data ||
                            activeItem.document_slide?.published_data
                            : activeItem.document_slide?.data;

                    const scratchData = rawData
                        ? JSON.parse(rawData)
                        : { projectId: '', projectName: '', scratchUrl: '', timestamp: Date.now() };

                    setContent(
                        <ScratchProjectSlide
                            scratchData={scratchData}
                            // Allow editing even in PUBLISHED when non-admin flow hides publish buttons
                            isEditable={!isLearnerView && (hidePublishButtons || true)}
                            onDataChange={async (updatedScratchData) => {
                                // Save the scratch data to backend
                                try {
                                    const wasPublished = activeItem.status === 'PUBLISHED';
                                    const nextStatus = 'PUBLISHED';
                                    await addUpdateDocumentSlide({
                                        id: activeItem.id,
                                        title:
                                            updatedScratchData.projectName ||
                                            activeItem.title ||
                                            '',
                                        image_file_id: '',
                                        description: activeItem.description || '',
                                        slide_order: null,
                                        document_slide: {
                                            id: activeItem.document_slide?.id || '',
                                            type: 'SCRATCH',
                                            data: JSON.stringify(updatedScratchData),
                                            title:
                                                updatedScratchData.projectName ||
                                                activeItem.document_slide?.title ||
                                                '',
                                            cover_file_id: '',
                                            total_pages: 1,
                                            published_data: JSON.stringify(updatedScratchData),
                                            published_document_total_pages: 1,
                                        },
                                        status: nextStatus,
                                        new_slide: false,
                                        notify: false,
                                    });

                                    // Update activeItem with new title and data
                                    const updatedActiveItem = {
                                        ...activeItem,
                                        status: nextStatus,
                                        title: updatedScratchData.projectName || activeItem.title,
                                        document_slide: activeItem.document_slide
                                            ? {
                                                ...activeItem.document_slide,
                                                title:
                                                    updatedScratchData.projectName ||
                                                    activeItem.document_slide.title,
                                                data: JSON.stringify(updatedScratchData),
                                            }
                                            : undefined,
                                    };
                                    setActiveItem(updatedActiveItem);

                                    // On first configure, trigger approval UI and toast
                                    if (!wasPublished) {
                                        localStorage.setItem(
                                            'triggerApprovalButton',
                                            Date.now().toString()
                                        );
                                        toast.success('Slide auto-published for review');
                                    }

                                    // Re-render by reloading content with fresh store data
                                    // (avoids recursive callback nesting that closes over stale activeItem)
                                    loadContent();
                                } catch (error) {
                                    console.error('Error saving Scratch project data:', error);
                                    toast.error('Failed to save Scratch project changes');
                                }
                            }}
                        />
                    );
                } catch (error) {
                    console.error('Error loading Scratch project:', error);
                    setContent(<div>Error loading Scratch project</div>);
                }
                return;
            }

            if (documentType === 'CODE') {
                try {
                    // Fallback: first check data field, then published_data for published slides
                    const rawData =
                        activeItem.status === 'PUBLISHED'
                            ? activeItem.document_slide?.data ||
                            activeItem.document_slide?.published_data
                            : activeItem.document_slide?.data;

                    const codeData = rawData
                        ? JSON.parse(rawData)
                        : { language: 'python', code: '', theme: 'light' };

                    setContent(
                        <CodeEditorSlide
                            key={`code-editor-${activeItem.id}`}
                            codeData={codeData}
                            // Allow editing even in PUBLISHED when non-admin flow hides publish buttons
                            isEditable={!isLearnerView && (hidePublishButtons || true)}
                            onDataChange={async (updatedCodeData) => {
                                // Update the slide data when user changes code
                                try {
                                    await addUpdateDocumentSlide({
                                        id: activeItem.id,
                                        title: activeItem.title || '',
                                        image_file_id: '',
                                        description: activeItem.description || '',
                                        slide_order: null,
                                        document_slide: {
                                            id: activeItem.document_slide?.id || '',
                                            type: 'CODE',
                                            data: JSON.stringify(updatedCodeData),
                                            title: activeItem.document_slide?.title || '',
                                            cover_file_id: '',
                                            total_pages: 1,
                                            published_data:
                                                hidePublishButtons ||
                                                    activeItem.status === 'PUBLISHED'
                                                    ? JSON.stringify(updatedCodeData)
                                                    : null,
                                            published_document_total_pages: 1,
                                        },
                                        status: activeItem.status,
                                        new_slide: false,
                                        notify: false,
                                    });

                                    // Update the activeItem data to reflect the changes in local state
                                    setActiveItem({
                                        ...activeItem,
                                        document_slide: activeItem.document_slide
                                            ? {
                                                ...activeItem.document_slide,
                                                data: JSON.stringify(updatedCodeData),
                                            }
                                            : undefined,
                                    });
                                } catch (error) {
                                    console.error('Error saving code editor data:', error);
                                    toast.error('Failed to save code changes');
                                }
                            }}
                        />
                    );
                } catch (error) {
                    console.error('Error loading Code editor:', error);
                    setContent(<div>Error loading Code editor</div>);
                }
                return;
            }

            // Handle split-screen slides
            if (documentType?.startsWith('SPLIT_')) {
                try {
                    // Fallback: first check data field, then published_data for published slides
                    const rawData =
                        activeItem.status === 'PUBLISHED'
                            ? activeItem.document_slide?.data ||
                            activeItem.document_slide?.published_data
                            : activeItem.document_slide?.data;

                    const splitScreenData = rawData
                        ? JSON.parse(rawData)
                        : { splitScreen: true, videoSlideId: '', timestamp: Date.now() };

                    // Use regular import since it's already imported at the top
                    setContent(
                        <SplitScreenSlide
                            splitScreenData={splitScreenData}
                            slideType={
                                documentType as 'SPLIT_JUPYTER' | 'SPLIT_SCRATCH' | 'SPLIT_CODE'
                            }
                            isEditable={activeItem.status !== 'PUBLISHED'}
                            currentSlideId={activeItem.id}
                            onDataChange={async (updatedSplitData) => {
                                try {
                                    await addUpdateDocumentSlide({
                                        id: activeItem.id,
                                        title: activeItem.title || '',
                                        image_file_id: '',
                                        description: activeItem.description || '',
                                        slide_order: null,
                                        document_slide: {
                                            id:
                                                activeItem.document_slide?.id ||
                                                crypto.randomUUID(),
                                            type: documentType,
                                            data: JSON.stringify(updatedSplitData),
                                            title: activeItem.document_slide?.title || '',
                                            cover_file_id: '',
                                            total_pages: 1,
                                            published_data: null,
                                            published_document_total_pages: 1,
                                        },
                                        status: activeItem.status,
                                        new_slide: false,
                                        notify: false,
                                    });

                                    // Update active item
                                    setActiveItem({
                                        ...activeItem,
                                        document_slide: activeItem.document_slide
                                            ? {
                                                ...activeItem.document_slide,
                                                data: JSON.stringify(updatedSplitData),
                                            }
                                            : undefined,
                                    });
                                } catch (error) {
                                    console.error('Error saving split screen data:', error);
                                    toast.error('Failed to save split screen data');
                                }
                            }}
                        />
                    );
                } catch (error) {
                    console.error('Error parsing split screen data:', error);
                    // Show error message with option to retry
                    setContent(
                        <div className="flex h-full items-center justify-center p-6">
                            <div className="text-center">
                                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-red-100">
                                    <AlertCircle className="size-8 text-red-600" />
                                </div>
                                <h3 className="mb-2 text-lg font-semibold">
                                    Split Screen Loading Error
                                </h3>
                                <p className="mb-4 text-gray-600">
                                    Failed to load the split screen component. This is usually a
                                    temporary issue.
                                </p>
                                <MyButton
                                    buttonType="primary"
                                    scale="medium"
                                    onClick={() => loadContent()}
                                    className="mr-2"
                                >
                                    Retry
                                </MyButton>
                                <MyButton
                                    buttonType="secondary"
                                    scale="medium"
                                    onClick={() =>
                                        setContent(
                                            <div className="flex h-[400px] items-center justify-center text-gray-500">
                                                Split screen component unavailable
                                            </div>
                                        )
                                    }
                                >
                                    Show Fallback
                                </MyButton>
                            </div>
                        </div>
                    );
                }
                return;
            }

            // 🔁 Then handle DOC
            if (documentType === 'DOC') {
                try {
                    // Single call — the focus() inside is already deferred via setTimeout
                    setEditorContent();
                } catch (error) {
                    console.error('Error preparing document content:', error);
                    setContent(<div>Error loading document content</div>);
                }
                return;
            }
        }

        if (
            activeItem.source_type?.toUpperCase() === 'QUIZ' ||
            activeItem.id?.startsWith('quiz-')
        ) {
            try {
                // For question slides, we don't need to parse data as it's already structured
                setContent(
                    <QuizPreview
                        activeItem={activeItem}
                        routeParams={{
                            chapterId,
                            moduleId,
                            subjectId,
                            sessionId,
                            courseId,
                            levelId,
                        }}
                    />
                );
            } catch (error) {
                console.error('Error loading quiz questions:', error);
                setContent(<div>Error loading quiz questions</div>);
            }
            return;
        }

        if (activeItem.source_type?.toUpperCase() === 'QUESTION') {
            setContent(<StudyLibraryQuestionsPreview activeItem={activeItem} />);
            return;
        }

        // Handle AUDIO slides
        if (activeItem.source_type?.toUpperCase() === 'AUDIO') {
            setContent(<AudioSlidePreview activeItem={activeItem} isLearnerView={isLearnerView} />);
            return;
        }

        // Handle SCORM slides
        if (activeItem.source_type?.toUpperCase() === 'SCORM') {
            setContent(<ScormSlidePreview activeItem={activeItem} isLearnerView={isLearnerView} />);
            return;
        }

        // Fallback
        setContent(
            <div className="flex h-[500px] flex-col items-center justify-center rounded-lg py-10">
                <EmptySlideMaterial />
                <p className="mt-4 text-neutral-500">No study material has been added yet</p>
            </div>
        );
    };

    const SaveDraft = async (slideToSave?: Slide | null) => {
        setIsSaving(true);
        try {
            const slide = slideToSave ? slideToSave : activeItem;
            // Determine the correct status based on slide type and current state
            let status: string;
            if (
                slide?.source_type === 'DOCUMENT' &&
                slide?.document_slide?.type === 'PRESENTATION'
            ) {
                // For presentations, use the same logic as auto-save
                status = slide?.status || 'DRAFT';
                if (slide?.status === 'PUBLISHED') {
                    status = 'UNSYNC';
                }
            } else {
                // For other slide types, use the original logic
                status = slide
                    ? slide.status == 'PUBLISHED'
                        ? 'UNSYNC'
                        : slide.status == 'UNSYNC'
                            ? 'UNSYNC'
                            : 'DRAFT'
                    : 'DRAFT';
            }

            if (activeItem?.source_type == 'ASSIGNMENT') {
                const convertedData = converDataToAssignmentFormat({
                    activeItem,
                    status,
                    notify: false,
                    newSlide: false,
                });
                try {
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-expect-error
                    await updateAssignmentOrder(convertedData!);
                    toast.success(`slide saved in draft successfully!`);
                } catch {
                    toast.error(`Error in publishing the slide`);
                }
            }

            if (activeItem?.source_type == 'VIDEO' && activeItem?.splitScreenMode) {
                const splitData = activeItem.splitScreenData as any;
                const projectName = splitData?.projectName || splitData?.name || activeItem.title;
                const originalVideoData = splitData?.originalVideoData || {};

                // Use the original video slide ID if available, otherwise use the slide ID
                const originalVideoSlide = (activeItem as any).originalVideoSlide;
                const videoSlideId =
                    originalVideoSlide?.id ||
                    originalVideoData.id ||
                    activeItem.video_slide?.id ||
                    crypto.randomUUID();

                const videoSlidePayload = {
                    id: activeItem.id,
                    title: projectName || activeItem.title || '',
                    description: activeItem.description || '',
                    image_file_id: activeItem.image_file_id || '',
                    slide_order: activeItem.slide_order,
                    video_slide: {
                        id: videoSlideId,
                        description: originalVideoData.description || activeItem.description || '',
                        title: projectName || activeItem.title || '',
                        url: originalVideoData.url || '',
                        video_length_in_millis: originalVideoData.video_length_in_millis || 0,
                        published_url:
                            originalVideoData.published_url || originalVideoData.url || '',
                        published_video_length_in_millis:
                            originalVideoData.published_video_length_in_millis || 0,
                        source_type: originalVideoData.source_type || 'VIDEO',
                        embedded_type: splitData?.splitType || 'JUPYTER',
                        embedded_data: JSON.stringify(splitData || {}),
                        questions: (originalVideoData.questions as any) || [],
                    },
                    status: status,
                    new_slide: false,
                    notify: false,
                };
                try {
                    await addUpdateVideoSlide(videoSlidePayload);
                    toast.success(`Split screen slide saved successfully!`);

                    // Update the local state to reflect saved changes and clear the new split screen flag
                    const updatedSlide = {
                        ...activeItem,
                        ...(projectName &&
                            projectName !== activeItem.title && { title: projectName }),
                        isNewSplitScreen: false, // Clear the flag after first save
                    };
                    setActiveItem(updatedSlide);
                } catch (error) {
                    console.error('Error saving split screen slide:', error);
                    console.error('Payload that failed:', videoSlidePayload);
                    toast.error(`Error saving split screen slide: ${error}`);
                }
            } else if (activeItem?.source_type == 'VIDEO') {
                // Handle regular video slides (non-split screen)
                const convertedData = converDataToVideoFormat({
                    activeItem,
                    status,
                    notify: false,
                    newSlide: false,
                });
                try {
                    await addUpdateVideoSlide(convertedData);
                    toast.success(`slide saved in draft successfully!`);
                } catch {
                    toast.error(`Error in saving the slide`);
                }
            }

            if (activeItem?.source_type === 'QUESTION') {
                const convertedData = convertToQuestionBackendSlideFormat({
                    activeItem,
                    status,
                    notify: false,
                    newSlide: false,
                });
                try {
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-expect-error
                    await updateQuestionOrder(convertedData!);
                    toast.success(`slide saved in draft successfully!`);
                } catch {
                    toast.error('error saving slide');
                }
                return;
            }

            if (activeItem?.source_type === 'QUIZ') {
                try {
                    // Use the createQuizSlidePayload function to properly transform the data
                    const payload = createQuizSlidePayload(activeItem.quiz_slide?.questions || [], {
                        ...activeItem,
                        status: status, // Use the determined status
                    });

                    await addUpdateQuizSlide(payload);
                    toast.success(`Quiz saved in draft successfully!`);
                } catch (error) {
                    console.error('Error saving quiz slide:', error);
                    toast.error('Error saving quiz slide');
                }
                return;
            }

            if (activeItem?.source_type === 'AUDIO') {
                if (!activeItem.audio_slide) {
                    toast.error('Audio slide data is missing');
                    return;
                }
                try {
                    await addUpdateAudioSlide({
                        id: activeItem.id,
                        title: activeItem.title,
                        description: activeItem.description || null,
                        image_file_id: activeItem.image_file_id || null,
                        status: status as 'DRAFT' | 'PUBLISHED',
                        slide_order: activeItem.slide_order,
                        notify: false,
                        new_slide: false,
                        audio_slide: {
                            id: activeItem.audio_slide.id,
                            audio_file_id: activeItem.audio_slide.audio_file_id,
                            thumbnail_file_id: activeItem.audio_slide.thumbnail_file_id || null,
                            audio_length_in_millis: activeItem.audio_slide.audio_length_in_millis,
                            source_type: activeItem.audio_slide.source_type,
                            external_url: activeItem.audio_slide.external_url || null,
                            transcript: activeItem.audio_slide.transcript || null,
                        },
                    });
                    toast.success('Audio slide saved successfully!');
                } catch (error) {
                    console.error('Error saving audio slide:', error);
                    toast.error('Error saving audio slide');
                }
                return;
            }

            // Handle SCORM slides
            if (activeItem?.source_type === 'SCORM') {
                if (!activeItem.scorm_slide) {
                    toast.error('SCORM slide data is missing');
                    return;
                }
                try {
                    await addUpdateScormSlide({
                        id: activeItem.id,
                        title: activeItem.title,
                        description: activeItem.description || null,
                        status: status as 'DRAFT' | 'PUBLISHED',
                        slide_order: activeItem.slide_order,
                        new_slide: false,
                        scorm_slide: {
                            id: activeItem.scorm_slide.id,
                        },
                    });
                    toast.success('SCORM slide saved successfully!');
                } catch (error) {
                    console.error('Error saving SCORM slide:', error);
                    toast.error('Error saving SCORM slide');
                }
                return;
            }

            if (
                activeItem?.source_type == 'DOCUMENT' &&
                activeItem?.document_slide?.type == 'PRESENTATION'
            ) {
                try {
                    // For non-admin users, use custom save function if available
                    if (customSaveFunction && slide) {
                        console.log('🎨 Using custom save function for presentation');
                        await customSaveFunction(slide);
                        return;
                    }

                    // For presentations, use the same status logic as auto-save
                    let presentationStatus = slide?.status || 'DRAFT';

                    // If the slide is PUBLISHED and being edited, change status to UNSYNC
                    if (slide?.status === 'PUBLISHED') {
                        presentationStatus = 'UNSYNC';
                    }
                    await addUpdateDocumentSlide({
                        id: slide?.id || '',
                        title: slide?.title || '',
                        image_file_id: '',
                        description: slide?.description || '',
                        slide_order: null,
                        document_slide: {
                            id: slide?.document_slide?.id || '',
                            type: 'PRESENTATION',
                            data: slide?.document_slide?.data || null, // Keep existing S3 file ID
                            title: slide?.document_slide?.title || '',
                            cover_file_id: '',
                            total_pages: 1,
                            published_data: slide?.document_slide?.published_data || null,
                            published_document_total_pages: 1,
                        },
                        status: presentationStatus, // Use the correct status logic
                        new_slide: false,
                        notify: false,
                    });
                    // Update local activeItem state with the new status
                    if (slide?.id === activeItem?.id) {
                        const updatedActiveItem = {
                            ...activeItem,
                            status: presentationStatus as any,
                        };
                        setActiveItem(updatedActiveItem);
                    }

                    const successMessage =
                        slide?.status === 'PUBLISHED'
                            ? 'Presentation saved as draft (unsync from published version)!'
                            : 'Presentation saved successfully!';
                    toast.success(successMessage);
                } catch {
                    toast.error('Error saving presentation');
                }
                return;
            }

            // Handle CODE, JUPYTER, SCRATCH, and SPLIT slides
            if (
                activeItem?.source_type == 'DOCUMENT' &&
                (activeItem?.document_slide?.type == 'CODE' ||
                    activeItem?.document_slide?.type == 'JUPYTER' ||
                    activeItem?.document_slide?.type == 'SCRATCH' ||
                    activeItem?.document_slide?.type?.startsWith('SPLIT_'))
            ) {
                try {
                    // For these slide types, ensure the latest data is saved to backend
                    // Use fallback: first check data field, then published_data for published slides
                    const rawData =
                        activeItem.status === 'PUBLISHED'
                            ? activeItem.document_slide?.data ||
                            activeItem.document_slide?.published_data
                            : activeItem.document_slide?.data;

                    // CRITICAL FIX: Don't save if rawData is empty/null to prevent data loss
                    if (!rawData || rawData === '{}') {
                        console.warn(
                            '⚠️ Skipping save for interactive slide - no valid data found'
                        );
                        const slideTypeName =
                            activeItem.document_slide.type === 'CODE'
                                ? 'Code Editor'
                                : activeItem.document_slide.type === 'JUPYTER'
                                    ? 'Jupyter Notebook'
                                    : activeItem.document_slide.type === 'SCRATCH'
                                        ? 'Scratch Project'
                                        : activeItem.document_slide.type?.startsWith('SPLIT_')
                                            ? `Split Screen ${activeItem.document_slide.type.replace('SPLIT_', '')}`
                                            : 'Interactive Slide';
                        toast.success(`${slideTypeName} is already up to date!`);
                        return;
                    }

                    await addUpdateDocumentSlide({
                        id: slide?.id || '',
                        title: slide?.title || '',
                        image_file_id: '',
                        description: slide?.description || '',
                        slide_order: null,
                        document_slide: {
                            id: slide?.document_slide?.id || '',
                            type: activeItem.document_slide.type,
                            data: rawData, // Use the actual data without dangerous fallback
                            title: slide?.document_slide?.title || '',
                            cover_file_id: '',
                            total_pages: 1,
                            published_data: activeItem.status === 'PUBLISHED' ? rawData : null,
                            published_document_total_pages: 1,
                        },
                        status: status,
                        new_slide: false,
                        notify: false,
                    });

                    const slideTypeName =
                        activeItem.document_slide.type === 'CODE'
                            ? 'Code Editor'
                            : activeItem.document_slide.type === 'JUPYTER'
                                ? 'Jupyter Notebook'
                                : activeItem.document_slide.type === 'SCRATCH'
                                    ? 'Scratch Project'
                                    : activeItem.document_slide.type?.startsWith('SPLIT_')
                                        ? `Split Screen ${activeItem.document_slide.type.replace('SPLIT_', '')}`
                                        : 'Interactive Slide';
                    toast.success(`${slideTypeName} saved successfully!`);
                } catch (error) {
                    console.error(`Error saving ${activeItem.document_slide.type} slide:`, error);
                    toast.error(
                        `Error saving ${activeItem.document_slide.type.toLowerCase()} slide`
                    );
                }
                return;
            }

            // Handle regular documents
            const currentHtml = getCurrentEditorHTMLContent();

            // Process images in HTML content before saving
            let processedHtmlString = currentHtml;
            let uploadedImagesCount = 0;
            if (containsBase64Images(currentHtml)) {
                console.log('Processing base64 images in DOC content...');
                const imageSize = getBase64ImagesSize(currentHtml);
                console.log(`Base64 images size: ${Math.round(imageSize / 1024)}KB`);

                const { processedHtml, uploadedImages, failedUploads } = await processHtmlImages(currentHtml);
                processedHtmlString = processedHtml;
                uploadedImagesCount = uploadedImages;

                if (failedUploads > 0) {
                    toast.error(`Warning: ${failedUploads} images failed to upload`);
                }
                if (uploadedImages > 0) {
                    console.log(`Successfully processed ${uploadedImages} images`);
                    toast.success(`Slide saved with ${uploadedImages} images uploaded!`);
                }
            }

            const totalPages = estimatePageCount(processedHtmlString);

            try {
                await addUpdateDocumentSlide({
                    id: slide?.id || '',
                    title: slide?.title || '',
                    image_file_id: '',
                    description: slide?.description || '',
                    slide_order: null,
                    document_slide: {
                        id: slide?.document_slide?.id || '',
                        type: 'DOC',
                        data: processedHtmlString,
                        title: slide?.document_slide?.title || '',
                        cover_file_id: '',
                        total_pages: totalPages,
                        published_data: null,
                        published_document_total_pages: 1,
                    },
                    status: status,
                    new_slide: false,
                    notify: false,
                });
                if (!containsBase64Images(currentHtml) || uploadedImagesCount === 0) {
                    toast.success(`slide saved in draft successfully!`);
                }
            } catch {
                toast.error(`Error in saving the slide`);
            }
        } finally {
            setIsSaving(false);
        }
    };

    // Custom publish function for Excalidraw presentations
    const publishExcalidrawPresentation = async () => {
        if (!activeItem || activeItem.document_slide?.type !== 'PRESENTATION') return;

        try {
            // Step 1: Get current state from Excalidraw editor
            if (!getCurrentExcalidrawStateRef.current) {
                toast.error('Editor not ready. Please try again.');
                return;
            }

            const currentState = getCurrentExcalidrawStateRef.current();

            if (!currentState.elements || currentState.elements.length === 0) {
                toast.error('No content to publish. Please add some content first.');
                return;
            }

            // Step 2: Prepare Excalidraw data for S3 upload
            const excalidrawData = {
                isExcalidraw: true,
                elements: currentState.elements,
                files: currentState.files || {},
                appState: currentState.appState || {},
                lastModified: Date.now(),
            };

            // Step 3: Upload current state to S3
            const jsonBlob = new Blob([JSON.stringify(excalidrawData)], {
                type: 'application/json',
            });
            const fileName = `excalidraw_${activeItem.id}_published_${Date.now()}.json`;
            const jsonFile = new File([jsonBlob], fileName, {
                type: 'application/json',
            });

            // Get user and institute info for S3 upload
            const accessToken = getTokenFromCookie(TokenKey.accessToken);
            const tokenData = getTokenDecodedData(accessToken);
            const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];
            const USER_ID = tokenData?.sub;

            const publishedFileId = await UploadFileInS3(
                jsonFile,
                () => { }, // No progress callback needed
                USER_ID || '',
                INSTITUTE_ID,
                'ADMIN',
                true // public URL
            );

            if (!publishedFileId) {
                toast.error('Failed to upload presentation data');
                return;
            }

            // Step 4: Update slide with both data and published_data set to the new file_id
            await addUpdateDocumentSlide({
                id: activeItem.id,
                title: activeItem.title || '',
                image_file_id: '',
                description: activeItem.description || '',
                slide_order: null,
                document_slide: {
                    id: activeItem.document_slide?.id || '',
                    type: 'PRESENTATION',
                    data: publishedFileId, // Set data to new file_id
                    title: activeItem.document_slide?.title || '',
                    cover_file_id: '',
                    total_pages: 1,
                    published_data: publishedFileId, // Set published_data to same file_id
                    published_document_total_pages: 1,
                },
                status: 'PUBLISHED',
                new_slide: false,
                notify: false,
            });

            // Update local activeItem state with the new published data
            const updatedActiveItem = {
                ...activeItem,
                status: 'PUBLISHED' as any,
                document_slide: activeItem.document_slide
                    ? {
                        ...activeItem.document_slide,
                        data: publishedFileId,
                        published_data: publishedFileId,
                    }
                    : undefined,
            };
            setActiveItem(updatedActiveItem);

            toast.success('Presentation published successfully!');
        } catch (error) {
            console.error('Error publishing presentation:', error);
            toast.error('Failed to publish presentation');
        }
    };

    const handleSaveDraftClick = async () => {
        try {
            // Special handling for interactive slides (CODE, JUPYTER, SCRATCH, SPLIT)
            if (
                activeItem?.source_type === 'DOCUMENT' &&
                (activeItem?.document_slide?.type === 'CODE' ||
                    activeItem?.document_slide?.type === 'JUPYTER' ||
                    activeItem?.document_slide?.type === 'SCRATCH' ||
                    activeItem?.document_slide?.type?.startsWith('SPLIT_'))
            ) {
                // For interactive slides, check if we have valid data
                const rawData =
                    activeItem.status === 'PUBLISHED'
                        ? activeItem.document_slide?.data ||
                        activeItem.document_slide?.published_data
                        : activeItem.document_slide?.data;

                // If no valid data exists, skip manual save as auto-save handles these slides
                if (!rawData || rawData === '{}') {
                    const slideTypeName =
                        activeItem.document_slide.type === 'CODE'
                            ? 'Code Editor'
                            : activeItem.document_slide.type === 'JUPYTER'
                                ? 'Jupyter Notebook'
                                : activeItem.document_slide.type === 'SCRATCH'
                                    ? 'Scratch Project'
                                    : activeItem.document_slide.type?.startsWith('SPLIT_')
                                        ? `Split Screen ${activeItem.document_slide.type.replace('SPLIT_', '')}`
                                        : 'Interactive Slide';

                    toast.success(`${slideTypeName} is up to date! Changes are auto-saved.`);
                    return;
                }
            }

            // Use custom save function if provided (for non-admin users)
            if (customSaveFunction && activeItem) {
                console.log('🔄 Using custom save function for non-admin');
                await customSaveFunction(activeItem);
                return; // Don't show additional toast as custom function handles it
            }

            await SaveDraft(activeItem);
            toast.success('Slide saved successfully');
        } catch {
            toast.error('error saving document');
        }
    };

    useEffect(() => {
        setHeading(activeItem?.title || '');
        setSlideTitle(
            (activeItem?.source_type === 'DOCUMENT' && activeItem?.document_slide?.title) ||
            (activeItem?.source_type === 'VIDEO' && activeItem?.video_slide?.title) ||
            ''
        );
    }, [activeItem]);

    // Detect adding a new slide and handle unsaved DOC changes
    const prevItemsCountRef = useRef<number>(Array.isArray(items) ? items.length : 0);
    useEffect(() => {
        const currentCount = Array.isArray(items) ? items.length : 0;
        const previousCount = prevItemsCountRef.current;

        if (currentCount > previousCount) {
            // Defer slightly to let store reflect deletions before checking
            setTimeout(() => {
                if (prevDocSlideRef.current) {
                    const previous = prevDocSlideRef.current;
                    const snapshot = getCurrentEditorHTMLContent();
                    handleUnsavedDocWithSnapshot(previous, snapshot);
                }
            }, 50);
        }

        prevItemsCountRef.current = currentCount;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items?.length]);

    useEffect(() => {
        setHeading(activeItem?.title || '');
        if (items && items.length === 0 && slideId === undefined) {
            setActiveItem(null);
            return;
        }

        if (items && items.length > 0) {
            // Priority 1: Use slideId from URL if available (ALWAYS respect URL)
            if (slideId) {
                const targetSlide = items.find((slide) => slide.id === slideId);
                if (targetSlide) {
                    // Only update if it's different from current activeItem
                    if (!activeItem || activeItem.id !== slideId) {
                        setActiveItem(targetSlide);
                    }
                    return;
                }
            }

            // Priority 2: Check if current active slide still exists in items
            const activeSlideStillExists =
                activeItem && items.find((slide) => slide.id === activeItem.id);

            if (activeSlideStillExists) {
                // Active slide still exists, keep it selected
                return;
            }

            // Priority 3: Always set first available slide as active
            // This handles both new slide creation and slide deletion scenarios
            const firstSlide = items[0];

            setActiveItem(firstSlide || null);
        }
    }, [items, slideId]);

    useEffect(() => {
        setHeading(activeItem?.title || '');
        // Only reload content if the slide identity or shape changes.
        // IMPORTANT: `items` was intentionally removed from deps because
        // query refetches (triggered by auto-save) would re-run loadContent,
        // which reads from the stale `activeItem` object and overwrites
        // in-memory editor changes (e.g. newly-inserted YouTube embeds).
        loadContent();
    }, [
        activeItem?.id,
        activeItem?.source_type,
        activeItem?.document_slide?.type,
        activeItem?.status,
    ]);

    // Update the refs whenever these functions change
    useEffect(() => {
        setHeading(activeItem?.title || '');
        setGetCurrentEditorHTMLContent(getCurrentEditorHTMLContent);
        setSaveDraft(SaveDraft);
    }, [editor]);

    return (
        <div
            className="flex w-full flex-1 flex-col transition-all duration-300 ease-in-out"
            ref={selectionRef}
        >

            {activeItem && (
                <div className="sticky top-0 z-50 -mx-2 -mt-2 flex flex-wrap items-center justify-between gap-1 border-b border-neutral-200 bg-white/80 px-2 py-1 shadow-sm backdrop-blur-sm sm:-mx-3 sm:-mt-3 sm:px-3 sm:py-1.5 md:-mx-4 md:-mt-4 md:flex-nowrap md:gap-3 md:px-4 md:py-2.5 lg:-mx-7 lg:-mt-7 lg:gap-4 lg:px-7 lg:py-3">
                    <div className="w-full min-w-0 md:w-auto md:flex-1">
                        {isEditing ? (
                            <div className="flex items-center justify-center gap-2 duration-200 animate-in fade-in">
                                <input
                                    type="text"
                                    value={heading}
                                    onChange={handleHeadingChange}
                                    className="w-fit border-b border-neutral-300 bg-transparent text-lg font-semibold text-neutral-700 transition-colors duration-200 focus:border-primary-500 focus:outline-none"
                                    autoFocus
                                />
                                <Check
                                    onClick={() =>
                                        updateHeading(
                                            activeItem,
                                            addUpdateVideoSlide,
                                            SaveDraft,
                                            heading,
                                            setIsEditing,
                                            addUpdateDocumentSlide,
                                            addUpdateQuizSlide, // <-- pass this for QUIZ support
                                            updateAssignmentOrder, // <-- pass for ASSIGNMENT
                                            updateQuestionOrder // <-- pass for QUESTION
                                        )
                                    }
                                    className="cursor-pointer hover:text-primary-500"
                                />
                            </div>
                        ) : (
                            <div className="flex min-w-0 items-center gap-1.5">
                                <h3 className="truncate text-xs font-semibold text-neutral-600 sm:text-sm md:text-base lg:text-h3">
                                    {heading || 'No content selected'}
                                </h3>
                                {!isLearnerView && (
                                    <PencilSimpleLine
                                        className="shrink-0 cursor-pointer hover:text-primary-500"
                                        onClick={() => setIsEditing(true)}
                                    />
                                )}
                            </div>
                        )}
                    </div>

                    {!isLearnerView && (
                        <div className="flex shrink-0 items-center gap-1 sm:gap-2 md:gap-3">
                            <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
                                {activeItem.source_type === 'DOCUMENT' &&
                                    activeItem?.document_slide?.type === 'DOC' && (
                                        <MyButton
                                            layoutVariant="icon"
                                            onClick={async () => {
                                                await SaveDraft(activeItem);
                                                if (activeItem.status === 'PUBLISHED') {
                                                    await handleConvertAndUpload(
                                                        activeItem.document_slide?.published_data ||
                                                        null
                                                    );
                                                } else {
                                                    await handleConvertAndUpload(
                                                        activeItem.document_slide?.data || null
                                                    );
                                                }
                                            }}
                                        >
                                            <DownloadSimple size={30} />
                                        </MyButton>
                                    )}

                                <ActivityStatsSidebar />

                                {(!hidePublishButtons || // Show for admin users OR
                                    (hidePublishButtons && // Show for non-admin users if it's an editable slide type
                                        (activeItem?.document_slide?.type === 'DOC' ||
                                            activeItem?.document_slide?.type === 'PDF' ||
                                            activeItem?.document_slide?.type === 'PRESENTATION' ||
                                            activeItem?.document_slide?.type === 'CODE' ||
                                            activeItem?.document_slide?.type === 'JUPYTER' ||
                                            activeItem?.document_slide?.type === 'SCRATCH' ||
                                            activeItem?.source_type === 'QUESTION' ||
                                            activeItem?.source_type === 'ASSIGNMENT' ||
                                            activeItem?.source_type === 'QUIZ' ||
                                            activeItem?.source_type === 'DOCUMENT' ||
                                            activeItem?.source_type === 'VIDEO' ||
                                            activeItem?.source_type === 'HTML_VIDEO')) || // Include ALL video slides for non-admin
                                    (!hidePublishButtons &&
                                        activeItem?.source_type === 'VIDEO' &&
                                        activeItem?.splitScreenMode)) && ( // Keep split-screen condition for admin
                                        <MyButton
                                            buttonType="secondary"
                                            scale="medium"
                                            layoutVariant="default"
                                            onClick={handleSaveDraftClick}
                                            disabled={isSaving}
                                            className={cn(isSaving && 'pointer-events-none')}
                                        >
                                            {isSaving ? (
                                                <>
                                                    <Loader2 className="size-4 animate-spin text-primary-500 " />
                                                    Saving...
                                                </>
                                            ) : hidePublishButtons ? (
                                                <FloppyDisk size={18} />
                                            ) : (
                                                <>
                                                    <FloppyDisk size={18} className="md:hidden" />
                                                    <span className="hidden md:inline">Save Draft</span>
                                                </>
                                            )}
                                        </MyButton>
                                    )}

                                {/* Single Publish/Unpublish Button - Hidden for non-admin users */}
                                {!hidePublishButtons &&
                                    (activeItem.status === 'PUBLISHED' ? (
                                        <MyButton
                                            buttonType="secondary"
                                            scale="medium"
                                            layoutVariant="default"
                                            onClick={() => setIsUnpublishDialogOpen(true)}
                                        >
                                            <span className="hidden sm:inline">Unpublish</span>
                                            <span className="sm:hidden text-xs">Unpub</span>
                                        </MyButton>
                                    ) : (
                                        <MyButton
                                            buttonType="primary"
                                            scale="medium"
                                            layoutVariant="default"
                                            onClick={() => setIsPublishDialogOpen(true)}
                                        >
                                            <span className="hidden sm:inline">Publish</span>
                                            <span className="sm:hidden text-xs">Pub</span>
                                        </MyButton>
                                    ))}

                                {/* Keep dialogs but make them conditional */}
                                {isUnpublishDialogOpen && (
                                    <UnpublishDialog
                                        isOpen={isUnpublishDialogOpen}
                                        setIsOpen={setIsUnpublishDialogOpen}
                                        handlePublishUnpublishSlide={() =>
                                            handleUnpublishSlide(
                                                setIsUnpublishDialogOpen,
                                                false,
                                                activeItem,
                                                addUpdateDocumentSlide,
                                                addUpdateVideoSlide,
                                                updateQuestionOrder,
                                                updateAssignmentOrder,
                                                addUpdateQuizSlide,
                                                addUpdateAudioSlide,
                                                addUpdateScormSlide,
                                                SaveDraft,
                                                playerRef
                                            )
                                        }
                                    />
                                )}

                                {isPublishDialogOpen && (
                                    <PublishDialog
                                        isOpen={isPublishDialogOpen}
                                        setIsOpen={setIsPublishDialogOpen}
                                        handlePublishUnpublishSlide={() => {
                                            if (
                                                activeItem?.document_slide?.type === 'PRESENTATION'
                                            ) {
                                                publishExcalidrawPresentation();
                                                setIsPublishDialogOpen(false);
                                            } else {
                                                handlePublishSlide(
                                                    setIsPublishDialogOpen,
                                                    false,
                                                    activeItem,
                                                    addUpdateDocumentSlide,
                                                    addUpdateVideoSlide,
                                                    updateQuestionOrder,
                                                    updateAssignmentOrder,
                                                    addUpdateQuizSlide,
                                                    addUpdateAudioSlide,
                                                    addUpdateScormSlide,
                                                    SaveDraft,
                                                    playerRef
                                                );                                            }
                                        }}
                                    />
                                )}
                            </div>

                            {/* ✅ Doubt Icon Trigger */}
                            {showManageDoubts && (
                                <MyButton
                                    layoutVariant="icon"
                                    buttonType="secondary"
                                    title="Open Doubt Resolution Sidebar"
                                    onClick={() => setSidebarOpen(true)}
                                >
                                    <ChatCircleDots className="size-5" />
                                </MyButton>
                            )}
                            {/* Slides Menu Option */}
                            <SlidesMenuOption />
                        </div>
                    )}
                </div>
            )}

            <div
                className={`mx-auto mt-14 ${activeItem?.document_slide?.type === 'PDF' ? 'h-[calc(100vh-200px)]' : 'h-full'
                    } relative z-20 w-full ${activeItem?.document_slide?.type === 'DOC'
                        ? 'overflow-visible'
                        : 'overflow-hidden'
                    }`}
            >
                {content}
            </div>

            {/* ✅ Doubt Sidebar (mounted only if allowed) */}
            {showManageDoubts && <DoubtResolutionSidebar />}
        </div>
    );
};

