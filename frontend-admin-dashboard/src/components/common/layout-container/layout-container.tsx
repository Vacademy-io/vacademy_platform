import { MySidebar } from './sidebar/mySidebar';
import { useSidebar } from '@/components/ui/sidebar';
import { Navbar } from './top-navbar.tsx/navbar';
import { cn } from '@/lib/utils';
import React, { useEffect } from 'react';
import { InternalSideBar } from './internal-sidebar/internalSideBar';
import { StudentSidebarProvider } from '@/routes/manage-students/students-list/-providers/student-sidebar-provider';
import { InternalSidebarComponent } from './internal-sidebar/internalSidebarComponent';

export const LayoutContainer = ({
    children,
    className,
    sidebarComponent,
    intrnalMargin = true,
    internalSideBar = false,
    sideBarList,
    sideBarData,
    internalSidebarComponent,
    hasInternalSidebarComponent = false,
}: {
    children?: React.ReactNode;
    className?: string;
    sidebarComponent?: React.ReactNode;
    intrnalMargin?: boolean;
    internalSideBar?: boolean;
    sideBarList?: { value: string; id: string }[];
    sideBarData?: { title: string; listIconText: string; searchParam: string };
    hasInternalSidebarComponent?: boolean;
    internalSidebarComponent?: React.ReactNode;
}) => {
    const { open, setOpen } = useSidebar();
    useEffect(() => {
        const isCollapse = !(internalSideBar || hasInternalSidebarComponent);
        setOpen(isCollapse);
    }, [internalSideBar, hasInternalSidebarComponent]);
    return (
        <div className={`flex w-full`}>
            <div className={`flex  ${open ? 'gap-12' : 'gap-16'}`}>
                <div>
                    <MySidebar sidebarComponent={sidebarComponent} />
                </div>
                <div className="sticky top-0 h-screen">
                    {hasInternalSidebarComponent && internalSidebarComponent ? (
                        <InternalSidebarComponent sidebarComponent={internalSidebarComponent} />
                    ) : (
                        internalSideBar && (
                            <InternalSideBar sideBarList={sideBarList} sideBarData={sideBarData} />
                        )
                    )}
                </div>
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
