import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

/**
 * Choosing which of several certificate designs learners actually receive.
 *
 * <p>The reported bugs, in one screen: uploading a second template replaced the
 * first, so there was nothing to choose between; "make this one default" did not
 * change what was issued; and an uploaded design made default went out with no
 * institute logo on it.
 *
 * <p>Asserted through the save payload rather than the DOM, because the payload
 * is what decides the learner's certificate. The renderer reads exactly one
 * field — `currentHtmlCertificateTemplate` — so "is the default working" is the
 * question "is that field the default design's HTML".
 */

const savedSetting = (records: unknown[]) =>
    JSON.stringify({
        setting: {
            CERTIFICATE_SETTING: { data: { data: records } },
        },
    });

const image = (id: string, originalFileName = `${id}.png`) => ({
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

const textField = (fieldName: string, token: string) => ({
    id: `f-${fieldName}`,
    fieldName,
    displayName: token,
    type: 'text',
    position: { x: 100, y: 300, width: 400, height: 60 },
    style: {
        fontSize: 32,
        fontColor: '#111111',
        fontFamily: 'Arial, sans-serif',
        alignment: 'center',
        fontWeight: 'normal',
    },
});

const libraryEntry = (id: string, name: string, fieldName: string) => ({
    id,
    name,
    imageTemplate: image(id),
    fieldMappings: [textField(fieldName, fieldName)],
    customImages: [],
    templateCustomizations: null,
    updatedAt: 1,
});

const instituteDetails = (imageTemplateJson: string) => ({
    id: 'inst-1',
    institute_name: 'EduStream Academy',
    institute_theme_code: '#1e4fa1',
    institute_logo_file_id: 'logo-file-1',
    setting: savedSetting([
        {
            key: 'COURSE_COMPLETION',
            isDefaultCertificateSettingOn: true,
            imageTemplateJson,
            preferredEditorMode: 'visual',
        },
    ]),
});

const storeState = {
    instituteDetails: null as unknown,
    setInstituteDetails: vi.fn(),
};

vi.mock('@/stores/students/students-list/useInstituteDetailsStore', () => ({
    useInstituteDetailsStore: () => storeState,
}));

vi.mock('@/routes/settings/-services/setting-services', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('@/routes/settings/-services/setting-services')>();
    return { ...actual, handleConfigureCertificateSettings: vi.fn(async () => ({})) };
});

vi.mock('@/services/upload_file', () => ({
    getPublicUrl: vi.fn(async (fileId: string) => `https://cdn.example/${fileId}.png`),
    UploadFileInS3: vi.fn(async () => 'uploaded-file-id'),
}));

vi.mock('@/lib/auth/sessionUtility', () => ({
    getTokenFromCookie: () => 'token',
    getTokenDecodedData: () => ({ user: 'admin-1' }),
}));

vi.mock('@/lib/auth/facultyAccessUtils', () => ({
    getEffectiveInstituteLogoFileId: (id?: string) => id,
    getEffectiveInstituteName: (name?: string) => name,
}));

// The real upload section pulls in pdf.js. Standing in for it keeps this a test
// about what happens *after* a file arrives.
vi.mock(
    '@/routes/certificate-generation/student-data/-components/pdf-upload/pdf-upload-section',
    () => ({
        PdfUploadSection: ({
            onImageTemplateUpload,
        }: {
            onImageTemplateUpload: (t: unknown) => void;
        }) => (
            <button
                type="button"
                onClick={() => onImageTemplateUpload(image('upload-new', 'winter-award.png'))}
            >
                simulate upload
            </button>
        ),
    })
);

import CertificatesSettings from '@/routes/settings/-components/Certificates/CertificatesSettings';
import { handleConfigureCertificateSettings } from '@/routes/settings/-services/setting-services';

const savePayload = () => {
    const calls = vi.mocked(handleConfigureCertificateSettings).mock.calls;
    const last = calls[calls.length - 1]![0];
    if (typeof last === 'boolean') throw new Error('expected a structured payload');
    return last;
};

const editorJson = () => JSON.parse(savePayload().imageTemplateJson ?? '{}');

/**
 * The card in "My Templates" carrying this name, found by its thumbnail's alt
 * text — the name alone also matches unrelated copy like "Completion threshold".
 */
const templateCard = (name: string): HTMLElement => {
    const card = screen.getByAltText(name).closest('div.group');
    if (!card) throw new Error(`no template card for ${name}`);
    return card as HTMLElement;
};

const save = async () => {
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(handleConfigureCertificateSettings).toHaveBeenCalled());
};

describe('choosing the default certificate template', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        storeState.instituteDetails = instituteDetails(
            JSON.stringify({
                imageTemplate: image('tpl-a'),
                fieldMappings: [textField('student_name', 'student_name')],
                customImages: [],
                library: [
                    libraryEntry('tpl-a', 'Completion', 'student_name'),
                    libraryEntry('tpl-b', 'Participation', 'course_name'),
                ],
                defaultTemplateId: 'tpl-a',
            })
        );
    });

    it('lists every saved design, marking the one learners receive', async () => {
        render(<CertificatesSettings />);

        expect(await screen.findByText('My Templates')).toBeInTheDocument();
        expect(within(templateCard('Completion')).getByText('Default')).toBeInTheDocument();
        expect(within(templateCard('Participation')).queryByText('Default')).toBeNull();
        expect(screen.getByAltText('Participation')).toBeInTheDocument();
    });

    it('issues the design just marked default, not the one on screen', async () => {
        render(<CertificatesSettings />);
        await screen.findByText('My Templates');

        fireEvent.click(
            within(templateCard('Participation')).getByRole('button', { name: 'Make default' })
        );
        await save();

        // The whole point: the *issued* template changed.
        expect(savePayload().currentHtmlTemplate).toContain('{{COURSE_NAME}}');
        expect(savePayload().currentHtmlTemplate).not.toContain('{{STUDENT_NAME}}');
        expect(editorJson().defaultTemplateId).toBe('tpl-b');
    });

    it('keeps the designs that are not the default', async () => {
        render(<CertificatesSettings />);
        await screen.findByText('My Templates');

        fireEvent.click(
            within(templateCard('Participation')).getByRole('button', { name: 'Make default' })
        );
        await save();

        expect(editorJson().library.map((t: { name: string }) => t.name)).toEqual([
            'Completion',
            'Participation',
        ]);
    });

    /**
     * The design being edited is not necessarily the one being issued, and an
     * admin who does not know that can spend a session on a template no learner
     * will ever see.
     */
    it('says so when the design on screen is not the one being issued', async () => {
        render(<CertificatesSettings />);
        await screen.findByText('My Templates');

        fireEvent.click(
            within(templateCard('Participation')).getByRole('button', { name: 'Make default' })
        );

        expect(await screen.findByText(/Learners still receive/)).toBeInTheDocument();
    });

    it('does not offer to delete the design learners are receiving', async () => {
        render(<CertificatesSettings />);
        await screen.findByText('My Templates');

        expect(within(templateCard('Completion')).queryByLabelText(/^Delete/)).toBeNull();
        expect(
            within(templateCard('Participation')).getByLabelText('Delete Participation')
        ).toBeInTheDocument();
    });
});

describe('the automatic code and number', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        storeState.instituteDetails = instituteDetails(
            JSON.stringify({
                imageTemplate: image('tpl-a'),
                fieldMappings: [],
                customImages: [],
                library: [libraryEntry('tpl-a', 'Completion', 'student_name')],
                defaultTemplateId: 'tpl-a',
            })
        );
    });

    /** Neither is compulsory — the reported bug was that both effectively were. */
    it('stops stamping the code once it is switched off, and keeps it off', async () => {
        render(<CertificatesSettings />);
        await screen.findByText('My Templates');

        const codeSwitch = screen
            .getByText(/Stamp the (QR code|barcode)/)
            .closest('label')!
            .querySelector('[role="switch"]')!;
        fireEvent.click(codeSwitch);
        await save();

        expect(savePayload().autoStampCode).toBe(false);
        // The number is a separate decision and must not be dragged along.
        expect(savePayload().autoStampNumber).toBe(true);
    });

    it('switches the number off on its own', async () => {
        render(<CertificatesSettings />);
        await screen.findByText('My Templates');

        const numberSwitch = screen
            .getByText('Stamp the certificate number')
            .closest('label')!
            .querySelector('[role="switch"]')!;
        fireEvent.click(numberSwitch);
        await save();

        expect(savePayload().autoStampNumber).toBe(false);
        expect(savePayload().autoStampCode).toBe(true);
    });

    /** Both on is what every institute had before the switch existed. */
    it('leaves both on when nothing is touched', async () => {
        render(<CertificatesSettings />);
        await screen.findByText('My Templates');
        await save();

        expect(savePayload().autoStampCode).toBe(true);
        expect(savePayload().autoStampNumber).toBe(true);
    });

    /**
     * Being asked for a verification URL implied the admin had to build the
     * page. They do not: the platform hosts it on their own portal.
     */
    it('never asks for a verification URL', async () => {
        render(<CertificatesSettings />);
        await screen.findByText('My Templates');

        expect(screen.queryByLabelText(/custom qr link/i)).toBeNull();
        expect(screen.queryByPlaceholderText(/your-site\.com/i)).toBeNull();
    });
});

describe('uploading more than one design', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        storeState.instituteDetails = instituteDetails(
            JSON.stringify({
                imageTemplate: image('tpl-a'),
                fieldMappings: [textField('student_name', 'student_name')],
                customImages: [],
                library: [libraryEntry('tpl-a', 'Completion', 'student_name')],
                defaultTemplateId: 'tpl-a',
            })
        );
    });

    /** A second upload used to overwrite the first. */
    it('adds an upload alongside the existing designs', async () => {
        render(<CertificatesSettings />);
        await screen.findByText('My Templates');

        fireEvent.click(screen.getByRole('button', { name: 'simulate upload' }));

        expect(await screen.findByAltText('winter award')).toBeInTheDocument();
        expect(screen.getByAltText('Completion')).toBeInTheDocument();
    });

    /**
     * An uploaded design has no fields at all, so making it the default used to
     * issue certificates carrying no mark of who awarded them.
     */
    it('puts the institute logo on an uploaded design made default', async () => {
        render(<CertificatesSettings />);
        await screen.findByText('My Templates');

        fireEvent.click(screen.getByRole('button', { name: 'simulate upload' }));
        await screen.findByAltText('winter award');
        fireEvent.click(
            within(templateCard('winter award')).getByRole('button', { name: 'Make default' })
        );
        await save();

        expect(savePayload().currentHtmlTemplate).toContain('{{INSTITUTE_LOGO}}');
    });

    /**
     * Removing the logo has to stick. Enforcing it on every save meant an admin
     * could delete it, save, and watch it come back with nothing to explain why.
     */
    it('does not put the logo back on a design it was deleted from', async () => {
        storeState.instituteDetails = instituteDetails(
            JSON.stringify({
                imageTemplate: image('tpl-a'),
                fieldMappings: [],
                customImages: [],
                library: [
                    {
                        ...libraryEntry('tpl-a', 'Completion', 'student_name'),
                        // The admin already removed it: only the name is placed.
                        fieldMappings: [textField('student_name', 'student_name')],
                    },
                ],
                defaultTemplateId: 'tpl-a',
            })
        );
        render(<CertificatesSettings />);
        await screen.findByText('My Templates');
        await save();

        expect(savePayload().currentHtmlTemplate).not.toContain('{{INSTITUTE_LOGO}}');
    });

    /** A design that already places its logo must not gain a second one. */
    it('does not add a logo to a design that already has one', async () => {
        storeState.instituteDetails = instituteDetails(
            JSON.stringify({
                imageTemplate: image('tpl-a'),
                fieldMappings: [],
                customImages: [],
                library: [
                    {
                        ...libraryEntry('tpl-a', 'Completion', 'student_name'),
                        fieldMappings: [
                            textField('institute_logo', 'institute_logo'),
                            textField('student_name', 'student_name'),
                        ],
                    },
                ],
                defaultTemplateId: 'tpl-a',
            })
        );
        render(<CertificatesSettings />);
        await screen.findByText('My Templates');
        await save();

        const html = savePayload().currentHtmlTemplate ?? '';
        expect(html.split('{{INSTITUTE_LOGO}}')).toHaveLength(2);
    });
});
