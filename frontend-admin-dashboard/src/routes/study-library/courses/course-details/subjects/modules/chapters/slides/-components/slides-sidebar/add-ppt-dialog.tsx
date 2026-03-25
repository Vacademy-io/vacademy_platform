import { MyButton } from '@/components/design-system/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { FileUploadComponent } from '@/components/design-system/file-upload';
import { Form } from '@/components/ui/form';
import { useSlides } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-hooks/use-slides';
import { useRouter } from '@tanstack/react-router';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { useContentStore } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-stores/chapter-sidebar-store';
import * as pdfjs from 'pdfjs-dist';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { CheckCircle, PresentationChart } from '@phosphor-icons/react';
import { getSlideStatusForUser } from '../../non-admin/hooks/useNonAdminSlides';
import { CONVERT_PPT_TO_PDF_URL } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { useFileUpload } from '@/hooks/use-file-upload';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface FormData {
    pptFile: FileList | null;
    pptTitle: string;
}

/**
 * Converts a PPT/PPTX file to PDF using the media-service API.
 * Returns the PDF as a File object.
 */
export async function convertPptToPdf(file: File): Promise<File> {
    const formData = new globalThis.FormData();
    formData.append('file', file);

    const response = await authenticatedAxiosInstance.post(
        `${CONVERT_PPT_TO_PDF_URL}?quality=high`,
        formData,
        {
            headers: { 'Content-Type': 'multipart/form-data' },
            responseType: 'blob',
        }
    );

    const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
    const pdfFileName = file.name.replace(/\.[^/.]+$/, '') + '.pdf';
    return new File([pdfBlob], pdfFileName, { type: 'application/pdf' });
}

export const AddPptDialog = ({
    openState,
}: {
    openState?: ((open: boolean) => void) | undefined;
}) => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const data = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = data && Object.keys(data.authorities)[0];
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const route = useRouter();
    const { courseId, levelId, chapterId, moduleId, subjectId, sessionId } =
        route.state.location.search;
    const { getPackageSessionId } = useInstituteDetailsStore();
    const { addUpdateDocumentSlide, updateSlideOrder } = useSlides(
        chapterId || '',
        moduleId || '',
        subjectId || '',
        getPackageSessionId({
            courseId: courseId || '',
            levelId: levelId || '',
            sessionId: sessionId || '',
        }) || ''
    );
    const { setActiveItem, getSlideById, items } = useContentStore();
    const { uploadFile } = useFileUpload();

    const form = useForm<FormData>({
        defaultValues: {
            pptFile: null,
            pptTitle: '',
        },
    });

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

            setTimeout(() => {
                setActiveItem(getSlideById(newSlideId));
            }, 500);
        } catch (error) {
            console.error('Error reordering slides:', error);
            toast.error('Slide created but reordering failed');
        }
    };

    const handleFileSubmit = async (selectedFile: File) => {
        const ext = selectedFile.name.split('.').pop()?.toLowerCase();
        if (!['ppt', 'pptx'].includes(ext || '')) {
            setError('Please upload only PPT or PPTX files');
            return;
        }

        setError(null);
        setFile(selectedFile);
        form.setValue('pptFile', [selectedFile] as unknown as FileList);

        const fileName = selectedFile.name.replace(/\.[^/.]+$/, '');
        form.setValue('pptTitle', fileName);
        toast.success('PPT file selected successfully');
    };

    const handleUpload = async () => {
        if (!file) {
            toast.error('Please select a file first');
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        setError(null);

        try {
            // Step 1: Convert PPT to PDF
            setStatusMessage('Converting PPT to PDF...');
            setUploadProgress(10);
            const pdfFile = await convertPptToPdf(file);
            setUploadProgress(40);

            // Step 2: Read the PDF to get page count
            setStatusMessage('Analyzing PDF pages...');
            const arrayBuffer = await pdfFile.arrayBuffer();
            const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
            const totalPages = pdf.numPages;
            setUploadProgress(50);

            // Step 3: Upload the converted PDF to S3
            setStatusMessage('Uploading converted PDF...');
            const fileId = await uploadFile({
                file: pdfFile,
                setIsUploading,
                userId: 'your-user-id',
                source: INSTITUTE_ID,
                sourceId: 'PDF_DOCUMENTS',
            });
            setUploadProgress(80);

            if (fileId) {
                // Step 4: Create the slide (treated as PDF internally)
                setStatusMessage('Creating slide...');
                const slideId = crypto.randomUUID();
                const slideStatus = getSlideStatusForUser();

                const response: string = await addUpdateDocumentSlide({
                    id: slideId,
                    title: form.getValues('pptTitle'),
                    image_file_id: '',
                    description: null,
                    slide_order: 0,
                    document_slide: {
                        id: crypto.randomUUID(),
                        type: 'PDF',
                        data: fileId,
                        title: form.getValues('pptTitle'),
                        cover_file_id: '',
                        total_pages: totalPages,
                        published_data: slideStatus === 'PUBLISHED' ? fileId : null,
                        published_document_total_pages:
                            slideStatus === 'PUBLISHED' ? totalPages : 1,
                    },
                    status: slideStatus,
                    new_slide: true,
                    notify: false,
                });

                if (response) {
                    await reorderSlidesAfterNewSlide(response);
                    openState?.(false);
                    toast.success('PPT uploaded and converted successfully!');
                }
            }

            setUploadProgress(100);
            setStatusMessage('');
            openState && openState(false);
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : 'Upload failed. Please try again.';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsUploading(false);
            setStatusMessage('');
        }
    };

    useEffect(() => {
        setFile(null);
        setError(null);
        setUploadProgress(0);
        setStatusMessage('');
        form.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpload)} className="flex flex-col gap-6 p-6">
                <div className="space-y-4">
                    <FileUploadComponent
                        fileInputRef={fileInputRef}
                        onFileSubmit={handleFileSubmit}
                        control={form.control}
                        name="pptFile"
                        acceptedFileTypes={[
                            'application/vnd.ms-powerpoint',
                            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                        ]}
                        isUploading={isUploading}
                        error={error}
                        disableClick={false}
                        className={`
              flex flex-col items-center rounded-xl border-2 border-dashed px-6 py-8
              transition-all duration-300 ease-in-out
              ${
                  file
                      ? 'border-green-300 bg-green-50/50'
                      : 'border-primary-300 bg-primary-50/30 hover:border-primary-400 hover:bg-primary-50/50'
              }
              focus:outline-none focus:ring-2 focus:ring-primary-500/20
            `}
                    >
                        <div className="pointer-events-none flex flex-col items-center gap-4">
                            {file ? (
                                <div className="flex items-center gap-3 duration-500 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="rounded-full bg-green-100 p-3">
                                        <CheckCircle className="size-6 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-wrap font-medium text-green-700">
                                            {file.name}
                                        </p>
                                        <div className="flex items-center gap-2 text-sm text-green-600">
                                            <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3 text-center">
                                    <div className="mx-auto w-fit animate-pulse rounded-full bg-primary-100 p-4">
                                        <PresentationChart className="size-8 text-primary-600" />
                                    </div>
                                    <div>
                                        <p className="mb-1 font-medium text-neutral-700">
                                            Drop your PPT file here, or click to browse
                                        </p>
                                        <p className="text-sm text-neutral-500">
                                            Supports .ppt and .pptx files
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </FileUploadComponent>

                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 duration-300 animate-in fade-in slide-in-from-top-2">
                            <p className="flex items-center gap-2 text-sm text-red-600">
                                <span className="size-2 rounded-full bg-red-500"></span>
                                {error}
                            </p>
                        </div>
                    )}
                </div>

                {isUploading && (
                    <div className="space-y-3 duration-300 animate-in fade-in slide-in-from-bottom-2">
                        <Progress
                            value={uploadProgress}
                            className="h-2 bg-neutral-200 [&>div]:bg-gradient-to-r [&>div]:from-primary-500 [&>div]:to-primary-600"
                        />
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-neutral-600">
                                {statusMessage || 'Processing...'}
                            </span>
                            <span className="font-medium text-primary-600">{uploadProgress}%</span>
                        </div>
                    </div>
                )}

                <DialogFooter className="flex w-full items-center justify-between border-t border-neutral-100 pt-4">
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
                                {statusMessage || 'Processing...'}
                            </div>
                        ) : (
                            'Upload PPT'
                        )}
                    </MyButton>
                </DialogFooter>
            </form>
        </Form>
    );
};
