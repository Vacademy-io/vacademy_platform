import { describe, expect, it } from 'vitest';
import {
    hasInstituteLogo,
    INSTITUTE_LOGO_FIELD,
    readTemplateLibrary,
    resolveDefaultTemplate,
    templateNameFromFile,
    uniqueTemplateName,
    upsertTemplate,
    withInstituteLogo,
    type SavedCertificateTemplate,
} from '../certificate-template-library';
import type { FieldMapping, ImageTemplate } from '@/types/certificate/certificate-types';

/**
 * Multiple saved designs, one of them default.
 *
 * The settings page used to hold exactly one design — a second upload replaced
 * the first — so "make this one the default" had nothing to choose between.
 */

const image = (id: string, originalFileName = 'cert.png'): ImageTemplate => ({
    id,
    fileName: `${id}.png`,
    originalFileName,
    imageDataUrl: `https://cdn.example/${id}.png`,
    width: 1123,
    height: 794,
    format: 'png',
    createdAt: '2026-01-01',
    sourceType: 'image',
});

const textField = (fieldName: string): FieldMapping => ({
    id: `f-${fieldName}`,
    fieldName,
    displayName: fieldName,
    type: 'text',
    position: { x: 10, y: 10, width: 300, height: 50 },
    style: {
        fontSize: 24,
        fontColor: '#111111',
        fontFamily: 'Arial, sans-serif',
        alignment: 'center',
        fontWeight: 'normal',
    },
});

const saved = (
    id: string,
    over: Partial<SavedCertificateTemplate> = {}
): SavedCertificateTemplate => ({
    id,
    name: id,
    imageTemplate: image(id),
    fieldMappings: [textField('student_name')],
    customImages: [],
    templateCustomizations: null,
    updatedAt: 1,
    ...over,
});

describe('keeping more than one design', () => {
    it('adds a new design rather than replacing the existing one', () => {
        const library = upsertTemplate([saved('a')], saved('b'));
        expect(library.map((t) => t.id)).toEqual(['a', 'b']);
    });

    it('updates a design in place, keeping its position in the list', () => {
        const library = upsertTemplate([saved('a'), saved('b')], saved('a', { name: 'renamed' }));
        expect(library.map((t) => t.id)).toEqual(['a', 'b']);
        expect(library[0]?.name).toBe('renamed');
    });

    it('keeps names distinct, since the name is how a default is chosen', () => {
        const library = [saved('a', { name: 'Certificate' })];
        expect(uniqueTemplateName(library, 'Certificate')).toBe('Certificate 2');
        // Renaming an entry to what it already is must not bump it.
        expect(uniqueTemplateName(library, 'Certificate', 'a')).toBe('Certificate');
    });

    it('names an upload after its file', () => {
        expect(templateNameFromFile('spring-course_2026.png', 1)).toBe('spring course 2026');
        expect(templateNameFromFile(undefined, 3)).toBe('Template 3');
    });
});

describe('which design learners receive', () => {
    it('returns the entry marked default', () => {
        expect(resolveDefaultTemplate([saved('a'), saved('b')], 'b')?.id).toBe('b');
    });

    /**
     * A dangling default id would otherwise issue whatever sorted first while
     * the UI showed no default at all.
     */
    it('falls back to the first design when the default id is stale', () => {
        expect(resolveDefaultTemplate([saved('a'), saved('b')], 'deleted')?.id).toBe('a');
    });

    it('has nothing to issue when there are no designs', () => {
        expect(resolveDefaultTemplate([], 'a')).toBeNull();
    });
});

describe('the default always carries the institute logo', () => {
    /**
     * A custom upload starts with no fields at all, so making one the default
     * used to issue certificates with no mark of who awarded them.
     */
    it('adds a logo to a design that has none', () => {
        const branded = withInstituteLogo(saved('a', { fieldMappings: [] }));
        expect(hasInstituteLogo(branded.fieldMappings)).toBe(true);
        const logo = branded.fieldMappings.find((f) => f.fieldName === INSTITUTE_LOGO_FIELD);
        // Inside the canvas, top-centre.
        expect(logo!.position.x).toBeGreaterThan(0);
        expect(logo!.position.x).toBeLessThan(1123);
        expect(logo!.position.y).toBeLessThan(794 / 2);
    });

    it('leaves a logo the admin already placed exactly where it is', () => {
        const placed = {
            ...textField(INSTITUTE_LOGO_FIELD),
            position: { x: 900, y: 700, width: 60, height: 60 },
        };
        const branded = withInstituteLogo(saved('a', { fieldMappings: [placed] }));
        expect(branded.fieldMappings).toHaveLength(1);
        expect(branded.fieldMappings[0]?.position).toEqual(placed.position);
    });

    it('keeps the fields already on the design', () => {
        const branded = withInstituteLogo(saved('a'));
        expect(branded.fieldMappings.map((f) => f.fieldName)).toContain('student_name');
        expect(branded.fieldMappings).toHaveLength(2);
    });
});

describe('reading saved state', () => {
    it('reads a saved library and its default', () => {
        const { library, defaultTemplateId } = readTemplateLibrary({
            library: [saved('a'), saved('b')],
            defaultTemplateId: 'b',
        });
        expect(library.map((t) => t.id)).toEqual(['a', 'b']);
        expect(defaultTemplateId).toBe('b');
    });

    it('resolves a default id that points at a deleted entry', () => {
        const { defaultTemplateId } = readTemplateLibrary({
            library: [saved('a')],
            defaultTemplateId: 'gone',
        });
        expect(defaultTemplateId).toBe('a');
    });

    /**
     * ~500 institutes saved a design before the library existed. An empty "My
     * templates" list would read to them as "your certificate is gone".
     */
    it('migrates a pre-library design into the library as the default', () => {
        const { library, defaultTemplateId } = readTemplateLibrary({
            imageTemplate: image('legacy', 'graduation-cert.png'),
            fieldMappings: [textField('student_name')],
            customImages: [],
            templateCustomizations: null,
        });
        expect(library).toHaveLength(1);
        expect(library[0]?.name).toBe('graduation cert');
        expect(library[0]?.fieldMappings).toHaveLength(1);
        expect(defaultTemplateId).toBe(library[0]?.id);
    });

    it('migrates a remembered custom upload as a second design', () => {
        const { library } = readTemplateLibrary({
            imageTemplate: image('builtin:classic-blue'),
            fieldMappings: [],
            customUploadSlot: {
                imageTemplate: image('upload-1', 'my-design.png'),
                fieldMappings: [textField('course_name')],
            },
        });
        expect(library).toHaveLength(2);
        expect(library[1]?.name).toBe('my design');
    });

    /** The slot usually mirrors the active design; seeding both would duplicate it. */
    it('does not duplicate an upload that is also the active design', () => {
        const { library } = readTemplateLibrary({
            imageTemplate: image('upload-1'),
            fieldMappings: [],
            customUploadSlot: { imageTemplate: image('upload-1'), fieldMappings: [] },
        });
        expect(library).toHaveLength(1);
    });

    it('copes with no saved state at all', () => {
        expect(readTemplateLibrary(null)).toEqual({ library: [], defaultTemplateId: null });
        expect(readTemplateLibrary({})).toEqual({ library: [], defaultTemplateId: null });
    });

    /** A half-written blob must not take the settings page down with it. */
    it('ignores malformed library entries', () => {
        const { library } = readTemplateLibrary({
            library: [{ id: 'ok', imageTemplate: image('ok'), fieldMappings: [] }, null, 7],
            defaultTemplateId: 'ok',
        } as never);
        expect(library.map((t) => t.id)).toEqual(['ok']);
    });
});
