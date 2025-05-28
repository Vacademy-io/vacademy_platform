import { ImportFileImage } from '@/assets/svgs';
import { MyButton } from '@/components/design-system/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { FileUploadComponent } from '@/components/design-system/file-upload';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { useSlides } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-hooks/use-slides';
import { useRouter } from '@tanstack/react-router';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { useContentStore } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-stores/chapter-sidebar-store';
import { MyInput } from '@/components/design-system/input';
import * as pdfjs from 'pdfjs-dist';

// Set the workerSrc for pdfjs
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface FormData {
    pdfFile: FileList | null;
    pdfTitle: string;
}

export const AddPdfDialog = ({
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
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const route = useRouter();
    const { chapterId } = route.state.location.search;
    const { addUpdateDocumentSlide } = useSlides(chapterId || '');
    const { setActiveItem, getSlideById } = useContentStore();

    const [fileUrl, setFileUrl] = useState<string | null>(null);

    const form = useForm<FormData>({
        defaultValues: {
            pdfFile: null,
            pdfTitle: '',
        },
    });

    const { uploadFile, getPublicUrl } = useFileUpload();

    const handleFileSubmit = async (selectedFile: File) => {
        if (!selectedFile.type.includes('pdf')) {
            setError('Please upload only PDF files');
            return;
        }

        setError(null);
        setFile(selectedFile);
        form.setValue('pdfFile', [selectedFile] as unknown as FileList);

        // Get PDF page count
        try {
            const arrayBuffer = await selectedFile.arrayBuffer();
            const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
            const numPages = pdf.numPages;
            toast.success(`File selected successfully. Total pages: ${numPages}`);
        } catch (err) {
            console.error('Error reading PDF:', err);
            toast.success('File selected successfully');
        }
    };

    const handleUpload = async (data: FormData) => {
        if (!file) {
            toast.error('Please select a file first');
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        setError(null);

        try {
            const progressInterval = setInterval(() => {
                setUploadProgress((prev) => Math.min(prev + 10, 90));
            }, 200);

            // Get PDF page count
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
            const totalPages = pdf.numPages;

            const fileId = await uploadFile({
                file,
                setIsUploading,
                userId: 'your-user-id',
                source: INSTITUTE_ID,
                sourceId: 'PDF_DOCUMENTS',
            });

            if (fileId) {
                const url = await getPublicUrl(fileId);
                setFileUrl(url);
                setFile(null);
                form.reset();
                const slideId = crypto.randomUUID();

                const response: string = await addUpdateDocumentSlide({
                    id: slideId,
                    title: data.pdfTitle,
                    image_file_id: '',
                    description: null,
                    slide_order: null,
                    document_slide: {
                        id: crypto.randomUUID(),
                        type: 'PDF',
                        data: fileId,
                        title: data.pdfTitle,
                        cover_file_id: '',
                        total_pages: totalPages,
                        published_data: null,
                        published_document_total_pages: 0,
                    },
                    status: 'DRAFT',
                    new_slide: true,
                    notify: false,
                });

                if (response) {
                    setTimeout(() => {
                        setActiveItem(getSlideById(response));
                    }, 500);
                    openState?.(false);
                    toast.success('PDF uploaded successfully!');
                }
            }

            clearInterval(progressInterval);
            openState && openState(false);
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : 'Upload failed. Please try again.';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsUploading(false);
        }
    };

    useEffect(() => {
        setFile(null);
        setError(null);
        setUploadProgress(0);
        setFileUrl(null);
        form.reset();
    }, []);

    return (
        // <DialogContent onCloseAutoFocus={handleClose}>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpload)} className="flex flex-col gap-6 p-6">
                <FileUploadComponent
                    fileInputRef={fileInputRef}
                    onFileSubmit={handleFileSubmit}
                    control={form.control}
                    name="pdfFile"
                    acceptedFileTypes={['application/pdf']}
                    isUploading={isUploading}
                    error={error}
                    className="flex flex-col items-center rounded-lg border-2 border-dashed border-primary-500 px-5 pb-6 focus:outline-none"
                >
                    <div className="pointer-events-none flex flex-col items-center gap-6">
                        <ImportFileImage />
                        <div className="text-center">
                            {file ? (
                                <>
                                    <p className="text-primary-600 text-wrap font-medium">
                                        {file.name}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                                    </p>
                                </>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <p className="text-neutral-600">
                                        Drag and drop a PDF file here, or click to select
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </FileUploadComponent>

                {fileUrl && !isUploading && (
                    <>
                        <div>
                            <Progress
                                value={uploadProgress}
                                className="h-2 bg-neutral-200 [&>div]:bg-primary-500"
                            />
                            <p className="mt-2 text-sm text-neutral-600">
                                Uploading... {uploadProgress}%
                            </p>
                        </div>
                    </>
                )}

                <FormField
                    control={form.control}
                    name="pdfTitle"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <MyInput
                                    {...field}
                                    label="Title"
                                    required={true}
                                    input={field.value}
                                    inputType="text"
                                    inputPlaceholder="File name"
                                    onChangeFunction={field.onChange}
                                    className="w-full"
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />

                <DialogFooter className="flex w-full items-center justify-center">
                    <MyButton
                        buttonType="primary"
                        scale="large"
                        layoutVariant="default"
                        type="submit"
                        disabled={!file || isUploading}
                        className="mx-auto"
                    >
                        {isUploading ? 'Uploading...' : 'Upload PDF'}
                    </MyButton>
                </DialogFooter>
            </form>
        </Form>
        // </DialogContent>
    );
};
