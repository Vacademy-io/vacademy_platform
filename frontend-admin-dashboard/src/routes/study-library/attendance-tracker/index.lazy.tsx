/* eslint-disable tailwindcss/no-custom-classname */
import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { MyButton } from '@/components/design-system/button';
import {
    Eye,
    ArrowSquareOut,
    X,
    Phone,
    Clock,
    Key,
    Copy,
    GraduationCap,
    Shield,
    MapPin,
    Users,
} from '@phosphor-icons/react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { Sidebar, SidebarContent, SidebarHeader, useSidebar } from '@/components/ui/sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays, subMonths, subYears, startOfDay } from 'date-fns';
import { getStudentAttendanceReport, StudentSchedule } from '../live-session/-services/utils';
import { useGetAttendance, ContentType } from './-services/attendance';
import { MyPagination } from '@/components/design-system/pagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';

import { CaretUpDown, CaretDown, CaretUp, CaretDownIcon } from '@phosphor-icons/react';
import { MyDropdown } from '@/components/common/students/enroll-manually/dropdownForPackageItems';
import { Checkbox } from '@/components/ui/checkbox';
import { useGetBatchesQuery } from '@/routes/manage-institute/batches/-services/get-batches';
import { useStudentFilters } from '@/routes/manage-students/students-list/-hooks/useStudentFilters';
import {
    BatchType,
    batchWithStudentDetails,
} from '@/routes/manage-institute/batches/-types/manage-batches-types';
import { DateRange } from 'react-day-picker';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export const Route = createLazyFileRoute('/study-library/attendance-tracker/')({
    component: RouteComponent,
});

interface ClassAttendanceItem {
    id: string;
    className: string;
    date: string;
    time: string;
    status: 'Present' | 'Absent';
}

type ClassAttendanceData = {
    [key: string]: ClassAttendanceItem[];
};

interface AttendanceStudent {
    id: string; // studentId
    name: string;
    username?: string;
    batch: string; // batchSessionId or label
    mobileNumber: string;
    email: string;
    attendedClasses: number;
    totalClasses: number;
    attendancePercentage: number;
}

// Create context for selected student
interface StudentSidebarContextType {
    selectedStudent: AttendanceStudent | null;
    setSelectedStudent: (student: AttendanceStudent | null) => void;
}

const StudentSidebarContext = createContext<StudentSidebarContextType | undefined>(undefined);

export const useStudentSidebar = () => {
    const context = useContext(StudentSidebarContext);
    if (!context) {
        throw new Error('useStudentSidebar must be used within a StudentSidebarProvider');
    }
    return context;
};

// Student Sidebar Component

// Student Sidebar Component
const StudentDetailsSidebar = () => {
    const { state } = useSidebar();
    const { toggleSidebar } = useSidebar();
    const { selectedStudent } = useStudentSidebar();
    const [category, setCategory] = useState('overview');

    useEffect(() => {
        if (state === 'expanded') {
            document.body.classList.add('sidebar-open');
        } else {
            document.body.classList.remove('sidebar-open');
        }

        // Cleanup on unmount
        return () => {
            document.body.classList.remove('sidebar-open');
        };
    }, [state]);

    if (!selectedStudent) return null;

    // Calculate days until expiry (placeholder)
    const daysUntilExpiry = 118;

    return (
        <Sidebar side="right">
            <SidebarContent
                className={`sidebar-content flex flex-col border-l border-neutral-200 bg-white text-neutral-700`}
            >
                <SidebarHeader className="sticky top-0 z-10 border-b border-neutral-100 bg-white/95 shadow-sm backdrop-blur-sm">
                    <div className="flex flex-col p-4">
                        {/* Header with close button - enhanced with gradient */}
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-6 w-1 animate-pulse rounded-full bg-gradient-to-b from-primary-500 to-primary-400"></div>
                                <h2 className="bg-gradient-to-r from-neutral-800 to-neutral-600 bg-clip-text text-lg font-semibold text-transparent">
                                    Student Profile
                                </h2>
                            </div>
                            <button
                                onClick={toggleSidebar}
                                className="group rounded-xl p-2 transition-all duration-300 hover:scale-105 hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 active:scale-95"
                            >
                                <X className="size-5 text-neutral-500 transition-colors duration-200 group-hover:text-red-500" />
                            </button>
                        </div>

                        {/* Enhanced tab navigation with modern design */}
                        <div className="relative flex gap-1 rounded-xl bg-gradient-to-r from-neutral-50 to-neutral-100 p-1.5 shadow-inner">
                            {/* Animated background indicator */}
                            <div
                                className={`absolute inset-y-1.5 rounded-lg bg-white shadow-lg transition-all duration-300 ease-out ${category === 'overview'
                                        ? 'left-1.5 w-[calc(33.333%-0.5rem)]'
                                        : category === 'learningProgress'
                                            ? 'left-[calc(33.333%+0.167rem)] w-[calc(33.333%-0.333rem)]'
                                            : 'left-[calc(66.666%+0.833rem)] w-[calc(33.333%-0.5rem)]'
                                    }`}
                            ></div>

                            <button
                                className={`group relative z-10 flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300 ${category === 'overview'
                                        ? 'scale-105 text-primary-500'
                                        : 'text-neutral-600 hover:scale-100 hover:text-neutral-800'
                                    }`}
                                onClick={() => setCategory('overview')}
                            >
                                <span className="relative">
                                    Overview
                                    {category === 'overview' && (
                                        <div className="absolute -bottom-1 left-1/2 size-1 -translate-x-1/2 animate-bounce rounded-full bg-primary-500"></div>
                                    )}
                                </span>
                            </button>

                            <button
                                className={`group relative z-10 flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300 ${category === 'learningProgress'
                                        ? 'scale-105 text-primary-500'
                                        : 'text-neutral-600 hover:scale-100 hover:text-neutral-800'
                                    }`}
                                onClick={() => setCategory('learningProgress')}
                            >
                                <span className="relative">
                                    Progress
                                    {category === 'learningProgress' && (
                                        <div className="absolute -bottom-1 left-1/2 size-1 -translate-x-1/2 animate-bounce rounded-full bg-primary-500"></div>
                                    )}
                                </span>
                            </button>
                            <button
                                className={`group relative z-10 flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300 ${category === 'testRecord'
                                        ? 'scale-105 text-primary-500'
                                        : 'text-neutral-600 hover:scale-100 hover:text-neutral-800'
                                    }`}
                                onClick={() => setCategory('testRecord')}
                            >
                                <span className="relative">
                                    Tests
                                    {category === 'testRecord' && (
                                        <div className="absolute -bottom-1 left-1/2 size-1 -translate-x-1/2 animate-bounce rounded-full bg-primary-500"></div>
                                    )}
                                </span>
                            </button>
                        </div>
                    </div>
                </SidebarHeader>

                <div className="flex-1 overflow-y-auto p-4">
                    {/* Enhanced student profile header with animations */}
                    <div className="relative mb-4 overflow-hidden rounded-xl border border-neutral-100 bg-gradient-to-r from-neutral-50/50 to-primary-50/30 p-4">
                        {/* Animated background pattern */}
                        <div className="absolute inset-0 opacity-5">
                            <div className="absolute right-0 top-0 size-32 -translate-y-16 translate-x-16 animate-pulse rounded-full bg-primary-500"></div>
                            <div className="absolute bottom-0 left-0 size-24 -translate-x-12 translate-y-12 animate-pulse rounded-full bg-primary-300 delay-1000"></div>
                        </div>

                        <div className="group relative flex items-center gap-4">
                            <div className="relative">
                                {/* Enhanced profile image with ring animation */}
                                <div className="relative flex size-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-neutral-100 to-neutral-200 transition-transform duration-300 group-hover:scale-105">
                                    {/* Animated ring */}
                                    <div className="absolute inset-0 rounded-full ring-2 ring-primary-500/20 ring-offset-2 ring-offset-white transition-all duration-300 group-hover:ring-primary-500/40"></div>
                                    <div className="flex size-full items-center justify-center bg-neutral-100 text-2xl font-bold text-primary-600">
                                        {selectedStudent.name
                                            .split(' ')
                                            .map((n) => n[0])
                                            .join('')}
                                    </div>
                                </div>

                                {/* Online status indicator */}
                                <div className="absolute -bottom-1 -right-1 size-4 animate-pulse rounded-full border-2 border-white bg-green-500 shadow-lg">
                                    <div className="absolute inset-0 animate-ping rounded-full bg-green-400"></div>
                                </div>
                            </div>

                            <div className="min-w-0 flex-1">
                                <h3 className="truncate font-semibold text-neutral-800 transition-colors duration-300 group-hover:text-primary-500">
                                    {selectedStudent.name}
                                </h3>
                                <div className="mt-1 flex items-center gap-2">
                                    <div className="transition-all duration-300 group-hover:scale-105">
                                        <div className="flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1">
                                            <div className="size-2 rounded-full bg-green-500"></div>
                                            <span className="text-xs font-medium uppercase text-green-700">
                                                ACTIVE
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <div className="size-1.5 animate-bounce rounded-full bg-primary-400"></div>
                                        <div className="size-1.5 animate-bounce rounded-full bg-primary-400 delay-75"></div>
                                        <div className="size-1.5 animate-bounce rounded-full bg-primary-400 delay-150"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main content based on selected category */}
                    {category === 'overview' && (
                        <div className="animate-fadeIn flex flex-col gap-3 text-neutral-600">
                            {/* Edit Button */}
                            <div className="flex justify-center">
                                <button className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-6 py-2 font-medium text-neutral-700 hover:bg-neutral-50">
                                    <span className="text-primary-500">✏️</span>
                                    Edit Details
                                </button>
                            </div>

                            {/* Session Expiry Card */}
                            <div className="rounded-lg border border-neutral-200/50 bg-gradient-to-br from-white to-neutral-50/30 p-3 transition-all duration-200 hover:border-primary-200/50 hover:shadow-md">
                                <div className="mb-2 flex items-center gap-2.5">
                                    <div className="rounded-md bg-gradient-to-br from-primary-50 to-primary-100 p-1.5">
                                        <Clock className="size-4 text-primary-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="mb-0.5 text-xs font-medium text-neutral-700">
                                            Session Expiry
                                        </h4>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-base font-bold text-primary-600">
                                                {daysUntilExpiry}
                                            </span>
                                            <span className="text-xs text-neutral-500">days</span>
                                        </div>
                                    </div>
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        className="text-primary-500"
                                    >
                                        <path d="M7 17l9.2-9.2M17 17V7H7" />
                                    </svg>
                                </div>
                                <div className="relative mt-2">
                                    <div className="h-2 w-3/5 rounded-full bg-primary-500"></div>
                                    <div className="mt-1 text-center text-[10px] leading-tight text-neutral-500">
                                        Renewal due soon
                                    </div>
                                </div>
                            </div>

                            {/* Account Credentials */}
                            <div className="rounded-lg border border-neutral-200/50 bg-gradient-to-br from-white to-neutral-50/30 p-3 transition-all duration-200 hover:border-primary-200/50 hover:shadow-md">
                                <div className="mb-2 flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="rounded-md bg-gradient-to-br from-neutral-50 to-neutral-100 p-1.5">
                                            <Key className="size-4 text-neutral-600" />
                                        </div>
                                        <h4 className="text-xs font-medium text-neutral-700">
                                            Account Credentials
                                        </h4>
                                    </div>
                                    <button className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
                                        <Shield className="size-3" />
                                        Share
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between rounded-md p-1.5 hover:bg-neutral-50">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1.5 rounded-full bg-neutral-300"></div>
                                            <p className="text-xs text-neutral-600">
                                                Username: {selectedStudent.username}
                                            </p>
                                        </div>
                                        <button className="text-neutral-400 hover:text-neutral-600">
                                            <Copy className="size-3.5" />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between rounded-md p-1.5 hover:bg-neutral-50">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1.5 rounded-full bg-neutral-300"></div>
                                            <p className="text-xs text-neutral-600">
                                                Password: 123456
                                            </p>
                                        </div>
                                        <button className="text-neutral-400 hover:text-neutral-600">
                                            <Copy className="size-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* General Details */}
                            <div className="rounded-lg border border-neutral-200/50 bg-gradient-to-br from-white to-neutral-50/30 p-3 transition-all duration-200 hover:border-primary-200/50 hover:shadow-md">
                                <div className="mb-2 flex items-center gap-2.5">
                                    <div className="rounded-md bg-gradient-to-br from-primary-50 to-primary-100 p-1.5">
                                        <GraduationCap className="size-4 text-primary-600" />
                                    </div>
                                    <h4 className="text-xs font-medium text-neutral-700">
                                        General Details
                                    </h4>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between rounded-md p-1.5 hover:bg-neutral-50">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1.5 rounded-full bg-neutral-300"></div>
                                            <p className="text-xs text-neutral-600">
                                                Course: {selectedStudent.batch.split(' ')[0]}
                                            </p>
                                        </div>
                                        <div className="text-neutral-400">
                                            <Copy className="size-3.5" />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between rounded-md p-1.5 hover:bg-neutral-50">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1.5 rounded-full bg-neutral-300"></div>
                                            <p className="text-xs text-neutral-600">
                                                Level: 12th standard
                                            </p>
                                        </div>
                                        <div className="text-neutral-400">
                                            <Copy className="size-3.5" />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between rounded-md p-1.5 hover:bg-neutral-50">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1.5 rounded-full bg-neutral-300"></div>
                                            <p className="text-xs text-neutral-600">
                                                Session: 2025-2026
                                            </p>
                                        </div>
                                        <div className="text-neutral-400">
                                            <Copy className="size-3.5" />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between rounded-md p-1.5 hover:bg-neutral-50">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1.5 rounded-full bg-neutral-300"></div>
                                            <p className="text-xs text-neutral-600">
                                                Enrollment No: 368053
                                            </p>
                                        </div>
                                        <div className="text-neutral-400">
                                            <Copy className="size-3.5" />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between rounded-md p-1.5 hover:bg-neutral-50">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1.5 rounded-full bg-neutral-300"></div>
                                            <p className="text-xs text-neutral-600">Gender: MALE</p>
                                        </div>
                                        <div className="text-neutral-400">
                                            <Copy className="size-3.5" />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between rounded-md p-1.5 hover:bg-neutral-50">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1.5 rounded-full bg-neutral-300"></div>
                                            <p className="text-xs text-neutral-600">School: N/A</p>
                                        </div>
                                        <div className="text-neutral-400">
                                            <Copy className="size-3.5" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Contact Information */}
                            <div className="rounded-lg border border-neutral-200/50 bg-gradient-to-br from-white to-neutral-50/30 p-3 transition-all duration-200 hover:border-primary-200/50 hover:shadow-md">
                                <div className="mb-2 flex items-center gap-2.5">
                                    <div className="rounded-md bg-gradient-to-br from-green-50 to-green-100 p-1.5">
                                        <Phone className="size-4 text-green-600" />
                                    </div>
                                    <h4 className="text-xs font-medium text-neutral-700">
                                        Contact Information
                                    </h4>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between rounded-md p-1.5 hover:bg-neutral-50">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1.5 rounded-full bg-neutral-300"></div>
                                            <p className="text-xs text-neutral-600">
                                                Mobile No.: 919968858268
                                            </p>
                                        </div>
                                        <div className="text-neutral-400">
                                            <Copy className="size-3.5" />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between rounded-md p-1.5 hover:bg-neutral-50">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1.5 rounded-full bg-neutral-300"></div>
                                            <p className="text-xs text-neutral-600">
                                                Email Id: {selectedStudent.email}
                                            </p>
                                        </div>
                                        <div className="text-neutral-400">
                                            <Copy className="size-3.5" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Location Details */}
                            <div className="rounded-lg border border-neutral-200/50 bg-gradient-to-br from-white to-neutral-50/30 p-3 transition-all duration-200 hover:border-primary-200/50 hover:shadow-md">
                                <div className="mb-2 flex items-center gap-2.5">
                                    <div className="rounded-md bg-gradient-to-br from-orange-50 to-orange-100 p-1.5">
                                        <MapPin className="size-4 text-orange-600" />
                                    </div>
                                    <h4 className="text-xs font-medium text-neutral-700">
                                        Location Details
                                    </h4>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between rounded-md p-1.5 hover:bg-neutral-50">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1.5 rounded-full bg-neutral-300"></div>
                                            <p className="text-xs text-neutral-600">State: N/A</p>
                                        </div>
                                        <div className="text-neutral-400">
                                            <Copy className="size-3.5" />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between rounded-md p-1.5 hover:bg-neutral-50">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1.5 rounded-full bg-neutral-300"></div>
                                            <p className="text-xs text-neutral-600">City: N/A</p>
                                        </div>
                                        <div className="text-neutral-400">
                                            <Copy className="size-3.5" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Parent/Guardian's Details */}
                            <div className="rounded-lg border border-neutral-200/50 bg-gradient-to-br from-white to-neutral-50/30 p-3 transition-all duration-200 hover:border-primary-200/50 hover:shadow-md">
                                <div className="mb-2 flex items-center gap-2.5">
                                    <div className="rounded-md bg-gradient-to-br from-purple-50 to-purple-100 p-1.5">
                                        <Users className="size-4 text-purple-600" />
                                    </div>
                                    <h4 className="text-xs font-medium text-neutral-700">
                                        Parent/Guardian&lsquo;s Details
                                    </h4>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between rounded-md p-1.5 hover:bg-neutral-50">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1.5 rounded-full bg-neutral-300"></div>
                                            <p className="text-xs text-neutral-600">
                                                Father/Male Guardian&lsquo;s Name: N/A
                                            </p>
                                        </div>
                                        <div className="text-neutral-400">
                                            <Copy className="size-3.5" />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between rounded-md p-1.5 hover:bg-neutral-50">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1.5 rounded-full bg-neutral-300"></div>
                                            <p className="text-xs text-neutral-600">
                                                Mother/Male Guardian&lsquo;s Name: N/A
                                            </p>
                                        </div>
                                        <div className="text-neutral-400">
                                            <Copy className="size-3.5" />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between rounded-md p-1.5 hover:bg-neutral-50">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1.5 rounded-full bg-neutral-300"></div>
                                            <p className="text-xs text-neutral-600">
                                                Mobile No.: N/A
                                            </p>
                                        </div>
                                        <div className="text-neutral-400">
                                            <Copy className="size-3.5" />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between rounded-md p-1.5 hover:bg-neutral-50">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1.5 rounded-full bg-neutral-300"></div>
                                            <p className="text-xs text-neutral-600">
                                                Email Id: N/A
                                            </p>
                                        </div>
                                        <div className="text-neutral-400">
                                            <Copy className="size-3.5" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {category === 'learningProgress' && (
                        <div className="flex h-40 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-center">
                            <div className="text-neutral-500">
                                <p className="mb-2 text-lg font-medium">Learning Progress</p>
                                <p className="text-sm">
                                    Student progress information will be displayed here
                                </p>
                            </div>
                        </div>
                    )}

                    {category === 'testRecord' && (
                        <div className="flex h-40 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-center">
                            <div className="text-neutral-500">
                                <p className="mb-2 text-lg font-medium">Test Records</p>
                                <p className="text-sm">
                                    Student test records will be displayed here
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </SidebarContent>
        </Sidebar>
    );
};

// runtime generated from API. fallback empty.
const classAttendanceData: ClassAttendanceData = {};

// Attendance Modal Component
interface AttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: AttendanceStudent | null;
    batchId: string;
    startDate?: Date;
    endDate?: Date;
}

const AttendanceModal = ({
    isOpen,
    onClose,
    student,
    batchId,
    startDate,
    endDate,
}: AttendanceModalProps) => {
    const [loading, setLoading] = useState(false);
    const [studentClasses, setStudentClasses] = useState<ClassAttendanceItem[]>([]);
    const [overallAttendance, setOverallAttendance] = useState<number | null>(null);

    useEffect(() => {
        const showAttendance = async () => {
            if (!student || !isOpen) return;

            // 1️⃣ Reuse sessions that were already fetched with the batch call.
            const cached = classAttendanceData[student.id];
            if (cached && cached.length) {
                setStudentClasses(cached);
                setOverallAttendance(student.attendancePercentage);
                return; // no extra API call needed ✔️
            }

            // 2️⃣ Fallback – fetch from student-report endpoint.
            try {
                setLoading(true);
                const start = startDate ? format(startDate, 'yyyy-MM-dd') : '2020-01-01';
                const end = endDate
                    ? format(endDate, 'yyyy-MM-dd')
                    : format(new Date(), 'yyyy-MM-dd');

                const report = await getStudentAttendanceReport(
                    student.id,
                    batchId !== '' ? batchId : undefined,
                    start,
                    end
                );

                setOverallAttendance(Math.round(report.attendancePercentage));

                const transformed: ClassAttendanceItem[] = report.schedules.map(
                    (s: StudentSchedule) => ({
                        id: s.scheduleId,
                        className: s.sessionTitle,
                        date: s.meetingDate,
                        time: s.startTime,
                        status: s.attendanceStatus === 'PRESENT' ? 'Present' : 'Absent',
                    })
                );

                // cache for next time
                classAttendanceData[student.id] = transformed;
                setStudentClasses(transformed);
            } catch (err) {
                console.error('Failed to fetch attendance report', err);
            } finally {
                setLoading(false);
            }
        };

        showAttendance();
    }, [student, batchId, startDate, endDate, isOpen]);

    if (!student) return null;

    // while data is loading, we can show spinner

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="flex max-h-[75vh] flex-col sm:max-w-[450px]">
                <div className="flex items-center justify-between border-b border-neutral-200 p-4">
                    <h2 className="text-lg font-semibold text-neutral-800">
                        {student.name} - Class Attendance
                    </h2>
                </div>

                <div className="flex flex-col gap-4 overflow-y-auto p-4">
                    {/* Overall Attendance */}
                    <div className="rounded-lg bg-primary-50 p-4 text-center">
                        <div className="text-4xl font-bold text-primary-500">
                            {overallAttendance !== null ? `${overallAttendance}%` : '--'}
                        </div>
                        <div className="mt-2 text-base text-neutral-600">Overall Attendance</div>
                    </div>

                    {/* Class List */}
                    <div className="flex flex-col gap-3 overflow-y-auto">
                        {loading ? (
                            <p className="text-center text-neutral-500">Loading...</p>
                        ) : (
                            studentClasses.map((classItem) => (
                                <div
                                    key={classItem.id}
                                    className="rounded-lg border border-neutral-200 p-4"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-base font-medium text-neutral-800">
                                                {classItem.className}
                                            </h3>
                                            <p className="text-sm text-neutral-600">
                                                {classItem.date} • {classItem.time}
                                            </p>
                                        </div>
                                        <div
                                            className={`rounded-full px-3 py-1 text-xs font-medium ${classItem.status === 'Present'
                                                    ? 'bg-success-50 text-success-600'
                                                    : 'bg-danger-100 text-danger-600'
                                                }`}
                                        >
                                            {classItem.status}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

function RouteComponent() {
    const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 7));
    const [endDate, setEndDate] = useState<Date | undefined>(new Date());
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLiveSessions, setSelectedLiveSessions] = useState<string[]>([]);
    const [attendanceFilter, setAttendanceFilter] = useState('All');
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });
    const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
    const { currentSession, sessionList, handleSessionChange } = useStudentFilters();
    const { data: batches } = useGetBatchesQuery({ sessionId: currentSession.id });
    const [page, setPage] = useState(0);
    const [rowSelections, setRowSelections] = useState<Record<string, boolean>>({});
    const [sortConfig, setSortConfig] = useState<{
        key: string | null;
        direction: 'asc' | 'desc';
    }>({
        key: null,
        direction: 'asc',
    });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<AttendanceStudent | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Extract batch options for dropdown
    const batchOptions = useMemo(() => {
        if (!batches || !Array.isArray(batches)) return [{ label: 'All Batches', value: null }];

        const extractedBatches = batches.flatMap((batchData: batchWithStudentDetails) =>
            batchData.batches.map((batch: BatchType) => ({
                label: `${batch.batch_name} (${batch.invite_code})`,
                value: batch.package_session_id,
            }))
        );

        return [{ label: 'All Batches', value: null }, ...extractedBatches];
    }, [batches]);

    // Reset batch selection when session changes
    useEffect(() => {
        setSelectedBatchId(null);
    }, [currentSession.id]);

    // Set the first batch as default when batches are loaded
    useEffect(() => {
        if (batchOptions.length > 1 && selectedBatchId === null) {
            // Set the first actual batch (skip "All Batches" option)
            const firstBatch = batchOptions[1];
            if (firstBatch && firstBatch.value) {
                setSelectedBatchId(firstBatch.value);
            }
        }
    }, [batchOptions, selectedBatchId]);

    const sortIconFor = (key: string) => {
        if (sortConfig.key !== key) return <CaretUpDown className="inline" />;
        return sortConfig.direction === 'asc' ? (
            <CaretUp className="inline" />
        ) : (
            <CaretDown className="inline" />
        );
    };

    const toggleSelectAll = (checked: boolean) => {
        if (checked) {
            const newSelections: Record<string, boolean> = {};
            studentsData.forEach((s: { id: string | number }) => {
                newSelections[s.id] = true;
            });
            setRowSelections(newSelections);
        } else {
            setRowSelections({});
        }
    };

    const toggleRowSelection = (id: string, checked: boolean) => {
        setRowSelections((prev) => {
            const newSel = { ...prev };
            if (checked) newSel[id] = true;
            else delete newSel[id];
            return newSel;
        });
    };

    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading('Attendance Tracker');
    }, [setNavHeading]);

    // Sync dateRange with individual date states for backwards compatibility
    useEffect(() => {
        setStartDate(dateRange.from);
        setEndDate(dateRange.to);
    }, [dateRange]);

    const filterRequest = useMemo(
        () => ({
            name: searchQuery,
            start_date: startDate ? format(startDate, 'yyyy-MM-dd') : '2020-01-01',
            end_date: endDate ? format(endDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
            batch_ids: selectedBatchId ? [selectedBatchId] : null,
            live_session_ids: selectedLiveSessions.length > 0 ? selectedLiveSessions : null,
        }),
        [searchQuery, startDate, endDate, selectedBatchId, selectedLiveSessions]
    );

    // Use attendance service hook
    const {
        data: attendanceData,
        isLoading,
        error,
    } = useGetAttendance({
        pageNo: page,
        pageSize: 10,
        filterRequest,
    });

    // Get selected batch label for display
    const selectedBatchLabel = useMemo(() => {
        if (!selectedBatchId) return 'All Batches';
        const batch = batchOptions.find((opt) => opt.value === selectedBatchId);
        return batch?.label || 'All Batches';
    }, [selectedBatchId, batchOptions]);

    // Process attendance data to match current table structure
    const studentsData = useMemo(() => {
        if (!attendanceData?.pages) return [];

        const allStudents: AttendanceStudent[] = [];

        attendanceData.pages.forEach((pageData) => {
            console.log('pageData', pageData);
            if (pageData?.content) {
                const mappedStudents = pageData.content.map((student: ContentType) => {
                    const total = student.sessions.length;
                    const attended = student.sessions.filter(
                        (s) => s.attendanceStatus === 'PRESENT'
                    ).length;
                    const percent = student.attendancePercentage;

                    // Store sessions for modal
                    classAttendanceData[student.studentId] = student.sessions.map((sess) => ({
                        id: sess.scheduleId,
                        className: sess.title,
                        date: sess.meetingDate,
                        time: sess.startTime,
                        status: sess.attendanceStatus === 'PRESENT' ? 'Present' : 'Absent',
                    }));

                    return {
                        id: student.studentId,
                        name: student.fullName,
                        username: student.instituteEnrollmentNumber || '',
                        batch: selectedBatchLabel,
                        mobileNumber: student.mobileNumber,
                        email: student.email,
                        attendedClasses: attended,
                        totalClasses: total,
                        attendancePercentage: percent,
                    };
                });
                allStudents.push(...mappedStudents);
            }
        });

        return allStudents;
    }, [attendanceData, selectedBatchLabel]);

    // Function to clear all filters
    const clearFilters = () => {
        setStartDate(undefined);
        setEndDate(undefined);
        setDateRange({});
        setSearchQuery('');
        setSelectedBatchId(null);
        setSelectedLiveSessions([]);
        setAttendanceFilter('All');
    };

    // Function to handle View More click
    const handleViewMoreClick = (student: AttendanceStudent) => {
        setSelectedStudent(student);
        setIsModalOpen(true); // Open modal for attendance view
    };

    // Function to handle student details view (eye icon in first column)
    const handleViewDetailsClick = (student: AttendanceStudent) => {
        setSelectedStudent(student);
        setIsSidebarOpen(true); // Open sidebar for detailed profile
    };

    // Pagination helpers - with server-side pagination
    const totalPages = attendanceData?.pages?.[0]?.totalPages || 1;
    const totalElements = attendanceData?.pages?.[0]?.totalElements || 0;

    const allRowsSelected =
        studentsData.length > 0 && studentsData.every((s) => rowSelections[s.id]);

    // Placeholder export functions
    const exportAccountDetails = (sel: AttendanceStudent[]) => {
        // TODO: implement actual export
        console.log('Exporting account details for', sel.length, 'students');
    };

    const exportFullData = (sel: AttendanceStudent[]) => {
        console.log('Exporting full data for', sel.length, 'students');
    };

    console.log('student data  -> ', studentsData);

    return (
        <StudentSidebarContext.Provider value={{ selectedStudent, setSelectedStudent }}>
            <LayoutContainer>
                <Helmet>
                    <title>Live Class Attendance</title>
                    <meta
                        name="description"
                        content="Track and manage student attendance for live classes"
                    />
                </Helmet>
                <div className="flex flex-col gap-4">
                    <h1 className="text-2xl font-semibold text-neutral-800">
                        Live Class Attendance
                    </h1>
                    <p className="text-neutral-600">
                        Track and manage student attendance for live classes
                    </p>

                    <div className="rounded-lg border border-neutral-200 bg-white p-4">
                        <div className="mb-4 flex flex-wrap items-center gap-3">
                            <MyDropdown
                                currentValue={currentSession}
                                dropdownList={sessionList}
                                placeholder="Select Session"
                                handleChange={handleSessionChange}
                            />
                            <div className="relative min-w-[240px] flex-1">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <Search />
                                </div>
                                <Input
                                    type="text"
                                    placeholder="Search students..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-9 w-full rounded-md border border-neutral-300 bg-white py-2 pl-10 pr-3 text-sm text-neutral-900 placeholder:text-neutral-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                {/* Date Range */}
                                <RangeDateFilter range={dateRange} onChange={setDateRange} />

                                {/* Batch */}
                                <BatchDropdown
                                    label="Batch"
                                    value={selectedBatchLabel}
                                    options={batchOptions}
                                    onSelect={(batchId) => setSelectedBatchId(batchId)}
                                />
                            </div>

                            {(searchQuery ||
                                startDate ||
                                endDate ||
                                selectedBatchId ||
                                selectedLiveSessions.length > 0 ||
                                attendanceFilter !== 'All') && (
                                    <button
                                        onClick={clearFilters}
                                        className="ml-auto inline-flex h-9 items-center justify-center gap-1 rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200"
                                    >
                                        <X />
                                        Clear Filters
                                    </button>
                                )}
                        </div>

                        {/* Students Count */}
                        <div className="flex items-center justify-between text-xs text-neutral-500">
                            <span>
                                {isLoading ? (
                                    'Loading students...'
                                ) : (
                                    <>
                                        Showing{' '}
                                        <span className="font-medium text-neutral-700">
                                            {studentsData.length}
                                        </span>
                                        {totalElements > studentsData.length && (
                                            <>
                                                {' '}
                                                of{' '}
                                                <span className="font-medium text-neutral-700">
                                                    {totalElements}
                                                </span>
                                            </>
                                        )}{' '}
                                        students
                                    </>
                                )}
                            </span>
                        </div>
                    </div>

                    {/* Table Section */}
                    <div className="overflow-hidden rounded-lg border border-neutral-200">
                        {/* Table */}
                        <div className="w-full overflow-x-auto">
                            <div className="max-h-[400px] overflow-y-auto">
                                <table className="w-full min-w-[800px] table-auto border-collapse">
                                    <thead>
                                        <tr className="relative overflow-visible border-b border-neutral-200 bg-primary-100 text-left text-sm font-medium text-neutral-600">
                                            <th className="w-[40px] px-4 py-6">
                                                <Checkbox
                                                    checked={allRowsSelected}
                                                    onCheckedChange={(val) =>
                                                        toggleSelectAll(!!val)
                                                    }
                                                    className="border-neutral-400 bg-white text-neutral-600 data-[state=checked]:bg-primary-500 data-[state=checked]:text-white"
                                                />
                                            </th>
                                            <th className="w-[60px] px-4 py-6">Details</th>
                                            <th className="select-none px-4 py-6">
                                                <MyDropdown
                                                    dropdownList={['ASC', 'DESC']}
                                                    onSelect={(val) =>
                                                        setSortConfig({
                                                            key: 'name',
                                                            direction:
                                                                val === 'ASC' ? 'asc' : 'desc',
                                                        })
                                                    }
                                                >
                                                    <button
                                                        type="button"
                                                        className="flex items-center gap-1 text-neutral-700 hover:text-neutral-900 focus:outline-none"
                                                        aria-label="Sort learner name"
                                                    >
                                                        <span>Learner Name</span>
                                                        {sortIconFor('name')}
                                                    </button>
                                                </MyDropdown>
                                            </th>
                                            <th className="px-4 py-6">Username</th>
                                            <th className="px-4 py-6">Batch</th>
                                            <th className="px-4 py-6">Mobile Number</th>
                                            <th className="px-4 py-6">Email</th>
                                            <th className="px-4 py-6">
                                                Live Classes and Attendance
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {isLoading ? (
                                            <tr>
                                                <td
                                                    colSpan={8}
                                                    className="p-8 text-center text-neutral-500"
                                                >
                                                    <div className="flex flex-col items-center">
                                                        <div className="mb-3 size-8 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-500"></div>
                                                        <p className="text-lg font-medium">
                                                            Loading students...
                                                        </p>
                                                        <p className="mt-1 text-sm">
                                                            Please wait while we fetch attendance
                                                            data
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : error ? (
                                            <tr>
                                                <td
                                                    colSpan={8}
                                                    className="p-8 text-center text-neutral-500"
                                                >
                                                    <div className="flex flex-col items-center">
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            width="40"
                                                            height="40"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="1"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            className="mb-3 text-red-300"
                                                        >
                                                            <circle cx="12" cy="12" r="10"></circle>
                                                            <line
                                                                x1="12"
                                                                y1="8"
                                                                x2="12"
                                                                y2="12"
                                                            ></line>
                                                            <line
                                                                x1="12"
                                                                y1="16"
                                                                x2="12.01"
                                                                y2="16"
                                                            ></line>
                                                        </svg>
                                                        <p className="text-lg font-medium text-red-600">
                                                            Error loading attendance data
                                                        </p>
                                                        <p className="mt-1 text-sm">
                                                            Please try refreshing the page or
                                                            adjusting your filters
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : studentsData.length > 0 ? (
                                            studentsData.map((student) => (
                                                <tr
                                                    key={student.id}
                                                    className="border-b border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50"
                                                >
                                                    <td className="p-4">
                                                        <Checkbox
                                                            checked={!!rowSelections[student.id]}
                                                            onCheckedChange={(val) =>
                                                                toggleRowSelection(
                                                                    student.id,
                                                                    !!val
                                                                )
                                                            }
                                                            className="flex size-4 items-center justify-center border-neutral-400 text-neutral-600 shadow-none data-[state=checked]:bg-primary-500 data-[state=checked]:text-white"
                                                        />
                                                    </td>
                                                    <td className="p-4">
                                                        <button
                                                            className="text-neutral-500 hover:text-primary-500"
                                                            onClick={() =>
                                                                handleViewDetailsClick(student)
                                                            }
                                                        >
                                                            <ArrowSquareOut size={20} />
                                                        </button>
                                                    </td>
                                                    <td className="p-4">{student.name}</td>
                                                    <td className="p-4">{student.username}</td>
                                                    <td className="p-4">{student.batch}</td>
                                                    <td className="p-4">{student.mobileNumber}</td>
                                                    <td className="p-4">{student.email}</td>
                                                    <td className="p-4">
                                                        <div className="flex flex-col">
                                                            <span>
                                                                {student.attendedClasses}/
                                                                {student.totalClasses} Attended
                                                            </span>
                                                            <div className="mt-1 flex items-center gap-3">
                                                                <button
                                                                    className="flex items-center gap-1 font-medium text-primary-500 hover:underline"
                                                                    onClick={() =>
                                                                        handleViewMoreClick(student)
                                                                    }
                                                                >
                                                                    <Eye size={14} />
                                                                    View More
                                                                </button>
                                                                <div className="h-4 w-px bg-neutral-300"></div>
                                                                <span
                                                                    className={`rounded-full px-2 py-0.5 font-medium ${student.attendancePercentage >=
                                                                            75
                                                                            ? 'bg-success-50 text-success-600'
                                                                            : student.attendancePercentage >=
                                                                                50
                                                                                ? 'bg-warning-50 text-warning-600'
                                                                                : 'bg-danger-50 text-danger-600'
                                                                        }`}
                                                                >
                                                                    {student.attendancePercentage}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td
                                                    colSpan={8}
                                                    className="p-8 text-center text-neutral-500"
                                                >
                                                    <div className="flex flex-col items-center">
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            width="40"
                                                            height="40"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="1"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            className="mb-3 text-neutral-300"
                                                        >
                                                            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                                            <line
                                                                x1="12"
                                                                y1="9"
                                                                x2="12"
                                                                y2="13"
                                                            ></line>
                                                            <line
                                                                x1="12"
                                                                y1="17"
                                                                x2="12.01"
                                                                y2="17"
                                                            ></line>
                                                        </svg>
                                                        <p className="text-lg font-medium">
                                                            No students found
                                                        </p>
                                                        <p className="mt-1 text-sm">
                                                            Try adjusting your search or filter
                                                            criteria
                                                        </p>
                                                        <button
                                                            className="mt-4 rounded-md bg-primary-50 px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-100"
                                                            onClick={clearFilters}
                                                        >
                                                            Clear all filters
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Pagination Controls */}
                        <div className="flex flex-col gap-4 border-t border-neutral-200 p-4">
                            {/* Bulk Actions Bar */}
                            {Object.keys(rowSelections).length > 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-4 text-neutral-600">
                                    <div className="flex gap-1 text-sm">
                                        [{Object.keys(rowSelections).length}]<span> Selected</span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <MyButton
                                            buttonType="secondary"
                                            scale="medium"
                                            onClick={() => setRowSelections({})}
                                        >
                                            Reset
                                        </MyButton>

                                        <MyDropdown
                                            dropdownList={['Export Account Details', 'Export Data']}
                                            onSelect={(value) => {
                                                const sel = studentsData.filter(
                                                    (s) => rowSelections[s.id]
                                                );
                                                if (value === 'Export Account Details') {
                                                    exportAccountDetails(sel);
                                                } else if (value === 'Export Data') {
                                                    exportFullData(sel);
                                                }
                                            }}
                                        >
                                            <MyButton
                                                buttonType="primary"
                                                scale="medium"
                                                className="flex items-center gap-1"
                                            >
                                                Bulk Actions
                                                <CaretUpDown />
                                            </MyButton>
                                        </MyDropdown>
                                    </div>
                                </div>
                            )}

                            <MyPagination
                                currentPage={page}
                                totalPages={totalPages}
                                onPageChange={(p) => setPage(p)}
                            />
                        </div>
                    </div>
                </div>

                {/* Attendance Modal - Keep for backwards compatibility */}
                <AttendanceModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    student={selectedStudent}
                    batchId={selectedBatchId || ''}
                    startDate={startDate}
                    endDate={endDate}
                />

                {/* Student Details Sidebar with SidebarProvider */}
                <SidebarProvider
                    style={{ ['--sidebar-width' as string]: '565px' }}
                    defaultOpen={false}
                    open={isSidebarOpen}
                    onOpenChange={setIsSidebarOpen}
                >
                    <StudentDetailsSidebar />
                </SidebarProvider>
            </LayoutContainer>
        </StudentSidebarContext.Provider>
    );
}

interface RangeDateFilterProps {
    range: { from?: Date; to?: Date };
    onChange: (r: { from?: Date; to?: Date }) => void;
}

function RangeDateFilter({ range, onChange }: RangeDateFilterProps) {
    const { from, to } = range;
    return (
        <div className="w-full">
            <Popover>
                <PopoverTrigger asChild>
                    <button
                        className={`flex h-9 w-full items-center justify-between rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm ${from || to ? 'text-neutral-900' : 'text-neutral-500'
                            } focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
                    >
                        {from && to ? (
                            <>
                                {format(from, 'dd/MM/yy')} - {format(to, 'dd/MM/yy')}
                            </>
                        ) : from ? (
                            <>From {format(from, 'dd/MM/yy')}</>
                        ) : (
                            <>Select date range</>
                        )}
                        <CalendarIcon className="ml-2 size-4 text-neutral-500" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start">
                    <div className="flex gap-3">
                        <Calendar
                            mode="range"
                            selected={range as DateRange}
                            onSelect={(sel: { from?: Date; to?: Date } | undefined) =>
                                onChange(sel || {})
                            }
                            className="border-r border-neutral-100 pr-3"
                        />
                        {/* Quick presets */}
                        <div className="flex flex-col gap-2 pt-1">
                            <h4 className="mb-1 text-xs font-medium text-neutral-500">
                                Quick Select
                            </h4>
                            {[
                                { label: 'Past Day', from: startOfDay(subDays(new Date(), 1)) },
                                {
                                    label: 'Past Week',
                                    from: startOfDay(subDays(new Date(), 7)),
                                },
                                {
                                    label: 'Past Month',
                                    from: startOfDay(subMonths(new Date(), 1)),
                                },
                                {
                                    label: 'Past 6 Months',
                                    from: startOfDay(subMonths(new Date(), 6)),
                                },
                                {
                                    label: 'Past Year',
                                    from: startOfDay(subYears(new Date(), 1)),
                                },
                            ].map((preset) => (
                                <button
                                    key={preset.label}
                                    onClick={() => onChange({ from: preset.from, to: new Date() })}
                                    className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-left text-xs hover:border-neutral-300 hover:bg-neutral-50"
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}

interface BatchDropdownProps {
    label: string;
    value: string;
    options: Array<{ label: string; value: string | null }>;
    onSelect: (batchId: string | null) => void;
}

function BatchDropdown({ label, value, options, onSelect }: BatchDropdownProps) {
    return (
        <div className="w-full">
            <Popover>
                <PopoverTrigger asChild>
                    <button
                        className={`flex h-9 w-full items-center justify-between rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm ${value !== 'All Batches' ? 'text-neutral-900' : 'text-neutral-500'
                            } focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
                    >
                        {value || label}
                        <CaretDownIcon className="ml-2 size-4 text-neutral-500" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start">
                    <div className="flex flex-col gap-2">
                        <h4 className="mb-1 text-xs font-medium text-neutral-500">{label}</h4>
                        <div className="flex max-h-60 flex-col gap-2 overflow-y-auto">
                        {options.map((opt) => (
                            <button
                                key={opt.value || 'all'}
                                onClick={() => onSelect(opt.value)}
                                className={`w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-left text-xs hover:border-neutral-300 hover:bg-neutral-50 ${value === opt.label ? 'bg-primary-50 text-primary-600' : ''
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
