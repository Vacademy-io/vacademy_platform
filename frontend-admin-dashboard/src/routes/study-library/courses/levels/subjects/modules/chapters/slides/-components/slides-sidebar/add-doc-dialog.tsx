import { ImportFileImage } from '@/assets/svgs';
import { MyButton } from '@/components/design-system/button';
import { DialogFooter } from '@/components/ui/dialog';
import { useState, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { FileUploadComponent } from '@/components/design-system/file-upload';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FileType } from '@/types/common/file-upload';
import { convertDocToHtml } from './utils/doc-to-html';
import { useRouter } from '@tanstack/react-router';
import { useSlides } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-hooks/use-slides';
import { useReplaceBase64ImagesWithNetworkUrls } from '@/utils/helpers/study-library-helpers.ts/slides/replaceBase64ToNetworkUrl';
import { useContentStore } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-stores/chapter-sidebar-store';
import { MyInput } from '@/components/design-system/input';
import { convertHtmlToPdf } from '../../-helper/helper';

interface FormData {
    docFile: FileList | null;
    docTitle: string;
}

export const AddDocDialog = ({
    openState,
}: {
    openState?: ((open: boolean) => void) | undefined;
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const route = useRouter();
    const { chapterId } = route.state.location.search;
    const { addUpdateDocumentSlide } = useSlides(chapterId || '');
    const replaceBase64ImagesWithNetworkUrls = useReplaceBase64ImagesWithNetworkUrls();
    const { setActiveItem, getSlideById } = useContentStore();

    const form = useForm<FormData>({
        defaultValues: {
            docFile: null,
            docTitle: '',
        },
    });

    const handleFileSubmit = async (selectedFile: File) => {
        const allowedTypes = {
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
        };

        if (!Object.keys(allowedTypes).includes(selectedFile.type)) {
            setError('Please upload only document files (DOC, DOCX)');
            return;
        }

        setError(null);
        setFile(selectedFile);
        form.setValue('docFile', [selectedFile] as unknown as FileList);
        toast.success('File selected successfully');
    };

    const useHandleUpload = async (data: FormData) => {
        if (!file) {
            toast.error('Please select a file first');
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        setError(null);

        const progressInterval = setInterval(() => {
            setUploadProgress((prev) => Math.min(prev + 10, 90));
        }, 200);

        try {
            const HTMLContent = await convertDocToHtml(file);
            const processedHtml = await replaceBase64ImagesWithNetworkUrls(HTMLContent);
            const { totalPages } = await convertHtmlToPdf(processedHtml);
            const slideId = crypto.randomUUID();
            const response = await addUpdateDocumentSlide({
                id: slideId,
                title: data.docTitle,
                image_file_id: '',
                description: null,
                slide_order: null,
                document_slide: {
                    id: crypto.randomUUID(),
                    type: 'DOC',
                    data: processedHtml,
                    title: data.docTitle,
                    cover_file_id: '',
                    total_pages: totalPages,
                    published_data: null,
                    published_document_total_pages: 0,
                },
                status: 'DRAFT',
                new_slide: true,
                notify: false,
            });

            toast.success('Document uploaded successfully!');

            if (response) {
                setTimeout(() => {
                    setActiveItem(getSlideById(response));
                }, 500);
                openState?.(false);
                toast.success('Document uploaded successfully!');
            }

            setUploadProgress(100);
            toast.success('Document converted successfully!');

            setFile(null);
            form.reset();
            openState && openState(false);
        } catch (err) {
            console.error('Upload handling error:', err);
            const errorMessage =
                err instanceof Error ? err.message : 'Conversion failed. Please try again.';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            clearInterval(progressInterval);
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
                                </div>
                            )}
                        </div>
                    </div>
                </FileUploadComponent>

                <FormField
                    control={form.control}
                    name="docTitle"
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
                {isUploading && (
                    <>
                        <div>
                            <Progress
                                value={uploadProgress}
                                className="h-2 bg-neutral-200 [&>div]:bg-primary-500"
                            />
                            <p className="mt-2 text-sm text-neutral-600">
                                This may take a few moments...
                            </p>
                        </div>
                    </>
                )}

                <DialogFooter className="flex w-full items-center justify-center">
                    <MyButton
                        buttonType="primary"
                        scale="large"
                        layoutVariant="default"
                        type="submit"
                        disabled={!file || isUploading}
                        className="mx-auto"
                    >
                        {isUploading ? 'Converting...' : 'Convert Document'}
                    </MyButton>
                </DialogFooter>
            </form>
        </Form>
    );
};
