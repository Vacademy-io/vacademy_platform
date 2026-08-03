import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { FileArrowUp, FilePdf, UploadSimple, X } from '@phosphor-icons/react';
import { FileUploadComponent } from '@/components/design-system/file-upload';
import { MyButton } from '@/components/design-system/button';
import { Form } from '@/components/ui/form';
import { FileType } from '@/types/common/file-upload';
import { AttachmentSlot, OfflineAttachmentFiles } from '../-utils/types';

const ACCEPTED_FILE_TYPES: FileType[] = ['application/pdf'];

interface SlotConfig {
    slot: AttachmentSlot;
    label: string;
    hint: string;
}

// The three artifacts a pen-and-paper exam leaves behind. Each one lands in a
// different place on the attempt (see attachOfflineFiles), so they are collected
// separately rather than as one generic "attachments" list.
const SLOTS: SlotConfig[] = [
    {
        slot: 'student',
        label: "Student's answer sheet",
        hint: "The scan of what the student wrote. Shown as their submitted response.",
    },
    {
        slot: 'checked',
        label: 'Checked answer sheet',
        hint: 'The evaluated copy with your marks and remarks. Shown to the student with their result.',
    },
    {
        slot: 'report',
        label: 'Report',
        hint: 'An optional result report you prepared outside the platform.',
    },
];

interface OfflineAttachmentsPanelProps {
    files: OfflineAttachmentFiles;
    onChange: (files: OfflineAttachmentFiles) => void;
    disabled?: boolean;
}

interface AttachmentsForm {
    student: FileList | null;
    checked: FileList | null;
    report: FileList | null;
}

/**
 * Optional PDF attachments for an offline data entry. Files are only held in
 * component state here — the parent uploads them to S3 and attaches them to the
 * attempt on submit, so abandoning the entry never leaves orphaned uploads.
 */
export const OfflineAttachmentsPanel = ({
    files,
    onChange,
    disabled = false,
}: OfflineAttachmentsPanelProps) => {
    const form = useForm<AttachmentsForm>({
        defaultValues: { student: null, checked: null, report: null },
    });
    const studentInputRef = useRef<HTMLInputElement | null>(null);
    const checkedInputRef = useRef<HTMLInputElement | null>(null);
    const reportInputRef = useRef<HTMLInputElement | null>(null);
    const inputRefs: Record<AttachmentSlot, React.MutableRefObject<HTMLInputElement | null>> = {
        student: studentInputRef,
        checked: checkedInputRef,
        report: reportInputRef,
    };

    const setFile = (slot: AttachmentSlot, file: File | undefined) => {
        const next = { ...files };
        if (file) next[slot] = file;
        else delete next[slot];
        onChange(next);
    };

    const attachedCount = SLOTS.filter(({ slot }) => files[slot]).length;

    return (
        <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-1 flex flex-wrap items-center gap-2">
                <FilePdf className="size-5 text-primary-500" />
                <h2 className="text-subtitle font-semibold text-neutral-700">Attachments</h2>
                <span className="text-caption text-neutral-400">
                    Optional&nbsp;&middot;&nbsp;PDF only
                    {attachedCount > 0 ? ` · ${attachedCount} of 3 selected` : ''}
                </span>
            </div>
            <p className="mb-4 text-caption text-neutral-500">
                Uploaded when you submit this entry.
            </p>

            <Form {...form}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {SLOTS.map(({ slot, label, hint }) => {
                        const file = files[slot];
                        return (
                            <div key={slot} className="flex flex-col gap-2">
                                <div>
                                    <p className="text-body font-medium text-neutral-700">{label}</p>
                                    <p className="text-caption text-neutral-400">{hint}</p>
                                </div>

                                <FileUploadComponent
                                    fileInputRef={inputRefs[slot]}
                                    onFileSubmit={(picked) => setFile(slot, picked)}
                                    control={form.control}
                                    name={slot}
                                    acceptedFileTypes={ACCEPTED_FILE_TYPES}
                                    isUploading={disabled}
                                >
                                    {file ? (
                                        <div className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 p-3">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <FileArrowUp className="size-5 shrink-0 text-primary-500" />
                                                <span className="truncate text-caption text-neutral-700">
                                                    {file.name}
                                                </span>
                                            </div>
                                            <MyButton
                                                buttonType="secondary"
                                                scale="small"
                                                layoutVariant="icon"
                                                type="button"
                                                disable={disabled}
                                                aria-label={`Remove ${label}`}
                                                // Stop the dropzone (the parent) from
                                                // re-opening the file picker on remove.
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setFile(slot, undefined);
                                                }}
                                            >
                                                <X className="size-3" />
                                            </MyButton>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-300 p-6 text-center hover:border-primary-300">
                                            <UploadSimple className="size-6 text-neutral-400" />
                                            <p className="text-caption font-medium text-neutral-700">
                                                Click to upload or drag &amp; drop
                                            </p>
                                        </div>
                                    )}
                                </FileUploadComponent>
                            </div>
                        );
                    })}
                </div>
            </Form>
        </section>
    );
};
