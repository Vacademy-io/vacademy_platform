import {
    filterMenuItems,
    filterMenuList,
    getModuleFlags,
} from '@/routes/evaluator-ai/-components/layout-container/sidebar/helper';
import { useSuspenseQuery } from '@tanstack/react-query';
import { SidebarItem } from '@/routes/evaluator-ai/-components/layout-container/sidebar/sidebar-item';
import { SidebarItemsData } from '@/routes/evaluator-ai/-components/layout-container/sidebar/utils';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import React from 'react';
import { DashboardLoader } from '@/components/core/dashboard-loader';

export const InternalSidebarComponent = ({
    sidebarComponent,
}: {
    sidebarComponent: React.ReactNode;
}) => {
    const { data, isLoading } = useSuspenseQuery(useInstituteQuery());
    const subModules = getModuleFlags(data?.sub_modules);
    const sideBarData = filterMenuList(subModules, SidebarItemsData);
    const sideBarItems = filterMenuItems(sideBarData, data?.id);

    if (isLoading) {
        return <DashboardLoader />;
    }
    return (
        <div className="relative flex h-screen w-[307px] flex-col gap-6 overflow-y-scroll bg-primary-50 pb-5 pt-10">
            <div>
                {sidebarComponent
                    ? sidebarComponent
                    : sideBarItems.map((obj, key) => (
                          <div key={key} id={obj.id} className="pb-5">
                              <SidebarItem
                                  icon={obj.icon}
                                  subItems={obj.subItems}
                                  title={obj.title}
                                  to={obj.to}
                              />
                          </div>
                      ))}
            </div>
        </div>
    );
};
