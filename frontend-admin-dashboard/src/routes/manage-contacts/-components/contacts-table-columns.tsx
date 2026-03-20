import { ColumnDef, Row } from '@tanstack/react-table';
import { ContactUser } from '../-types/contact-types';
import { ArrowSquareOut, CaretUpDown } from '@phosphor-icons/react';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { StudentTable } from '@/types/student-table-types';
import { MyDropdown } from '@/components/design-system/dropdown';
import { useRef } from 'react';

// Reusing the click handler logic pattern
export const useClickHandlers = () => {
    const clickTimeout = useRef<NodeJS.Timeout | null>(null);
    const { setSelectedStudent, selectedStudent } = useStudentSidebar();
    const { setOpen, open } = useSidebar();

    const handleClick = (columnId: string, row: Row<ContactUser>) => {
        if (clickTimeout.current) clearTimeout(clickTimeout.current);

        clickTimeout.current = setTimeout(() => {
            if (selectedStudent?.id != row.original.user?.id) {
                // Map ContactUser to StudentTable (partial) to satisfy constraints
                const mappedStudent = mapContactToStudent(row.original);
                setSelectedStudent(mappedStudent);
                setOpen(true);
            } else {
                if (open == true) setOpen(false);
                else setOpen(true);
            }
        }, 250);
    };

    const handleDoubleClick = (e: React.MouseEvent, columnId: string, row: Row<ContactUser>) => {
        e.stopPropagation();
        if (clickTimeout.current) {
            clearTimeout(clickTimeout.current);
            clickTimeout.current = null;
        }
    };

    return { handleClick, handleDoubleClick };
};

const mapContactToStudent = (contact: ContactUser): StudentTable => {
    // Best effort mapping
    return {
        id: contact.user.id,
        user_id: contact.user.id,
        full_name: contact.user.full_name,
        email: contact.user.email,
        username: contact.user.username,
        mobile_number: contact.user.mobile_number,
        gender: contact.user.gender || '',
        region: contact.user.region || null,
        city: contact.user.city || '',
        date_of_birth: contact.user.date_of_birth || '',
        created_at: '', // Not in base user currently?
        // Defaults or missing
        address_line: contact.user.address_line || '',
        attendance_percent: 0,
        referral_count: 0,
        pin_code: contact.user.pin_code || '',
        fathers_name: '',
        mothers_name: '',
        father_mobile_number: '',
        father_email: '',
        mother_mobile_number: '',
        mother_email: '',
        linked_institute_name: null,
        updated_at: '',
        package_session_id: '',
        institute_enrollment_id: '',
        status: 'INACTIVE', // Default
        session_expiry_days: 0,
        institute_id: '',
        expiry_date: 0,
        face_file_id: contact.user.profile_pic_file_id || null,
        parents_email: '',
        parents_mobile_number: '',
        parents_to_mother_email: '',
        parents_to_mother_mobile_number: '',
        destination_package_session_id: '',
        enroll_invite_id: '',
        payment_status: '',
        custom_fields: {}, // Map custom fields array to record if needed
    };
};

const DetailsCell = ({ row }: { row: Row<ContactUser> }) => {
    const { setSelectedStudent } = useStudentSidebar();

    const handleClick = async () => {
        setSelectedStudent(mapContactToStudent(row.original));
    };

    return (
        <SidebarTrigger onClick={handleClick}>
            <ArrowSquareOut className="size-10 cursor-pointer text-neutral-600" />
        </SidebarTrigger>
    );
};

const CreateClickableCell = ({ row, columnId }: { row: Row<ContactUser>; columnId: string }) => {
    const { handleClick, handleDoubleClick } = useClickHandlers();

    // Handle nested access or root access
    // TanStack table usually handles accessors automatically for getValue,
    // but here we are using manual columnId in handleClick which expects a flat structure key maybe?
    // Actually handleClick just passes the key.

    // Get value from row (works with nested accessorKey)
    const value = row.getValue(columnId) as string;

    return (
        <div
            onClick={() => handleClick(columnId, row)}
            onDoubleClick={(e) => handleDoubleClick(e, columnId, row)}
            className="cursor-pointer truncate"
        >
            {value || '-'}
        </div>
    );
};

export const getContactColumns = (onSort?: (columnId: string, direction: string) => void): ColumnDef<ContactUser>[] => [
    {
        id: 'details',
        size: 80,
        minSize: 60,
        maxSize: 120,
        enablePinning: true,
        header: 'Details',
        cell: ({ row }) => <DetailsCell row={row} />,
    },
    {
        id: 'user.full_name',
        accessorKey: 'user.full_name',
        size: 200,
        header: () => (
            <MyDropdown
                dropdownList={['ASC', 'DESC']}
                onSelect={(value) => {
                    if (typeof value == 'string' && onSort) onSort('full_name', value);
                }}
            >
                <button className="flex w-full cursor-pointer items-center justify-between">
                    <div>Name</div>
                    <CaretUpDown />
                </button>
            </MyDropdown>
        ),
        cell: ({ row }) => <CreateClickableCell row={row} columnId="user.full_name" />,
    },
    {
        id: 'user.username',
        accessorKey: 'user.username',
        header: 'Username',
        size: 150,
        cell: ({ row }) => <CreateClickableCell row={row} columnId="user.username" />,
    },
    {
        id: 'user.email',
        accessorKey: 'user.email',
        header: 'Email',
        size: 200,
        cell: ({ row }) => <CreateClickableCell row={row} columnId="user.email" />,
    },
    {
        id: 'user.mobile_number',
        accessorKey: 'user.mobile_number',
        header: 'Mobile',
        size: 150,
        cell: ({ row }) => <CreateClickableCell row={row} columnId="user.mobile_number" />,
    },
    {
        id: 'user.gender',
        accessorKey: 'user.gender',
        header: 'Gender',
        size: 100,
        cell: ({ row }) => <CreateClickableCell row={row} columnId="user.gender" />,
    },
    {
        id: 'user.region',
        accessorKey: 'user.region',
        header: 'Region',
        size: 150,
        cell: ({ row }) => <CreateClickableCell row={row} columnId="user.region" />,
    },
    {
        id: 'user.city',
        accessorKey: 'user.city',
        header: 'City',
        size: 150,
        cell: ({ row }) => <CreateClickableCell row={row} columnId="user.city" />,
    },
    {
        // created_at seems missing from user object in provided JSON, 
        // fallback to last_login_time or remove if strictly needed from root?
        // JSON shows last_login_time.
        // Let's use last_login_time for now as created_at is not in the sample JSON user object.
        accessorKey: 'user.last_login_time',
        header: 'Last Login',
        size: 150,
        cell: ({ row }) => {
            const val = row.original.user.last_login_time;
            return <div className="truncate">{val ? new Date(val).toLocaleDateString() : '-'}</div>;
        },
    },
    {
        id: 'source',
        header: 'Source',
        size: 180,
        cell: ({ row }) => {
            const isInst = row.original.is_institute_user;
            const isAud = row.original.is_audience_respondent;
            const sources = [];
            if (isInst) sources.push('Institute');
            if (isAud) sources.push('Audience');
            return <div>{sources.join(', ')}</div>;
        }
    }
];
