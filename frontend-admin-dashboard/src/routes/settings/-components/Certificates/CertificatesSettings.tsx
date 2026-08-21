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
    Plus,
    Trash,
} from '@phosphor-icons/react';
import { nanoid } from 'nanoid';
import {
    getCertificateNumberingStatus,
    handleConfigureCertificateSettings,
    type BarcodeContent,
    type CertificateAspectRatio,
    type CertificateCustomField,
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
import { CertificateTemplateLibrary } from './CertificateTemplateLibrary';
import { CertificateNumberingBuilder } from './CertificateNumberingBuilder';
import { VerificationPageSection, type VerificationPageConfig } from './VerificationPageSection';
import {
    newTemplateId,
    readTemplateLibrary,
    type EditorStateJson,
    resolveDefaultTemplate,
    templateNameFromFile,
    uniqueTemplateName,
    upsertTemplate,
    withInstituteLogo,
    type SavedCertificateTemplate,
} from '../../-utils/certificate-template-library';
import { TemplateCustomizationPanel } from './TemplateCustomizationPanel';
import { PdfUploadSection } from '@/routes/certificate-generation/student-data/-components/pdf-upload/pdf-upload-section';
import type {
    AvailableField,
    FieldMapping,
    ImageTemplate,
} from '@/types/certificate/certificate-types';
import {
    CUSTOM_FIELD_PREFIX,
    fieldNameToToken,
    MAX_TEXT_LINES,
    normalizeCustomFieldKey,
    serializeImageTemplateToHtml,
    TEXT_LINE_HEIGHT,
} from '../../-utils/serialize-image-template-to-html';
import {
    buildAutoBadgeHtml,
    codeSizePx,
    injectAutoBadge,
    isCodeFieldName,
    minBarcodeWidthMm,
    planFromHtml,
    type BadgeCodeType,
} from '../../-utils/certificate-auto-badge';
import {
    applyCertificateSamples,
    buildCertificateSampleTokens,
} from '../../-utils/certificate-preview-samples';
import { applyTextFitToHtml } from '../../-utils/certificate-text-fit';
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
/**
 * Kept in sync with CertificateNumberService.DEFAULT_PATTERN on the backend.
 * Shown as the placeholder so an admin can see what blank means.
 */
const DEFAULT_NUMBERING_PATTERN = '{PREFIX}{YYYY}{SEQ:3}';
const DEFAULT_SEQUENCE_PADDING = 3;
const DEFAULT_PREFIX_LENGTH = 3;

/** Mirrors CertificateNumberService.resolvePrefix. */
const derivePrefixFromInstituteName = (name: string | undefined | null): string => {
    const letters = (name ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!letters) return 'XXX';
    if (letters.length >= DEFAULT_PREFIX_LENGTH) return letters.slice(0, DEFAULT_PREFIX_LENGTH);
    return letters.padEnd(DEFAULT_PREFIX_LENGTH, 'X');
};

/**
 * Mirrors CertificateNumberService.format so the preview matches the number that
 * will actually be issued. Kept deliberately small — if the two ever diverge,
 * the backend is authoritative.
 */
const formatCertificateNumberPreview = (opts: {
    pattern: string;
    prefix: string;
    suffix: string;
    padding: number;
    sequence: number;
    year: number;
}): string => {
    const pattern = opts.pattern.trim() || DEFAULT_NUMBERING_PATTERN;
    const padding = opts.padding > 0 ? opts.padding : DEFAULT_SEQUENCE_PADDING;

    const withSeq = pattern.replace(/\{SEQ(?::(\d+))?\}/g, (_m, digits) => {
        const width = digits ? Number(digits) : padding;
        return String(opts.sequence).padStart(width, '0');
    });

    const substituted = withSeq
        .replace(/\{PREFIX\}/g, opts.prefix)
        .replace(/\{SUFFIX\}/g, opts.suffix)
        .replace(/\{YYYY\}/g, String(opts.year))
        .replace(/\{YY\}/g, String(opts.year % 100).padStart(2, '0'))
        .replace(/\{COURSE_CODE\}/g, '');

    // Collapse separators orphaned by an empty token, then trim the edges.
    return substituted
        .replace(/([-/_])\1+/g, '$1')
        .replace(/^[-/_]+/, '')
        .replace(/[-/_]+$/, '')
        .trim();
};

const AVAILABLE_FIELDS: AvailableField[] = [
    {
        name: 'student_name',
        displayName: 'Student Name',
        type: 'text',
        isRequired: true,
        sampleValue: 'Alex Sample',
        source: 'system',
    },
    {
        name: 'institute_name',
        displayName: 'Institute Name',
        type: 'text',
        isRequired: true,
        sampleValue: 'Vacademy Institute',
        source: 'system',
    },
    {
        name: 'institute_logo',
        displayName: 'Institute Logo',
        type: 'text',
        isRequired: false,
        sampleValue: '(logo image)',
        source: 'system',
    },
    {
        name: 'course_name',
        displayName: 'Course Name',
        type: 'text',
        isRequired: true,
        sampleValue: 'Intro to Sample Course',
        source: 'system',
    },
    {
        name: 'package_name',
        displayName: 'Package Name',
        type: 'text',
        isRequired: false,
        sampleValue: 'Foundation Package',
        source: 'system',
    },
    {
        name: 'package_level',
        displayName: 'Package Level',
        type: 'text',
        isRequired: false,
        sampleValue: 'Beginner',
        source: 'system',
    },
    {
        name: 'session_name',
        displayName: 'Session Name',
        type: 'text',
        isRequired: false,
        sampleValue: '2025-26',
        source: 'system',
    },
    {
        name: 'completion_date',
        displayName: 'Completion Date',
        type: 'date',
        isRequired: false,
        sampleValue: '08-05-2026',
        source: 'system',
    },
    {
        name: 'completion_percentage',
        displayName: 'Completion %',
        type: 'number',
        isRequired: false,
        sampleValue: '92',
        source: 'system',
    },
    {
        name: 'date_of_completion',
        displayName: 'Date of Completion',
        type: 'date',
        isRequired: false,
        sampleValue: '08-05-2026',
        source: 'system',
    },
    {
        name: 'certificate_id',
        displayName: 'Certificate ID',
        type: 'text',
        isRequired: false,
        sampleValue: 'VA-0123-2026',
        source: 'system',
    },
    {
        name: 'certificate_qr',
        displayName: 'QR Code',
        type: 'text',
        isRequired: false,
        sampleValue: '(QR image)',
        source: 'system',
    },
    {
        name: 'certificate_barcode',
        displayName: 'Barcode',
        type: 'text',
        isRequired: false,
        sampleValue: '(barcode image)',
        source: 'system',
    },
    // Worth placing beside a barcode: a barcode that gets damaged, photocopied
    // or cropped stops scanning, and the printed code is then the only way left
    // to verify the certificate.
    {
        name: 'certificate_short_code',
        displayName: 'Verification Code',
        type: 'text',
        isRequired: false,
        sampleValue: 'A1B2C3D4E5',
        source: 'system',
    },
    {
        name: 'enrollment_number',
        displayName: 'Enrollment Number',
        type: 'text',
        isRequired: false,
        sampleValue: 'ENR2024001',
        source: 'system',
    },
    {
        name: 'email',
        displayName: 'Email',
        type: 'text',
        isRequired: false,
        sampleValue: 'student@example.com',
        source: 'system',
    },
    {
        name: 'mobile_number',
        displayName: 'Mobile Number',
        type: 'text',
        isRequired: false,
        sampleValue: '+1 555 0100',
        source: 'system',
    },
    {
        name: 'theme_color',
        displayName: 'Theme Color',
        type: 'text',
        isRequired: false,
        sampleValue: '#1e4fa1',
        source: 'system',
    },
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

/**
 * Admin-defined certificate fields.
 *
 * The built-in token list is platform-wide and fixed, so an institute wanting
 * "Grade", "Director of Studies" or an accreditation line on its certificates
 * had no way to add one — and dropping an unrecognised chip on the canvas used
 * to print the raw `{{GRADE}}` on the learner's PDF.
 *
 * Keys are normalised to the token shape as you type, and shown, because the
 * key is what the renderer matches on. An admin who cannot see it has no way to
 * tell why a field came out blank.
 */
const CustomFieldsEditor = ({
    fields,
    onChange,
}: {
    fields: CertificateCustomField[];
    onChange: (fields: CertificateCustomField[]) => void;
}) => {
    const update = (index: number, patch: Partial<CertificateCustomField>) =>
        onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));

    const addField = () =>
        onChange([
            ...fields,
            { key: '', displayName: '', valueType: 'STATIC', value: '', fallbackValue: '' },
        ]);

    // Duplicates are flagged rather than blocked: two fields sharing a key both
    // resolve to the same token, so the second silently overwrites the first on
    // every certificate — invisible unless we say so.
    const keyCounts = fields.reduce<Record<string, number>>((counts, f) => {
        const key = normalizeCustomFieldKey(f.key || '');
        if (key) counts[key] = (counts[key] ?? 0) + 1;
        return counts;
    }, {});

    return (
        <div>
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Your own fields</label>
                <Button type="button" variant="outline" size="sm" onClick={addField}>
                    <Plus className="mr-1 size-3" />
                    Add field
                </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
                For anything the built-in fields don&apos;t cover — a grade, a signatory&apos;s
                title, an accreditation line. Each one becomes a chip you can drag onto the design,
                anywhere you like.
            </p>

            {fields.length === 0 ? (
                <div className="mt-2 rounded border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
                    No custom fields yet.
                </div>
            ) : (
                <div className="mt-2 space-y-3">
                    {fields.map((field, index) => {
                        const key = normalizeCustomFieldKey(field.key || '');
                        const isDuplicate = !!key && (keyCounts[key] ?? 0) > 1;
                        return (
                            <div key={index} className="space-y-2 rounded border bg-card p-3">
                                <div className="flex items-start gap-2">
                                    <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                                        <div>
                                            <label className="text-xs text-muted-foreground">
                                                Field name
                                            </label>
                                            <input
                                                type="text"
                                                value={field.displayName}
                                                placeholder="Grade"
                                                onChange={(e) => {
                                                    // Typing the label fills the key until the
                                                    // admin edits the key directly, so the common
                                                    // case needs one input, not two.
                                                    const displayName = e.target.value;
                                                    const derivedFromOld = normalizeCustomFieldKey(
                                                        field.displayName || ''
                                                    );
                                                    update(index, {
                                                        displayName,
                                                        key:
                                                            !field.key ||
                                                            field.key === derivedFromOld
                                                                ? normalizeCustomFieldKey(
                                                                      displayName
                                                                  )
                                                                : field.key,
                                                    });
                                                }}
                                                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-muted-foreground">
                                                Where the value comes from
                                            </label>
                                            <select
                                                value={field.valueType}
                                                onChange={(e) =>
                                                    update(index, {
                                                        valueType:
                                                            e.target.value === 'CUSTOM_FIELD'
                                                                ? 'CUSTOM_FIELD'
                                                                : 'STATIC',
                                                    })
                                                }
                                                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                                            >
                                                <option value="STATIC">
                                                    Same text on every certificate
                                                </option>
                                                <option value="CUSTOM_FIELD">
                                                    The learner&apos;s own answer
                                                </option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-muted-foreground">
                                                {field.valueType === 'CUSTOM_FIELD'
                                                    ? 'Learner custom field key'
                                                    : 'Text to print'}
                                            </label>
                                            <input
                                                type="text"
                                                value={field.value}
                                                placeholder={
                                                    field.valueType === 'CUSTOM_FIELD'
                                                        ? 'final_grade'
                                                        : 'Director of Studies'
                                                }
                                                onChange={(e) =>
                                                    update(index, { value: e.target.value })
                                                }
                                                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                                            />
                                        </div>
                                        {field.valueType === 'CUSTOM_FIELD' && (
                                            <div>
                                                <label className="text-xs text-muted-foreground">
                                                    If the learner has no answer
                                                </label>
                                                <input
                                                    type="text"
                                                    value={field.fallbackValue ?? ''}
                                                    placeholder="—"
                                                    onChange={(e) =>
                                                        update(index, {
                                                            fallbackValue: e.target.value,
                                                        })
                                                    }
                                                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            onChange(fields.filter((_, i) => i !== index))
                                        }
                                        className="mt-5 text-destructive hover:text-destructive"
                                        aria-label={`Remove ${field.displayName || 'field'}`}
                                    >
                                        <Trash className="size-4" />
                                    </Button>
                                </div>

                                {key ? (
                                    <p className="text-xs text-muted-foreground">
                                        Placed on the certificate as{' '}
                                        <code className="rounded bg-muted px-1 font-mono">
                                            {`{{CF_${key}}}`}
                                        </code>
                                        {isDuplicate && (
                                            <span className="ml-2 font-medium text-destructive">
                                                Two fields share this name — only the first will be
                                                used.
                                            </span>
                                        )}
                                    </p>
                                ) : (
                                    <p className="text-xs text-muted-foreground">
                                        Give this field a name so it can be placed.
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

type CertificateConfig = {
    isDefaultCertificateSettingOn?: boolean;
    certificateNumbering?: {
        pattern?: string;
        prefix?: string;
        suffix?: string;
        sequencePadding?: number;
        startFrom?: number;
        resetAnnually?: boolean;
    };
    qrVerificationUrlTemplate?: string;
    badgeCodeType?: 'QR' | 'BARCODE';
    barcodeContent?: BarcodeContent;
    autoStampCode?: boolean;
    autoStampNumber?: boolean;
    verificationNote?: string;
    verificationHeadline?: string;
    verificationShowCourse?: boolean;
    verificationShowIssueDate?: boolean;
    verificationShowCompletion?: boolean;
    customFields?: CertificateCustomField[];
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
        !!r.imageTemplate && typeof r.imageTemplate === 'object' && Array.isArray(r.fieldMappings)
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
    /**
     * The whole parsed blob, so the template library can read its own keys
     * without this function having to know about them. Null when the JSON was
     * absent or unparseable.
     */
    raw: EditorStateJson | null;
} => {
    if (!raw)
        return {
            imageTemplate: null,
            fieldMappings: [],
            customImages: [],
            templateCustomizations: null,
            customUploadSlot: null,
            raw: null,
        };
    try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.imageTemplate && Array.isArray(parsed.fieldMappings)) {
            return {
                raw: parsed as EditorStateJson,
                imageTemplate: parsed.imageTemplate as ImageTemplate,
                fieldMappings: parsed.fieldMappings as FieldMapping[],
                customImages: Array.isArray(parsed.customImages) ? parsed.customImages : [],
                templateCustomizations:
                    parsed.templateCustomizations &&
                    typeof parsed.templateCustomizations === 'object'
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
        // A blob with no top-level imageTemplate can still carry a library —
        // that is what an institute whose only design lives in the library
        // looks like once nothing is open in the editor.
        if (parsed && typeof parsed === 'object') {
            return {
                raw: parsed as EditorStateJson,
                imageTemplate: null,
                fieldMappings: [],
                customImages: [],
                templateCustomizations: null,
                customUploadSlot: null,
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
        raw: null,
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

    // Certificate numbering. Blank fields mean "use the shipped default":
    // {PREFIX}{YYYY}{SEQ:3} with PREFIX = first three letters of the institute
    // name, i.e. EDU2026001.
    const [numberingPattern, setNumberingPattern] = useState<string>('');
    const [numberingPrefix, setNumberingPrefix] = useState<string>('');
    const [numberingSuffix, setNumberingSuffix] = useState<string>('');
    const [sequencePadding, setSequencePadding] = useState<number>(3);
    // Where the series begins, for an institute continuing from paper records or
    // another system. 0 means unset — the counter simply carries on. The backend
    // treats it as a floor, so a value at or below what is already issued is
    // ignored rather than reissuing a live certificate number.
    const [numberingStartFrom, setNumberingStartFrom] = useState<number>(0);
    // Absent means true, matching the backend: the counter has always reset each
    // January, and every institute saved before this setting existed relies on
    // that.
    const [numberingResetAnnually, setNumberingResetAnnually] = useState<boolean>(true);
    // Highest position the counter has handed out, read from the server. Drives
    // the sample numbers and the "that start number is already used" warning.
    const [highestIssuedSequence, setHighestIssuedSequence] = useState<number | undefined>(
        undefined
    );
    const [qrVerificationUrlTemplate, setQrVerificationUrlTemplate] = useState<string>('');
    const [badgeCodeType, setBadgeCodeType] = useState<'QR' | 'BARCODE'>('QR');
    // Defaults to NUMBER, which is what every certificate issued before this
    // setting existed encodes. Switching to VERIFICATION_CODE makes the barcode
    // scannable-to-verify but noticeably wider, so it is opt-in.
    const [barcodeContent, setBarcodeContent] = useState<BarcodeContent>('NUMBER');
    const [customFields, setCustomFields] = useState<CertificateCustomField[]>([]);

    // Whether the platform may stamp the code and the number bottom-right on a
    // design that does not place them itself. Both start on, which is what the
    // badge always did — until these existed, deleting the QR or the number
    // from a design just brought the stamped one back on the issued PDF.
    // How the public verification page presents itself. Defaults match what the
    // page shipped with, so an institute that never opens this sees no change.
    const [verificationPage, setVerificationPage] = useState<VerificationPageConfig>({
        headline: '',
        note: '',
        showCourse: true,
        showIssueDate: true,
        showCompletion: true,
    });
    const [autoStampCode, setAutoStampCode] = useState<boolean>(true);
    const [autoStampNumber, setAutoStampNumber] = useState<boolean>(true);

    // What actually gets saved: keys normalised to the token shape the renderer
    // looks for, keyless rows dropped, duplicates collapsed. Two fields sharing
    // a key would both resolve to the same {{CF_…}} token, so the second would
    // silently overwrite the first on every certificate.
    const sanitizedCustomFields = useMemo<CertificateCustomField[]>(() => {
        const seen = new Set<string>();
        return customFields.reduce<CertificateCustomField[]>((out, field) => {
            const key = normalizeCustomFieldKey(field.key || '');
            if (!key || seen.has(key)) return out;
            seen.add(key);
            out.push({
                key,
                displayName: field.displayName?.trim() || key,
                valueType: field.valueType === 'CUSTOM_FIELD' ? 'CUSTOM_FIELD' : 'STATIC',
                value: field.value ?? '',
                fallbackValue: field.fallbackValue ?? '',
            });
            return out;
        }, []);
    }, [customFields]);

    // The palette: built-ins plus this institute's own fields. Chips are keyed
    // `custom_field:<KEY>`, which the serializer turns into {{CF_<KEY>}}.
    const paletteFields = useMemo<AvailableField[]>(
        () => [
            ...AVAILABLE_FIELDS,
            ...sanitizedCustomFields.map((field) => ({
                name: `${CUSTOM_FIELD_PREFIX}${field.key}`,
                displayName: field.displayName,
                type: 'text' as const,
                isRequired: false,
                sampleValue:
                    field.valueType === 'CUSTOM_FIELD'
                        ? field.fallbackValue || `(${field.value || 'learner value'})`
                        : field.value,
                source: 'system' as const,
            })),
        ],
        [sanitizedCustomFields]
    );
    // True while the visual editor is showing a template that was auto-loaded
    // as a starting point rather than saved by this institute or picked just
    // now. Keeps the gallery from claiming it is the active design.
    const [isAutoLoadedTemplate, setIsAutoLoadedTemplate] = useState(false);

    const derivedPrefix = useMemo(
        () => derivePrefixFromInstituteName(instituteDetails?.institute_name),
        [instituteDetails?.institute_name]
    );

    // The position the next certificate actually takes. Mirrors the backend's
    // max(counter + 1, startFrom) — the sample numbers shown all over this page
    // are supposed to be what gets issued, and a hardcoded 1 told an institute
    // already sitting at #1200 that its series starts over.
    const nextCertificateSequence = useMemo(
        () => Math.max((highestIssuedSequence ?? 0) + 1, numberingStartFrom, 1),
        [highestIssuedSequence, numberingStartFrom]
    );

    // Read where the counter stands. Depends only on which counter is selected —
    // the yearly one or the continuous one — so it does not refetch while the
    // admin types a start number; that value is applied locally on top.
    useEffect(() => {
        let cancelled = false;
        getCertificateNumberingStatus({ resetAnnually: numberingResetAnnually })
            .then((status) => {
                if (!cancelled && typeof status?.highestIssuedSequence === 'number') {
                    setHighestIssuedSequence(status.highestIssuedSequence);
                }
            })
            .catch(() => {
                // A counter we cannot read is not worth blocking the page for:
                // the builder falls back to showing the series from #1, and the
                // backend applies the real floor at issuance either way.
                if (!cancelled) setHighestIssuedSequence(undefined);
            });
        return () => {
            cancelled = true;
        };
    }, [numberingResetAnnually]);

    const numberingPreview = useMemo(
        () =>
            formatCertificateNumberPreview({
                pattern: numberingPattern,
                prefix: numberingPrefix.trim() || derivedPrefix,
                suffix: numberingSuffix,
                padding: sequencePadding,
                sequence: nextCertificateSequence,
                year: new Date().getFullYear(),
            }),
        [
            numberingPattern,
            numberingPrefix,
            numberingSuffix,
            sequencePadding,
            derivedPrefix,
            nextCertificateSequence,
        ]
    );

    // Same number the editor ghost and both previews show, so a sample number
    // never changes shape as you move between design and preview. Falls back
    // when the numbering pattern is empty and the preview comes out blank.
    const sampleCertificateNumber = numberingPreview || 'VA-0123-2026';

    /**
     * The address a scanned QR really opens: the platform's verification page on
     * the institute's own portal. Mirrors
     * CertificateVerificationService.buildVerificationUrl — shown rather than
     * described, because "your own branded page" is not believable without it.
     */
    const verificationPageUrl = useMemo(() => {
        const host = (instituteDetails?.learner_portal_base_url || '').trim().replace(/\/+$/, '');
        if (!host) return '';
        const base = /^https?:\/\//i.test(host) ? host : `https://${host}`;
        return `${base}/verify/${sampleCertificateNumber}`;
    }, [instituteDetails?.learner_portal_base_url, sampleCertificateNumber]);

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

    // Every design this institute has saved, and which of them learners get.
    // The editor still works on exactly one design at a time (imageTemplate /
    // fieldMappings above); the library is where the others wait, and
    // defaultTemplateId is the one whose HTML is written to
    // currentHtmlCertificateTemplate — the single field the renderer reads.
    const [templateLibrary, setTemplateLibrary] = useState<SavedCertificateTemplate[]>([]);
    const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(null);
    // Which library entry the editor has open. Null means the open design is
    // not in the library yet, so saving adds it rather than updating one.
    const [activeLibraryId, setActiveLibraryId] = useState<string | null>(null);

    // Editor mode: 'visual' (drag-and-drop on uploaded image) vs 'html' (raw
    // HTML editing with token chips). HTML mode is an escape hatch for admins
    // who need finer control than the visual editor allows. Hydration picks
    // the right default based on what's saved.
    const [editorMode, setEditorMode] = useState<'visual' | 'html'>('visual');
    const [htmlTemplate, setHtmlTemplate] = useState<string>('');

    // Whether a barcode will actually print — either stamped automatically as
    // the badge, or placed on the design by hand. A placed Barcode field renders
    // regardless of badgeCodeType, so keying the setting off badgeCodeType alone
    // hid it from exactly the admins who had positioned one themselves.
    const usesBarcode = useMemo(() => {
        if (badgeCodeType === 'BARCODE') return true;
        if (editorMode === 'visual') {
            return fieldMappings.some((f) => f.fieldName === 'certificate_barcode');
        }
        return /\{\{\s*CERTIFICATE_BARCODE\s*\}\}/i.test(htmlTemplate || '');
    }, [badgeCodeType, editorMode, fieldMappings, htmlTemplate]);
    const htmlTextareaRef = useRef<HTMLTextAreaElement | null>(null);

    // Hydrate local state from the institute store whenever the underlying
    // settings string changes. useState initializers only run on first mount —
    // so if the institute store hadn't loaded yet, the form stayed at defaults
    // and a subsequent Save (e.g., changing only the completion threshold)
    // sent imageTemplateJson: undefined and overwrote the saved template on
    // the backend. The ref guards against re-hydrating from an unchanged
    // source, so in-progress edits aren't clobbered.
    const hydratedFromRef = useRef<string | null>(null);
    // Set as soon as hydration finds a saved design, so the first-visit
    // auto-load below can never fire over one. It cannot rely on reading
    // `imageTemplate` for that: both effects run in the same commit, so the
    // auto-load sees the pre-hydration value (null) and would replace the
    // institute's own template with a built-in — and, now that designs are kept
    // in a library, leave a stray entry behind as well.
    const autoDefaultAppliedRef = useRef(false);
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
        setNumberingPattern(ex.certificateNumbering?.pattern ?? '');
        setNumberingPrefix(ex.certificateNumbering?.prefix ?? '');
        setNumberingSuffix(ex.certificateNumbering?.suffix ?? '');
        setSequencePadding(ex.certificateNumbering?.sequencePadding ?? 3);
        setNumberingStartFrom(
            typeof ex.certificateNumbering?.startFrom === 'number'
                ? Math.max(0, ex.certificateNumbering.startFrom)
                : 0
        );
        setNumberingResetAnnually(ex.certificateNumbering?.resetAnnually !== false);
        setQrVerificationUrlTemplate(ex.qrVerificationUrlTemplate ?? '');
        setBadgeCodeType(ex.badgeCodeType === 'BARCODE' ? 'BARCODE' : 'QR');
        setBarcodeContent(
            ex.barcodeContent === 'VERIFICATION_CODE' ? 'VERIFICATION_CODE' : 'NUMBER'
        );
        setCustomFields(Array.isArray(ex.customFields) ? ex.customFields : []);
        // Absent means on, matching the backend: every institute that saved
        // before these existed had the stamp, unconditionally.
        setVerificationPage({
            headline: ex.verificationHeadline ?? '',
            note: ex.verificationNote ?? '',
            // Absent means shown: these were not optional before the page could
            // be configured, so unset has to keep reading that way.
            showCourse: ex.verificationShowCourse !== false,
            showIssueDate: ex.verificationShowIssueDate !== false,
            showCompletion: ex.verificationShowCompletion !== false,
        });
        setAutoStampCode(ex.autoStampCode !== false);
        setAutoStampNumber(ex.autoStampNumber !== false);
        const parsed = parseImageTemplateJson(ex.imageTemplateJson);
        // The library, and the design the editor should open onto: the default
        // one, because that is the certificate this institute actually issues.
        // Institutes that saved before the library existed get their single
        // design migrated into it here — see readTemplateLibrary.
        const { library, defaultTemplateId: savedDefaultId } = readTemplateLibrary(parsed.raw);
        setTemplateLibrary(library);
        setDefaultTemplateId(savedDefaultId);
        const openEntry = resolveDefaultTemplate(library, savedDefaultId);
        setActiveLibraryId(openEntry?.id ?? null);
        if (openEntry || parsed.imageTemplate) autoDefaultAppliedRef.current = true;

        setImageTemplate(openEntry?.imageTemplate ?? parsed.imageTemplate);
        // Restored from saved settings, so it genuinely is this
        // institute's template, not a starting point.
        if (openEntry || parsed.imageTemplate) setIsAutoLoadedTemplate(false);
        setFieldMappings(openEntry?.fieldMappings ?? parsed.fieldMappings);
        setCustomImages(openEntry?.customImages ?? parsed.customImages);
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
        const openTemplate = openEntry?.imageTemplate ?? parsed.imageTemplate;
        if (openTemplate && isBuiltinTemplateId(openTemplate.id)) {
            const tpl = getBuiltinTemplateById(openTemplate.id);
            setTemplateCustomizations(
                openEntry?.templateCustomizations ??
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

    /**
     * The page splits into three because it answers three unrelated questions,
     * and stacked in one column they read as one long form: what the
     * certificate looks like, how it is numbered and coded, and what someone
     * scanning it sees. Whether certificates are issued at all stays outside
     * the tabs — it governs all three.
     */
    const [settingsTab, setSettingsTab] = useState<'design' | 'numbering' | 'verification'>(
        'design'
    );

    // Which gallery card is currently active. Built-in template ids carry the
    // BUILTIN_TEMPLATE_ID_PREFIX so we can recognize them on reload; anything
    // else is treated as the admin's own upload.
    //
    // A template that was auto-loaded (rather than saved or clicked) is only a
    // starting point for the editor — it is NOT what this institute issues. The
    // gallery must not mark it "Selected": 524 of 527 institutes have no saved
    // editor state but do have a real certificate template, so the highlight
    // would confidently point at a design they have never used.
    const activeTemplateId: string | undefined =
        imageTemplate && !isAutoLoadedTemplate
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

        // Every upload is a template in its own right. Before this, a second
        // upload overwrote the first and there was no way back to it — which is
        // also why "make one of them the default" had nothing to choose from.
        const becomesDefault = !defaultTemplateId;
        const uploaded: SavedCertificateTemplate = {
            id: newTemplateId(),
            name: uniqueTemplateName(
                templateLibrary,
                templateNameFromFile(
                    nextTemplate.originalFileName || nextTemplate.fileName,
                    templateLibrary.length + 1
                )
            ),
            imageTemplate: nextTemplate,
            fieldMappings: [],
            customImages: [],
            templateCustomizations: null,
            updatedAt: Date.now(),
        };
        // An upload arrives with no fields at all, so the one that becomes the
        // institute's default starts with its logo on it. Only at this point:
        // once the design exists, what is on it is the admin's to decide.
        const entry = becomesDefault ? withInstituteLogo(uploaded) : uploaded;
        if (becomesDefault) setFieldMappings(entry.fieldMappings);
        setTemplateLibrary((prev) => upsertTemplate(prev, entry));
        setActiveLibraryId(entry.id);
        // The first design an institute saves has to be the default, or it
        // would have a template library and still issue nothing.
        setDefaultTemplateId((prev) => prev ?? entry.id);

        setActiveView('design');
        setIsAutoLoadedTemplate(false);
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
        setIsAutoLoadedTemplate(false);
        setActiveView('design');

        // Picking a ready-made design replaces whatever the editor had open —
        // the same as before this page had a library. "Add template" is the
        // path to a *new* entry; this one keeps the entry's id and name so an
        // admin trying out designs doesn't leave a trail of near-duplicates.
        const entryId = activeLibraryId ?? newTemplateId();
        const existing = templateLibrary.find((t) => t.id === entryId);
        const entry: SavedCertificateTemplate = {
            id: entryId,
            name: existing?.name ?? uniqueTemplateName(templateLibrary, template.name),
            imageTemplate: builtinTpl,
            fieldMappings: defaultMappings,
            customImages: [],
            templateCustomizations: initialCustomizations,
            updatedAt: Date.now(),
        };
        setTemplateLibrary((prev) => upsertTemplate(prev, entry));
        setActiveLibraryId(entryId);
        setDefaultTemplateId((prev) => prev ?? entryId);
    };

    /**
     * Fold whatever the editor currently holds back into its library entry.
     *
     * <p>Called before anything that changes which design is open or which is
     * the default. Without it, moving between templates loses the field
     * placements the admin just dragged — the edits live in `fieldMappings`,
     * not in the library, until something puts them there.
     */
    const commitActiveToLibrary = (library = templateLibrary): SavedCertificateTemplate[] => {
        if (!imageTemplate) return library;
        const entryId = activeLibraryId ?? newTemplateId();
        const existing = library.find((t) => t.id === entryId);
        return upsertTemplate(library, {
            id: entryId,
            name:
                existing?.name ??
                uniqueTemplateName(
                    library,
                    templateNameFromFile(
                        imageTemplate.originalFileName || imageTemplate.fileName,
                        library.length + 1
                    )
                ),
            imageTemplate,
            fieldMappings,
            customImages,
            templateCustomizations,
            updatedAt: Date.now(),
        });
    };

    /** Open a saved design, keeping the edits made to the one being left. */
    const handleOpenLibraryTemplate = (id: string) => {
        const committed = commitActiveToLibrary();
        const entry = committed.find((t) => t.id === id);
        if (!entry) return;
        setTemplateLibrary(committed);
        setActiveLibraryId(entry.id);
        setImageTemplate(entry.imageTemplate);
        setFieldMappings(entry.fieldMappings);
        setCustomImages(entry.customImages);
        setTemplateCustomizations(entry.templateCustomizations);
        setIsAutoLoadedTemplate(false);
        setActiveView('design');
    };

    /**
     * Make a design the one learners receive.
     *
     * <p>Also puts the institute's logo on it if it has none. A design becoming
     * the default is the moment it starts being issued, and a custom upload
     * starts life with no fields at all — so without this an institute could
     * make its own artwork default and send out certificates carrying no mark
     * of who awarded them.
     */
    const handleMakeDefaultTemplate = (id: string) => {
        const committed = commitActiveToLibrary();
        const entry = committed.find((t) => t.id === id);
        if (!entry) return;
        const branded = withInstituteLogo(entry);
        setTemplateLibrary(upsertTemplate(committed, branded));
        setDefaultTemplateId(id);
        // Keep the editor in step when it is showing the design that just
        // gained a logo, or the admin would only see it after a reload.
        if (activeLibraryId === id) {
            setFieldMappings(branded.fieldMappings);
        }
    };

    const handleRenameLibraryTemplate = (id: string, name: string) => {
        setTemplateLibrary((prev) =>
            prev.map((t) => (t.id === id ? { ...t, name: uniqueTemplateName(prev, name, id) } : t))
        );
    };

    const handleDeleteLibraryTemplate = (id: string) => {
        // The default is not deletable from the UI, so this only ever removes a
        // design nobody is receiving.
        if (id === defaultTemplateId) return;
        const next = templateLibrary.filter((t) => t.id !== id);
        setTemplateLibrary(next);
        if (activeLibraryId === id) {
            const fallback = resolveDefaultTemplate(next, defaultTemplateId);
            setActiveLibraryId(fallback?.id ?? null);
            setImageTemplate(fallback?.imageTemplate ?? null);
            setFieldMappings(fallback?.fieldMappings ?? []);
            setCustomImages(fallback?.customImages ?? []);
            setTemplateCustomizations(fallback?.templateCustomizations ?? null);
        }
    };

    /** Start a design that is not any of the saved ones. */
    const handleAddLibraryTemplate = () => {
        setTemplateLibrary(commitActiveToLibrary());
        setActiveLibraryId(null);
        setImageTemplate(null);
        setFieldMappings([]);
        setCustomImages([]);
        setTemplateCustomizations(null);
        setActiveView('upload');
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
        setIsAutoLoadedTemplate(false);
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
    useEffect(() => {
        if (autoDefaultAppliedRef.current) return;
        // Wait until hydration has run at least once so we don't race the
        // settings store and clobber a saved template.
        if (hydratedFromRef.current === null) return;
        if (editorMode !== 'visual') return;
        if (imageTemplate) return;
        autoDefaultAppliedRef.current = true;
        handleSelectBuiltinTemplate(DEFAULT_BUILTIN_TEMPLATE);
        // Flag after the handler, which clears it for explicit picks.
        setIsAutoLoadedTemplate(true);
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
        //
        // Codes are the exception: they are images with a fixed aspect, so they
        // get the same box the backend's automatic stamp uses. A text-shaped
        // box would letterbox a QR into a sliver and squash a barcode until it
        // stops scanning.
        const isCodeField = isCodeFieldName(field.name);
        const codeBox = codeSizePx(
            field.name === 'certificate_barcode' ? 'BARCODE' : 'QR',
            barcodeContent
        );
        const width = isCodeField
            ? codeBox.width
            : Math.round(Math.max(220, imageTemplate.width * 0.3));
        const fontSize = Math.max(18, Math.round(imageTemplate.height * 0.03));
        // Tall enough for the two lines a long value is allowed to wrap to
        // (MAX_TEXT_LINES x TEXT_LINE_HEIGHT), so a learner with a long name
        // doesn't land in a box that was only ever one line deep.
        const height = isCodeField
            ? codeBox.height
            : Math.round(fontSize * MAX_TEXT_LINES * TEXT_LINE_HEIGHT);
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

    /**
     * Give a saved design a stable, S3-hosted background.
     *
     * <p>The editor keeps a built-in's artwork as an SVG data URL so colour and
     * text changes feel instant. That is fine while editing and wrong once
     * stored: the data URL lands inside the design's rendered HTML, and every
     * certificate issued from it carries the whole image inline.
     *
     * <p>Runs per entry rather than only for the default, because a course can
     * now follow any saved design — so any of them can be the one being
     * rendered. Entries whose artwork is already a URL (every upload, and every
     * built-in that has been through here once) are returned untouched, so a
     * save costs an upload only for designs that have just been added.
     */
    const materializeTemplate = async (
        entry: SavedCertificateTemplate
    ): Promise<SavedCertificateTemplate> => {
        const source = entry.imageTemplate.imageDataUrl || '';
        if (!source.startsWith('data:')) return entry;

        try {
            let pngDataUrl = source;
            if (isBuiltinTemplateId(entry.imageTemplate.id) && entry.templateCustomizations) {
                const tpl = getBuiltinTemplateById(entry.imageTemplate.id);
                if (tpl) {
                    pngDataUrl = await rasterizeBuiltinTemplate(tpl, entry.templateCustomizations);
                }
            }
            const token = getTokenFromCookie(TokenKey.accessToken);
            const userId = (token ? getTokenDecodedData(token) : null)?.user || '';
            const fileName = `${entry.imageTemplate.id.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.png`;
            const file = await dataUrlToFile(pngDataUrl, fileName);
            const fileId = await UploadFileInS3(
                file,
                () => {},
                userId,
                'CERTIFICATE_TEMPLATE',
                'INSTITUTE',
                true
            );
            if (!fileId) return entry;
            const url = await getPublicUrl(fileId);
            if (typeof url !== 'string' || !url) return entry;
            return { ...entry, imageTemplate: { ...entry.imageTemplate, imageDataUrl: url } };
        } catch (e) {
            // Fall through with the data URL: a slower certificate beats a save
            // that fails because an upload did.
            console.error('Failed to hoist certificate template artwork to S3', e);
            return entry;
        }
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
            // Fold the open design back into the library first, then work from
            // the DEFAULT entry — the renderer reads exactly one template, and
            // the default is the one it reads. Saving while editing a
            // non-default design must not quietly change what learners receive.
            const libraryForSave =
                editorMode === 'visual' ? commitActiveToLibrary() : templateLibrary;
            const effectiveDefaultId =
                defaultTemplateId ?? activeLibraryId ?? libraryForSave[0]?.id ?? null;
            // Deliberately NOT re-adding the institute logo here. Placing it is
            // a one-time decision, made when a design becomes the default (see
            // handleMakeDefaultTemplate) or when the first one is uploaded.
            // Enforcing it on every save meant deleting the logo from a design
            // did nothing: it came back on the next save, with no way to keep it
            // off. An admin who removes it meant to remove it.
            let defaultEntry = resolveDefaultTemplate(libraryForSave, effectiveDefaultId);

            // Every entry has to stand on its own now: a course can point at
            // any of them, and the server renders whichever one it is told to.
            // A built-in still carrying its editing-time SVG data URL would
            // otherwise be inlined into that course's certificate.
            const materialized = await Promise.all(
                (editorMode === 'visual' ? libraryForSave : []).map((entry) =>
                    materializeTemplate(entry)
                )
            );
            const libraryMaterialized = editorMode === 'visual' ? materialized : libraryForSave;
            if (defaultEntry) {
                defaultEntry =
                    libraryMaterialized.find((t) => t.id === defaultEntry!.id) ?? defaultEntry;
            }

            const librarySaved = (
                defaultEntry
                    ? upsertTemplate(libraryMaterialized, defaultEntry)
                    : libraryMaterialized
            ).map((entry) => ({
                // The rendered certificate for each saved design, so a course
                // can be pointed at one by id and the server has something to
                // render without knowing how the editor serializes. Refreshed
                // on every save, which is what keeps a course's certificate in
                // step with edits to the template it follows.
                ...entry,
                renderedHtml: serializeImageTemplateToHtml(
                    entry.imageTemplate,
                    entry.fieldMappings,
                    entry.customImages
                ),
            }));

            // The editor is showing the design that was just rasterized, or
            // that just gained a logo. Push both back so the canvas matches
            // what was saved without needing a reload.
            if (defaultEntry && activeLibraryId === defaultEntry.id) {
                setImageTemplate(defaultEntry.imageTemplate);
                setFieldMappings(defaultEntry.fieldMappings);
            }
            if (editorMode === 'visual') {
                setTemplateLibrary(librarySaved);
                setActiveLibraryId((prev) => prev ?? defaultEntry?.id ?? null);
                if (defaultEntry) setDefaultTemplateId(defaultEntry.id);
            }

            const renderedHtml =
                editorMode === 'html'
                    ? htmlTemplate || defaultCertificateHtml
                    : defaultEntry
                      ? serializeImageTemplateToHtml(
                            defaultEntry.imageTemplate,
                            defaultEntry.fieldMappings,
                            defaultEntry.customImages
                        )
                      : existing.currentHtmlCertificateTemplate || defaultCertificateHtml;

            // Legacy custom-upload slot, still written so a client from before
            // the library reads back a usable upload. It tracks the default
            // design, which is the one such a client would open.
            const slotForSave: CustomUploadSlot | null =
                defaultEntry && !isBuiltinTemplateId(defaultEntry.imageTemplate.id)
                    ? {
                          imageTemplate: defaultEntry.imageTemplate,
                          fieldMappings: defaultEntry.fieldMappings,
                          customImages: defaultEntry.customImages,
                      }
                    : customUploadSlot;

            // The pre-library keys still describe the DEFAULT design, so a
            // client that has not been updated opens the certificate this
            // institute actually issues rather than an empty editor.
            const editorJson =
                editorMode === 'visual' && defaultEntry
                    ? JSON.stringify({
                          imageTemplate: defaultEntry.imageTemplate,
                          fieldMappings: defaultEntry.fieldMappings,
                          customImages: defaultEntry.customImages,
                          templateCustomizations: defaultEntry.templateCustomizations,
                          customUploadSlot: slotForSave,
                          library: librarySaved,
                          defaultTemplateId: defaultEntry.id,
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
                // Send undefined for blanks so the backend's preserve-on-null
                // merge keeps whatever is stored rather than clearing it.
                certificateNumbering: {
                    pattern: numberingPattern.trim() || undefined,
                    prefix: numberingPrefix.trim() || undefined,
                    suffix: numberingSuffix.trim() || undefined,
                    sequencePadding,
                    // 0 in local state means "no start number". Omit it rather
                    // than sending 0: the backend replaces the whole
                    // certificateNumbering object on save, so an omitted field
                    // clears the stored floor — which is exactly what emptying
                    // the box should do.
                    startFrom: numberingStartFrom > 0 ? numberingStartFrom : undefined,
                    resetAnnually: numberingResetAnnually,
                },
                // Empty string, not undefined: undefined hits the backend's
                // preserve-on-null merge, so "Use my portal instead" could
                // never actually clear a link somebody had set.
                qrVerificationUrlTemplate: qrVerificationUrlTemplate.trim(),
                badgeCodeType,
                barcodeContent,
                autoStampCode,
                autoStampNumber,
                verificationNote: verificationPage.note.trim(),
                verificationHeadline: verificationPage.headline.trim(),
                verificationShowCourse: verificationPage.showCourse,
                verificationShowIssueDate: verificationPage.showIssueDate,
                verificationShowCompletion: verificationPage.showCompletion,
                // Always sent, including as `[]`, so deleting the last custom
                // field actually clears it. `undefined` would hit the backend's
                // preserve-on-null merge and silently keep the old list.
                customFields: sanitizedCustomFields,
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
                            : existing?.imageTemplateJson ?? undefined,
                    htmlEditorTemplate:
                        editorMode === 'html'
                            ? htmlAuthored
                            : existing?.htmlEditorTemplate ?? undefined,
                    preferredEditorMode: editorMode,
                    // These must mirror exactly what was just sent to the server.
                    // The record spreads `existing` first, so omitting them left
                    // the OLD values in the local store — and because the line
                    // below stamps this string as already-hydrated, the settings
                    // page read those stale values back and the admin saw their
                    // change revert moments after saving.
                    certificateNumbering: {
                        pattern: numberingPattern.trim() || undefined,
                        prefix: numberingPrefix.trim() || undefined,
                        suffix: numberingSuffix.trim() || undefined,
                        sequencePadding,
                        startFrom: numberingStartFrom > 0 ? numberingStartFrom : undefined,
                        resetAnnually: numberingResetAnnually,
                    },
                    qrVerificationUrlTemplate: qrVerificationUrlTemplate.trim(),
                    badgeCodeType,
                    barcodeContent,
                    autoStampCode,
                    autoStampNumber,
                    verificationNote: verificationPage.note.trim(),
                    verificationHeadline: verificationPage.headline.trim(),
                    verificationShowCourse: verificationPage.showCourse,
                    verificationShowIssueDate: verificationPage.showIssueDate,
                    verificationShowCompletion: verificationPage.showCompletion,
                    customFields: sanitizedCustomFields,
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
                // Saved now, so it is no longer merely auto-loaded.
                setIsAutoLoadedTemplate(false);
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
                {
                    customImages,
                    instituteLogoUrl: logoUrl,
                    customFields: sanitizedCustomFields,
                }
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
                        Design the certificate, decide how it is numbered and coded, and set up the
                        page people reach by scanning it.
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

            <div className="space-y-6 rounded-lg border bg-card p-6">
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

                <div className="max-w-xs">
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
                        Learners receive a certificate once their course completion crosses this.
                        Default 80; the server re-checks it at issuance.
                    </p>
                </div>
            </div>

            {/* Three questions, three tabs: what it looks like, how it is
                numbered, and what a scan shows. Stacked in one column they read
                as one long form and admins told us as much. */}
            <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-card p-1">
                {(
                    [
                        ['design', 'Design'],
                        ['numbering', 'Numbering & codes'],
                        ['verification', 'Verification page'],
                    ] as const
                ).map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setSettingsTab(key)}
                        className={cn(
                            'rounded-md px-4 py-2 text-sm font-medium transition-colors',
                            settingsTab === key
                                ? 'bg-primary-50 text-primary-500'
                                : 'text-neutral-600 hover:bg-neutral-50'
                        )}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {settingsTab === 'numbering' && (
                <div className="space-y-6 rounded-lg border bg-card p-6">
                    <CertificateNumberingBuilder
                        value={{
                            pattern: numberingPattern,
                            prefix: numberingPrefix,
                            suffix: numberingSuffix,
                            sequencePadding,
                            startFrom: numberingStartFrom,
                            resetAnnually: numberingResetAnnually,
                        }}
                        onChange={(patch) => {
                            if (patch.pattern !== undefined) setNumberingPattern(patch.pattern);
                            if (patch.prefix !== undefined) setNumberingPrefix(patch.prefix);
                            if (patch.suffix !== undefined) setNumberingSuffix(patch.suffix);
                            if (patch.sequencePadding !== undefined)
                                setSequencePadding(patch.sequencePadding);
                            if (patch.startFrom !== undefined) setNumberingStartFrom(patch.startFrom);
                            if (patch.resetAnnually !== undefined)
                                setNumberingResetAnnually(patch.resetAnnually);
                        }}
                        derivedPrefix={derivedPrefix}
                        highestIssuedSequence={highestIssuedSequence}
                        disabled={loading}
                        // The builder previews through the page's own formatter, so
                        // the samples cannot drift from the number that is issued.
                        formatSample={(value, sequence) =>
                            formatCertificateNumberPreview({
                                pattern: value.pattern,
                                prefix: value.prefix.trim() || derivedPrefix,
                                suffix: value.suffix,
                                padding: value.sequencePadding,
                                sequence,
                                year: new Date().getFullYear(),
                            })
                        }
                    />

                    <div>
                        <label className="text-sm font-medium" htmlFor="badge-code-type">
                            Scannable code on the certificate
                        </label>
                        <select
                            id="badge-code-type"
                            value={badgeCodeType}
                            onChange={(e) =>
                                setBadgeCodeType(e.target.value === 'BARCODE' ? 'BARCODE' : 'QR')
                            }
                            className="mt-1 w-full rounded border px-3 py-2 text-sm"
                        >
                            <option value="QR">QR code (default)</option>
                            <option value="BARCODE">Barcode (Code 128)</option>
                        </select>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Stamped next to the certificate number, bottom-right — the design below
                            shows you exactly where. To position it yourself instead, drag that
                            badge, or drag the <strong>QR Code</strong> / <strong>Barcode</strong>{' '}
                            field onto the design. The same goes for the number: wherever you place{' '}
                            <strong>Certificate ID</strong>, it stops being stamped automatically,
                            so you never get two of either.
                        </p>
                    </div>

                    {usesBarcode && (
                        <div>
                            <label className="text-sm font-medium" htmlFor="barcode-content">
                                What the barcode encodes
                            </label>
                            <select
                                id="barcode-content"
                                value={barcodeContent}
                                onChange={(e) =>
                                    setBarcodeContent(
                                        e.target.value === 'VERIFICATION_CODE'
                                            ? 'VERIFICATION_CODE'
                                            : 'NUMBER'
                                    )
                                }
                                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                            >
                                <option value="NUMBER">Certificate number only (default)</option>
                                <option value="VERIFICATION_CODE">
                                    Verification code — anyone can scan it to check the certificate
                                </option>
                            </select>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {barcodeContent === 'VERIFICATION_CODE' ? (
                                    <>
                                        Scanning the barcode gives a code that verifies the
                                        certificate on your verification page. It carries about
                                        twice as much data as the number alone, so it needs to be at
                                        least{' '}
                                        <strong>{minBarcodeWidthMm('VERIFICATION_CODE')}mm</strong>{' '}
                                        wide to still scan off a printed page — the design below
                                        warns you if it is too narrow.
                                    </>
                                ) : (
                                    <>
                                        Scanning gives the certificate number as text. That
                                        identifies the certificate but proves nothing, because the
                                        number on its own is not a credential. Switch to the
                                        verification code to make a barcode scan actually verify.
                                    </>
                                )}
                            </p>
                        </div>
                    )}

                    {/* The answer to "I removed the QR and it came back". The stamp
                    is a safety net for designs that place neither, and it was
                    unconditional — so removing the field from the design was
                    not enough to remove it from the certificate. */}
                    <div className="flex flex-col gap-3 rounded-md border p-4">
                        <div>
                            <div className="text-sm font-medium">Automatic stamp</div>
                            <p className="text-xs text-muted-foreground">
                                Printed bottom-right on certificates whose design does not place
                                these itself. A field you place on the design always wins over the
                                stamp.
                            </p>
                        </div>
                        <label className="flex items-start gap-3">
                            <Switch checked={autoStampCode} onCheckedChange={setAutoStampCode} />
                            <span className="text-sm">
                                Stamp the {badgeCodeType === 'BARCODE' ? 'barcode' : 'QR code'}
                                <span className="block text-xs text-muted-foreground">
                                    {autoStampCode
                                        ? 'Every certificate carries a scannable code.'
                                        : 'Turned off — certificates with no code of their own cannot be verified by scanning.'}
                                </span>
                            </span>
                        </label>
                        <label className="flex items-start gap-3">
                            <Switch
                                checked={autoStampNumber}
                                onCheckedChange={setAutoStampNumber}
                            />
                            <span className="text-sm">
                                Stamp the certificate number
                                <span className="block text-xs text-muted-foreground">
                                    {autoStampNumber
                                        ? 'Every certificate shows its number somewhere.'
                                        : 'Turned off — the number is still allocated and still verifies, it is just not printed unless your design places it.'}
                                </span>
                            </span>
                        </label>
                    </div>
                </div>
            )}

            {settingsTab === 'verification' && (
                <VerificationPageSection
                    verificationPageUrl={verificationPageUrl}
                    instituteName={effectiveInstituteName}
                    logoUrl={logoUrl}
                    themeColor={instituteDetails?.institute_theme_code || '#1e4fa1'}
                    config={verificationPage}
                    onConfigChange={(patch) =>
                        setVerificationPage((prev) => ({ ...prev, ...patch }))
                    }
                    customUrl={qrVerificationUrlTemplate}
                    onClearCustomUrl={() => setQrVerificationUrlTemplate('')}
                    sampleCertificateId={sampleCertificateNumber}
                    disabled={loading}
                />
            )}

            {settingsTab === 'design' && (
                <>
                    <div className="space-y-6 rounded-lg border bg-card p-6">
                        <div>
                            <h3 className="text-base font-semibold">Page &amp; fields</h3>
                            <p className="text-sm text-muted-foreground">
                                The size the certificate prints at, and any values of your own you
                                want to place on it.
                            </p>
                        </div>

                        <div className="grid gap-6 md:grid-cols-3">
                            <div>
                                <label className="text-sm font-medium" htmlFor="aspect">
                                    Page size
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
                                <div className="grid grid-cols-2 gap-2 md:col-span-2">
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

                        {/* Custom fields live here rather than with numbering: each one
                    becomes a chip you drag onto the design below. */}
                        <CustomFieldsEditor fields={customFields} onChange={setCustomFields} />
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
                                                Upload template and annotate with student data
                                                fields
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
                                                            const trimmed = (
                                                                htmlTemplate || ''
                                                            ).trim();
                                                            if (
                                                                !trimmed ||
                                                                /class\s*=\s*["']certificate-canvas["']/.test(
                                                                    htmlTemplate
                                                                )
                                                            ) {
                                                                setHtmlTemplate(
                                                                    defaultCertificateHtml
                                                                );
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
                                                    {
                                                        key: 'upload',
                                                        label: 'Upload',
                                                        icon: UploadIcon,
                                                    },
                                                    {
                                                        key: 'design',
                                                        label: 'Design',
                                                        icon: PaintBrush,
                                                    },
                                                    { key: 'preview', label: 'Preview', icon: Eye },
                                                ].map(({ key, label, icon: Icon }) => (
                                                    <button
                                                        key={key}
                                                        onClick={() =>
                                                            setActiveView(
                                                                key as
                                                                    | 'upload'
                                                                    | 'design'
                                                                    | 'preview'
                                                            )
                                                        }
                                                        disabled={
                                                            (key === 'design' ||
                                                                key === 'preview') &&
                                                            !imageTemplate
                                                        }
                                                        className={cn(
                                                            'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all',
                                                            activeView === key
                                                                ? 'bg-white text-purple-600 shadow-sm'
                                                                : 'text-neutral-600 hover:text-neutral-700',
                                                            (key === 'design' ||
                                                                key === 'preview') &&
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
                                    badgeCodeType={badgeCodeType}
                                    barcodeContent={barcodeContent}
                                    sampleCertificateId={sampleCertificateNumber}
                                    paletteFields={paletteFields}
                                    customFields={sanitizedCustomFields}
                                />
                            )}

                            {editorMode === 'visual' && activeView !== 'preview' && (
                                <CertificateTemplateLibrary
                                    templates={templateLibrary}
                                    activeTemplateId={activeLibraryId}
                                    defaultTemplateId={defaultTemplateId}
                                    onOpen={handleOpenLibraryTemplate}
                                    onMakeDefault={handleMakeDefaultTemplate}
                                    onRename={handleRenameLibraryTemplate}
                                    onDelete={handleDeleteLibraryTemplate}
                                    onAdd={handleAddLibraryTemplate}
                                    disabled={loading}
                                />
                            )}

                            {/* Says which design is issued whenever that is not the one
                        on screen. Without it an admin can spend a session
                        perfecting a template that no learner will ever see. */}
                            {editorMode === 'visual' &&
                                activeLibraryId &&
                                defaultTemplateId &&
                                activeLibraryId !== defaultTemplateId && (
                                    <Alert
                                        variant="default"
                                        className="border-amber-300 bg-amber-50 text-amber-900"
                                    >
                                        <AlertTriangle className="size-4" />
                                        <AlertDescription>
                                            You are editing{' '}
                                            <strong>
                                                {templateLibrary.find(
                                                    (t) => t.id === activeLibraryId
                                                )?.name || 'this template'}
                                            </strong>
                                            . Learners still receive{' '}
                                            <strong>
                                                {templateLibrary.find(
                                                    (t) => t.id === defaultTemplateId
                                                )?.name || 'the default template'}
                                            </strong>
                                            . Use <strong>Make default</strong> on a card above to
                                            change that.
                                        </AlertDescription>
                                    </Alert>
                                )}

                            {editorMode === 'visual' && activeView === 'design' && (
                                <CertificateTemplateGallery
                                    activeTemplateId={activeTemplateId}
                                    hasCustomUpload={hasCustomUpload}
                                    customThumbnailUrl={customThumbnailUrl}
                                    themeColor={instituteDetails?.institute_theme_code || '#1e4fa1'}
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
                                                <div className="space-y-3 rounded-lg border bg-card p-4">
                                                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                        Drag a field
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {paletteFields.map((f) => (
                                                            <DraggableFieldChip
                                                                key={f.name}
                                                                field={f}
                                                            />
                                                        ))}
                                                    </div>
                                                    <div className="rounded border bg-muted/30 p-2 text-xs text-muted-foreground">
                                                        {fieldMappings.length} field
                                                        {fieldMappings.length === 1 ? '' : 's'}{' '}
                                                        placed
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
                                                badgeCodeType={badgeCodeType}
                                                barcodeContent={barcodeContent}
                                                autoStampCode={autoStampCode}
                                                autoStampNumber={autoStampNumber}
                                                // Deleting a code or the number from the
                                                // design is the gesture an admin already
                                                // tried; make it mean what they meant,
                                                // instead of the platform stamping it
                                                // straight back on the issued PDF.
                                                onAutoStampChange={(part, enabled) => {
                                                    if (part === 'code') setAutoStampCode(enabled);
                                                    else setAutoStampNumber(enabled);
                                                }}
                                                // The editor works in canvas pixels, but
                                                // whether a code scans is a printed-millimetre
                                                // question — which depends on the page size.
                                                pageWidthMm={
                                                    aspectRatioToMm(
                                                        aspectRatio,
                                                        customWidthMm,
                                                        customHeightMm
                                                    ).wMm
                                                }
                                                sampleCertificateId={sampleCertificateNumber}
                                            />
                                        )}

                                        {activeView === 'preview' && imageTemplate && (
                                            <CertificateSettingsPreview
                                                imageTemplate={imageTemplate}
                                                autoStampCode={autoStampCode}
                                                autoStampNumber={autoStampNumber}
                                                fieldMappings={fieldMappings}
                                                customImages={customImages}
                                                logoUrl={logoUrl}
                                                instituteName={effectiveInstituteName}
                                                badgeCodeType={badgeCodeType}
                                                barcodeContent={barcodeContent}
                                                customFields={sanitizedCustomFields}
                                                sampleCertificateId={sampleCertificateNumber}
                                            />
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </DndContext>
                </>
            )}
        </div>
    );
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
    badgeCodeType,
    barcodeContent,
    sampleCertificateId,
    paletteFields,
    customFields,
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
    badgeCodeType: BadgeCodeType;
    barcodeContent: BarcodeContent;
    sampleCertificateId: string;
    /** Built-ins plus the institute's own fields, so both editors offer the same set. */
    paletteFields: AvailableField[];
    /** Definitions, so the preview substitutes the value each field will print. */
    customFields: CertificateCustomField[];
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
        const sampleCertId = sampleCertificateId;
        // Plan off the raw template, before substitution removes the tokens.
        const badgePlan = planFromHtml(html || '');
        const out = applyCertificateSamples(
            html || '',
            buildCertificateSampleTokens({
                sampleCertificateId: sampleCertId,
                instituteName,
                logoUrl,
                customFields,
            })
        );
        // Mirror server-side appendCertificateIdBadge, including the scannable
        // code it stamps beside the number. The old hand-rolled copy showed the
        // number only, so the code arrived unannounced on the issued PDF.
        return injectAutoBadge(
            out,
            buildAutoBadgeHtml({
                badgePlan,
                codeType: badgeCodeType,
                barcodeContent,
                certificateId: sampleCertId,
            })
        );
    }, [
        html,
        logoUrl,
        instituteName,
        badgeCodeType,
        barcodeContent,
        customFields,
        sampleCertificateId,
    ]);

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
                        {paletteFields.map((f) => {
                            const token = fieldNameToToken(f.name);
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
    badgeCodeType,
    barcodeContent,
    customFields,
    sampleCertificateId,
    autoStampCode,
    autoStampNumber,
}: {
    imageTemplate: ImageTemplate;
    fieldMappings: FieldMapping[];
    customImages?: CustomImage[];
    logoUrl?: string;
    instituteName?: string;
    badgeCodeType: BadgeCodeType;
    barcodeContent: BarcodeContent;
    sampleCertificateId: string;
    customFields: CertificateCustomField[];
    autoStampCode: boolean;
    autoStampNumber: boolean;
}) => {
    // Off by default: the everyday certificate carries short values, and an
    // admin should see that first. The switch is what makes the awkward case
    // discoverable at design time rather than at issuance.
    const [longValues, setLongValues] = useState(false);

    const srcDoc = useMemo(() => {
        const html = serializeImageTemplateToHtml(imageTemplate, fieldMappings, customImages);
        // Read the plan off the un-substituted template, exactly as the backend
        // does — after substitution the tokens are gone and every design would
        // look like it places nothing.
        const badgePlan = planFromHtml(html, {
            code: autoStampCode,
            number: autoStampNumber,
        });
        const out = applyCertificateSamples(
            html,
            buildCertificateSampleTokens({
                sampleCertificateId,
                instituteName,
                logoUrl,
                customFields,
                useLongValues: longValues,
            })
        );
        // Shrink long values exactly as CertificateTextFitService will at
        // issuance. Without this the preview was the one view of the design
        // that did NOT behave like the certificate.
        const fitted = applyTextFitToHtml(out);
        // Mirror the server's automatic badge so the preview shows the code and
        // number an admin has not placed themselves — the parts that would
        // otherwise appear for the first time on an issued PDF.
        return injectAutoBadge(
            fitted,
            buildAutoBadgeHtml({
                badgePlan,
                codeType: badgeCodeType,
                barcodeContent,
                certificateId: sampleCertificateId,
            })
        );
    }, [
        imageTemplate,
        fieldMappings,
        customImages,
        logoUrl,
        instituteName,
        badgeCodeType,
        barcodeContent,
        customFields,
        sampleCertificateId,
        longValues,
        autoStampCode,
        autoStampNumber,
    ]);

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
                <label className="mr-auto flex items-center gap-2 text-sm text-neutral-600">
                    <Switch checked={longValues} onCheckedChange={setLongValues} />
                    Preview with long names
                </label>
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
