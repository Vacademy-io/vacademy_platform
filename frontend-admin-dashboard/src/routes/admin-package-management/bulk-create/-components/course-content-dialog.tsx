import { useState, useRef, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { MyButton } from '@/components/design-system/button';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import ImageCropperDialog from '@/components/design-system/image-cropper-dialog';
import { useFileUpload } from '@/hooks/use-file-upload';
import { TokenKey } from '@/constants/auth/tokens';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { ImageSquare, PencilSimpleLine, Trash, Image, TextT } from '@phosphor-icons/react';
import { toast } from 'sonner';

interface CourseContentData {
    why_learn_html?: string | null;
    who_should_learn_html?: string | null;
    about_the_course_html?: string | null;
    course_html_description?: string | null;
    thumbnail_file_id?: string | null;
    course_preview_image_media_id?: string | null;
    course_banner_media_id?: string | null;
    course_media_id?: string | null;
}

interface CourseContentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    courseName: string;
    initialData: CourseContentData;
    onSave: (data: CourseContentData) => void;
    defaultTab?: 'content' | 'media';
}

interface MediaPreview {
    thumbnail: string | null;
    preview: string | null;
    banner: string | null;
    media: string | null;
}

export function CourseContentDialog({
    open,
    onOpenChange,
    courseName,
    initialData,
    onSave,
    defaultTab = 'content',
}: CourseContentDialogProps) {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const instituteId = tokenData && Object.keys(tokenData.authorities)[0];

    const { uploadFile, getPublicUrl } = useFileUpload();

    const [formData, setFormData] = useState<CourseContentData>(initialData);
    const [mediaPreview, setMediaPreview] = useState<MediaPreview>({
        thumbnail: null,
        preview: null,
        banner: null,
        media: null,
    });
    const [uploadingStates, setUploadingStates] = useState({
        thumbnail: false,
        preview: false,
        banner: false,
        media: false,
    });

    const thumbnailRef = useRef<HTMLInputElement>(null);
    const previewRef = useRef<HTMLInputElement>(null);
    const bannerRef = useRef<HTMLInputElement>(null);
    const mediaRef = useRef<HTMLInputElement>(null);

    const [isCropperOpen, setIsCropperOpen] = useState(false);
    const [cropperSrc, setCropperSrc] = useState<string>('');
    const [cropperAspect, setCropperAspect] = useState<number | undefined>(undefined);
    const cropTargetField = useRef<'thumbnail' | 'preview' | 'banner' | 'media'>('thumbnail');
    const cropOutputType = useRef<'image/jpeg' | 'image/png'>('image/jpeg');

    useEffect(() => {
        const loadPreviews = async () => {
            const previews: MediaPreview = {
                thumbnail: null,
                preview: null,
                banner: null,
                media: null,
            };

            if (initialData.thumbnail_file_id) {
                try {
                    previews.thumbnail = await getPublicUrl(initialData.thumbnail_file_id);
                } catch (e) {
                    console.error('Failed to load thumbnail preview');
                }
            }
            if (initialData.course_preview_image_media_id) {
                try {
                    previews.preview = await getPublicUrl(
                        initialData.course_preview_image_media_id
                    );
                } catch (e) {
                    console.error('Failed to load preview image');
                }
            }
            if (initialData.course_banner_media_id) {
                try {
                    previews.banner = await getPublicUrl(initialData.course_banner_media_id);
                } catch (e) {
                    console.error('Failed to load banner');
                }
            }
            if (initialData.course_media_id) {
                try {
                    previews.media = await getPublicUrl(initialData.course_media_id);
                } catch (e) {
                    console.error('Failed to load media');
                }
            }

            setMediaPreview(previews);
        };

        if (open) {
            setFormData(initialData);
            loadPreviews();
        }
    }, [open, initialData, getPublicUrl]);

    const handleFileUpload = async (
        file: File,
        field: 'thumbnail' | 'preview' | 'banner' | 'media'
    ) => {
        try {
            setUploadingStates((prev) => ({ ...prev, [field]: true }));

            const uploadedFileId = await uploadFile({
                file,
                setIsUploading: (state) =>
                    setUploadingStates((prev) => ({ ...prev, [field]: state })),
                userId: 'user',
                source: instituteId || '',
                sourceId: 'COURSES',
            });

            if (uploadedFileId) {
                const publicUrl = await getPublicUrl(uploadedFileId);

                const fieldToDataKey: Record<
                    'thumbnail' | 'preview' | 'banner' | 'media',
                    keyof CourseContentData
                > = {
                    thumbnail: 'thumbnail_file_id',
                    preview: 'course_preview_image_media_id',
                    banner: 'course_banner_media_id',
                    media: 'course_media_id',
                };

                const dataKey = fieldToDataKey[field];
                setFormData((prev) => ({
                    ...prev,
                    [dataKey]: uploadedFileId,
                }));
                setMediaPreview((prev) => ({
                    ...prev,
                    [field]: publicUrl,
                }));
                toast.success('File uploaded successfully');
            }
        } catch (error) {
            toast.error('Failed to upload file');
            console.error(error);
        } finally {
            setUploadingStates((prev) => ({ ...prev, [field]: false }));
        }
    };

    const readFileAsDataURL = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

    const handleFileSelectedWithCrop = async (
        file: File,
        field: 'thumbnail' | 'preview' | 'banner' | 'media'
    ) => {
        const isImage = file.type.startsWith('image/');
        const isSvg = file.type === 'image/svg+xml';

        if (!isImage || isSvg) {
            await handleFileUpload(file, field);
            return;
        }

        const dataUrl = await readFileAsDataURL(file);
        cropTargetField.current = field;

        // We allow free cropping now as per user request
        setCropperAspect(undefined);
        cropOutputType.current = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        setCropperSrc(dataUrl);
        setIsCropperOpen(true);
    };

    const handleRemoveMedia = (field: 'thumbnail' | 'preview' | 'banner' | 'media') => {
        const fieldToDataKey: Record<
            'thumbnail' | 'preview' | 'banner' | 'media',
            keyof CourseContentData
        > = {
            thumbnail: 'thumbnail_file_id',
            preview: 'course_preview_image_media_id',
            banner: 'course_banner_media_id',
            media: 'course_media_id',
        };

        const dataKey = fieldToDataKey[field];
        setFormData((prev) => ({
            ...prev,
            [dataKey]: null,
        }));
        setMediaPreview((prev) => ({
            ...prev,
            [field]: null,
        }));
    };

    const handleSave = () => {
        onSave(formData);
        onOpenChange(false);
    };

    const isUploading = Object.values(uploadingStates).some((s) => s);

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-h-[90vh] sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Course Content & Media</DialogTitle>
                        <DialogDescription>
                            Add content and media for &quot;{courseName}&quot;
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue={defaultTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="content" className="flex items-center gap-2">
                                <TextT className="size-4" />
                                Content
                            </TabsTrigger>
                            <TabsTrigger value="media" className="flex items-center gap-2">
                                <Image className="size-4" />
                                Media
                            </TabsTrigger>
                        </TabsList>

                        <div className="mt-4 max-h-[60vh] overflow-y-auto px-1">
                            <TabsContent value="content" className="space-y-6 pr-4">
                                {/* Why Learn */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">
                                        Why Learn This Course?
                                    </Label>
                                    <p className="text-xs text-neutral-500">
                                        Explain the benefits and value of taking this course
                                    </p>
                                    <RichTextEditor
                                        value={formData.why_learn_html || ''}
                                        onChange={(val) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                why_learn_html: val,
                                            }))
                                        }
                                        minHeight={100}
                                        placeholder="Enter reasons why learners should take this course..."
                                    />
                                </div>

                                {/* Who Should Learn */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Target Audience</Label>
                                    <p className="text-xs text-neutral-500">
                                        Describe who this course is designed for
                                    </p>
                                    <RichTextEditor
                                        value={formData.who_should_learn_html || ''}
                                        onChange={(val) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                who_should_learn_html: val,
                                            }))
                                        }
                                        minHeight={100}
                                        placeholder="Describe the ideal learner for this course..."
                                    />
                                </div>

                                {/* About the Course */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">About the Course</Label>
                                    <p className="text-xs text-neutral-500">
                                        Provide a detailed overview of the course content
                                    </p>
                                    <RichTextEditor
                                        value={formData.about_the_course_html || ''}
                                        onChange={(val) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                about_the_course_html: val,
                                            }))
                                        }
                                        minHeight={120}
                                        placeholder="Provide a detailed description of the course..."
                                    />
                                </div>

                                {/* Course Description */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">
                                        Course Description (HTML)
                                    </Label>
                                    <p className="text-xs text-neutral-500">
                                        Additional description content for the course page
                                    </p>
                                    <RichTextEditor
                                        value={formData.course_html_description || ''}
                                        onChange={(val) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                course_html_description: val,
                                            }))
                                        }
                                        minHeight={100}
                                        placeholder="Additional course description..."
                                    />
                                </div>
                            </TabsContent>

                            <TabsContent value="media" className="pr-4">
                                <div className="grid gap-6 md:grid-cols-2">
                                    {/* Thumbnail */}
                                    <MediaUploadCard
                                        title="Thumbnail"
                                        description="Course card thumbnail (1:1 ratio)"
                                        previewUrl={mediaPreview.thumbnail}
                                        isUploading={uploadingStates.thumbnail}
                                        aspectHint="1:1"
                                        inputRef={thumbnailRef}
                                        onUploadClick={() => thumbnailRef.current?.click()}
                                        onRemove={() => handleRemoveMedia('thumbnail')}
                                        onFileSelect={(file) =>
                                            handleFileSelectedWithCrop(file, 'thumbnail')
                                        }
                                    />

                                    {/* Preview Image */}
                                    <MediaUploadCard
                                        title="Preview Image"
                                        description="Course preview thumbnail (2:1 ratio)"
                                        previewUrl={mediaPreview.preview}
                                        isUploading={uploadingStates.preview}
                                        aspectHint="2:1"
                                        inputRef={previewRef}
                                        onUploadClick={() => previewRef.current?.click()}
                                        onRemove={() => handleRemoveMedia('preview')}
                                        onFileSelect={(file) =>
                                            handleFileSelectedWithCrop(file, 'preview')
                                        }
                                    />

                                    {/* Banner Image */}
                                    <MediaUploadCard
                                        title="Banner Image"
                                        description="Course page banner (2.64:1 ratio)"
                                        previewUrl={mediaPreview.banner}
                                        isUploading={uploadingStates.banner}
                                        aspectHint="2.64:1"
                                        inputRef={bannerRef}
                                        onUploadClick={() => bannerRef.current?.click()}
                                        onRemove={() => handleRemoveMedia('banner')}
                                        onFileSelect={(file) =>
                                            handleFileSelectedWithCrop(file, 'banner')
                                        }
                                    />

                                    {/* Course Media */}
                                    <MediaUploadCard
                                        title="Course Media"
                                        description="Featured media (image/video, 16:9)"
                                        previewUrl={mediaPreview.media}
                                        isUploading={uploadingStates.media}
                                        aspectHint="16:9"
                                        inputRef={mediaRef}
                                        onUploadClick={() => mediaRef.current?.click()}
                                        onRemove={() => handleRemoveMedia('media')}
                                        onFileSelect={(file) =>
                                            handleFileSelectedWithCrop(file, 'media')
                                        }
                                        acceptVideo
                                    />
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isUploading}>
                            {isUploading ? 'Uploading...' : 'Save Content'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ImageCropperDialog
                open={isCropperOpen}
                onOpenChange={setIsCropperOpen}
                src={cropperSrc}
                aspectRatio={cropperAspect}
                title="Crop Image"
                outputMimeType={cropOutputType.current}
                onCropped={(file) => handleFileUpload(file, cropTargetField.current)}
            />
        </>
    );
}

interface MediaUploadCardProps {
    title: string;
    description: string;
    previewUrl: string | null;
    isUploading: boolean;
    aspectHint: string;
    inputRef: React.RefObject<HTMLInputElement>;
    onUploadClick: () => void;
    onRemove: () => void;
    onFileSelect: (file: File) => void;
    acceptVideo?: boolean;
}

function MediaUploadCard({
    title,
    description,
    previewUrl,
    isUploading,
    aspectHint,
    inputRef,
    onUploadClick,
    onRemove,
    onFileSelect,
    acceptVideo = false,
}: MediaUploadCardProps) {
    const acceptedTypes = acceptVideo
        ? ['image/jpeg', 'image/png', 'video/mp4', 'video/webm']
        : ['image/jpeg', 'image/png'];

    return (
        <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3">
            <div className="flex items-start justify-between">
                <div>
                    <Label className="text-sm font-medium">{title}</Label>
                    <p className="text-xs text-neutral-500">{description}</p>
                </div>
                <span className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
                    {aspectHint}
                </span>
            </div>

            <div className="relative">
                {isUploading ? (
                    <div className="flex h-32 items-center justify-center rounded-lg bg-neutral-100">
                        <DashboardLoader />
                    </div>
                ) : previewUrl ? (
                    <div className="h-32 w-full overflow-hidden rounded-lg bg-neutral-100">
                        <img src={previewUrl} alt={title} className="size-full object-contain" />
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={onUploadClick}
                        className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 transition-colors hover:border-primary-400 hover:bg-primary-50"
                    >
                        <ImageSquare className="size-8 text-neutral-400" />
                        <span className="text-xs font-medium text-neutral-500">
                            Click to upload
                        </span>
                    </button>
                )}

                {previewUrl && (
                    <div className="absolute bottom-2 right-2 flex gap-1">
                        <MyButton
                            type="button"
                            onClick={onUploadClick}
                            disabled={isUploading}
                            buttonType="secondary"
                            layoutVariant="icon"
                            scale="small"
                            className="bg-white shadow-sm hover:bg-white"
                        >
                            <PencilSimpleLine className="size-4" />
                        </MyButton>
                        <MyButton
                            type="button"
                            onClick={onRemove}
                            disabled={isUploading}
                            buttonType="secondary"
                            layoutVariant="icon"
                            scale="small"
                            className="bg-white text-red-500 shadow-sm hover:bg-red-50 hover:text-red-600"
                        >
                            <Trash className="size-4" />
                        </MyButton>
                    </div>
                )}
            </div>

            <input
                ref={inputRef}
                type="file"
                accept={acceptedTypes.join(',')}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        onFileSelect(file);
                        e.target.value = '';
                    }
                }}
                style={{ display: 'none' }}
            />
        </div>
    );
}
