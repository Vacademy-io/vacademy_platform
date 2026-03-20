import { UseFormReturn } from 'react-hook-form';
import { InviteLinkFormValues } from '../GenerateInviteLinkSchema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, FormItem, FormControl, FormMessage, FormLabel } from '@/components/ui/form';
import { ImageSquare, PencilSimpleLine } from '@phosphor-icons/react';
import { MyInput } from '@/components/design-system/input';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { MyButton } from '@/components/design-system/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { FileUploadComponent } from '@/components/design-system/file-upload';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

interface CoursePreviewCardProps {
    form: UseFormReturn<InviteLinkFormValues>;
    handleTagInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    addTag: (e?: React.MouseEvent | React.KeyboardEvent, selectedTag?: string) => void;
    removeTag: (tagToRemove: string) => void;
    coursePreviewRef: React.RefObject<HTMLInputElement>;
    courseBannerRef: React.RefObject<HTMLInputElement>;
    mediaMenuRef: React.RefObject<HTMLDivElement>;
    youtubeInputRef: React.RefObject<HTMLDivElement>;
    courseMediaRef: React.RefObject<HTMLInputElement>;
    handleFileUpload: (file: File, field: 'coursePreview' | 'courseBanner' | 'courseMedia') => void;
    extractYouTubeVideoId: (url: string) => string | null;
    isBundle?: boolean;
    totalBatches?: number;
}

const CoursePreviewCard = ({
    form,
    handleTagInputChange,
    addTag,
    removeTag,
    coursePreviewRef,
    courseBannerRef,
    mediaMenuRef,
    youtubeInputRef,
    courseMediaRef,
    handleFileUpload,
    extractYouTubeVideoId,
    isBundle = false,
    totalBatches = 1,
}: CoursePreviewCardProps) => {
    return (
        <Card className="pb-4">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                    <PencilSimpleLine size={22} />
                    <span>Course Preview</span>
                    {isBundle && (
                        <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700">
                            Bundle ({totalBatches} batches)
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-8">
                    {/* Left Column - Form Fields */}
                    <div className="space-y-6">
                        <FormField
                            control={form.control}
                            name="course"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <MyInput
                                            id="course-name"
                                            required={true}
                                            label="Course"
                                            inputType="text"
                                            inputPlaceholder="Enter course name"
                                            className="w-full"
                                            input={field.value}
                                            onChangeFunction={(e) => field.onChange(e.target.value)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex flex-col">
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl>
                                            <RichTextEditor
                                                onChange={(value: string) => {
                                                    const plainText = value
                                                        .replace(/<[^>]*>/g, '')
                                                        .trim();
                                                    const words = plainText.split(/\s+/);
                                                    if (words.length <= 30) {
                                                        field.onChange(value);
                                                    } else {
                                                        // Truncate to first 30 words and update editor content
                                                        const truncatedText = words
                                                            .slice(0, 30)
                                                            .join(' ');
                                                        field.onChange(truncatedText);
                                                    }
                                                }}
                                                value={field.value}
                                                onBlur={field.onBlur}
                                                minHeight={120}
                                                placeholder="Enter course description (max 30 words)"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <span className="relative top-12 text-xs text-red-500">
                                *Max 30 words allowed
                            </span>
                        </div>

                        {/* Tags Section */}
                        <div className="space-y-2 pt-10">
                            <Label className="font-medium text-gray-900">
                                {getTerminology(ContentTerms.PopularTag, SystemTerms.PopularTag)} Tags
                            </Label>
                            <p className="text-sm text-gray-600">
                                Add tags to help categorize and find your course easily
                            </p>
                            <div className="flex gap-2">
                                <Input
                                    type="text"
                                    placeholder="Enter a tag"
                                    value={form.watch('newTag')}
                                    onChange={handleTagInputChange}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            addTag(e);
                                        }
                                    }}
                                    className="h-9 border-gray-300"
                                />

                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="medium"
                                    layoutVariant="default"
                                    onClick={addTag}
                                    disable={!(form.watch('newTag') || '').trim()}
                                >
                                    Add
                                </MyButton>
                            </div>

                            {/* Suggestions dropdown */}
                            {form.watch('filteredTags')?.length > 0 && (
                                <div className="w-full overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-sm">
                                    <div className="flex flex-wrap gap-1.5 p-2">
                                        {form.watch('filteredTags').map((tag, index) => (
                                            <span
                                                key={index}
                                                className="hover:text-primary-600 cursor-pointer select-none rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-700 transition-colors hover:bg-primary-100"
                                                onClick={(e) => addTag(e, tag)}
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {form.watch('tags')?.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {form.watch('tags').map((tag, index) => (
                                        <Badge
                                            key={index}
                                            variant="secondary"
                                            className="flex items-center gap-1 px-3 py-1"
                                        >
                                            {tag}
                                            <X
                                                className="size-3 cursor-pointer"
                                                onClick={() => removeTag(tag)}
                                            />
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-16 pb-8">
                            <FormField
                                control={form.control}
                                name="learningOutcome"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>What learners will gain?</FormLabel>
                                        <FormControl>
                                            <RichTextEditor
                                                onChange={field.onChange}
                                                value={field.value}
                                                onBlur={field.onBlur}
                                                minHeight={120}
                                                placeholder="Provide a detailed overview of the course. Include learning objectives, topics covered, format (video, quizzes, projects), and who this course is for."
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="aboutCourse"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>About the course</FormLabel>
                                        <FormControl>
                                            <RichTextEditor
                                                onChange={field.onChange}
                                                value={field.value}
                                                onBlur={field.onBlur}
                                                minHeight={120}
                                                placeholder="Provide a detailed overview of the course. Include learning objectives, topics covered, format (video, quizzes, projects), and who this course is for."
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="targetAudience"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Who should join?</FormLabel>
                                        <FormControl>
                                            <RichTextEditor
                                                onChange={field.onChange}
                                                value={field.value}
                                                onBlur={field.onBlur}
                                                minHeight={120}
                                                placeholder="Provide a detailed overview of the course. Include learning objectives, topics covered, format (video, quizzes, projects), and who this course is for."
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>

                    {/* Right Column - Image Uploads */}
                    <div className="space-y-6">
                        {/* Course Preview */}
                        <div className="flex flex-col gap-1">
                            <FormLabel>Course Preview Image</FormLabel>
                            <p className="text-sm text-gray-500">
                                This is the thumbnail that appears on the course card. Recommended
                                size: 2:1 ratio
                            </p>
                            <div className="relative">
                                {form.watch('uploadingStates').coursePreview ? (
                                    <div className="flex h-[200px] items-center justify-center rounded-lg bg-gray-100">
                                        <DashboardLoader />
                                    </div>
                                ) : form.watch('coursePreview') ? (
                                    <div className="h-[200px] w-full rounded-lg bg-gray-100">
                                        <img
                                            src={form.watch('coursePreviewBlob')}
                                            alt="Course Preview"
                                            className="size-full rounded-lg object-contain"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex h-[200px] items-center justify-center rounded-lg bg-gray-100">
                                        <p className="text-white">
                                            <ImageSquare size={100} />
                                        </p>
                                    </div>
                                )}
                                <FileUploadComponent
                                    fileInputRef={coursePreviewRef}
                                    onFileSubmit={(file) => handleFileUpload(file, 'coursePreview')}
                                    control={form.control}
                                    name="coursePreview"
                                    acceptedFileTypes={['image/jpeg', 'image/png', 'image/svg+xml']}
                                />
                                <MyButton
                                    type="button"
                                    onClick={() => coursePreviewRef.current?.click()}
                                    disabled={form.watch('uploadingStates').coursePreview}
                                    buttonType="secondary"
                                    layoutVariant="icon"
                                    scale="small"
                                    className="absolute bottom-2 right-2 bg-white"
                                >
                                    <PencilSimpleLine />
                                </MyButton>
                            </div>
                        </div>

                        {/* Course Banner */}
                        <div className="flex flex-col gap-1">
                            <FormLabel>Course Banner Image</FormLabel>
                            <p className="text-sm text-gray-500">
                                A wide background image displayed on top of the course detail page.
                                Recommended size: 2.64:1 ratio
                            </p>
                            <div className="relative">
                                {form.watch('uploadingStates').courseBanner ? (
                                    <div className="flex h-[200px] items-center justify-center rounded-lg bg-gray-100">
                                        <DashboardLoader />
                                    </div>
                                ) : form.watch('courseBanner') ? (
                                    <div className="h-[200px] w-full rounded-lg bg-gray-100">
                                        <img
                                            src={form.watch('courseBannerBlob')}
                                            alt="Course Banner"
                                            className="size-full rounded-lg object-contain"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex h-[200px] items-center justify-center rounded-lg bg-gray-100">
                                        <p className="text-white">
                                            <ImageSquare size={100} />
                                        </p>
                                    </div>
                                )}
                                <FileUploadComponent
                                    fileInputRef={courseBannerRef}
                                    onFileSubmit={(file) => handleFileUpload(file, 'courseBanner')}
                                    control={form.control}
                                    name="courseBanner"
                                    acceptedFileTypes={['image/jpeg', 'image/png', 'image/svg+xml']}
                                />
                                <MyButton
                                    type="button"
                                    onClick={() => courseBannerRef.current?.click()}
                                    disabled={form.watch('uploadingStates').courseBanner}
                                    buttonType="secondary"
                                    layoutVariant="icon"
                                    scale="small"
                                    className="absolute bottom-2 right-2 bg-white"
                                >
                                    <PencilSimpleLine />
                                </MyButton>
                            </div>
                        </div>

                        {/* Course Media */}
                        <div className="flex flex-col gap-1">
                            <FormLabel>Course Media (Image or Video)</FormLabel>
                            <p className="text-sm text-gray-500">
                                A featured media block within the course page; this can visually
                                represent the content or offer a teaser. For videos, recommended
                                format: MP4
                            </p>
                            <div className="flex flex-col gap-2">
                                {/* Preview logic remains unchanged */}
                                {form.watch('uploadingStates').courseMedia ? (
                                    <div className="flex h-[200px] items-center justify-center rounded-lg bg-gray-100">
                                        <DashboardLoader />
                                    </div>
                                ) : form.watch('courseMedia')?.id &&
                                  form.watch('courseMedia')?.type !== 'youtube' ? (
                                    form.watch('courseMedia')?.type === 'video' ? (
                                        <div className="h-[200px] w-full rounded-lg bg-gray-100">
                                            <video
                                                src={form.watch('courseMediaBlob')}
                                                controls
                                                controlsList="nodownload noremoteplayback"
                                                disablePictureInPicture
                                                disableRemotePlayback
                                                className="size-full rounded-lg object-contain"
                                            >
                                                Your browser does not support the video tag.
                                            </video>
                                        </div>
                                    ) : (
                                        <div className="flex h-[200px] items-center justify-center rounded-lg bg-gray-100">
                                            <img
                                                src={form.watch('courseMediaBlob')}
                                                alt="Course Banner"
                                                className="size-full rounded-lg object-contain"
                                            />
                                        </div>
                                    )
                                ) : form.watch('courseMedia')?.type === 'youtube' &&
                                  form.watch('courseMedia')?.id ? (
                                    <div className="mt-2 flex h-[200px] w-full items-center justify-center rounded-lg bg-gray-100">
                                        <iframe
                                            width="100%"
                                            height="100%"
                                            src={`https://www.youtube.com/embed/${extractYouTubeVideoId(form.watch('courseMedia')?.id || '')}`}
                                            title="YouTube video player"
                                            frameBorder="0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                            className="size-full rounded-lg object-contain"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex h-[200px] items-center justify-center rounded-lg bg-gray-100">
                                        <p className="text-white">
                                            <ImageSquare size={100} />
                                        </p>
                                    </div>
                                )}
                                {/* Pen icon and dropdown logic */}
                                <div className="-mt-10 mr-2 flex flex-col items-end justify-end">
                                    <MyButton
                                        type="button"
                                        disabled={form.watch('uploadingStates').courseMedia}
                                        buttonType="secondary"
                                        layoutVariant="icon"
                                        scale="small"
                                        className="bg-white hover:bg-white active:bg-white"
                                        onClick={() => {
                                            form.setValue(
                                                'showMediaMenu',
                                                !form.watch('showMediaMenu')
                                            );
                                            form.setValue('showYoutubeInput', false);
                                        }}
                                    >
                                        <PencilSimpleLine />
                                    </MyButton>
                                    {form.watch('showMediaMenu') && (
                                        <div
                                            ref={mediaMenuRef}
                                            className=" flex w-48 flex-col gap-2 rounded bg-white p-2 shadow"
                                        >
                                            <button
                                                className="w-full rounded px-3 py-2 text-left text-sm hover:bg-gray-100"
                                                onClick={() => {
                                                    form.setValue('showMediaMenu', false);
                                                    courseMediaRef.current?.click();
                                                }}
                                            >
                                                Upload Image/Video
                                            </button>
                                            <button
                                                className="w-full rounded px-3 py-2 text-left text-sm hover:bg-gray-100"
                                                onClick={() => {
                                                    form.setValue('showMediaMenu', false);
                                                    form.setValue('showYoutubeInput', true);
                                                }}
                                            >
                                                YouTube Link
                                            </button>
                                        </div>
                                    )}
                                    {form.watch('showYoutubeInput') && (
                                        <div
                                            ref={youtubeInputRef}
                                            className=" w-64 rounded bg-white p-4 shadow"
                                        >
                                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                                Paste YouTube Link
                                            </label>
                                            <Input
                                                type="text"
                                                placeholder="https://youtube.com/watch?v=..."
                                                value={form.watch('youtubeUrl') || ''}
                                                onChange={(e) => {
                                                    form.setValue('youtubeUrl', e.target.value);
                                                    form.setValue('youtubeError', '');
                                                }}
                                                className="mb-2"
                                            />
                                            {form.watch('youtubeError') && (
                                                <div className="mb-2 text-xs text-red-500">
                                                    {form.watch('youtubeError')}
                                                </div>
                                            )}
                                            <MyButton
                                                buttonType="primary"
                                                scale="medium"
                                                layoutVariant="default"
                                                className="w-full"
                                                onClick={() => {
                                                    const id = extractYouTubeVideoId(
                                                        form.watch('youtubeUrl')
                                                    );
                                                    if (!id) {
                                                        form.setValue(
                                                            'youtubeError',
                                                            'Invalid YouTube link'
                                                        );
                                                        return;
                                                    }
                                                    form.setValue('courseMedia', {
                                                        type: 'youtube',
                                                        id: form.watch('youtubeUrl'),
                                                    });
                                                    form.setValue(
                                                        'courseMediaBlob',
                                                        form.watch('youtubeUrl')
                                                    );
                                                    form.setValue('showYoutubeInput', false);
                                                }}
                                                disable={!form.watch('youtubeUrl')}
                                            >
                                                Save YouTube Link
                                            </MyButton>
                                        </div>
                                    )}
                                </div>
                                {/* Always render the FileUploadComponent, but hide it visually */}
                                <div style={{ display: 'none' }}>
                                    <FileUploadComponent
                                        fileInputRef={courseMediaRef}
                                        onFileSubmit={(file) =>
                                            handleFileUpload(file, 'courseMedia')
                                        }
                                        control={form.control}
                                        name="courseMedia"
                                        acceptedFileTypes={[
                                            'image/jpeg',
                                            'image/png',
                                            'image/svg+xml',
                                            'video/mp4',
                                            'video/quicktime',
                                            'video/x-msvideo',
                                            'video/webm',
                                        ]}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default CoursePreviewCard;
