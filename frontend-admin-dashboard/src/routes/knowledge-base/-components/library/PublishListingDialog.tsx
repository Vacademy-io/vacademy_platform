import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Image as ImageIcon, Spinner, X } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { MyInput } from '@/components/design-system/input';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getUserId } from '@/utils/userDetails';
import { saveListing } from '../../-services/library-service';
import type { PublisherListingRow } from '../../-types/library';
import { LibraryCover } from './LibraryCover';

const schema = z.object({
    title: z.string().trim().min(1, 'Give this library a title').max(200),
    // Capped to match the column so a catalogue card never truncates mid-word.
    summary: z
        .string()
        .trim()
        .min(1, 'Write one line describing what this is')
        .max(280, 'Keep the summary under 280 characters'),
    description: z.string().max(4000).optional(),
    subject: z.string().trim().min(1, 'Subject is needed for filtering'),
    level: z.string().trim().min(1, 'Class or exam is needed for filtering'),
    board: z.string().optional(),
    language: z.string().optional(),
    tagsText: z.string().optional(),
    coverAlt: z.string().max(300).optional(),
});

type FormValues = z.infer<typeof schema>;

interface PublishListingDialogProps {
    row: PublisherListingRow | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
}

/**
 * Describe a knowledge base for the catalogue.
 *
 * Subject and class are required here rather than at publish time because they
 * drive the filters — a library nobody can filter to is a library nobody finds.
 */
export const PublishListingDialog = ({
    row,
    open,
    onOpenChange,
    onSaved,
}: PublishListingDialogProps) => {
    const [coverFileId, setCoverFileId] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const { uploadFile } = useFileUpload();

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            title: '',
            summary: '',
            description: '',
            subject: '',
            level: '',
            board: '',
            language: '',
            tagsText: '',
            coverAlt: '',
        },
    });

    useEffect(() => {
        if (!open || !row) return;
        form.reset({
            title: row.title || row.kb_name || '',
            summary: row.summary || '',
            description: row.description || '',
            subject: row.subject || '',
            level: row.level || '',
            board: row.board || '',
            language: row.language || '',
            tagsText: (row.tags || []).join(', '),
            coverAlt: row.cover_alt || '',
        });
        setCoverFileId(row.cover_file_id ?? null);
    }, [open, row, form]);

    const pickCover = async (file: File | undefined) => {
        if (!file) return;
        const userId = getUserId();
        if (!userId) {
            toast.error('Could not identify you. Please sign in again.');
            return;
        }
        try {
            const uploaded = await uploadFile({
                file,
                setIsUploading: setUploading,
                userId,
                source: 'KNOWLEDGE_BASE',
                sourceId: row?.knowledge_base_id,
            });
            if (uploaded) setCoverFileId(uploaded);
        } catch {
            toast.error('Could not upload that image. Please try again.');
        }
    };

    const onSubmit = async (values: FormValues) => {
        if (!row) return;
        setSaving(true);
        try {
            await saveListing(row.knowledge_base_id, {
                title: values.title,
                summary: values.summary,
                description: values.description || undefined,
                cover_file_id: coverFileId,
                cover_alt: values.coverAlt || null,
                subject: values.subject,
                level: values.level,
                board: values.board || undefined,
                language: values.language || undefined,
                tags: (values.tagsText || '')
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                sort_weight: row.sort_weight ?? 0,
            });
            toast.success('Library details saved');
            onSaved();
            onOpenChange(false);
        } catch {
            toast.error('Could not save these details');
        } finally {
            setSaving(false);
        }
    };

    const title = form.watch('title');

    return (
        <MyDialog
            heading={row?.status ? 'Edit library details' : 'Describe this library'}
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-2xl"
            footer={
                <div className="flex w-full justify-end gap-2">
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => onOpenChange(false)}
                        disable={saving}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        onClick={form.handleSubmit(onSubmit)}
                        disable={saving || uploading}
                    >
                        {saving ? 'Saving…' : 'Save details'}
                    </MyButton>
                </div>
            }
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5 p-6">
                    <p className="text-body text-neutral-500">
                        This is what an institute reads while deciding whether to spend credits.
                        Write it for someone who has never seen the material.
                    </p>

                    {/* ---- Cover ---- */}
                    <div className="flex items-start gap-4">
                        <div className="h-24 w-36 shrink-0 overflow-hidden rounded-lg border border-neutral-200">
                            <LibraryCover
                                fileId={coverFileId}
                                alt={form.watch('coverAlt')}
                                title={title || 'Library'}
                            />
                        </div>
                        <div className="flex flex-1 flex-col gap-2">
                            <input
                                ref={fileInput}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => pickCover(e.target.files?.[0])}
                            />
                            <div className="flex flex-wrap gap-2">
                                <MyButton
                                    buttonType="secondary"
                                    scale="small"
                                    type="button"
                                    disable={uploading}
                                    onClick={() => fileInput.current?.click()}
                                >
                                    {uploading ? (
                                        <Spinner className="mr-1 size-3.5 animate-spin" />
                                    ) : (
                                        <ImageIcon className="mr-1 size-3.5" />
                                    )}
                                    {coverFileId ? 'Replace cover' : 'Add cover image'}
                                </MyButton>
                                {coverFileId && (
                                    <MyButton
                                        buttonType="text"
                                        scale="small"
                                        type="button"
                                        onClick={() => setCoverFileId(null)}
                                    >
                                        <X className="mr-1 size-3.5" />
                                        Remove
                                    </MyButton>
                                )}
                            </div>
                            <FormField
                                control={form.control}
                                name="coverAlt"
                                render={({ field, fieldState }) => (
                                    <FormItem className="w-full">
                                        <FormControl>
                                            <MyInput
                                                label="Describe the cover"
                                                inputType="text"
                                                input={field.value ?? ''}
                                                onChangeFunction={field.onChange}
                                                error={fieldState.error?.message}
                                                inputPlaceholder="e.g. NCERT Physics Class 11 textbook cover"
                                                className="w-full"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <p className="text-caption text-neutral-400">
                                Read aloud to anyone using a screen reader, and shown if the image
                                fails to load.
                            </p>
                        </div>
                    </div>

                    <FormField
                        control={form.control}
                        name="title"
                        render={({ field, fieldState }) => (
                            <FormItem className="w-full">
                                <FormControl>
                                    <MyInput
                                        label="Title"
                                        required
                                        inputType="text"
                                        input={field.value}
                                        onChangeFunction={field.onChange}
                                        error={fieldState.error?.message}
                                        inputPlaceholder="e.g. NCERT Physics — Class 11"
                                        className="w-full"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="summary"
                        render={({ field, fieldState }) => (
                            <FormItem className="w-full">
                                <FormControl>
                                    <MyInput
                                        label="One-line summary"
                                        required
                                        inputType="text"
                                        input={field.value}
                                        onChangeFunction={field.onChange}
                                        error={fieldState.error?.message}
                                        inputPlaceholder="e.g. Full syllabus, both parts, with worked examples"
                                        className="w-full"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="flex flex-col gap-2">
                        <span className="text-caption font-medium text-neutral-600">
                            Full description
                        </span>
                        <Textarea
                            rows={4}
                            placeholder="What it covers, who it suits, and anything a teacher should know before using it."
                            value={form.watch('description') ?? ''}
                            onChange={(e) => form.setValue('description', e.target.value)}
                            className="w-full"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="subject"
                            render={({ field, fieldState }) => (
                                <FormItem className="w-full">
                                    <FormControl>
                                        <MyInput
                                            label="Subject"
                                            required
                                            inputType="text"
                                            input={field.value}
                                            onChangeFunction={field.onChange}
                                            error={fieldState.error?.message}
                                            inputPlaceholder="Physics"
                                            className="w-full"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="level"
                            render={({ field, fieldState }) => (
                                <FormItem className="w-full">
                                    <FormControl>
                                        <MyInput
                                            label="Class or exam"
                                            required
                                            inputType="text"
                                            input={field.value}
                                            onChangeFunction={field.onChange}
                                            error={fieldState.error?.message}
                                            inputPlaceholder="Class 11"
                                            className="w-full"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="board"
                            render={({ field }) => (
                                <FormItem className="w-full">
                                    <FormControl>
                                        <MyInput
                                            label="Board"
                                            inputType="text"
                                            input={field.value ?? ''}
                                            onChangeFunction={field.onChange}
                                            inputPlaceholder="CBSE"
                                            className="w-full"
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="language"
                            render={({ field }) => (
                                <FormItem className="w-full">
                                    <FormControl>
                                        <MyInput
                                            label="Language"
                                            inputType="text"
                                            input={field.value ?? ''}
                                            onChangeFunction={field.onChange}
                                            inputPlaceholder="English"
                                            className="w-full"
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="tagsText"
                        render={({ field }) => (
                            <FormItem className="w-full">
                                <FormControl>
                                    <MyInput
                                        label="Tags"
                                        inputType="text"
                                        input={field.value ?? ''}
                                        onChangeFunction={field.onChange}
                                        inputPlaceholder="mechanics, thermodynamics, solved examples"
                                        className="w-full"
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </form>
            </Form>
        </MyDialog>
    );
};
