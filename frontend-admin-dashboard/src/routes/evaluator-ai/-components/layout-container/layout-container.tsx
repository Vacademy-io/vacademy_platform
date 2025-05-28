import { MySidebar } from './sidebar/mySidebar';
import { useSidebar } from '@/components/ui/sidebar';
import { Navbar } from './top-navbar.tsx/navbar';
import { cn } from '@/lib/utils';
import React from 'react';
import { StudentSidebarProvider } from '@/routes/manage-students/students-list/-providers/student-sidebar-provider';

export const LayoutContainer = ({
    children,
    className,
    intrnalMargin = true,
    sidebarComponent,
}: {
    children?: React.ReactNode;
    className?: string;
    intrnalMargin?: boolean;
    sidebarComponent?: React.ReactNode;
}) => {
    const { open } = useSidebar();
    return (
        <div className={`flex w-full ${open ? 'gap-12' : 'gap-16'}`}>
            <div>
                <MySidebar sidebarComponent={sidebarComponent} />
            </div>
            <div className="flex w-full flex-1 flex-col text-neutral-600">
                <Navbar />
                <StudentSidebarProvider>
                    <div
                        className={cn(
                            intrnalMargin ? `m-7 flex flex-1 flex-col` : `m-0`,
                            open
                                ? intrnalMargin
                                    ? `max-w-[calc(100vw-322px-56px)]`
                                    : `max-w-[calc(100vw-320px)]`
                                : intrnalMargin
                                  ? `max-w-[calc(100vw-132px-56px)]`
                                  : `max-w-[calc(100vw-132px)]`,
                            className
                        )}
                    >
                        {children}
                    </div>
                </StudentSidebarProvider>
            </div>
        </div>
    );
};
