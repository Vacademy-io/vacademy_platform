import { ImportFileImage } from '@/assets/svgs';
import { MyButton } from '@/components/design-system/button';
import { DialogFooter } from '@/components/ui/dialog';
import { useEffect, useRef, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { FileUploadComponent } from '@/components/design-system/file-upload';
import { Form } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FileType } from '@/types/common/file-upload';
import { convertDocToHtml } from './utils/doc-to-html';
import { useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useReplaceBase64ImagesWithNetworkUrls } from '@/utils/helpers/study-library-helpers.ts/slides/replaceBase64ToNetworkUrl';
import { useContentStore } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-stores/chapter-sidebar-store';
import { convertHtmlToPdf } from '../../-helper/helper';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useSlidesMutations } from '../../-hooks/use-slides';
import { getSlideStatusForUser } from '../../non-admin/hooks/useNonAdminSlides';

interface FormData {
    docFile: FileList | null;
    docTitle: string;
}

const MAX_DOC_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const AddDocDialog = ({
    openState,
}: {
    openState?: ((open: boolean) => void) | undefined;
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStage, setUploadStage] = useState<string>('');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Preserve slide/document ids across retries so a failed upload retry
    // doesn't orphan a record on the server under a fresh id.
    const slideIdRef = useRef<string | null>(null);
    const documentIdRef = useRef<string | null>(null);

    const route = useRouter();
    const queryClient = useQueryClient();
    const { getPackageSessionId } = useInstituteDetailsStore();
    const { courseId, levelId, chapterId, moduleId, subjectId, sessionId } =
        route.state.location.search;

    const { addUpdateDocumentSlide, updateSlideOrder } = useSlidesMutations(
        chapterId || '',
        moduleId || '',
        subjectId || '',
        getPackageSessionId({
            courseId: courseId || '',
            levelId: levelId || '',
            sessionId: sessionId || '',
        }) || ''
    );

    const replaceBase64ImagesWithNetworkUrls = useReplaceBase64ImagesWithNetworkUrls();
    const { setActiveItem, getSlideById, items } = useContentStore();

    const form = useForm<FormData>({
        defaultValues: {
            docFile: null,
            docTitle: '',
        },
    });

    const resetUploadIds = () => {
        slideIdRef.current = null;
        documentIdRef.current = null;
    };

    // Wait until the refetched slides include `newSlideId` in the store, with
    // a bounded retry — avoids the old hardcoded 500ms delay that raced the
    // query refetch.
    const waitForSlideInStore = async (newSlideId: string, maxAttempts = 10) => {
        for (let i = 0; i < maxAttempts; i++) {
            const slide = useContentStore.getState().getSlideById(newSlideId);
            if (slide) return slide;
            await new Promise((r) => setTimeout(r, 100));
        }
        return null;
    };

    const reorderSlidesAfterNewSlide = async (newSlideId: string) => {
        try {
            const currentSlides = items || [];
            const newSlide = currentSlides.find((slide) => slide.id === newSlideId);
            if (!newSlide) return;

            const reorderedSlides = [
                { slide_id: newSlideId, slide_order: 0 },
                ...currentSlides
                    .filter((slide) => slide.id !== newSlideId)
                    .map((slide, index) => ({
                        slide_id: slide.id,
                        slide_order: index + 1,
                    })),
            ];

            await updateSlideOrder({
                chapterId: chapterId || '',
                slideOrderPayload: reorderedSlides,
            });

            // Force a refetch and wait for the store to reflect it before
            // resolving the active slide. This replaces the old setTimeout.
            await queryClient.refetchQueries({ queryKey: ['slides'] });
            const freshSlide = await waitForSlideInStore(newSlideId);
            if (freshSlide) {
                setActiveItem(freshSlide);
            } else {
                // Fallback: the slide didn't show up in the expected window;
                // use whatever `getSlideById` returns (may be null).
                setActiveItem(getSlideById(newSlideId));
            }
        } catch (error) {
            console.error('Error reordering slides:', error);
            toast.error('Slide created but reordering failed');
        }
    };

    const handleFileSubmit = async (selectedFile: File) => {
        const allowedTypes = {
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
        };

        if (!Object.keys(allowedTypes).includes(selectedFile.type)) {
            setError('Please upload only document files (DOC, DOCX)');
            return;
        }

        if (selectedFile.size > MAX_DOC_SIZE_BYTES) {
            const sizeMb = (selectedFile.size / (1024 * 1024)).toFixed(1);
            const msg = `File is ${sizeMb} MB. Maximum size is 25 MB.`;
            setError(msg);
            toast.error(msg);
            return;
        }

        setError(null);
        setFile(selectedFile);
        form.setValue('docFile', [selectedFile] as unknown as FileList);

        // Auto-fill title from file name
        const title = selectedFile.name.replace(/\.[^/.]+$/, '');
        form.setValue('docTitle', title);

        toast.success('Document selected successfully');
    };

    // Clear retry-preserved ids when the dialog closes so the next open
    // starts a fresh upload.
    useEffect(() => {
        return () => {
            resetUploadIds();
        };
    }, []);

    const useHandleUpload = async () => {
        if (!file) {
            toast.error('Please select a file first');
            return;
        }

        const title = form.getValues('docTitle')?.trim();
        if (!title) {
            const msg = 'Please enter a title for the document';
            setError(msg);
            toast.error(msg);
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        setUploadStage('Starting…');
        setError(null);

        // Preserve ids across retries so we don't create orphaned records.
        if (!slideIdRef.current) slideIdRef.current = crypto.randomUUID();
        if (!documentIdRef.current) documentIdRef.current = crypto.randomUUID();

        try {
            setUploadStage('Converting document…');
            setUploadProgress(20);
            const HTMLContent = await convertDocToHtml(file);

            setUploadStage('Processing images…');
            setUploadProgress(45);
            const processedHtml = await replaceBase64ImagesWithNetworkUrls(HTMLContent);

            setUploadStage('Generating preview…');
            setUploadProgress(70);
            const { totalPages } = await convertHtmlToPdf(processedHtml);

            setUploadStage('Saving slide…');
            setUploadProgress(85);
            const slideStatus = getSlideStatusForUser();

            const response = await addUpdateDocumentSlide({
                id: slideIdRef.current,
                title,
                image_file_id: '',
                description: null,
                slide_order: 0,
                document_slide: {
                    id: documentIdRef.current,
                    type: 'DOC',
                    data: processedHtml,
                    title,
                    cover_file_id: '',
                    total_pages: totalPages,
                    published_data: slideStatus === 'PUBLISHED' ? processedHtml : null,
                    published_document_total_pages: totalPages,
                },
                status: slideStatus,
                new_slide: true,
                notify: false,
            });

            // Backend mutation returns the slide id as a string. Guard
            // against unexpected shapes so reorder logic can still find the
            // slide via the locally-generated id.
            const createdSlideId =
                typeof response === 'string' && response ? response : slideIdRef.current;

            setUploadStage('Finalizing…');
            setUploadProgress(95);
            await reorderSlidesAfterNewSlide(createdSlideId);

            setUploadProgress(100);
            setUploadStage('Done');
            toast.success('Document uploaded successfully!');
            openState?.(false);
            setFile(null);
            form.reset();
            resetUploadIds();
        } catch (err) {
            console.error('Upload handling error:', err);
            const errorMessage =
                err instanceof Error ? err.message : 'Conversion failed. Please try again.';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(useHandleUpload)} className="flex flex-col gap-6 p-6">
                <FileUploadComponent
                    fileInputRef={fileInputRef}
                    onFileSubmit={handleFileSubmit}
                    control={form.control}
                    name="docFile"
                    acceptedFileTypes={
                        [
                            'application/msword',
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        ] as FileType[]
                    }
                    isUploading={isUploading}
                    error={error}
                    disableClick={false}
                    className="flex flex-col items-center rounded-lg border-2 border-dashed border-primary-500 px-5 pb-6 focus:outline-none"
                >
                    <div className="pointer-events-none flex flex-col items-center gap-6">
                        <ImportFileImage />
                        <div className="text-center">
                            {file ? (
                                <>
                                    <p className="text-primary-600 font-medium">{file.name}</p>
                                    <p className="text-sm text-gray-500">
                                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                                    </p>
                                </>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <p className="text-neutral-600">
                                        Drag and drop a document here, or click to select
                                    </p>
                                    <p className="text-xs text-neutral-500">
                                        DOC or DOCX, up to 25 MB
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </FileUploadComponent>

                {isUploading && (
                    <div className="space-y-3 duration-300 animate-in fade-in slide-in-from-bottom-2">
                        <Progress
                            value={uploadProgress}
                            className="[&>div]:to-primary-600 h-2 bg-neutral-200 [&>div]:bg-gradient-to-r [&>div]:from-primary-500"
                        />
                        <div className="text-sm text-neutral-600">
                            {uploadStage || 'This may take a few moments…'}
                        </div>
                    </div>
                )}

                <DialogFooter className="flex w-full items-center justify-center pt-4">
                    <MyButton
                        buttonType="primary"
                        scale="large"
                        layoutVariant="default"
                        type="submit"
                        disabled={!file || isUploading}
                        className={`
              w-full
              transition-all duration-300 ease-in-out
              ${
                  !file || isUploading
                      ? 'cursor-not-allowed opacity-50'
                      : 'shadow-lg hover:scale-105 hover:shadow-xl active:scale-95'
              }
            `}
                    >
                        {isUploading ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                Uploading…
                            </div>
                        ) : (
                            'Upload Document'
                        )}
                    </MyButton>
                </DialogFooter>
            </form>
        </Form>
    );
};
