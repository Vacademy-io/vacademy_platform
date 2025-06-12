'use client';

import { MyButton } from '@/components/design-system/button';
import { MyDropdown } from '@/components/design-system/dropdown';
import { useSidebar } from '@/components/ui/sidebar';
import {
    Plus,
    FilePdf,
    FileDoc,
    YoutubeLogo,
    Question,
    PresentationChart,
} from '@phosphor-icons/react';
import { MyDialog } from '@/components/design-system/dialog';
import { AddVideoDialog } from './add-video-dialog';
import { AddVideoFileDialog } from './add-video-file-dialog';
import { AddDocDialog } from './add-doc-dialog';
import { AddPdfDialog } from './add-pdf-dialog';
import { useRouter } from '@tanstack/react-router';
import { useSlides } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-hooks/use-slides';
import { useContentStore } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-stores/chapter-sidebar-store';
import { useDialogStore } from '@/routes/study-library/courses/-stores/slide-add-dialogs-store';
import AddQuestionDialog from './add-question-dialog';
import { File } from 'phosphor-react';
import { useForm } from 'react-hook-form';
import {
    assignmentFormSchema,
    type AssignmentFormType,
} from '../../-form-schemas/assignmentFormSchema';
import { zodResolver } from '@hookform/resolvers/zod';
import { formatHTMLString } from '../slide-operations/formatHtmlString';
import AddAssignmentDialog from './add-assignment-dialog';

export const ChapterSidebarAddButton = () => {
    const form = useForm<AssignmentFormType>({
        resolver: zodResolver(assignmentFormSchema),
        defaultValues: {
            task: '',
            taskDescription: '',
            startDate: '',
            endDate: '',
            reattemptCount: '0',
            uploaded_question_paper: null,
            adaptive_marking_for_each_question: [],
        },
    });
    console.log('Form values:', form);
    const { open } = useSidebar();
    const route = useRouter();
    const { chapterId } = route.state.location.search;
    const { addUpdateDocumentSlide } = useSlides(chapterId || '');
    // const { setActiveItem, getSlideById, setItems, items } = useContentStore();
    const { setActiveItem, getSlideById } = useContentStore();

    // Use the Zustand store instead of useState
    const {
        isPdfDialogOpen,
        isDocUploadDialogOpen,
        isVideoDialogOpen,
        isVideoFileDialogOpen,
        isQuestionDialogOpen,
        isAssignmentDialogOpen,
        openPdfDialog,
        closePdfDialog,
        openDocUploadDialog,
        closeDocUploadDialog,
        openVideoDialog,
        closeVideoDialog,
        openVideoFileDialog,
        closeVideoFileDialog,
        openQuestionDialog,
        closeQuestionDialog,
        openAssignmentDialog,
        closeAssignmentDialog,
    } = useDialogStore();

    const dropdownList = [
        {
            label: 'Pdf',
            value: 'pdf',
            icon: <FilePdf className="size-4" />,
        },
        {
            label: 'Doc',
            value: 'doc',
            icon: <FileDoc className="size-4" />,
            subItems: [
                { label: 'Upload from device', value: 'upload-doc' },
                { label: 'Create new doc', value: 'create-doc' },
            ],
        },
        {
            label: 'Video',
            value: 'video',
            icon: <YoutubeLogo className="size-4" />,
            subItems: [
                { label: 'Upload from device', value: 'upload-video' },
                { label: 'YouTube link', value: 'youtube-video' },
            ],
        },
        {
            label: 'Question',
            value: 'question',
            icon: <Question className="size-4" />,
        },
        {
            label: 'Assignment',
            value: 'assignment',
            icon: <File className="size-4" />,
        },
        {
            label: 'Presentation',
            value: 'presentation',
            icon: <PresentationChart className="size-4" />,
        },
    ];

    const handleSelect = async (value: string) => {
        switch (value) {
            case 'pdf':
                openPdfDialog();
                break;
            case 'upload-doc':
                openDocUploadDialog();
                break;
            case 'create-doc': {
                try {
                    const documentData = formatHTMLString('');
                    const slideId = crypto.randomUUID();
                    const response = await addUpdateDocumentSlide({
                        id: slideId,
                        title: 'New Doc',
                        image_file_id: '',
                        description: '',
                        slide_order: null,
                        document_slide: {
                            id: crypto.randomUUID(),
                            type: 'DOC',
                            data: documentData,
                            title: 'New Doc',
                            cover_file_id: '',
                            total_pages: 1,
                            published_data: null,
                            published_document_total_pages: 0,
                        },
                        status: 'DRAFT',
                        new_slide: true,
                        notify: false,
                    });

                    if (response) {
                        setTimeout(() => {
                            setActiveItem(getSlideById(slideId));
                        }, 500);
                    }
                } catch (err) {
                    console.error('Error creating new doc:', err);
                }
                break;
            }
            case 'youtube-video':
                openVideoDialog();
                break;
            case 'upload-video':
                openVideoFileDialog(); // Open the new video file upload dialog
                break;
            case 'question':
                openQuestionDialog();
                break;
            case 'assignment':
                openAssignmentDialog();
                break;
            case 'presentation':
                // Redirect to the Excalidraw presentation slide
                window.location.href = `/presentation/excalidraw?chapterId=${chapterId}`;
                break;
        }
    };

    return (
        <>
            <MyDropdown dropdownList={dropdownList} onSelect={handleSelect}>
                <MyButton
                    buttonType="primary"
                    scale="large"
                    layoutVariant={open ? 'default' : 'icon'}
                    className={`${open ? '' : ''}`}
                    id="add-slides"
                >
                    <Plus />
                    <p className={`${open ? 'visible' : 'hidden'}`}>Add</p>
                </MyButton>
            </MyDropdown>

            {/* PDF Upload Dialog */}
            <MyDialog
                trigger={<></>}
                heading="Upload PDF"
                dialogWidth="min-w-[400px] w-auto"
                open={isPdfDialogOpen}
                onOpenChange={closePdfDialog}
            >
                <AddPdfDialog openState={(open) => !open && closePdfDialog()} />
            </MyDialog>

            {/* Doc Upload Dialog */}
            <MyDialog
                trigger={<></>}
                heading="Upload Document"
                dialogWidth="min-w-[400px] w-auto"
                open={isDocUploadDialogOpen}
                onOpenChange={closeDocUploadDialog}
            >
                <AddDocDialog openState={(open) => !open && closeDocUploadDialog()} />
            </MyDialog>

            {/* YouTube Video Upload Dialog */}
            <MyDialog
                trigger={<></>}
                heading="Add YouTube Video"
                dialogWidth="min-w-[400px]"
                open={isVideoDialogOpen}
                onOpenChange={closeVideoDialog}
            >
                <AddVideoDialog openState={(open) => !open && closeVideoDialog()} />
            </MyDialog>

            {/* Video File Upload Dialog */}
            <MyDialog
                trigger={<></>}
                heading="Upload Video"
                dialogWidth="min-w-[400px]"
                open={isVideoFileDialogOpen}
                onOpenChange={closeVideoFileDialog}
            >
                <AddVideoFileDialog openState={(open) => !open && closeVideoFileDialog()} />
            </MyDialog>

            {/* Question Upload Dialog */}
            <MyDialog
                trigger={<></>}
                heading="Upload Question"
                dialogWidth="min-w-[500px]"
                open={isQuestionDialogOpen}
                onOpenChange={closeQuestionDialog}
            >
                <AddQuestionDialog openState={(open) => !open && closeQuestionDialog()} />
            </MyDialog>

            {/* Assignment Upload Dialog */}
            <MyDialog
                trigger={<></>}
                heading="Upload Assignment"
                dialogWidth="min-w-[500px]"
                open={isAssignmentDialogOpen}
                onOpenChange={closeAssignmentDialog} // Pass the action function directly
            >
                <AddAssignmentDialog openState={(open) => !open && closeAssignmentDialog()} />
            </MyDialog>
        </>
    );
};
