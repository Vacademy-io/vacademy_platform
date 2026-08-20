/**
 * An institute's saved certificate designs, and which one learners actually get.
 *
 * <p><b>Why this exists.</b> The settings page could hold exactly one design:
 * one built-in, or one custom upload, and uploading a second file overwrote the
 * first. Institutes that issue more than one kind of certificate — a course
 * completion and a participation, or an English and an Arabic edition — had to
 * re-upload and re-place every field each time they switched. There was nowhere
 * to keep the other design, and so nothing to mark as the default.
 *
 * <p><b>What "default" means.</b> The renderer reads exactly one field,
 * {@code currentHtmlCertificateTemplate}, so exactly one design can be issued.
 * The default is the entry whose HTML gets written there on save. Everything
 * else in the library is kept so it can be switched to later — it is storage,
 * not a second active template.
 *
 * <p><b>Where it is stored.</b> Inside the existing {@code imageTemplateJson}
 * blob, which the backend stores verbatim and never inspects. The pre-existing
 * top-level keys are still written exactly as before, so a client that has not
 * been updated still opens the default design rather than an empty editor.
 */
import { nanoid } from 'nanoid';
import type { FieldMapping, ImageTemplate } from '@/types/certificate/certificate-types';
import type { TemplateCustomizations } from './builtin-certificate-templates';

export interface CustomImage {
    id: string;
    dataUrl: string;
}

export interface SavedCertificateTemplate {
    id: string;
    /** Admin-facing name. Seeded from the uploaded file name, then editable. */
    name: string;
    imageTemplate: ImageTemplate;
    fieldMappings: FieldMapping[];
    customImages: CustomImage[];
    /** Only meaningful for built-in designs; null for uploads. */
    templateCustomizations: TemplateCustomizations | null;
    /** Epoch millis, for a stable "newest last" order in the gallery. */
    updatedAt: number;
}

/** The field name the serializer turns into {{INSTITUTE_LOGO}}. */
export const INSTITUTE_LOGO_FIELD = 'institute_logo';

export const hasInstituteLogo = (fields: FieldMapping[]): boolean =>
    fields.some((f) => f.fieldName === INSTITUTE_LOGO_FIELD);

/**
 * Put the institute's logo on a design that has none.
 *
 * <p>Every built-in design ships with a logo box. A custom upload starts with no
 * fields at all, so an institute that uploaded its own artwork and made it the
 * default issued certificates with no mark on them — the one thing that makes a
 * certificate identifiably theirs. This is called when a design becomes the
 * default, which is the moment it starts being issued.
 *
 * <p>Placed top-centre and deliberately modest (8% of the canvas height): a
 * guessed position that is wrong is a nudge away from right, while no logo at
 * all is not recoverable by the learner who already received the PDF. An admin
 * who has drawn their own logo box keeps it — this never moves an existing one.
 */
export const withInstituteLogo = (template: SavedCertificateTemplate): SavedCertificateTemplate => {
    if (hasInstituteLogo(template.fieldMappings)) return template;

    const canvasWidth = template.imageTemplate.width || 1123;
    const canvasHeight = template.imageTemplate.height || 794;
    const size = Math.round(canvasHeight * 0.08);

    const logoField: FieldMapping = {
        id: nanoid(),
        fieldName: INSTITUTE_LOGO_FIELD,
        displayName: 'Institute Logo',
        type: 'text',
        position: {
            x: Math.round((canvasWidth - size) / 2),
            y: Math.round(canvasHeight * 0.06),
            width: size,
            height: size,
        },
        style: {
            fontSize: 16,
            // Colour on the printed certificate, not app UI — a design token
            // would not survive the PDF renderer.
            fontColor: '#000000', // design-lint-ignore: certificate document colour
            fontFamily: 'Arial, sans-serif',
            alignment: 'center',
            fontWeight: 'normal',
        },
    };

    return {
        ...template,
        // First, so it sits behind any text the admin has already placed.
        fieldMappings: [logoField, ...template.fieldMappings],
    };
};

/** Replace an entry in place, or append it when it is new. */
export const upsertTemplate = (
    library: SavedCertificateTemplate[],
    entry: SavedCertificateTemplate
): SavedCertificateTemplate[] => {
    const index = library.findIndex((t) => t.id === entry.id);
    if (index < 0) return [...library, entry];
    const next = [...library];
    next[index] = entry;
    return next;
};

/**
 * Which entry is issued. Falls back to the first saved design rather than
 * returning nothing: an institute with templates but no recorded default must
 * still issue something, and the alternative is a blank certificate.
 */
export const resolveDefaultTemplate = (
    library: SavedCertificateTemplate[],
    defaultTemplateId: string | null
): SavedCertificateTemplate | null => {
    if (!library.length) return null;
    return library.find((t) => t.id === defaultTemplateId) ?? library[0] ?? null;
};

/** A readable name for a freshly uploaded file: "my-cert (1).png" → "my cert". */
export const templateNameFromFile = (
    fileName: string | undefined,
    fallbackIndex: number
): string => {
    const base = (fileName || '')
        .replace(/\.[^.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .trim();
    return base || `Template ${fallbackIndex}`;
};

/**
 * Names have to be unique to be useful — two cards both called "Certificate"
 * make "make this one the default" a coin toss.
 */
export const uniqueTemplateName = (
    library: SavedCertificateTemplate[],
    desired: string,
    ignoreId?: string
): string => {
    const taken = new Set(
        library.filter((t) => t.id !== ignoreId).map((t) => t.name.trim().toLowerCase())
    );
    const base = desired.trim() || 'Template';
    if (!taken.has(base.toLowerCase())) return base;
    for (let n = 2; n < 500; n++) {
        const candidate = `${base} ${n}`;
        if (!taken.has(candidate.toLowerCase())) return candidate;
    }
    return `${base} ${nanoid(4)}`;
};

export const newTemplateId = (): string => `tpl_${nanoid(10)}`;

/** The shape stored in `imageTemplateJson`, as far as this module cares. */
export interface EditorStateJson {
    imageTemplate?: ImageTemplate | null;
    fieldMappings?: FieldMapping[];
    customImages?: CustomImage[];
    templateCustomizations?: TemplateCustomizations | null;
    customUploadSlot?: {
        imageTemplate: ImageTemplate;
        fieldMappings: FieldMapping[];
        customImages?: CustomImage[];
    } | null;
    library?: unknown;
    defaultTemplateId?: unknown;
}

const isSavedTemplate = (raw: unknown): raw is SavedCertificateTemplate => {
    if (!raw || typeof raw !== 'object') return false;
    const r = raw as Record<string, unknown>;
    return (
        typeof r.id === 'string' &&
        !!r.imageTemplate &&
        typeof r.imageTemplate === 'object' &&
        Array.isArray(r.fieldMappings)
    );
};

/**
 * Read the library out of saved editor state, migrating institutes that saved
 * before it existed.
 *
 * <p>The migration matters more than the parsing: ~500 institutes have a saved
 * design and no library. Presenting them with an empty "My templates" list would
 * read as "your certificate is gone", so their one design is seeded as the first
 * entry and marked default — which is exactly what it already was.
 */
export const readTemplateLibrary = (
    parsed: EditorStateJson | null | undefined
): { library: SavedCertificateTemplate[]; defaultTemplateId: string | null } => {
    if (!parsed) return { library: [], defaultTemplateId: null };

    if (Array.isArray(parsed.library) && parsed.library.some(isSavedTemplate)) {
        const library = parsed.library.filter(isSavedTemplate).map((entry) => ({
            ...entry,
            name: entry.name || 'Template',
            customImages: Array.isArray(entry.customImages) ? entry.customImages : [],
            templateCustomizations: entry.templateCustomizations ?? null,
            updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : 0,
        }));
        const savedDefault =
            typeof parsed.defaultTemplateId === 'string' ? parsed.defaultTemplateId : null;
        return {
            library,
            // A default id pointing at a deleted entry is worse than none: it
            // would silently issue whatever sorted first while the UI showed no
            // default at all. Resolve it to a real entry here, once.
            defaultTemplateId:
                library.find((t) => t.id === savedDefault)?.id ?? library[0]?.id ?? null,
        };
    }

    // Legacy: one active design, plus possibly a remembered custom upload.
    const library: SavedCertificateTemplate[] = [];
    if (parsed.imageTemplate) {
        library.push({
            id: newTemplateId(),
            name: templateNameFromFile(parsed.imageTemplate.originalFileName, 1),
            imageTemplate: parsed.imageTemplate,
            fieldMappings: parsed.fieldMappings ?? [],
            customImages: parsed.customImages ?? [],
            templateCustomizations: parsed.templateCustomizations ?? null,
            updatedAt: 0,
        });
    }
    const slot = parsed.customUploadSlot;
    // Only when it is a genuinely different design — the slot usually mirrors
    // the active template, and seeding both would show the same certificate
    // twice under two names.
    if (slot?.imageTemplate && slot.imageTemplate.id !== parsed.imageTemplate?.id) {
        library.push({
            id: newTemplateId(),
            name: uniqueTemplateName(
                library,
                templateNameFromFile(slot.imageTemplate.originalFileName, library.length + 1)
            ),
            imageTemplate: slot.imageTemplate,
            fieldMappings: slot.fieldMappings ?? [],
            customImages: slot.customImages ?? [],
            templateCustomizations: null,
            updatedAt: 0,
        });
    }

    return { library, defaultTemplateId: library[0]?.id ?? null };
};
