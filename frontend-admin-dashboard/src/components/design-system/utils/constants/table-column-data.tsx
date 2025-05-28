import { ColumnDef, Row } from '@tanstack/react-table';
import { StudentTable } from '@/types/student-table-types';
import { ArrowSquareOut, CaretUpDown, Info } from '@phosphor-icons/react';
import { Checkbox } from '@/components/ui/checkbox';
import { MyDropdown } from '../../dropdown';
import { useGetStudentBatch } from '@/routes/manage-students/students-list/-hooks/useGetStudentBatch';
import { ActivityStatus } from '../types/chips-types';
import { StatusChips } from '../../chips';
import { StudentMenuOptions } from '../../table-components/student-menu-options/student-menu-options';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { useActivityStatsStore } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-stores/activity-stats-store';
import { useContentStore } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-stores/chapter-sidebar-store';
import { useState, useRef } from 'react';
import { LogDetailsDialog } from '@/components/common/student-slide-tracking/log-details-dialog';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';

interface CustomTableMeta {
    onSort?: (columnId: string, direction: string) => void;
}

export interface ActivityLogType {
    activityDate: string;
    startTime: string;
    endTime: string;
    duration: string;
    lastPageRead: number;
    videos: {
        id: string;
        start_time_in_millis: number;
        end_time_in_millis: number;
    }[];
    documents: {
        id: string;
        start_time_in_millis: number;
        end_time_in_millis: number;
        page_number: number;
    }[];
}

const BatchCell = ({
    package_session_id,
    row,
}: {
    package_session_id: string;
    row: Row<StudentTable>;
}) => {
    const { packageName, levelName } = useGetStudentBatch(package_session_id);
    const { handleClick, handleDoubleClick } = useClickHandlers();

    return (
        <div
            onClick={() => handleClick('package_session_id', row)}
            onDoubleClick={(e) => handleDoubleClick(e, 'package_session_id', row)}
        >
            {levelName} {packageName}
        </div>
    );
};

const DetailsCell = ({ row }: { row: Row<StudentTable> }) => {
    const { setSelectedStudent } = useStudentSidebar();

    const handleClick = async () => {
        setSelectedStudent(row.original);
    };

    return (
        <SidebarTrigger onClick={handleClick}>
            <ArrowSquareOut className="size-10 cursor-pointer text-neutral-600" />
        </SidebarTrigger>
    );
};

const InfoCell = ({ row }: { row: Row<ActivityLogType> }) => {
    const [isLogDetailsOpen, setIsLogDetailsOpen] = useState(false);

    return (
        <>
            <Info
                size={20}
                className="cursor-pointer text-primary-500"
                onClick={() => setIsLogDetailsOpen(true)}
            />
            <LogDetailsDialog
                isOpen={isLogDetailsOpen}
                onClose={() => setIsLogDetailsOpen(false)}
                logData={row.original}
            />
        </>
    );
};

const useClickHandlers = () => {
    const clickTimeout = useRef<NodeJS.Timeout | null>(null);
    const { setSelectedStudent, selectedStudent } = useStudentSidebar();
    const { setOpen, open } = useSidebar();

    const handleClick = (columnId: string, row: Row<StudentTable>) => {
        if (clickTimeout.current) clearTimeout(clickTimeout.current);
        console.log('clicked on column:', columnId, 'row:', row.original);
        clickTimeout.current = setTimeout(() => {
            if (selectedStudent?.id != row.original.id) {
                console.log('single clicked');
                setSelectedStudent(row.original);
                setOpen(true);
            } else {
                if (open == true) setOpen(false);
                else setOpen(true);
            }
        }, 250);
    };

    const handleDoubleClick = (e: React.MouseEvent, columnId: string, row: Row<StudentTable>) => {
        e.stopPropagation();
        if (clickTimeout.current) {
            clearTimeout(clickTimeout.current);
            clickTimeout.current = null;
        }
        console.log('double clicked on column:', columnId, 'row:', row.original);
        // Add your double click logic here
    };

    return { handleClick, handleDoubleClick };
};

const CreateClickableCell = ({ row, columnId }: { row: Row<StudentTable>; columnId: string }) => {
    const { handleClick, handleDoubleClick } = useClickHandlers();

    return (
        <div
            onClick={() => handleClick(columnId, row)}
            onDoubleClick={(e) => handleDoubleClick(e, columnId, row)}
            className="cursor-pointer"
        >
            {row.getValue(columnId)}
        </div>
    );
};

const BatchCellComponent = ({ row }: { row: Row<StudentTable> }) => {
    const { handleClick, handleDoubleClick } = useClickHandlers();
    return (
        <div
            onClick={() => handleClick('package_session_id', row)}
            onDoubleClick={(e) => handleDoubleClick(e, 'package_session_id', row)}
        >
            <BatchCell package_session_id={row.original.package_session_id} row={row} />
        </div>
    );
};

const ExpiryDateCell = ({ row }: { row: Row<StudentTable> }) => {
    const { handleClick, handleDoubleClick } = useClickHandlers();

    if (row.original.expiry_date == null) {
        return <></>;
    }
    const expiryDate = new Date(row.original.expiry_date);
    const today = new Date();

    const diffTime = expiryDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return (
        <div
            className={`${
                daysLeft < 30
                    ? 'text-danger-600'
                    : daysLeft < 180
                      ? 'text-warning-500'
                      : 'text-success-500'
            }`}
            onClick={() => handleClick('expiry_date', row)}
            onDoubleClick={(e) => handleDoubleClick(e, 'expiry_date', row)}
        >
            {daysLeft > 0 ? daysLeft : 0}
        </div>
    );
};

const StatusCell = ({ row }: { row: Row<StudentTable> }) => {
    const { handleClick, handleDoubleClick } = useClickHandlers();
    const status = row.original.status;
    const statusMapping: Record<string, ActivityStatus> = {
        ACTIVE: 'active',
        TERMINATED: 'inactive',
    };

    const mappedStatus = statusMapping[status] || 'inactive';
    return (
        <div
            onClick={() => handleClick('status', row)}
            onDoubleClick={(e) => handleDoubleClick(e, 'status', row)}
        >
            <StatusChips status={mappedStatus} />
        </div>
    );
};

export const myColumns: ColumnDef<StudentTable>[] = [
    {
        id: 'checkbox',
        header: ({ table }) => (
            <Checkbox
                checked={table.getIsAllRowsSelected()}
                onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
                className="border-neutral-400 bg-white text-neutral-600 data-[state=checked]:bg-primary-500 data-[state=checked]:text-white"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                className="flex size-4 items-center justify-center border-neutral-400 text-neutral-600 shadow-none data-[state=checked]:bg-primary-500 data-[state=checked]:text-white"
            />
        ),
    },
    {
        id: 'details',
        header: 'Details',
        cell: ({ row }) => <DetailsCell row={row} />,
    },
    {
        accessorKey: 'full_name',
        header: (props) => {
            const meta = props.table.options.meta as CustomTableMeta;
            return (
                <div className="relative">
                    <MyDropdown
                        dropdownList={['ASC', 'DESC']}
                        onSelect={(value) => {
                            if (typeof value == 'string') meta.onSort?.('full_name', value);
                        }}
                    >
                        <button className="flex w-full cursor-pointer items-center justify-between">
                            <div>Learner Name</div>
                            <div>
                                <CaretUpDown />
                            </div>
                        </button>
                    </MyDropdown>
                </div>
            );
        },
        cell: ({ row }) => <CreateClickableCell row={row} columnId="full_name" />,
    },
    {
        accessorKey: 'username',
        header: 'Username',
        cell: ({ row }) => <CreateClickableCell row={row} columnId="username" />,
    },
    {
        accessorKey: 'package_session_id',
        header: 'Batch',
        cell: ({ row }) => <BatchCellComponent row={row} />,
    },
    {
        accessorKey: 'institute_enrollment_id',
        header: 'Enrollment Number',
        cell: ({ row }) => <CreateClickableCell row={row} columnId="institute_enrollment_id" />,
    },
    {
        accessorKey: 'linked_institute_name',
        header: 'College/School',
        cell: ({ row }) => <CreateClickableCell row={row} columnId="linked_institute_name" />,
    },
    {
        accessorKey: 'gender',
        header: 'Gender',
        cell: ({ row }) => <CreateClickableCell row={row} columnId="gender" />,
    },
    {
        accessorKey: 'mobile_number',
        header: 'Mobile Number',
        cell: ({ row }) => <CreateClickableCell row={row} columnId="mobile_number" />,
    },
    {
        accessorKey: 'email',
        header: 'Email ID',
        cell: ({ row }) => <CreateClickableCell row={row} columnId="email" />,
    },
    {
        accessorKey: 'father_name',
        header: "Father's Name",
        cell: ({ row }) => <CreateClickableCell row={row} columnId="father_name" />,
    },
    {
        accessorKey: 'mother_name',
        header: "Mother's Name",
        cell: ({ row }) => <CreateClickableCell row={row} columnId="mother_name" />,
    },
    {
        accessorKey: 'guardian_name',
        header: "Guardian's Name",
        cell: ({ row }) => <CreateClickableCell row={row} columnId="guardian_name" />,
    },
    {
        accessorKey: 'parents_mobile_number',
        header: "Parent/Guardian's Mobile Number",
        cell: ({ row }) => <CreateClickableCell row={row} columnId="parents_mobile_number" />,
    },
    {
        accessorKey: 'parents_email',
        header: "Parent/Guardian's Email ID",
        cell: ({ row }) => <CreateClickableCell row={row} columnId="parents_email" />,
    },
    {
        accessorKey: 'city',
        header: 'City',
        cell: ({ row }) => <CreateClickableCell row={row} columnId="city" />,
    },
    {
        accessorKey: 'region',
        header: 'State',
        cell: ({ row }) => <CreateClickableCell row={row} columnId="region" />,
    },
    {
        accessorKey: 'expiry_date',
        header: 'Session Expiry',
        cell: ({ row }) => <ExpiryDateCell row={row} />,
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusCell row={row} />,
    },
    {
        id: 'options',
        header: '',
        cell: ({ row }) => <StudentMenuOptions student={row.original} />,
    },
];

export interface ActivityLogDialogProps {
    isOpen: boolean;
    onClose: () => void;
    activityData: ActivityLogType[];
    topicName: string;
    studyType: string;
}

const LastPageReadHeader = () => {
    const { activeItem } = useContentStore();
    return (
        <>
            {activeItem?.video_slide?.url != null || activeItem?.video_slide?.published_url != null
                ? 'Percentage Watched'
                : 'Total Pages Read'}
        </>
    );
};

export const activityLogColumns: ColumnDef<ActivityLogType>[] = [
    {
        accessorKey: 'activityDate',
        header: 'Activity Date',
    },
    {
        accessorKey: 'startTime',
        header: 'Start Time',
    },
    {
        accessorKey: 'endTime',
        header: 'End Time',
    },
    {
        accessorKey: 'duration',
        header: 'Duration',
    },
    {
        accessorKey: 'concentrationScore',
        header: 'Concentration Score',
    },
    {
        accessorKey: 'lastPageRead',
        header: () => <LastPageReadHeader />,
    },
    {
        accessorKey: 'Details',
        header: 'Info',
        cell: ({ row }) => <InfoCell row={row} />,
    },
];

export interface ActivityStatsColumnsType {
    id: string;
    user_id: string;
    full_name: string;
    institute_enrollment_id: string;
    username: string;
    time_spent: string;
    last_active: string;
}

export const ActivityStatsColumns: ColumnDef<ActivityStatsColumnsType>[] = [
    {
        accessorKey: 'details',
        header: 'Details',
        cell: ({ row }) => {
            // Create a regular function to handle the click
            const handleClick = () => {
                const store = useActivityStatsStore.getState();
                store.openDialog(row.original.user_id);
            };

            return (
                <ArrowSquareOut
                    className="size-5 cursor-pointer text-neutral-500"
                    onClick={handleClick}
                />
            );
        },
    },
    {
        accessorKey: 'full_name',
        header: 'Learner Name',
    },
    {
        accessorKey: 'time_spent',
        header: 'Time Spent',
    },
    {
        accessorKey: 'last_active',
        header: 'Last Active',
    },
];

export interface ActivityResponseType {
    activityDate: string;
    attemptNumber: number;
    startTime: string;
    endTime: string;
    duration: string;
    response: string;
    responseStatus: string;
}

export const activityResponseTypeColumns: ColumnDef<ActivityResponseType>[] = [
    {
        accessorKey: 'activityDate',
        header: 'Activity Date',
    },
    {
        accessorKey: 'startTime',
        header: 'Start Time',
    },
    {
        accessorKey: 'endTime',
        header: 'End Time',
    },
    {
        accessorKey: 'duration',
        header: 'Duration',
    },
    {
        accessorKey: 'response',
        header: 'Response',
    },
    {
        accessorKey: 'responseStatus',
        header: 'Response Status',
    },
];

export interface ActivityResponseAssignmentType {
    uploadDate: string;
    uploadTime: number;
    submissions: string;
}

export const activityResponseAssignmentColumns: ColumnDef<ActivityResponseAssignmentType>[] = [
    {
        accessorKey: 'uploadDate',
        header: 'Upload Date',
    },
    {
        accessorKey: 'uploadTime',
        header: 'Upload Time',
    },
    {
        accessorKey: 'submissions',
        header: 'Submissions',
    },
];
