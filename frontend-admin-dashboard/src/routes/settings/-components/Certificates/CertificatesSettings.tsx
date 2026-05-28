import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Loader2, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { DndContext, type DragEndEvent, useDraggable } from '@dnd-kit/core';
import {
    Upload as UploadIcon,
    PaintBrush,
    Eye,
    Certificate,
    MagnifyingGlassPlus,
    MagnifyingGlassMinus,
    ArrowsOut,
} from '@phosphor-icons/react';
import { nanoid } from 'nanoid';
import {
    handleConfigureCertificateSettings,
    type CertificateAspectRatio,
} from '../../-services/setting-services';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { certificateHtml as defaultCertificateHtml } from '../../-utils/certificate-html';
import { getPublicUrl, UploadFileInS3 } from '@/services/upload_file';
import { getTokenFromCookie, getTokenDecodedData } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import {
    getEffectiveInstituteLogoFileId,
    getEffectiveInstituteName,
} from '@/lib/auth/facultyAccessUtils';
import { CertificateVisualEditor, type CustomImage } from './CertificateVisualEditor';
import { CertificateTemplateGallery } from './CertificateTemplateGallery';
import { TemplateCustomizationPanel } from './TemplateCustomizationPanel';
import { PdfUploadSection } from '@/routes/certificate-generation/student-data/-components/pdf-upload/pdf-upload-section';
import type {
    AvailableField,
    FieldMapping,
    ImageTemplate,
} from '@/types/certificate/certificate-types';
import { serializeImageTemplateToHtml } from '../../-utils/serialize-image-template-to-html';
import { downloadCertificateTemplatePreview } from '../../-utils/download-certificate-template';
import {
    type BuiltinCertificateTemplate,
    type TemplateCustomizations,
    DEFAULT_BUILTIN_TEMPLATE,
    buildImageTemplateFromBuiltin,
    getBuiltinTemplateById,
    getBuiltinTemplateSvgDataUrl,
    isBuiltinTemplateId,
    rasterizeBuiltinTemplate,
} from '../../-utils/builtin-certificate-templates';
import { cn } from '@/lib/utils';
import { MyButton } from '@/components/design-system/button';

// Available fields the visual editor exposes as draggable chips. These map to
// {{TOKENS}} via FIELD_NAME_TO_TOKEN in serialize-image-template-to-html.ts.
// Any field added here that's not in the token map will be emitted as
// {{FIELD_NAME}} (uppercase) and the backend will leave it unsubstituted.
const AVAILABLE_FIELDS: AvailableField[] = [
    { name: 'student_name', displayName: 'Student Name', type: 'text', isRequired: true, sampleValue: 'Alex Sample', source: 'system' },
    { name: 'institute_name', displayName: 'Institute Name', type: 'text', isRequired: true, sampleValue: 'Vacademy Institute', source: 'system' },
    { name: 'institute_logo', displayName: 'Institute Logo', type: 'text', isRequired: false, sampleValue: '(logo image)', source: 'system' },
    { name: 'course_name', displayName: 'Course Name', type: 'text', isRequired: true, sampleValue: 'Intro to Sample Course', source: 'system' },
    { name: 'package_name', displayName: 'Package Name', type: 'text', isRequired: false, sampleValue: 'Foundation Package', source: 'system' },
    { name: 'package_level', displayName: 'Package Level', type: 'text', isRequired: false, sampleValue: 'Beginner', source: 'system' },
    { name: 'session_name', displayName: 'Session Name', type: 'text', isRequired: false, sampleValue: '2025-26', source: 'system' },
    { name: 'completion_date', displayName: 'Completion Date', type: 'date', isRequired: false, sampleValue: '08-05-2026', source: 'system' },
    { name: 'completion_percentage', displayName: 'Completion %', type: 'number', isRequired: false, sampleValue: '92', source: 'system' },
    { name: 'date_of_completion', displayName: 'Date of Completion', type: 'date', isRequired: false, sampleValue: '08-05-2026', source: 'system' },
    { name: 'certificate_id', displayName: 'Certificate ID', type: 'text', isRequired: false, sampleValue: 'VA-0123-2026', source: 'system' },
    { name: 'enrollment_number', displayName: 'Enrollment Number', type: 'text', isRequired: false, sampleValue: 'ENR2024001', source: 'system' },
    { name: 'email', displayName: 'Email', type: 'text', isRequired: false, sampleValue: 'student@example.com', source: 'system' },
    { name: 'mobile_number', displayName: 'Mobile Number', type: 'text', isRequired: false, sampleValue: '+1 555 0100', source: 'system' },
    { name: 'theme_color', displayName: 'Theme Color', type: 'text', isRequired: false, sampleValue: '#1e4fa1', source: 'system' },
];

// Inline draggable chip mirrors the field-palette pattern from the wizard
// without depending on its `session` prop.
const DraggableFieldChip = ({ field }: { field: AvailableField }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `field-${field.name}`,
        data: { type: 'field', field },
    });
    const style = transform
        ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
        : undefined;
    return (
        <button
            ref={setNodeRef}
            style={style}
            type="button"
            {...listeners}
            {...attributes}
            className={`cursor-grab rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 active:cursor-grabbing ${isDragging ? 'opacity-50' : ''}`}
            title={`Drag onto template to place ${field.displayName}`}
        >
            {field.displayName}
        </button>
    );
};

type CertificateConfig = {
    isDefaultCertificateSettingOn?: boolean;
    currentHtmlCertificateTemplate?: string;
    placeHoldersMapping?: Record<string, string>;
    autoIssuePercentage?: number;
    aspectRatio?: CertificateAspectRatio;
    customWidthMm?: number;
    customHeightMm?: number;
    imageTemplateJson?: string;
    htmlEditorTemplate?: string;
    preferredEditorMode?: 'visual' | 'html';
};

interface CustomUploadSlot {
    imageTemplate: ImageTemplate;
    fieldMappings: FieldMapping[];
    customImages: CustomImage[];
}

const isValidCustomUploadSlot = (raw: unknown): raw is CustomUploadSlot => {
    if (!raw || typeof raw !== 'object') return false;
    const r = raw as Record<string, unknown>;
    return (
        !!r.imageTemplate &&
        typeof r.imageTemplate === 'object' &&
        Array.isArray(r.fieldMappings)
    );
};

const parseImageTemplateJson = (
    raw?: string
): {
    imageTemplate: ImageTemplate | null;
    fieldMappings: FieldMapping[];
    customImages: CustomImage[];
    templateCustomizations: TemplateCustomizations | null;
    customUploadSlot: CustomUploadSlot | null;
} => {
    if (!raw)
        return {
            imageTemplate: null,
            fieldMappings: [],
            customImages: [],
            templateCustomizations: null,
            customUploadSlot: null,
        };
    try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.imageTemplate && Array.isArray(parsed.fieldMappings)) {
            return {
                imageTemplate: parsed.imageTemplate as ImageTemplate,
                fieldMappings: parsed.fieldMappings as FieldMapping[],
                customImages: Array.isArray(parsed.customImages) ? parsed.customImages : [],
                templateCustomizations:
                    parsed.templateCustomizations && typeof parsed.templateCustomizations === 'object'
                        ? (parsed.templateCustomizations as TemplateCustomizations)
                        : null,
                customUploadSlot: isValidCustomUploadSlot(parsed.customUploadSlot)
                    ? {
                          imageTemplate: parsed.customUploadSlot.imageTemplate as ImageTemplate,
                          fieldMappings: parsed.customUploadSlot.fieldMappings as FieldMapping[],
                          customImages: Array.isArray(parsed.customUploadSlot.customImages)
                              ? (parsed.customUploadSlot.customImages as CustomImage[])
                              : [],
                      }
                    : null,
            };
        }
    } catch {
        // fall through
    }
    return {
        imageTemplate: null,
        fieldMappings: [],
        customImages: [],
        templateCustomizations: null,
        customUploadSlot: null,
    };
};

const CertificatesSettings = () => {
    const { instituteDetails, setInstituteDetails } = useInstituteDetailsStore();
    const settingString = instituteDetails?.setting || '';
    const settings = useMemo(() => {
        try {
            return JSON.parse(settingString || '{}');
        } catch {
            return {};
        }
    }, [settingString]);
    const certificateSetting = settings?.setting?.CERTIFICATE_SETTING;
    const existing: CertificateConfig = certificateSetting?.data?.data?.[0] || {};

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isCertificateEnabled, setIsCertificateEnabled] = useState<boolean>(false);
    const [autoIssuePercentage, setAutoIssuePercentage] = useState<number>(80);
    const [aspectRatio, setAspectRatio] = useState<CertificateAspectRatio>('A4_LANDSCAPE');
    const [customWidthMm, setCustomWidthMm] = useState<number>(297);
    const [customHeightMm, setCustomHeightMm] = useState<number>(210);

    // Visual editor state.
    const [imageTemplate, setImageTemplate] = useState<ImageTemplate | null>(null);
    const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
    const [customImages, setCustomImages] = useState<CustomImage[]>([]);

    // Customizations for the currently-active built-in template (colors, text,
    // border width). Lives separately from imageTemplate so the customization
    // panel can edit text/colors without having to crack open the rasterized
    // image. Cleared when a custom upload becomes active.
    const [templateCustomizations, setTemplateCustomizations] =
        useState<TemplateCustomizations | null>(null);

    // Snapshot of the admin's most recent custom upload (image + field
    // placements + custom images). Preserved even when they switch over to a
    // built-in template so the 4th gallery card keeps its thumbnail and a
    // single click restores everything. Cleared only when the admin
    // explicitly removes the upload.
    const [customUploadSlot, setCustomUploadSlot] = useState<CustomUploadSlot | null>(null);

    // Editor mode: 'visual' (drag-and-drop on uploaded image) vs 'html' (raw
    // HTML editing with token chips). HTML mode is an escape hatch for admins
    // who need finer control than the visual editor allows. Hydration picks
    // the right default based on what's saved.
    const [editorMode, setEditorMode] = useState<'visual' | 'html'>('visual');
    const [htmlTemplate, setHtmlTemplate] = useState<string>('');
    const htmlTextareaRef = useRef<HTMLTextAreaElement | null>(null);

    // Hydrate local state from the institute store whenever the underlying
    // settings string changes. useState initializers only run on first mount —
    // so if the institute store hadn't loaded yet, the form stayed at defaults
    // and a subsequent Save (e.g., changing only the completion threshold)
    // sent imageTemplateJson: undefined and overwrote the saved template on
    // the backend. The ref guards against re-hydrating from an unchanged
    // source, so in-progress edits aren't clobbered.
    const hydratedFromRef = useRef<string | null>(null);
    useEffect(() => {
        if (hydratedFromRef.current === settingString) return;
        hydratedFromRef.current = settingString;
        let parsedSettings: any = {};
        try {
            parsedSettings = JSON.parse(settingString || '{}');
        } catch {
            parsedSettings = {};
        }
        const ex: CertificateConfig =
            parsedSettings?.setting?.CERTIFICATE_SETTING?.data?.data?.[0] || {};
        setIsCertificateEnabled(!!ex.isDefaultCertificateSettingOn);
        setAutoIssuePercentage(
            typeof ex.autoIssuePercentage === 'number' ? ex.autoIssuePercentage : 80
        );
        setAspectRatio(ex.aspectRatio || 'A4_LANDSCAPE');
        setCustomWidthMm(ex.customWidthMm ?? 297);
        setCustomHeightMm(ex.customHeightMm ?? 210);
        const parsed = parseImageTemplateJson(ex.imageTemplateJson);
        setImageTemplate(parsed.imageTemplate);
        setFieldMappings(parsed.fieldMappings);
        setCustomImages(parsed.customImages);
        // Restore the custom-upload slot. Priority order:
        //   1. Explicit customUploadSlot field saved on a previous switch.
        //   2. Implicit: if the currently active template is a custom upload,
        //      seed the slot from it so the 4th gallery card lights up on
        //      first load even for sessions that pre-date the slot field.
        if (parsed.customUploadSlot) {
            setCustomUploadSlot(parsed.customUploadSlot);
        } else if (parsed.imageTemplate && !isBuiltinTemplateId(parsed.imageTemplate.id)) {
            setCustomUploadSlot({
                imageTemplate: parsed.imageTemplate,
                fieldMappings: parsed.fieldMappings,
                customImages: parsed.customImages,
            });
        } else {
            setCustomUploadSlot(null);
        }
        // For built-in templates: restore saved customizations or fall back to
        // the template's own defaults so the panel always opens onto sensible
        // values. For custom uploads: nothing to restore — null hides the panel.
        if (parsed.imageTemplate && isBuiltinTemplateId(parsed.imageTemplate.id)) {
            const tpl = getBuiltinTemplateById(parsed.imageTemplate.id);
            setTemplateCustomizations(
                parsed.templateCustomizations ??
                    tpl?.defaultCustomizations(
                        instituteDetails?.institute_theme_code || '#1e4fa1'
                    ) ??
                    null
            );
        } else {
            setTemplateCustomizations(null);
        }

        // HTML editor source of truth: htmlEditorTemplate is the admin's
        // hand-authored HTML, persisted independently of the rendered
        // currentHtmlCertificateTemplate. If it's missing (legacy data),
        // fall back to currentHtmlCertificateTemplate — but only when it
        // doesn't look auto-generated by the visual editor (we detect that
        // via the certificate-canvas class marker so the HTML editor doesn't
        // open onto useless machine markup).
        const savedHtml = ex.currentHtmlCertificateTemplate || '';
        const looksAutoGenerated =
            !savedHtml.trim() || /class\s*=\s*["']certificate-canvas["']/.test(savedHtml);
        const fallbackHtml = looksAutoGenerated ? defaultCertificateHtml : savedHtml;
        setHtmlTemplate(ex.htmlEditorTemplate ?? fallbackHtml);

        // Mode: respect the admin's last explicit choice when available,
        // otherwise infer from which side has data.
        if (ex.preferredEditorMode === 'html' || ex.preferredEditorMode === 'visual') {
            setEditorMode(ex.preferredEditorMode);
        } else {
            setEditorMode(
                parsed.imageTemplate
                    ? 'visual'
                    : savedHtml && !looksAutoGenerated
                      ? 'html'
                      : 'visual'
            );
        }
    }, [settingString]);

    const [activeView, setActiveView] = useState<'upload' | 'design' | 'preview'>('upload');

    // Which gallery card is currently active. Built-in template ids carry the
    // BUILTIN_TEMPLATE_ID_PREFIX so we can recognize them on reload; anything
    // else is treated as the admin's own upload.
    const activeTemplateId: string | undefined = imageTemplate
        ? isBuiltinTemplateId(imageTemplate.id)
            ? imageTemplate.id
            : 'custom'
        : undefined;
    // The 4th card stays populated for as long as the admin has *ever*
    // uploaded a file in this session (or restored one from a saved slot) —
    // independent of which template is currently active. Only an explicit
    // Remove clears it.
    const hasCustomUpload = !!customUploadSlot;
    const customThumbnailUrl = customUploadSlot?.imageTemplate.imageDataUrl;

    // Resolve the institute logo file id to a public URL for substitution
    // previews. Mirrors the navbar's resolution chain.
    const effectiveLogoFileId =
        getEffectiveInstituteLogoFileId(instituteDetails?.institute_logo_file_id ?? undefined) ||
        instituteDetails?.institute_logo_file_id ||
        '';
    const effectiveInstituteName =
        getEffectiveInstituteName(instituteDetails?.institute_name) ||
        instituteDetails?.institute_name ||
        '';
    const [logoUrl, setLogoUrl] = useState<string>('');
    useEffect(() => {
        if (!effectiveLogoFileId) {
            setLogoUrl('');
            return;
        }
        let cancelled = false;
        getPublicUrl(effectiveLogoFileId)
            .then((url) => {
                if (!cancelled && typeof url === 'string') setLogoUrl(url);
            })
            .catch(() => {
                if (!cancelled) setLogoUrl('');
            });
        return () => {
            cancelled = true;
        };
    }, [effectiveLogoFileId]);

    // PdfUploadSection (reused from the bulk wizard) handles PDF rasterization,
    // image dimension extraction, and dropzone UX. We just lift its result up.
    /**
     * Convert a base64 data URL to a File object so it can be uploaded to S3
     * via the existing presigned-URL helper. PdfUploadSection produces a data
     * URL after rasterizing PDFs / loading images; if we ship that data URL
     * verbatim inside imageTemplateJson, the JSON balloons to ~10 MB and the
     * institute setting POST silently truncates → settings disappear after
     * reload. Uploading the bytes once and persisting only the public URL
     * keeps the saved JSON small (<1 KB) and round-trips reliably.
     */
    const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        return new File([blob], filename, { type: blob.type || 'image/png' });
    };

    const handleImageTemplateUpload = async (template: ImageTemplate) => {
        let nextTemplate = template;
        // If the upload produced a data URL (PdfUploadSection always does),
        // hoist it to S3 and replace the data URL with the public URL.
        if (template.imageDataUrl?.startsWith('data:')) {
            try {
                setLoading(true);
                const token = getTokenFromCookie(TokenKey.accessToken);
                const userId = (token ? getTokenDecodedData(token) : null)?.user || '';
                const fileName =
                    template.originalFileName?.replace(/\.[^.]+$/, '') ||
                    `certificate-template-${Date.now()}`;
                const file = await dataUrlToFile(template.imageDataUrl, `${fileName}.png`);
                const fileId = await UploadFileInS3(
                    file,
                    () => {},
                    userId,
                    'CERTIFICATE_TEMPLATE',
                    'INSTITUTE',
                    true
                );
                if (fileId) {
                    const url = await getPublicUrl(fileId);
                    if (typeof url === 'string' && url) {
                        nextTemplate = { ...template, imageDataUrl: url };
                    }
                }
            } catch (e) {
                console.error('Failed to upload certificate template image to S3', e);
                // Best-effort: fall through with the data URL. The Tomcat
                // post-size bump on the backend gives us headroom for those
                // who don't get the S3 upgrade.
            } finally {
                setLoading(false);
            }
        }
        setImageTemplate(nextTemplate);
        setFieldMappings([]);
        setCustomImages([]);
        // A custom upload supersedes any built-in customizations AND becomes
        // the persistent slot behind the 4th gallery card.
        if (!isBuiltinTemplateId(nextTemplate.id)) {
            setTemplateCustomizations(null);
            setCustomUploadSlot({
                imageTemplate: nextTemplate,
                fieldMappings: [],
                customImages: [],
            });
        }
        setActiveView('design');
    };

    const handleTemplateRemove = () => {
        // Explicit Remove wipes the slot too — otherwise the 4th card would
        // keep showing a thumbnail for a file the admin just rejected.
        setImageTemplate(null);
        setFieldMappings([]);
        setCustomImages([]);
        setTemplateCustomizations(null);
        setCustomUploadSlot(null);
        setActiveView('upload');
    };

    /**
     * Save current state into the custom slot if (and only if) the admin is
     * currently working on a custom upload. Called right before they switch
     * over to a built-in template so any in-progress field edits aren't lost.
     */
    const snapshotCustomSlot = () => {
        if (imageTemplate && !isBuiltinTemplateId(imageTemplate.id)) {
            setCustomUploadSlot({
                imageTemplate,
                fieldMappings,
                customImages,
            });
        }
    };

    // Apply one of the built-in template designs. Uses an SVG data URL as the
    // canvas background — cheap to set, no S3 upload — and seeds the
    // customization panel with the template's defaults. The save flow takes
    // care of rasterizing to PNG and uploading to S3 at persist time.
    const handleSelectBuiltinTemplate = (template: BuiltinCertificateTemplate) => {
        // If we're leaving a custom upload, freeze it into the slot first so
        // a click back on the 4th card brings everything back exactly.
        snapshotCustomSlot();
        const themeColor = instituteDetails?.institute_theme_code || '#1e4fa1';
        const initialCustomizations = template.defaultCustomizations(themeColor);
        const { imageTemplate: builtinTpl, fieldMappings: defaultMappings } =
            buildImageTemplateFromBuiltin(template, initialCustomizations);
        setImageTemplate(builtinTpl);
        setFieldMappings(defaultMappings);
        setCustomImages([]);
        setTemplateCustomizations(initialCustomizations);
        setActiveView('design');
    };

    // Re-activate the admin's custom upload (the 4th gallery card). Restores
    // the image, field placements, and decorative custom images exactly as
    // they were when the admin last left this slot.
    const handleSelectCustomUpload = () => {
        if (!customUploadSlot) return;
        setImageTemplate(customUploadSlot.imageTemplate);
        setFieldMappings(customUploadSlot.fieldMappings);
        setCustomImages(customUploadSlot.customImages);
        setTemplateCustomizations(null);
        setActiveView('design');
    };

    // Live-update the canvas as the admin edits colors/text in the
    // customization panel. We just swap the imageDataUrl with a fresh SVG
    // data URL — no upload — so the response is instant. The PNG hoist to S3
    // happens once on Save.
    const handleCustomizationsChange = (next: TemplateCustomizations) => {
        setTemplateCustomizations(next);
        if (!imageTemplate || !isBuiltinTemplateId(imageTemplate.id)) return;
        const tpl = getBuiltinTemplateById(imageTemplate.id);
        if (!tpl) return;
        const dataUrl = getBuiltinTemplateSvgDataUrl(tpl, next);
        setImageTemplate({ ...imageTemplate, imageDataUrl: dataUrl });
    };

    const handleResetCustomizations = () => {
        if (!imageTemplate || !isBuiltinTemplateId(imageTemplate.id)) return;
        const tpl = getBuiltinTemplateById(imageTemplate.id);
        if (!tpl) return;
        const defaults = tpl.defaultCustomizations(
            instituteDetails?.institute_theme_code || '#1e4fa1'
        );
        handleCustomizationsChange(defaults);
    };

    // First-visit default: if the admin has no saved imageTemplate and isn't
    // already in HTML mode, auto-load the default built-in template so the
    // visual editor opens onto a real, editable design instead of an empty
    // upload zone. Guarded by a ref so it fires only once per page lifetime.
    const autoDefaultAppliedRef = useRef(false);
    useEffect(() => {
        if (autoDefaultAppliedRef.current) return;
        // Wait until hydration has run at least once so we don't race the
        // settings store and clobber a saved template.
        if (hydratedFromRef.current === null) return;
        if (editorMode !== 'visual') return;
        if (imageTemplate) return;
        autoDefaultAppliedRef.current = true;
        handleSelectBuiltinTemplate(DEFAULT_BUILTIN_TEMPLATE);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settingString, editorMode, imageTemplate]);

    // Mirrors the bulk wizard's handleDragEnd: when a chip drops on the
    // editor's `image-editor` droppable, append a new FieldMapping at a
    // sensible default position.
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || over.id !== 'image-editor') return;
        if (active.data.current?.type !== 'field') return;
        const field = active.data.current.field as AvailableField;
        if (!imageTemplate) return;
        // Scale default field size to the canvas's natural pixel dimensions so
        // a freshly dropped chip is comfortably visible regardless of whether
        // the uploaded template is 1200x800 or 4488x3173.
        const width = Math.round(Math.max(220, imageTemplate.width * 0.3));
        const fontSize = Math.max(18, Math.round(imageTemplate.height * 0.03));
        const height = Math.round(fontSize * 2);
        const newMapping: FieldMapping = {
            id: nanoid(),
            fieldName: field.name,
            displayName: field.displayName,
            type: field.type,
            position: {
                x: Math.round((imageTemplate.width - width) / 2),
                y: Math.round((imageTemplate.height - height) / 2),
                width,
                height,
            },
            style: {
                fontSize,
                fontColor: '#000000',
                fontFamily: 'Arial, sans-serif',
                alignment: 'center',
                fontWeight: 'normal',
                backgroundColor: 'rgba(255,255,255,0.0)',
                padding: 4,
            },
        };
        setFieldMappings((prev) => [...prev, newMapping]);
    };

    const handleSaveSettings = async () => {
        setLoading(true);
        setError(null);
        try {
            // Both editors now coexist on the backend. Each save:
            //   - sets `currentHtmlCertificateTemplate` from the active mode
            //     (this is the only field the renderer reads)
            //   - sends ONLY the active mode's own data field (imageTemplateJson
            //     for visual, htmlEditorTemplate for html); the other field is
            //     left `undefined` so the backend's "preserve on null" merge
            //     keeps the opposite mode's saved data intact
            //   - records `preferredEditorMode` so the next page load opens
            //     in the mode the admin just saved from
            // For built-in templates we keep an SVG data URL on the canvas
            // during editing so customization changes feel instant. At save
            // time, rasterize that SVG to PNG and hoist it to S3 so the
            // settings JSON stays small and the backend's PDF renderer gets a
            // stable raster URL. Custom uploads already went through the S3
            // pipeline in handleImageTemplateUpload and need no extra work.
            let templateForSave = imageTemplate;
            if (
                editorMode === 'visual' &&
                imageTemplate &&
                isBuiltinTemplateId(imageTemplate.id) &&
                templateCustomizations
            ) {
                const tpl = getBuiltinTemplateById(imageTemplate.id);
                if (tpl) {
                    try {
                        const pngDataUrl = await rasterizeBuiltinTemplate(
                            tpl,
                            templateCustomizations
                        );
                        const token = getTokenFromCookie(TokenKey.accessToken);
                        const userId =
                            (token ? getTokenDecodedData(token) : null)?.user || '';
                        const fileName = `${tpl.id.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.png`;
                        const file = await dataUrlToFile(pngDataUrl, fileName);
                        const fileId = await UploadFileInS3(
                            file,
                            () => {},
                            userId,
                            'CERTIFICATE_TEMPLATE',
                            'INSTITUTE',
                            true
                        );
                        if (fileId) {
                            const url = await getPublicUrl(fileId);
                            if (typeof url === 'string' && url) {
                                templateForSave = { ...imageTemplate, imageDataUrl: url };
                                setImageTemplate(templateForSave);
                            }
                        }
                    } catch (e) {
                        console.error(
                            'Failed to rasterize/upload built-in template at save time',
                            e
                        );
                        // Fall through with the SVG data URL — backend has the
                        // post-size headroom, just slower than a clean S3 URL.
                    }
                }
            }

            const renderedHtml =
                editorMode === 'html'
                    ? htmlTemplate || defaultCertificateHtml
                    : templateForSave
                      ? serializeImageTemplateToHtml(templateForSave, fieldMappings, customImages)
                      : existing.currentHtmlCertificateTemplate || defaultCertificateHtml;

            // Keep the persisted slot in sync. If the admin is currently on
            // the custom upload, snapshot the latest state into the slot so
            // the next reload sees the most recent field placements. If
            // they're on a built-in, the slot already holds whatever they
            // last left there.
            const slotForSave: CustomUploadSlot | null =
                templateForSave && !isBuiltinTemplateId(templateForSave.id)
                    ? {
                          imageTemplate: templateForSave,
                          fieldMappings,
                          customImages,
                      }
                    : customUploadSlot;

            const editorJson =
                editorMode === 'visual' && templateForSave
                    ? JSON.stringify({
                          imageTemplate: templateForSave,
                          fieldMappings,
                          customImages,
                          templateCustomizations,
                          customUploadSlot: slotForSave,
                      })
                    : undefined;
            const htmlAuthored = editorMode === 'html' ? htmlTemplate : undefined;

            await handleConfigureCertificateSettings({
                isEnabled: isCertificateEnabled,
                isCertificateExists: !!certificateSetting,
                placeHoldersMapping: existing.placeHoldersMapping || {},
                currentHtmlTemplate: renderedHtml,
                autoIssuePercentage,
                aspectRatio,
                customWidthMm: aspectRatio === 'CUSTOM' ? customWidthMm : undefined,
                customHeightMm: aspectRatio === 'CUSTOM' ? customHeightMm : undefined,
                imageTemplateJson: editorJson,
                htmlEditorTemplate: htmlAuthored,
                preferredEditorMode: editorMode,
            });

            // Patch the institute store with the just-saved values so a
            // remount of this page (or any other consumer of
            // instituteDetails.setting) sees the saved data instead of the
            // pre-save snapshot, which would otherwise force a full page
            // reload to recover.
            if (instituteDetails) {
                let parsedSettings: any = {};
                try {
                    parsedSettings = JSON.parse(instituteDetails.setting || '{}');
                } catch {
                    parsedSettings = {};
                }
                const updatedRecord: CertificateConfig = {
                    ...(existing || {}),
                    isDefaultCertificateSettingOn: isCertificateEnabled,
                    currentHtmlCertificateTemplate: renderedHtml,
                    autoIssuePercentage,
                    aspectRatio,
                    customWidthMm: aspectRatio === 'CUSTOM' ? customWidthMm : undefined,
                    customHeightMm: aspectRatio === 'CUSTOM' ? customHeightMm : undefined,
                    // Only overwrite the active mode's data field locally;
                    // leave the other one in place so the next remount has
                    // both editors' state available.
                    imageTemplateJson:
                        editorMode === 'visual'
                            ? editorJson
                            : (existing?.imageTemplateJson ?? undefined),
                    htmlEditorTemplate:
                        editorMode === 'html'
                            ? htmlAuthored
                            : (existing?.htmlEditorTemplate ?? undefined),
                    preferredEditorMode: editorMode,
                };
                const nextSettings = {
                    ...parsedSettings,
                    setting: {
                        ...(parsedSettings?.setting || {}),
                        CERTIFICATE_SETTING: {
                            ...(parsedSettings?.setting?.CERTIFICATE_SETTING || {}),
                            data: {
                                ...(parsedSettings?.setting?.CERTIFICATE_SETTING?.data || {}),
                                data: [updatedRecord],
                            },
                        },
                    },
                };
                const nextSettingString = JSON.stringify(nextSettings);
                // Mark this string as already hydrated so the effect doesn't
                // re-run and overwrite our just-set local state with itself.
                hydratedFromRef.current = nextSettingString;
                setInstituteDetails({
                    ...instituteDetails,
                    setting: nextSettingString,
                });
            }

            setSuccess('Certificate settings saved successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (e) {
            console.error('Error saving certificate settings:', e);
            setError('Failed to save certificate settings. Please try again.');
            setTimeout(() => setError(null), 5000);
        } finally {
            setLoading(false);
        }
    };

    const [downloading, setDownloading] = useState(false);
    const handleDownloadTemplate = async () => {
        if (!imageTemplate) return;
        try {
            setDownloading(true);
            await downloadCertificateTemplatePreview(
                imageTemplate,
                fieldMappings,
                `${imageTemplate.originalFileName || 'certificate-template'}-preview.pdf`,
                { customImages, instituteLogoUrl: logoUrl }
            );
        } catch (e) {
            console.error('Failed to download template preview', e);
            setError('Failed to download template preview.');
            setTimeout(() => setError(null), 5000);
        } finally {
            setDownloading(false);
        }
    };

    // Surface a hint about logo / theme when admin hasn't set them yet.
    const themeNotSet = !instituteDetails?.institute_theme_code;
    const logoNotSet = !logoUrl;

    return (
        <div className="space-y-6">
            {error && (
                <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {success && (
                <Alert variant="default" className="border-green-200 bg-green-50 text-green-800">
                    <CheckCircle className="size-4" />
                    <AlertDescription>{success}</AlertDescription>
                </Alert>
            )}

            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="flex items-center gap-2 text-lg font-bold">
                        <FileText className="size-6" />
                        Certificate Settings
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Upload a certificate background image, drag dynamic fields onto it, set the
                        issue threshold, and choose the aspect ratio.
                    </p>
                </div>
                <Button
                    onClick={handleSaveSettings}
                    disabled={loading}
                    className="flex items-center gap-2"
                >
                    {loading ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <CheckCircle className="size-4" />
                    )}
                    Save Changes
                </Button>
            </div>

            {(themeNotSet || logoNotSet) && (
                <Alert variant="default" className="border-amber-300 bg-amber-50 text-amber-900">
                    <AlertTriangle className="size-4" />
                    <AlertDescription>
                        {logoNotSet && (
                            <span className="block">
                                Institute logo is not set — upload one in Dashboard → Edit institute
                                profile so it appears on issued certificates and the navbar.
                            </span>
                        )}
                        {themeNotSet && (
                            <span className="block">
                                Institute theme color is not set — borders that bind to{' '}
                                <code>{'{{INSTITUTE_THEME_COLOR}}'}</code> will fall back to{' '}
                                <code>#1e4fa1</code>.
                            </span>
                        )}
                    </AlertDescription>
                </Alert>
            )}

            <div className="rounded-lg border bg-card p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-semibold">Auto-issue certificates</h3>
                        <p className="text-sm text-muted-foreground">
                            When enabled, learners receive a certificate as soon as their course
                            completion crosses the threshold below.
                        </p>
                    </div>
                    <Switch
                        id="certificate-enabled"
                        checked={isCertificateEnabled}
                        onCheckedChange={setIsCertificateEnabled}
                    />
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    <div>
                        <label className="text-sm font-medium" htmlFor="threshold">
                            Completion threshold (%)
                        </label>
                        <input
                            id="threshold"
                            type="number"
                            min={1}
                            max={100}
                            value={autoIssuePercentage}
                            onChange={(e) =>
                                setAutoIssuePercentage(
                                    Math.min(100, Math.max(1, Number(e.target.value) || 0))
                                )
                            }
                            className="mt-1 w-full rounded border px-3 py-2 text-sm"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                            Default: 80. Backend re-validates this value at issuance time.
                        </p>
                    </div>

                    <div>
                        <label className="text-sm font-medium" htmlFor="aspect">
                            Aspect ratio
                        </label>
                        <select
                            id="aspect"
                            value={aspectRatio}
                            onChange={(e) =>
                                setAspectRatio(e.target.value as CertificateAspectRatio)
                            }
                            className="mt-1 w-full rounded border px-3 py-2 text-sm"
                        >
                            <option value="A4_LANDSCAPE">A4 Landscape</option>
                            <option value="A4_PORTRAIT">A4 Portrait</option>
                            <option value="A3_LANDSCAPE">A3 Landscape</option>
                            <option value="A3_PORTRAIT">A3 Portrait</option>
                            <option value="CUSTOM">Custom</option>
                        </select>
                    </div>

                    {aspectRatio === 'CUSTOM' && (
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-sm font-medium" htmlFor="cw">
                                    Width (mm)
                                </label>
                                <input
                                    id="cw"
                                    type="number"
                                    min={50}
                                    value={customWidthMm}
                                    onChange={(e) =>
                                        setCustomWidthMm(Number(e.target.value) || 0)
                                    }
                                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium" htmlFor="ch">
                                    Height (mm)
                                </label>
                                <input
                                    id="ch"
                                    type="number"
                                    min={50}
                                    value={customHeightMm}
                                    onChange={(e) =>
                                        setCustomHeightMm(Number(e.target.value) || 0)
                                    }
                                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Wizard-style header card with Upload | Design | Preview tabs.
                Mirrors pdf-annotation-step.tsx so the settings page matches the
                bulk-generation flow's visual language. */}
            <DndContext onDragEnd={handleDragEnd}>
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-gradient-to-br from-white to-neutral-50/30 p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-purple-100 p-2">
                                    <Certificate className="size-5 text-purple-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-neutral-700">
                                        Template Design & Certificate Generation
                                    </h2>
                                    <p className="text-sm text-neutral-500">
                                        Upload template and annotate with student data fields
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Editor-mode pill: lets admins flip between
                                    the drag-and-drop visual editor and a raw
                                    HTML editor. Switching warns about losing
                                    in-progress edits in the other mode. */}
                                <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1">
                                    {[
                                        { key: 'visual', label: 'Visual' },
                                        { key: 'html', label: 'HTML' },
                                    ].map(({ key, label }) => (
                                        <button
                                            key={key}
                                            onClick={() => {
                                                if (key === editorMode) return;
                                                // Both editors persist independently
                                                // — switching is non-destructive. Just
                                                // make sure HTML mode opens onto a
                                                // real editable template (sample) if
                                                // the admin has nothing of their own
                                                // there yet.
                                                if (key === 'html') {
                                                    const trimmed = (htmlTemplate || '').trim();
                                                    if (
                                                        !trimmed ||
                                                        /class\s*=\s*["']certificate-canvas["']/.test(
                                                            htmlTemplate
                                                        )
                                                    ) {
                                                        setHtmlTemplate(defaultCertificateHtml);
                                                    }
                                                }
                                                setEditorMode(key as 'visual' | 'html');
                                            }}
                                            className={cn(
                                                'rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                                                editorMode === key
                                                    ? 'bg-white text-purple-600 shadow-sm'
                                                    : 'text-neutral-600 hover:text-neutral-700'
                                            )}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                {editorMode === 'visual' && (
                                    <MyButton
                                        buttonType="secondary"
                                        scale="medium"
                                        onClick={handleDownloadTemplate}
                                        disabled={!imageTemplate || downloading}
                                        className="flex items-center gap-2"
                                    >
                                        {downloading ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                            <Download className="size-4" />
                                        )}
                                        Download Template
                                    </MyButton>
                                )}
                                {editorMode === 'visual' && (
                                <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1">
                                {[
                                    { key: 'upload', label: 'Upload', icon: UploadIcon },
                                    { key: 'design', label: 'Design', icon: PaintBrush },
                                    { key: 'preview', label: 'Preview', icon: Eye },
                                ].map(({ key, label, icon: Icon }) => (
                                    <button
                                        key={key}
                                        onClick={() =>
                                            setActiveView(key as 'upload' | 'design' | 'preview')
                                        }
                                        disabled={
                                            (key === 'design' || key === 'preview') &&
                                            !imageTemplate
                                        }
                                        className={cn(
                                            'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all',
                                            activeView === key
                                                ? 'bg-white text-purple-600 shadow-sm'
                                                : 'text-neutral-600 hover:text-neutral-700',
                                            (key === 'design' || key === 'preview') &&
                                                !imageTemplate &&
                                                'cursor-not-allowed opacity-50'
                                        )}
                                    >
                                        <Icon className="size-4" />
                                        {label}
                                    </button>
                                ))}
                                </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {editorMode === 'html' && (
                        <HtmlCertificateEditor
                            html={htmlTemplate}
                            onHtmlChange={setHtmlTemplate}
                            textareaRef={htmlTextareaRef}
                            logoUrl={logoUrl}
                            instituteName={effectiveInstituteName}
                            aspectRatio={aspectRatio}
                            customWidthMm={customWidthMm}
                            customHeightMm={customHeightMm}
                            onResetToDefault={() => setHtmlTemplate(defaultCertificateHtml)}
                        />
                    )}

                    {editorMode === 'visual' && activeView === 'design' && (
                        <CertificateTemplateGallery
                            activeTemplateId={activeTemplateId}
                            hasCustomUpload={hasCustomUpload}
                            customThumbnailUrl={customThumbnailUrl}
                            themeColor={
                                instituteDetails?.institute_theme_code || '#1e4fa1'
                            }
                            onSelectBuiltin={handleSelectBuiltinTemplate}
                            onSelectCustom={handleSelectCustomUpload}
                            disabled={loading}
                        />
                    )}

                    {editorMode === 'visual' &&
                        activeView === 'design' &&
                        imageTemplate &&
                        isBuiltinTemplateId(imageTemplate.id) &&
                        templateCustomizations &&
                        (() => {
                            const tpl = getBuiltinTemplateById(imageTemplate.id);
                            if (!tpl) return null;
                            return (
                                <TemplateCustomizationPanel
                                    template={tpl}
                                    customizations={templateCustomizations}
                                    onChange={handleCustomizationsChange}
                                    onResetToDefaults={handleResetCustomizations}
                                    disabled={loading}
                                />
                            );
                        })()}

                    {editorMode === 'visual' && (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                        {(activeView === 'design' || activeView === 'preview') &&
                            imageTemplate && (
                                <div className="lg:col-span-1">
                                    <div className="rounded-lg border bg-card p-4 space-y-3">
                                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Drag a field
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {AVAILABLE_FIELDS.map((f) => (
                                                <DraggableFieldChip key={f.name} field={f} />
                                            ))}
                                        </div>
                                        <div className="rounded border bg-muted/30 p-2 text-xs text-muted-foreground">
                                            {fieldMappings.length} field
                                            {fieldMappings.length === 1 ? '' : 's'} placed
                                        </div>
                                    </div>
                                </div>
                            )}

                        <div
                            className={cn(
                                activeView === 'upload' ? 'col-span-1' : 'lg:col-span-3'
                            )}
                        >
                            {activeView === 'upload' && (
                                <PdfUploadSection
                                    onImageTemplateUpload={handleImageTemplateUpload}
                                    onTemplateRemove={handleTemplateRemove}
                                    uploadedTemplate={imageTemplate ?? undefined}
                                    isLoading={loading}
                                />
                            )}

                            {activeView === 'design' && imageTemplate && (
                                <CertificateVisualEditor
                                    imageTemplate={imageTemplate}
                                    fieldMappings={fieldMappings}
                                    onFieldMappingsChange={setFieldMappings}
                                    systemImageUrls={{ institute_logo: logoUrl }}
                                    customImages={customImages}
                                    onCustomImagesChange={setCustomImages}
                                />
                            )}

                            {activeView === 'preview' && imageTemplate && (
                                <CertificateSettingsPreview
                                    imageTemplate={imageTemplate}
                                    fieldMappings={fieldMappings}
                                    customImages={customImages}
                                    logoUrl={logoUrl}
                                    instituteName={effectiveInstituteName}
                                />
                            )}
                        </div>
                    </div>
                    )}
                </div>
            </DndContext>
        </div>
    );
};

/**
 * Maps a system field's `name` to the placeholder token the backend
 * substitutes at issuance time. Mirrors FIELD_NAME_TO_TOKEN in
 * serialize-image-template-to-html.ts so HTML-mode chip insertion produces
 * the same tokens the visual editor would have written.
 */
const FIELD_NAME_TO_TOKEN_HTML: Record<string, string> = {
    user_id: '{{USER_ID}}',
    enrollment_number: '{{ENROLLMENT_NUMBER}}',
    student_name: '{{STUDENT_NAME}}',
    full_name: '{{STUDENT_NAME}}',
    email: '{{EMAIL}}',
    mobile_number: '{{MOBILE_NUMBER}}',
    institute_name: '{{INSTITUTE_NAME}}',
    institute_logo: '{{INSTITUTE_LOGO}}',
    course_name: '{{COURSE_NAME}}',
    package_name: '{{PACKAGE_NAME}}',
    package_level: '{{PACKAGE_LEVEL}}',
    session_name: '{{SESSION_NAME}}',
    completion_date: '{{DATE_OF_COMPLETION}}',
    completion_percentage: '{{COMPLETION_PERCENTAGE}}',
    // Both `date_of_completion` (new canonical name) and legacy `issue_date`
    // map to the same token so saved templates that pre-date the rename keep
    // resolving on the backend without re-saving.
    date_of_completion: '{{DATE_OF_COMPLETION}}',
    issue_date: '{{DATE_OF_COMPLETION}}',
    certificate_id: '{{CERTIFICATE_ID}}',
    theme_color: '{{INSTITUTE_THEME_COLOR}}',
};

/**
 * Raw HTML editor: textarea on the left for writing/pasting custom HTML,
 * clickable token chips that insert {{TOKENS}} at the textarea's caret, a
 * "Reset to default" button, and a sandboxed iframe preview on the right
 * with sample values substituted so admins can see what the rendered cert
 * will look like before saving. Backend remains untouched — saving in HTML
 * mode just writes the raw HTML to currentHtmlCertificateTemplate.
 */
const PX_PER_MM = 96 / 25.4;

const aspectRatioToMm = (
    ar: CertificateAspectRatio,
    customW: number,
    customH: number
): { wMm: number; hMm: number } => {
    switch (ar) {
        case 'A4_LANDSCAPE':
            return { wMm: 297, hMm: 210 };
        case 'A4_PORTRAIT':
            return { wMm: 210, hMm: 297 };
        case 'A3_LANDSCAPE':
            return { wMm: 420, hMm: 297 };
        case 'A3_PORTRAIT':
            return { wMm: 297, hMm: 420 };
        case 'CUSTOM':
            return { wMm: Math.max(50, customW || 297), hMm: Math.max(50, customH || 210) };
    }
};

const HtmlCertificateEditor = ({
    html,
    onHtmlChange,
    textareaRef,
    logoUrl,
    instituteName,
    aspectRatio,
    customWidthMm,
    customHeightMm,
    onResetToDefault,
}: {
    html: string;
    onHtmlChange: (html: string) => void;
    textareaRef: React.MutableRefObject<HTMLTextAreaElement | null>;
    logoUrl?: string;
    instituteName?: string;
    aspectRatio: CertificateAspectRatio;
    customWidthMm: number;
    customHeightMm: number;
    onResetToDefault: () => void;
}) => {
    const insertAtCaret = (token: string) => {
        const ta = textareaRef.current;
        if (!ta) {
            onHtmlChange((html || '') + token);
            return;
        }
        const start = ta.selectionStart ?? html.length;
        const end = ta.selectionEnd ?? html.length;
        const next = html.slice(0, start) + token + html.slice(end);
        onHtmlChange(next);
        // Restore caret immediately after the inserted token.
        requestAnimationFrame(() => {
            ta.focus();
            const pos = start + token.length;
            ta.setSelectionRange(pos, pos);
        });
    };

    const previewSrcDoc = useMemo(() => {
        const sampleCertId = 'PREVIEW-0000-2026';
        const samples: Record<string, string> = {
            '{{STUDENT_NAME}}': 'Alex Sample',
            '{{INSTITUTE_NAME}}': instituteName || 'Vacademy Institute',
            '{{COURSE_NAME}}': 'Intro to Sample Course',
            '{{PACKAGE_NAME}}': 'Foundation Package',
            '{{PACKAGE_LEVEL}}': 'Beginner',
            '{{SESSION_NAME}}': '2025-26',
            '{{COMPLETION_PERCENTAGE}}': '92',
            '{{DATE_OF_COMPLETION}}': new Date().toLocaleDateString(),
            // Legacy alias kept so previews of pre-rename templates still
            // substitute correctly.
            '{{ISSUE_DATE}}': new Date().toLocaleDateString(),
            '{{CERTIFICATE_ID}}': sampleCertId,
            '{{ENROLLMENT_NUMBER}}': 'ENR2024001',
            '{{EMAIL}}': 'student@example.com',
            '{{MOBILE_NUMBER}}': '+1 555 0100',
            '{{USER_ID}}': 'PREVIEW_USER',
            // Legacy tokens used by the bundled default template and older
            // saved templates. The backend fills these via its numeric
            // placeholder pass (LEVEL->2, TODAY_DATE->9, DESIGNATION->6,
            // SIGNATURE->7); mirror them here so the preview matches the
            // issued certificate instead of showing raw {{TOKEN}} text.
            '{{LEVEL}}': 'Beginner',
            '{{TODAY_DATE}}': new Date().toLocaleDateString(),
            '{{DESIGNATION}}': 'Official Signatory',
            '{{SIGNATURE}}': '',
            '{{INSTITUTE_THEME_COLOR}}': '#1e4fa1',
            '{{INSTITUTE_LOGO}}':
                logoUrl ||
                'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        };
        let out = html || '';
        for (const [t, v] of Object.entries(samples)) out = out.split(t).join(v);
        // Mirror server-side appendCertificateIdBadge so admins see the
        // bottom-right cert ID chip that learners will see on the issued
        // PDF, regardless of where (or whether) they placed {{CERTIFICATE_ID}}
        // in the template.
        const badge =
            `<div style="position:fixed;bottom:8mm;right:10mm;` +
            `font-family:Arial,sans-serif;font-size:10px;color:#444;` +
            `background:rgba(255,255,255,0.85);padding:3px 8px;` +
            `border:1px solid #d0d7de;border-radius:4px;letter-spacing:0.5px;">` +
            `Certificate ID: ${sampleCertId}</div>`;
        const closing = out.lastIndexOf('</body>');
        out = closing >= 0 ? out.slice(0, closing) + badge + out.slice(closing) : out + badge;
        return out;
    }, [html, logoUrl, instituteName]);

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
                <div className="rounded-lg border bg-card p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Insert a token
                        </div>
                        <button
                            type="button"
                            onClick={onResetToDefault}
                            className="text-xs font-medium text-purple-600 hover:text-purple-700"
                        >
                            Reset to default
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {AVAILABLE_FIELDS.map((f) => {
                            const token = FIELD_NAME_TO_TOKEN_HTML[f.name] ??
                                `{{${f.name.toUpperCase()}}}`;
                            return (
                                <button
                                    key={f.name}
                                    type="button"
                                    onClick={() => insertAtCaret(token)}
                                    title={`Insert ${token} at cursor`}
                                    className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                                >
                                    {f.displayName}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <textarea
                    ref={textareaRef}
                    value={html}
                    onChange={(e) => onHtmlChange(e.target.value)}
                    spellCheck={false}
                    className="h-[640px] w-full rounded-lg border border-neutral-300 bg-white p-3 font-mono text-xs leading-relaxed shadow-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                    placeholder="<!-- Paste or write HTML for your certificate. Use the token chips above to insert dynamic fields like {{STUDENT_NAME}}. -->"
                />
            </div>
            <div className="flex flex-col gap-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Live preview (sample data)
                </div>
                <HtmlPreviewWithZoom
                    srcDoc={previewSrcDoc}
                    aspectRatio={aspectRatio}
                    customWidthMm={customWidthMm}
                    customHeightMm={customHeightMm}
                />
            </div>
        </div>
    );
};

/**
 * HTML preview frame with zoom in / zoom out / fit-to-screen controls.
 * Mirrors the visual editor's preview UX so admins get the same controls
 * regardless of which editor mode they're in. Defaults to fit-to-container
 * scale so the certificate is fully visible without manual scrolling.
 */
const HtmlPreviewWithZoom = ({
    srcDoc,
    aspectRatio,
    customWidthMm,
    customHeightMm,
}: {
    srcDoc: string;
    aspectRatio: CertificateAspectRatio;
    customWidthMm: number;
    customHeightMm: number;
}) => {
    const { wMm, hMm } = aspectRatioToMm(aspectRatio, customWidthMm, customHeightMm);
    const pageWidthPx = Math.round(wMm * PX_PER_MM);
    const pageHeightPx = Math.round(hMm * PX_PER_MM);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const [fitScale, setFitScale] = useState(1);
    const [zoom, setZoom] = useState<number | null>(null);

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const compute = () => {
            const w = el.clientWidth - 24;
            const h = el.clientHeight - 24;
            if (w <= 0 || h <= 0) return;
            const s = Math.min(w / pageWidthPx, h / pageHeightPx);
            setFitScale(s > 0 ? s : 1);
        };
        compute();
        const ro = new ResizeObserver(compute);
        ro.observe(el);
        return () => ro.disconnect();
    }, [pageWidthPx, pageHeightPx]);

    const effectiveScale = zoom ?? fitScale;
    const pct = Math.round(effectiveScale * 100);
    const zoomOut = () => setZoom(Math.max(0.1, effectiveScale - 0.1));
    const zoomIn = () => setZoom(Math.min(4, effectiveScale + 0.1));
    const fitToScreen = () => setZoom(null);

    return (
        <div className="flex h-[700px] w-full flex-col overflow-hidden rounded-lg border bg-neutral-50">
            <div className="flex items-center justify-end gap-2 border-b bg-white px-3 py-2">
                <button
                    type="button"
                    onClick={zoomOut}
                    className="rounded p-1.5 text-neutral-600 hover:bg-neutral-100"
                    title="Zoom out"
                >
                    <MagnifyingGlassMinus size={18} />
                </button>
                <span className="min-w-[3rem] text-center text-sm font-medium text-neutral-700">
                    {pct}%
                </span>
                <button
                    type="button"
                    onClick={zoomIn}
                    className="rounded p-1.5 text-neutral-600 hover:bg-neutral-100"
                    title="Zoom in"
                >
                    <MagnifyingGlassPlus size={18} />
                </button>
                <button
                    type="button"
                    onClick={fitToScreen}
                    className="ml-1 rounded p-1.5 text-neutral-600 hover:bg-neutral-100"
                    title="Fit to screen"
                >
                    <ArrowsOut size={18} />
                </button>
            </div>
            <div
                ref={containerRef}
                className="flex flex-1 items-center justify-center overflow-auto p-3"
            >
                <div
                    style={{
                        width: pageWidthPx * effectiveScale,
                        height: pageHeightPx * effectiveScale,
                        flex: 'none',
                    }}
                >
                    <iframe
                        title="HTML certificate preview"
                        srcDoc={srcDoc}
                        sandbox=""
                        style={{
                            width: pageWidthPx,
                            height: pageHeightPx,
                            transform: `scale(${effectiveScale})`,
                            transformOrigin: '0 0',
                            border: 0,
                            background: 'white',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

/**
 * Lightweight preview that renders the serialized HTML in a sandboxed iframe
 * with sample values substituted, so admins can see what an issued certificate
 * will look like before saving.
 */
const CertificateSettingsPreview = ({
    imageTemplate,
    fieldMappings,
    customImages,
    logoUrl,
    instituteName,
}: {
    imageTemplate: ImageTemplate;
    fieldMappings: FieldMapping[];
    customImages?: CustomImage[];
    logoUrl?: string;
    instituteName?: string;
}) => {
    const srcDoc = useMemo(() => {
        const html = serializeImageTemplateToHtml(imageTemplate, fieldMappings, customImages);
        const samples: Record<string, string> = {
            '{{STUDENT_NAME}}': 'Alex Sample',
            '{{INSTITUTE_NAME}}': instituteName || 'Vacademy Institute',
            '{{COURSE_NAME}}': 'Intro to Sample Course',
            '{{PACKAGE_NAME}}': 'Foundation Package',
            '{{PACKAGE_LEVEL}}': 'Beginner',
            '{{SESSION_NAME}}': '2025-26',
            '{{COMPLETION_PERCENTAGE}}': '92',
            '{{DATE_OF_COMPLETION}}': new Date().toLocaleDateString(),
            // Legacy alias for pre-rename templates.
            '{{ISSUE_DATE}}': new Date().toLocaleDateString(),
            '{{CERTIFICATE_ID}}': 'PREVIEW-0000-2026',
            '{{ENROLLMENT_NUMBER}}': 'ENR2024001',
            '{{EMAIL}}': 'student@example.com',
            '{{MOBILE_NUMBER}}': '+1 555 0100',
            // Legacy tokens used by the bundled default template and older
            // saved templates. The backend fills these via its numeric
            // placeholder pass (LEVEL->2, TODAY_DATE->9, DESIGNATION->6,
            // SIGNATURE->7); mirror them here so the preview matches the
            // issued certificate instead of showing raw {{TOKEN}} text.
            '{{LEVEL}}': 'Beginner',
            '{{TODAY_DATE}}': new Date().toLocaleDateString(),
            '{{DESIGNATION}}': 'Official Signatory',
            '{{SIGNATURE}}': '',
            '{{INSTITUTE_THEME_COLOR}}': '#1e4fa1',
            // Use the real institute logo URL when available so the preview
            // matches the issued certificate. Falls back to a transparent gif
            // so missing-logo institutes don't show a broken image.
            '{{INSTITUTE_LOGO}}':
                logoUrl ||
                'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        };
        let out = html;
        for (const [t, v] of Object.entries(samples)) out = out.split(t).join(v);
        return out;
    }, [imageTemplate, fieldMappings, customImages, logoUrl, instituteName]);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const [fitScale, setFitScale] = useState(1);
    const [zoom, setZoom] = useState<number | null>(null);

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const compute = () => {
            const w = el.clientWidth - 24;
            const h = el.clientHeight - 24;
            if (w <= 0 || h <= 0) return;
            const s = Math.min(w / imageTemplate.width, h / imageTemplate.height);
            setFitScale(s > 0 ? s : 1);
        };
        compute();
        const ro = new ResizeObserver(compute);
        ro.observe(el);
        return () => ro.disconnect();
    }, [imageTemplate.width, imageTemplate.height]);

    const effectiveScale = zoom ?? fitScale;
    const pct = Math.round(effectiveScale * 100);

    const zoomOut = () => setZoom(Math.max(0.1, effectiveScale - 0.1));
    const zoomIn = () => setZoom(Math.min(4, effectiveScale + 0.1));
    const fitToScreen = () => setZoom(null);

    return (
        <div className="flex h-[700px] w-full flex-col overflow-hidden rounded border bg-neutral-50">
            <div className="flex items-center justify-end gap-2 border-b bg-white px-3 py-2">
                <button
                    type="button"
                    onClick={zoomOut}
                    className="rounded p-1.5 text-neutral-600 hover:bg-neutral-100"
                    title="Zoom out"
                >
                    <MagnifyingGlassMinus size={18} />
                </button>
                <span className="min-w-[3rem] text-center text-sm font-medium text-neutral-700">
                    {pct}%
                </span>
                <button
                    type="button"
                    onClick={zoomIn}
                    className="rounded p-1.5 text-neutral-600 hover:bg-neutral-100"
                    title="Zoom in"
                >
                    <MagnifyingGlassPlus size={18} />
                </button>
                <button
                    type="button"
                    onClick={fitToScreen}
                    className="ml-1 rounded p-1.5 text-neutral-600 hover:bg-neutral-100"
                    title="Fit to screen"
                >
                    <ArrowsOut size={18} />
                </button>
            </div>
            <div
                ref={containerRef}
                className="flex flex-1 items-center justify-center overflow-auto p-3"
            >
                <div
                    style={{
                        width: imageTemplate.width * effectiveScale,
                        height: imageTemplate.height * effectiveScale,
                        flex: 'none',
                    }}
                >
                    <iframe
                        title="Certificate preview"
                        srcDoc={srcDoc}
                        sandbox=""
                        style={{
                            width: imageTemplate.width,
                            height: imageTemplate.height,
                            transform: `scale(${effectiveScale})`,
                            transformOrigin: '0 0',
                            border: 0,
                            background: 'white',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default CertificatesSettings;
