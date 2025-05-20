/* eslint-disable prettier/prettier */
import YooptaEditor, { createYooptaEditor } from '@yoopta/editor';
import { useEffect, useMemo, useRef } from 'react';
import { MyButton } from '@/components/design-system/button';
import PDFViewer from './pdf-viewer';
import { ActivityStatsSidebar } from './stats-dialog/activity-sidebar';
import { useContentStore } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-stores/chapter-sidebar-store';
import { EmptySlideMaterial } from '@/assets/svgs';
import { useState } from 'react';
import { html } from '@yoopta/exports';
import { SlidesMenuOption } from './slides-menu-options/slides-menu-option';
import { plugins, TOOLS, MARKS } from '@/constants/study-library/yoopta-editor-plugins-tools';
import { useRouter } from '@tanstack/react-router';
import { getPublicUrl } from '@/services/upload_file';
import { PublishDialog } from './publish-slide-dialog';
import { UnpublishDialog } from './unpublish-slide-dialog';
import {
    Slide,
    useSlides,
} from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-hooks/use-slides';
import { toast } from 'sonner';
import { Check, DownloadSimple, PencilSimpleLine } from 'phosphor-react';
import {
    converDataToAssignmentFormat,
    converDataToVideoFormat,
    convertHtmlToPdf,
    convertToQuestionBackendSlideFormat,
} from '../-helper/helper';
import { StudyLibraryQuestionsPreview } from './questions-preview';
import StudyLibraryAssignmentPreview from './assignment-preview';
import VideoSlidePreview from './video-slide-preview';
import { handlePublishSlide } from './slide-operations/handlePublishSlide';
import { handleUnpublishSlide } from './slide-operations/handleUnpublishSlide';
import { updateHeading } from './slide-operations/updateSlideHeading';
import { formatHTMLString } from './slide-operations/formatHtmlString';
import { handleConvertAndUpload } from './slide-operations/handleConvertUpload';

export const SlideMaterial = ({
    setGetCurrentEditorHTMLContent,
    setSaveDraft,
}: {
    setGetCurrentEditorHTMLContent: (fn: () => string) => void;
    setSaveDraft: (fn: (activeItem: Slide) => Promise<void>) => void;
}) => {
    const { items, activeItem, setActiveItem } = useContentStore();
    const editor = useMemo(() => createYooptaEditor(), []);
    const selectionRef = useRef(null);
    const [isEditing, setIsEditing] = useState(false);
    const [slideTitle, setSlideTitle] = useState('');

    const [heading, setHeading] = useState(slideTitle);
    const router = useRouter();
    const [content, setContent] = useState<JSX.Element | null>(null);

    const { chapterId, slideId } = router.state.location.search;
    const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
    const [isUnpublishDialogOpen, setIsUnpublishDialogOpen] = useState(false);
    const { addUpdateDocumentSlide } = useSlides(chapterId || '');
    const { addUpdateVideoSlide } = useSlides(chapterId || '');
    const { updateQuestionOrder } = useSlides(chapterId || '');
    const { updateAssignmentOrder } = useSlides(chapterId || '');

    const handleHeadingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setHeading(e.target.value);
    };

    const setEditorContent = () => {
        const docData =
            activeItem?.status == 'PUBLISHED'
                ? activeItem.document_slide?.published_data || null
                : activeItem?.document_slide?.data || null;
        const editorContent = html.deserialize(editor, docData || '');
        editor.setEditorValue(editorContent);
        setContent(
            <div className="w-full">
                <YooptaEditor
                    editor={editor}
                    plugins={plugins}
                    tools={TOOLS}
                    marks={MARKS}
                    value={editorContent}
                    selectionBoxRoot={selectionRef}
                    autoFocus={true}
                    onChange={() => {}}
                    className="size-full"
                    style={{ width: '100%', height: '100%' }}
                />
            </div>
        );
        // editor.insertBlock('Paragraph',{ at: 1, focus: true });
        editor.focus();
    };

    const getCurrentEditorHTMLContent: () => string = () => {
        const data = editor.getEditorValue();
        const htmlString = html.serialize(editor, data);
        const formattedHtmlString = formatHTMLString(htmlString);
        return formattedHtmlString;
    };

    const loadContent = async () => {
        if (activeItem == null) {
            setContent(
                <div className="flex h-[500px] flex-col items-center justify-center rounded-lg py-10">
                    <EmptySlideMaterial />
                    <p className="mt-4 text-neutral-500">No study material has been added yet</p>
                </div>
            );
            return;
        } else if (activeItem.source_type == 'VIDEO') {
            setContent(<VideoSlidePreview activeItem={activeItem} />);
            return;
        } else if (
            activeItem.source_type == 'DOCUMENT' &&
            activeItem.document_slide?.type == 'PDF'
        ) {
            const url = await getPublicUrl(
                (activeItem.status == 'PUBLISHED'
                    ? activeItem.document_slide?.published_data || null
                    : activeItem?.document_slide?.data) || ''
            );
            setContent(<PDFViewer pdfUrl={url} />);
            return;
        } else if (
            activeItem.source_type == 'DOCUMENT' &&
            activeItem.document_slide?.type == 'DOC'
        ) {
            try {
                setTimeout(() => {
                    setEditorContent();
                }, 300);
                setEditorContent();
            } catch (error) {
                console.error('Error preparing document content:', error);
                setContent(<div>Error loading document content</div>);
            }
            return;
        } else if (activeItem.source_type == 'QUESTION') {
            setContent(<StudyLibraryQuestionsPreview activeItem={activeItem} />);
            return;
        } else if (activeItem.source_type == 'ASSIGNMENT') {
            setContent(<StudyLibraryAssignmentPreview activeItem={activeItem} />);
            return;
        } else {
            setContent(
                <div className="flex h-[500px] flex-col items-center justify-center rounded-lg py-10">
                    <EmptySlideMaterial />
                    <p className="mt-4 text-neutral-500">No study material has been added yet</p>
                </div>
            );
        }
        return;
    };

    const SaveDraft = async (slideToSave?: Slide | null) => {
        const slide = slideToSave ? slideToSave : activeItem;
        const status = slide
            ? slide.status == 'PUBLISHED'
                ? 'UNSYNC'
                : slide.status == 'UNSYNC'
                  ? 'UNSYNC'
                  : 'DRAFT'
            : 'DRAFT';

        if (activeItem?.source_type == 'ASSIGNMENT') {
            const convertedData = converDataToAssignmentFormat({
                activeItem,
                status,
                notify: false,
                newSlide: false,
            });
            try {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                await updateAssignmentOrder(convertedData!);
                toast.success(`slide saved in draft successfully!`);
            } catch {
                toast.error(`Error in publishing the slide`);
            }
        }

        if (activeItem?.source_type == 'VIDEO') {
            const convertedData = converDataToVideoFormat({
                activeItem,
                status,
                notify: false,
                newSlide: false,
            });
            try {
                await addUpdateVideoSlide(convertedData);
                toast.success(`slide saved in draft successfully!`);
            } catch {
                toast.error(`Error in unpublishing the slide`);
            }
        }

        if (activeItem?.source_type === 'QUESTION') {
            const convertedData = convertToQuestionBackendSlideFormat({
                activeItem,
                status,
                notify: false,
                newSlide: false,
            });
            try {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                await updateQuestionOrder(convertedData!);
                toast.success(`slide saved in draft successfully!`);
            } catch {
                toast.error('error saving slide');
            }
            return;
        }

        const currentHtml = getCurrentEditorHTMLContent();
        const { totalPages } = await convertHtmlToPdf(currentHtml);

        try {
            await addUpdateDocumentSlide({
                id: slide?.id || '',
                title: slide?.title || '',
                image_file_id: '',
                description: slide?.description || '',
                slide_order: null,
                document_slide: {
                    id: slide?.document_slide?.id || '',
                    type: 'DOC',
                    data: currentHtml,
                    title: slide?.document_slide?.title || '',
                    cover_file_id: '',
                    total_pages: totalPages,
                    published_data: null,
                    published_document_total_pages:
                        slide?.document_slide?.published_document_total_pages || 0,
                },
                status: status,
                new_slide: false,
                notify: false,
            });
        } catch {
            toast.error('error updating slide');
        }
    };

    const handleSaveDraftClick = async () => {
        try {
            await SaveDraft(activeItem);
            toast.success('Slide saved successfully');
        } catch {
            toast.error('error saving document');
        }
    };

    useEffect(() => {
        setSlideTitle(
            (activeItem?.source_type === 'DOCUMENT' && activeItem?.document_slide?.title) ||
                (activeItem?.source_type === 'VIDEO' && activeItem?.video_slide?.title) ||
                ''
        );
    }, [activeItem]);

    useEffect(() => {
        if (items.length == 0 && slideId == undefined) {
            setActiveItem(null);
        } else {
            setActiveItem(items.find((slide) => slide.id == slideId) || items[0] || null);
        }
    }, [items]);

    useEffect(() => {
        setHeading(activeItem?.title || '');
        loadContent();
    }, [activeItem, items]);

    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null;
        let previousHtmlString: string | null = null;

        if (activeItem?.document_slide?.type === 'DOC') {
            intervalId = setInterval(() => {
                const data = editor.getEditorValue();
                const htmlString = html.serialize(editor, data);
                const formattedHtmlString = formatHTMLString(htmlString);

                // Only save if the content has changed
                if (formattedHtmlString !== previousHtmlString) {
                    previousHtmlString = formattedHtmlString;
                    SaveDraft(activeItem);
                }
            }, 60000);
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [activeItem?.document_slide?.type, editor]);

    // Update the refs whenever these functions change
    useEffect(() => {
        setGetCurrentEditorHTMLContent(getCurrentEditorHTMLContent);
        setSaveDraft(SaveDraft);
    }, [editor]);

    return (
        <div className="flex w-full flex-1 flex-col" ref={selectionRef}>
            {activeItem && (
                <div className="-m-8 flex items-center justify-between gap-6 border-b border-neutral-300 px-8 py-4">
                    <div className="flex items-center gap-4">
                        {isEditing ? (
                            <div className="flex items-center justify-center gap-2">
                                <input
                                    type="text"
                                    value={heading}
                                    onChange={handleHeadingChange}
                                    className="w-fit text-h3 font-semibold text-neutral-600 focus:outline-none"
                                    autoFocus
                                />
                                <Check
                                    onClick={() =>
                                        updateHeading(
                                            activeItem,
                                            addUpdateVideoSlide,
                                            SaveDraft,
                                            heading,
                                            setIsEditing,
                                            addUpdateDocumentSlide
                                        )
                                    }
                                    className="cursor-pointer hover:text-primary-500"
                                />
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2">
                                <h3 className="text-h3 font-semibold text-neutral-600">
                                    {heading || 'No content selected'}
                                </h3>
                                <PencilSimpleLine
                                    className="cursor-pointer hover:text-primary-500"
                                    onClick={() => setIsEditing(true)}
                                />
                            </div>
                        )}
                        {/* {activeItem.last_sync_date != null && (
                            <p className="text-neutral-500">
                                Last synced at: {formatReadableDate(activeItem.last_sync_date)}
                            </p>
                        )} */}
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-6">
                            {activeItem.source_type == 'DOCUMENT' &&
                                activeItem?.document_slide?.type == 'DOC' && (
                                    <MyButton
                                        layoutVariant="icon"
                                        onClick={async () => {
                                            await SaveDraft(activeItem);
                                            if (activeItem.status == 'PUBLISHED') {
                                                await handleConvertAndUpload(
                                                    activeItem.document_slide?.published_data ||
                                                        null
                                                );
                                            } else {
                                                await handleConvertAndUpload(
                                                    activeItem.document_slide?.data || null
                                                );
                                            }
                                        }}
                                    >
                                        <DownloadSimple size={30} />
                                    </MyButton>
                                )}
                            <ActivityStatsSidebar />
                            {(activeItem?.document_slide?.type == 'DOC' ||
                                activeItem?.source_type == 'QUESTION' ||
                                activeItem?.source_type == 'ASSIGNMENT') && (
                                <MyButton
                                    buttonType="secondary"
                                    scale="medium"
                                    layoutVariant="default"
                                    onClick={handleSaveDraftClick}
                                >
                                    Save Draft
                                </MyButton>
                            )}
                            <UnpublishDialog
                                isOpen={isUnpublishDialogOpen}
                                setIsOpen={setIsUnpublishDialogOpen}
                                handlePublishUnpublishSlide={() =>
                                    handleUnpublishSlide(
                                        setIsUnpublishDialogOpen,
                                        false,
                                        activeItem,
                                        addUpdateDocumentSlide,
                                        addUpdateVideoSlide,
                                        updateQuestionOrder,
                                        updateAssignmentOrder,
                                        SaveDraft
                                    )
                                }
                            />
                            <PublishDialog
                                isOpen={isPublishDialogOpen}
                                setIsOpen={setIsPublishDialogOpen}
                                handlePublishUnpublishSlide={() =>
                                    handlePublishSlide(
                                        setIsPublishDialogOpen,
                                        false,
                                        activeItem,
                                        addUpdateDocumentSlide,
                                        addUpdateVideoSlide,
                                        updateQuestionOrder,
                                        updateAssignmentOrder,
                                        SaveDraft
                                    )
                                }
                            />
                        </div>
                        <SlidesMenuOption />
                    </div>
                </div>
            )}
            <div
                className={`mx-auto mt-14 ${
                    activeItem?.document_slide?.type == 'PDF' ? 'h-[calc(100vh-200px)]' : 'h-full'
                } w-full overflow-hidden`}
            >
                {content}
            </div>
        </div>
    );
};
