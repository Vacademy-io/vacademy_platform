import { MyButton } from '@/components/design-system/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    // DropdownMenuSub,
    // DropdownMenuSubTrigger,
    // DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from '@tanstack/react-router';
import { DotsThree, Info } from 'phosphor-react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { TestContent } from '@/types/assessments/schedule-test-list';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { getInstituteId } from '@/constants/helper';
import { handleDeleteAssessment } from '../-services/assessment-services';

export function ScheduleTestDetailsDropdownLive({
    scheduleTestContent,
    handleRefetchData,
    selectedTab,
}: {
    scheduleTestContent: TestContent;
    handleRefetchData: () => void;
    selectedTab: string;
}) {
    const [isRemiderAlertDialogOpen, setIsRemiderAlertDialogOpen] = useState(false);
    const [isDeleteAssessmentDialog, setIsDeleteAssessmentDialog] = useState(false);
    const [isPauseLiveStatausDialog, setIsPauseLiveStatausDialog] = useState(false);
    const [isResumeLiveStatusDialog, setIsResumeLiveStatusDialog] = useState(false);
    const navigate = useNavigate();
    const handleNavigateAssessment = (assessmentId: string) => {
        navigate({
            to: '/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab',
            params: {
                assessmentId: assessmentId,
                examType: scheduleTestContent.play_mode,
                assesssmentType: scheduleTestContent.assessment_visibility,
                assessmentTab: selectedTab,
            },
        });
    };

    // const handleSendReminderClick = (assessmentId: string) => {
    //     console.log(assessmentId);
    //     setIsRemiderAlertDialogOpen(true);
    // };

    const handleDeleteAssessmentClick = (assessmentId: string) => {
        console.log(assessmentId);
        setIsDeleteAssessmentDialog(true);
    };

    // const handleRescheduleAssessment = (assessmentId: string) => {
    //     console.log(assessmentId);
    // };

    // const handleDuplicateAssessment = (assessmentId: string) => {
    //     console.log(assessmentId);
    // };

    // const handlePauseLiveStatus = (assessmentId: string, value: number) => {
    //     console.log(assessmentId, value);
    // };

    // const handleCustomPauseLiveAssessment = (assessmentId: string) => {
    //     console.log(assessmentId);
    //     setIsPauseLiveStatausDialog(true);
    // };

    // const handleResumeLiveAssessment = (assessmentId: string) => {
    //     console.log(assessmentId);
    //     setIsResumeLiveStatusDialog(true);
    // };
    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger>
                    <MyButton
                        type="button"
                        scale="small"
                        buttonType="secondary"
                        className="w-6 !min-w-6"
                    >
                        <DotsThree size={32} />
                    </MyButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => handleNavigateAssessment(scheduleTestContent.assessment_id)}
                    >
                        View Homework Details
                    </DropdownMenuItem>
                    {/* <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => handleSendReminderClick(scheduleTestContent.assessment_id)}
                    >
                        Send Reminder
                    </DropdownMenuItem> */}
                    {/* <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="cursor-pointer">
                            Pause Live Status
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() =>
                                    handlePauseLiveStatus(scheduleTestContent.assessment_id, 30)
                                }
                            >
                                For 30 min
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() =>
                                    handlePauseLiveStatus(scheduleTestContent.assessment_id, 60)
                                }
                            >
                                For 1 Hour
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() =>
                                    handlePauseLiveStatus(scheduleTestContent.assessment_id, 120)
                                }
                            >
                                For 2 Hour
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() =>
                                    handleCustomPauseLiveAssessment(
                                        scheduleTestContent.assessment_id,
                                    )
                                }
                            >
                                Custom
                            </DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub> */}
                    {/* <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() =>
                            handleResumeLiveAssessment(scheduleTestContent.assessment_id)
                        }
                    >
                        Resume Live Status
                    </DropdownMenuItem> */}
                    {/* <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() =>
                            handleRescheduleAssessment(scheduleTestContent.assessment_id)
                        }
                    >
                        Reschedule Assessment
                    </DropdownMenuItem> */}
                    {/* <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => handleDuplicateAssessment(scheduleTestContent.assessment_id)}
                    >
                        Duplicate Assessment
                    </DropdownMenuItem> */}
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAssessmentClick(scheduleTestContent.assessment_id);
                        }}
                    >
                        Delete Homework
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            {isRemiderAlertDialogOpen && (
                <ScheduleTestReminderDialog onClose={() => setIsRemiderAlertDialogOpen(false)} />
            )}
            {isDeleteAssessmentDialog && (
                <ScheduleTestDeleteDialog
                    handleRefetchData={handleRefetchData}
                    scheduleTestContent={scheduleTestContent}
                    onClose={() => setIsDeleteAssessmentDialog(false)}
                />
            )}
            {isPauseLiveStatausDialog && (
                <ScheduleTestPauseDialog onClose={() => setIsPauseLiveStatausDialog(false)} />
            )}
            {isResumeLiveStatusDialog && (
                <ScheduleTestResumeDialog onClose={() => setIsResumeLiveStatusDialog(false)} />
            )}
        </>
    );
}

export function ScheduleTestDetailsDropdownUpcoming({
    scheduleTestContent,
    handleRefetchData,
    selectedTab,
}: {
    scheduleTestContent: TestContent;
    handleRefetchData: () => void;
    selectedTab: string;
}) {
    const [isDeleteAssessmentDialog, setIsDeleteAssessmentDialog] = useState(false);
    const navigate = useNavigate();
    const handleNavigateAssessment = (assessmentId: string) => {
        navigate({
            to: '/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab',
            params: {
                assessmentId: assessmentId,
                examType: scheduleTestContent.play_mode,
                assesssmentType: scheduleTestContent.assessment_visibility,
                assessmentTab: selectedTab,
            },
        });
    };

    // const handleRescheduleAssessment = (assessmentId: string) => {
    //     console.log(assessmentId);
    // };

    // const handleDuplicateAssessment = (assessmentId: string) => {
    //     console.log(assessmentId);
    // };

    const handleDeleteAssessmentClick = (assessmentId: string) => {
        console.log(assessmentId);
        setIsDeleteAssessmentDialog(true);
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger>
                    <MyButton
                        type="button"
                        scale="small"
                        buttonType="secondary"
                        className="w-6 !min-w-6"
                    >
                        <DotsThree size={32} />
                    </MyButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => handleNavigateAssessment(scheduleTestContent.assessment_id)}
                    >
                        View Homework Details
                    </DropdownMenuItem>
                    {/* <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() =>
                            handleRescheduleAssessment(scheduleTestContent.assessment_id)
                        }
                    >
                        Reschedule Assessment
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => handleDuplicateAssessment(scheduleTestContent.assessment_id)}
                    >
                        Duplicate Assessment
                    </DropdownMenuItem> */}
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAssessmentClick(scheduleTestContent.assessment_id);
                        }}
                    >
                        Delete Homework
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            {isDeleteAssessmentDialog && (
                <ScheduleTestDeleteDialog
                    handleRefetchData={handleRefetchData}
                    scheduleTestContent={scheduleTestContent}
                    onClose={() => setIsDeleteAssessmentDialog(false)}
                />
            )}
        </>
    );
}

export function ScheduleTestDetailsDropdownPrevious({
    scheduleTestContent,
    handleRefetchData,
    selectedTab,
}: {
    scheduleTestContent: TestContent;
    handleRefetchData: () => void;
    selectedTab: string;
}) {
    const [isDeleteAssessmentDialog, setIsDeleteAssessmentDialog] = useState(false);
    const [isReopenAssessment, setIsReopenAssessment] = useState(false);
    const navigate = useNavigate();
    const handleNavigateAssessment = (assessmentId: string) => {
        navigate({
            to: '/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab',
            params: {
                assessmentId: assessmentId,
                examType: scheduleTestContent.play_mode,
                assesssmentType: scheduleTestContent.assessment_visibility,
                assessmentTab: selectedTab,
            },
        });
    };

    // const handleRescheduleAssessment = (assessmentId: string) => {
    //     console.log(assessmentId);
    // };

    // const handleDuplicateAssessment = (assessmentId: string) => {
    //     console.log(assessmentId);
    // };

    const handleDeleteAssessmentClick = (assessmentId: string) => {
        console.log(assessmentId);
        setIsDeleteAssessmentDialog(true);
    };

    // const handleReopenAssessment = (assessmentId: string) => {
    //     console.log(assessmentId);
    //     setIsReopenAssessment(true);
    // };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger>
                    <MyButton
                        type="button"
                        scale="small"
                        buttonType="secondary"
                        className="w-6 !min-w-6"
                    >
                        <DotsThree size={32} />
                    </MyButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => handleNavigateAssessment(scheduleTestContent.assessment_id)}
                    >
                        View Homework Details
                    </DropdownMenuItem>
                    {/* <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() =>
                            handleRescheduleAssessment(scheduleTestContent.assessment_id)
                        }
                    >
                        Reschedule Assessment
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => handleDuplicateAssessment(scheduleTestContent.assessment_id)}
                    >
                        Duplicate Assessment
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => handleReopenAssessment(scheduleTestContent.assessment_id)}
                    >
                        Reopen Assessment
                    </DropdownMenuItem> */}
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAssessmentClick(scheduleTestContent.assessment_id);
                        }}
                    >
                        Delete Homework
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            {isDeleteAssessmentDialog && (
                <ScheduleTestDeleteDialog
                    handleRefetchData={handleRefetchData}
                    scheduleTestContent={scheduleTestContent}
                    onClose={() => setIsDeleteAssessmentDialog(false)}
                />
            )}
            {isReopenAssessment && (
                <ScheduleTestReopenDialog onClose={() => setIsReopenAssessment(false)} />
            )}
        </>
    );
}

export function ScheduleTestDetailsDropdowDrafts({
    scheduleTestContent,
    handleRefetchData,
    selectedTab,
}: {
    scheduleTestContent: TestContent;
    handleRefetchData: () => void;
    selectedTab: string;
}) {
    const [isDeleteAssessmentDialog, setIsDeleteAssessmentDialog] = useState(false);
    const navigate = useNavigate();
    const handleNavigateAssessment = (assessmentId: string) => {
        navigate({
            to: '/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab',
            params: {
                assessmentId: assessmentId,
                examType: scheduleTestContent.play_mode,
                assesssmentType: scheduleTestContent.assessment_visibility,
                assessmentTab: selectedTab,
            },
        });
    };
    const handleDeleteAssessmentClick = (assessmentId: string) => {
        console.log(assessmentId);
        setIsDeleteAssessmentDialog(true);
    };
    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger>
                    <MyButton
                        type="button"
                        scale="small"
                        buttonType="secondary"
                        className="w-6 !min-w-6"
                    >
                        <DotsThree size={32} />
                    </MyButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => handleNavigateAssessment(scheduleTestContent.assessment_id)}
                    >
                        View Homework Details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAssessmentClick(scheduleTestContent.assessment_id);
                        }}
                    >
                        Delete Homework
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            {isDeleteAssessmentDialog && (
                <ScheduleTestDeleteDialog
                    handleRefetchData={handleRefetchData}
                    scheduleTestContent={scheduleTestContent}
                    onClose={() => setIsDeleteAssessmentDialog(false)}
                />
            )}
        </>
    );
}

export function ScheduleTestMainDropdownComponent({
    scheduleTestContent,
    selectedTab,
    handleRefetchData,
}: {
    scheduleTestContent: TestContent;
    selectedTab: string;
    handleRefetchData: () => void;
}) {
    switch (selectedTab) {
        case 'liveTests':
            return (
                <ScheduleTestDetailsDropdownLive
                    scheduleTestContent={scheduleTestContent}
                    handleRefetchData={handleRefetchData}
                    selectedTab={selectedTab}
                />
            );
        case 'upcomingTests':
            return (
                <ScheduleTestDetailsDropdownUpcoming
                    scheduleTestContent={scheduleTestContent}
                    handleRefetchData={handleRefetchData}
                    selectedTab={selectedTab}
                />
            );
        case 'previousTests':
            return (
                <ScheduleTestDetailsDropdownPrevious
                    scheduleTestContent={scheduleTestContent}
                    handleRefetchData={handleRefetchData}
                    selectedTab={selectedTab}
                />
            );
        case 'draftTests':
            return (
                <ScheduleTestDetailsDropdowDrafts
                    scheduleTestContent={scheduleTestContent}
                    handleRefetchData={handleRefetchData}
                    selectedTab={selectedTab}
                />
            );
        default:
            return null;
    }
}

const ScheduleTestReminderDialog = ({ onClose }: { onClose: () => void }) => {
    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogTrigger>Open</DialogTrigger>
            <DialogContent className="flex w-[500px] flex-col p-0">
                <h1 className="rounded-lg bg-primary-50 p-4 text-primary-500">Send Reminder</h1>
                <div className="flex flex-col gap-4 p-4 pt-3">
                    <div className="flex items-center gap-1">
                        <span className="text-danger-600">Attention</span>
                        <Info size={18} className="text-danger-600" />
                    </div>
                    <h1 className="-mt-2 font-thin">
                        A Homework reminder will be sent to all
                        <span className="text-primary-500"> 56 participants </span>
                        who have not yet appeared from the assigned batches.
                    </h1>
                    <div className="mt-2 flex justify-end">
                        <MyButton type="button" scale="large" buttonType="primary">
                            Send
                        </MyButton>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const ScheduleTestDeleteDialog = ({
    handleRefetchData,
    scheduleTestContent,
    onClose,
}: {
    handleRefetchData: () => void;
    scheduleTestContent: TestContent;
    onClose: () => void;
}) => {
    const instituteId = getInstituteId();
    const handleDeleteAssessmentMutation = useMutation({
        mutationFn: ({
            assessmentId,
            instituteId,
        }: {
            assessmentId: string;
            instituteId: string | undefined;
        }) => handleDeleteAssessment(assessmentId, instituteId),
        onSuccess: async () => {
            toast.success('Assessment has been deleted successfully!', {
                className: 'success-toast',
                duration: 2000,
            });
            onClose();
            handleRefetchData();
        },
        onError: (error: unknown) => {
            if (error instanceof AxiosError) {
                toast.error(error.message, {
                    className: 'error-toast',
                    duration: 2000,
                });
            } else {
                // Handle non-Axios errors if necessary
                console.error('Unexpected error:', error);
            }
        },
    });

    const deleteAssessment = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        handleDeleteAssessmentMutation.mutate({
            assessmentId: scheduleTestContent.assessment_id,
            instituteId,
        });
    };
    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogTrigger>Open</DialogTrigger>
            <DialogContent className="flex w-[500px] flex-col p-0">
                <h1 className="rounded-lg bg-primary-50 p-4 text-primary-500">Delete Homework</h1>
                <div className="flex flex-col gap-4 p-4 pt-3">
                    <div className="flex items-center gap-1">
                        <span className="text-danger-600">Attention</span>
                        <Info size={18} className="text-danger-600" />
                    </div>
                    <h1 className="-mt-2 font-thin">
                        Are you sure you want to delete
                        <span className="text-primary-500">&nbsp;{scheduleTestContent.name}</span>?
                    </h1>
                    <div className="mt-2 flex justify-end">
                        <MyButton
                            type="button"
                            scale="large"
                            buttonType="primary"
                            onClick={deleteAssessment}
                        >
                            Delete
                        </MyButton>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const ScheduleTestPauseDialog = ({ onClose }: { onClose: () => void }) => {
    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogTrigger>Open</DialogTrigger>
            <DialogContent className="flex w-[500px] flex-col p-0">
                <h1 className="rounded-lg bg-primary-50 p-4 text-primary-500">Pause Live Status</h1>
                <div className="flex flex-col gap-4 p-4 pt-3">
                    <div>
                        <h1 className="mb-1 text-sm">
                            Date <span className="text-danger-600">*</span>
                        </h1>
                        <Input type="date" placeholder="Date" />
                    </div>
                    <div className="text-sm">
                        <h1 className="mb-1 text-sm">
                            Pause Until <span className="text-danger-600">*</span>
                        </h1>
                        <Input type="time" placeholder="Time" />
                    </div>
                    <div className="mt-2 flex justify-end">
                        <MyButton type="button" scale="large" buttonType="primary">
                            Pause
                        </MyButton>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const ScheduleTestResumeDialog = ({ onClose }: { onClose: () => void }) => {
    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogTrigger>Open</DialogTrigger>
            <DialogContent className="flex w-[500px] flex-col p-0">
                <h1 className="rounded-lg bg-primary-50 p-4 text-primary-500">
                    Resume Live Status
                </h1>
                <div className="flex flex-col gap-4 p-4 pt-3">
                    <div className="flex items-center gap-1">
                        <span className="text-danger-600">Attention</span>
                        <Info size={18} className="text-danger-600" />
                    </div>
                    <h1 className="-mt-2 font-thin">
                        Do you want to resume your Live homework
                        <span className="text-primary-500">
                            &nbsp;The Human Eye and The Colourful World
                        </span>
                        ?
                    </h1>
                    <div className="mt-2 flex justify-end">
                        <MyButton type="button" scale="large" buttonType="primary">
                            Resume
                        </MyButton>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const ScheduleTestReopenDialog = ({ onClose }: { onClose: () => void }) => {
    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogTrigger>Open</DialogTrigger>
            <DialogContent className="flex w-[500px] flex-col p-0">
                <h1 className="rounded-lg bg-primary-50 p-4 text-primary-500">Reopen Homework</h1>
                <div className="flex flex-col gap-4 p-4 pt-3">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-1">
                            <span className="text-danger-600">Attention</span>
                            <Info size={18} className="text-danger-600" />
                        </div>
                        <h1 className="-mt-2 font-thin">
                            A Homework reminder will be sent to all
                            <span className="text-primary-500"> 56 participants </span>
                            who have not yet appeared from the assigned batches.
                        </h1>
                    </div>
                    <h1>Select homework reopening date and time</h1>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="mb-1 text-sm">
                                Start Date & Time <span className="text-danger-600">*</span>
                            </h1>
                            <Input type="datetime-local" placeholder="Date" />
                        </div>
                        <div className="text-sm">
                            <h1 className="mb-1 text-sm">
                                End Date & Time <span className="text-danger-600">*</span>
                            </h1>
                            <Input type="datetime-local" placeholder="Time" />
                        </div>
                    </div>
                    <div className="mt-2 flex justify-end">
                        <MyButton type="button" scale="large" buttonType="primary">
                            Reopen
                        </MyButton>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
