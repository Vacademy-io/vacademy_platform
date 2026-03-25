import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useSidebar } from '@/components/ui/sidebar';
import {
    X,
    Envelope,
    Phone,
    MapPin,
    Calendar,
    User,
    IdentificationCard,
} from '@phosphor-icons/react';
import { useEffect } from 'react';
import { useStudentSidebar } from '../../../-context/selected-student-sidebar-context';
import { useGetStudentDetails } from '@/services/get-student-details';
import { DashboardLoader } from '@/components/core/dashboard-loader';

// Enhanced DetailRow component with modern animations
const DetailRow = ({
    label,
    value,
    icon,
}: {
    label: string;
    value?: string;
    icon?: React.ReactNode;
}) => (
    <div className="hover:scale-102 group flex cursor-pointer items-center rounded-xl p-3 transition-all duration-300 hover:bg-gradient-to-r hover:from-neutral-50 hover:to-primary-50/30 hover:shadow-sm">
        {icon && (
            <div className="mr-3 shrink-0 text-neutral-500 transition-all duration-300 group-hover:scale-110 group-hover:text-primary-500">
                <div className="relative">
                    {icon}
                    <div className="absolute inset-0 scale-0 rounded-full bg-primary-500/10 transition-transform duration-300 group-hover:scale-150"></div>
                </div>
            </div>
        )}
        <div className="min-w-0 flex-1">
            <div className="group-hover:text-primary-600 mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500 transition-colors duration-300">
                {label}
            </div>
            <div className="truncate text-sm font-medium text-neutral-800 transition-colors duration-300 group-hover:text-neutral-900">
                {value || <span className="italic text-neutral-400">Not provided</span>}
            </div>
        </div>
        {/* Subtle arrow indicator */}
        <div className="ml-2 translate-x-[-8px] opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
            <div className="to-primary-600 h-4 w-1 rounded-full bg-gradient-to-b from-primary-400"></div>
        </div>
    </div>
);

export const OpenStudentSidebar = () => {
    const { state } = useSidebar();
    const { toggleSidebar } = useSidebar();

    const { selectedStudent } = useStudentSidebar();
    const {
        data: studentDetails,
        isLoading,
        isError,
    } = useGetStudentDetails(selectedStudent?.id || '');

    useEffect(() => {
        if (state == 'expanded') {
            document.body.classList.add('sidebar-open');
        } else {
            document.body.classList.remove('sidebar-open');
        }

        // Cleanup on unmount
        return () => {
            document.body.classList.remove('sidebar-open');
        };
    }, [state]);

    if (isLoading || isError) return <DashboardLoader />;

    return (
        <Sidebar side="right">
            <SidebarContent className="sidebar-content flex flex-col border-l border-neutral-200 bg-gradient-to-br from-white to-neutral-50/30 shadow-xl">
                <SidebarHeader className="sticky top-0 z-10 border-b border-neutral-100 bg-white/95 shadow-sm backdrop-blur-sm">
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <div className="to-primary-600 h-6 w-1 animate-pulse rounded-full bg-gradient-to-b from-primary-500"></div>
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
                </SidebarHeader>

                <div className="flex-1 space-y-6 overflow-y-auto p-4">
                    {/* Enhanced student name header with animation */}
                    <div className="group mb-6">
                        <h3 className="to-primary-700 group-hover:from-primary-600 group-hover:to-primary-800 mb-3 bg-gradient-to-r from-neutral-800 bg-clip-text text-xl font-semibold text-transparent transition-all duration-300">
                            {studentDetails?.full_name}
                        </h3>
                        <div className="h-px bg-gradient-to-r from-transparent via-neutral-300 to-transparent transition-colors duration-300 group-hover:via-primary-300"></div>
                        <div className="mt-2 flex gap-2">
                            <div className="h-px w-2 animate-pulse bg-primary-500"></div>
                            <div className="h-px w-4 animate-pulse bg-primary-400 delay-75"></div>
                            <div className="h-px w-2 animate-pulse bg-primary-300 delay-150"></div>
                        </div>
                    </div>

                    {/* Animated student details sections */}
                    <div className="space-y-6">
                        {/* Enhanced Contact Information */}
                        <div className="group rounded-xl border border-neutral-100/50 bg-gradient-to-br from-neutral-50/50 to-primary-50/30 p-1 transition-all duration-300 hover:border-primary-200/50 hover:shadow-lg">
                            <h4 className="group-hover:text-primary-600 mb-2 flex items-center gap-2 px-3 pt-2 text-xs font-medium uppercase tracking-wide text-neutral-500 transition-colors duration-300">
                                <div className="size-2 animate-pulse rounded-full bg-primary-400"></div>
                                Contact Information
                            </h4>
                            <DetailRow
                                label="Email"
                                value={studentDetails?.email}
                                icon={<Envelope size={16} />}
                            />
                            <DetailRow
                                label="Mobile"
                                value={studentDetails?.mobile_number}
                                icon={<Phone size={16} />}
                            />
                        </div>

                        {/* Enhanced Personal Information */}
                        <div className="group rounded-xl border border-neutral-100/50 bg-gradient-to-br from-neutral-50/50 to-blue-50/30 p-1 transition-all duration-300 hover:border-blue-200/50 hover:shadow-lg">
                            <h4 className="mb-2 flex items-center gap-2 px-3 pt-2 text-xs font-medium uppercase tracking-wide text-neutral-500 transition-colors duration-300 group-hover:text-blue-600">
                                <div className="size-2 animate-pulse rounded-full bg-blue-400"></div>
                                Personal Information
                            </h4>
                            <DetailRow
                                label="Gender"
                                value={studentDetails?.gender}
                                icon={<User size={16} />}
                            />
                            <DetailRow
                                label="Date of Birth"
                                value={studentDetails?.date_of_birth}
                                icon={<Calendar size={16} />}
                            />
                        </div>

                        {/* Enhanced Location Information */}
                        <div className="group rounded-xl border border-neutral-100/50 bg-gradient-to-br from-neutral-50/50 to-emerald-50/30 p-1 transition-all duration-300 hover:border-emerald-200/50 hover:shadow-lg">
                            <h4 className="mb-2 flex items-center gap-2 px-3 pt-2 text-xs font-medium uppercase tracking-wide text-neutral-500 transition-colors duration-300 group-hover:text-emerald-600">
                                <div className="size-2 animate-pulse rounded-full bg-emerald-400"></div>
                                Location Information
                            </h4>
                            <DetailRow
                                label="State"
                                value={studentDetails?.region}
                                icon={<MapPin size={16} />}
                            />
                            <DetailRow
                                label="City/Village"
                                value={studentDetails?.city}
                                icon={<MapPin size={16} />}
                            />
                            <DetailRow
                                label="Pin Code"
                                value={studentDetails?.pin_code}
                                icon={<IdentificationCard size={16} />}
                            />
                            <DetailRow
                                label="Address"
                                value={studentDetails?.address_line}
                                icon={<MapPin size={16} />}
                            />
                        </div>
                    </div>
                </div>
            </SidebarContent>
        </Sidebar>
    );
};
