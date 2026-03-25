import { ColumnDef } from '@tanstack/react-table';
import { PackageSessionDTO } from '../-types/package-types';
import { StatusChips } from '@/components/design-system/chips';
import {
    Package,
    Calendar,
    GraduationCap,
    Clock,
    CaretRight,
    TreeStructure,
    Tag,
    Globe,
} from '@phosphor-icons/react';
import { removeDefaultPrefix } from '@/utils/helpers/removeDefaultPrefix';
import { ColumnWidthConfig } from '@/components/design-system/utils/constants/table-layout';

interface PackageTableColumnsProps {
    onPackageClick: (packageData: { id: string; name: string }) => void;
}

export const getPackageTableColumns = ({
    onPackageClick,
}: PackageTableColumnsProps): ColumnDef<PackageSessionDTO>[] => [
    {
        id: 'package_name',
        accessorKey: 'package_dto.package_name',
        header: () => (
            <div className="flex items-center gap-2">
                <Package className="size-4" />
                <span>Package Name</span>
            </div>
        ),
        cell: ({ row }) => {
            const packageName = row.original.package_dto?.package_name || 'N/A';
            const packageId = row.original.package_dto?.id;
            return (
                <button
                    onClick={() =>
                        onPackageClick({
                            id: packageId,
                            name: removeDefaultPrefix(packageName),
                        })
                    }
                    className="group flex items-center gap-2 text-left font-medium text-neutral-800 transition-colors hover:text-primary-600"
                >
                    <span>{removeDefaultPrefix(packageName)}</span>
                    <CaretRight className="size-4 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
                </button>
            );
        },
        size: 250,
    },
    {
        id: 'level_name',
        accessorKey: 'level.level_name',
        header: () => (
            <div className="flex items-center gap-2">
                <GraduationCap className="size-4" />
                <span>Level</span>
            </div>
        ),
        cell: ({ row }) => {
            const levelName = row.original.level?.level_name || 'N/A';
            return <span className="text-neutral-600">{removeDefaultPrefix(levelName)}</span>;
        },
        size: 150,
    },
    {
        id: 'session_name',
        accessorKey: 'session.session_name',
        header: () => (
            <div className="flex items-center gap-2">
                <Calendar className="size-4" />
                <span>Session</span>
            </div>
        ),
        cell: ({ row }) => {
            const sessionName = row.original.session?.session_name || 'N/A';
            return (
                <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                    {sessionName}
                </span>
            );
        },
        size: 120,
    },
    {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
            const status = row.original.status || 'INACTIVE';
            const mappedStatus = status === 'HIDDEN' ? 'INACTIVE' : status;
            return <StatusChips status={mappedStatus as 'ACTIVE' | 'INACTIVE' | 'TERMINATED'} />;
        },
        size: 100,
    },
    {
        id: 'read_time',
        accessorKey: 'read_time_in_minutes',
        header: () => (
            <div className="flex items-center gap-2">
                <Clock className="size-4" />
                <span>Read Time</span>
            </div>
        ),
        cell: ({ row }) => {
            const readTime = row.original.read_time_in_minutes || 0;
            if (readTime === 0) {
                return <span className="text-neutral-400">-</span>;
            }
            const hours = Math.floor(readTime / 60);
            const minutes = Math.round(readTime % 60);
            return (
                <span className="text-neutral-600">
                    {hours > 0 ? `${hours}h ` : ''}
                    {minutes}m
                </span>
            );
        },
        size: 100,
    },
    {
        id: 'start_time',
        accessorKey: 'start_time',
        header: 'Start Date',
        cell: ({ row }) => {
            const startTime = row.original.start_time;
            if (!startTime) {
                return <span className="text-neutral-400">-</span>;
            }
            return (
                <span className="text-sm text-neutral-600">
                    {new Date(startTime).toLocaleDateString()}
                </span>
            );
        },
        size: 120,
    },
    {
        id: 'group',
        accessorKey: 'group.group_name',
        header: 'Group',
        cell: ({ row }) => {
            const groupName = row.original.group?.group_name;
            if (!groupName) {
                return <span className="text-neutral-400">-</span>;
            }
            return (
                <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                    {groupName}
                </span>
            );
        },
        size: 120,
    },
    {
        id: 'course_depth',
        accessorKey: 'package_dto.course_depth',
        header: () => (
            <div className="flex items-center gap-2">
                <TreeStructure className="size-4" />
                <span>Depth</span>
            </div>
        ),
        cell: ({ row }) => {
            const depth = row.original.package_dto?.course_depth;
            if (depth === undefined || depth === null) {
                return <span className="text-neutral-400">-</span>;
            }
            return (
                <span className="rounded-full bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700">
                    {depth}
                </span>
            );
        },
        size: 80,
    },
    {
        id: 'tags',
        accessorKey: 'package_dto.tags',
        header: () => (
            <div className="flex items-center gap-2">
                <Tag className="size-4" />
                <span>Tags</span>
            </div>
        ),
        cell: ({ row }) => {
            const tags = row.original.package_dto?.tags || [];
            if (tags.length === 0) {
                return <span className="text-neutral-400">-</span>;
            }
            return (
                <div className="flex flex-wrap gap-1">
                    {tags.slice(0, 2).map((tag, index) => (
                        <span
                            key={index}
                            className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                        >
                            {tag}
                        </span>
                    ))}
                    {tags.length > 2 && (
                        <span className="text-xs text-neutral-500">+{tags.length - 2}</span>
                    )}
                </div>
            );
        },
        size: 150,
    },
    {
        id: 'published',
        accessorKey: 'package_dto.is_course_published_to_catalaouge',
        header: () => (
            <div className="flex items-center gap-2">
                <Globe className="size-4" />
                <span>Published</span>
            </div>
        ),
        cell: ({ row }) => {
            const isPublished = row.original.package_dto?.is_course_published_to_catalaouge;
            return (
                <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                        isPublished
                            ? 'bg-green-50 text-green-700'
                            : 'bg-neutral-100 text-neutral-500'
                    }`}
                >
                    {isPublished ? 'Yes' : 'No'}
                </span>
            );
        },
        size: 100,
    },
];

export const PACKAGE_TABLE_COLUMN_WIDTHS: ColumnWidthConfig = {
    package_name: 'min-w-[250px]',
    level_name: 'min-w-[150px]',
    session_name: 'min-w-[120px]',
    status: 'min-w-[100px]',
    read_time: 'min-w-[100px]',
    start_time: 'min-w-[120px]',
    group: 'min-w-[120px]',
    course_depth: 'min-w-[80px]',
    tags: 'min-w-[150px]',
    published: 'min-w-[100px]',
};
