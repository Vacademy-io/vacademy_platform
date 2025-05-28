import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { SidebarStateType } from '../../../../types/layout-container/layout-container-types';
import { SidebarItem } from './sidebar-item';
import { SidebarItemsData } from './utils';
import './scrollbarStyle.css';
import React, { useEffect, useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { filterMenuItems, filterMenuList, getModuleFlags } from './helper';
import { useFileUpload } from '@/hooks/use-file-upload';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, goToMailSupport, goToWhatsappSupport } from '@/lib/utils';
import { Question } from 'phosphor-react';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { WhatsappLogo, EnvelopeSimple } from '@phosphor-icons/react';
import { useNavigate, useRouter } from '@tanstack/react-router';
import useInstituteLogoStore from './institutelogo-global-zustand';

export const MySidebar = ({ sidebarComponent }: { sidebarComponent?: React.ReactNode }) => {
    const navigate = useNavigate();
    const { state }: SidebarStateType = useSidebar();
    const { data, isLoading } = useSuspenseQuery(useInstituteQuery());
    const router = useRouter();
    const currentRoute = router.state.location.pathname;
    const subModules = getModuleFlags(data?.sub_modules);
    const sideBarData = filterMenuList(subModules, SidebarItemsData);
    const sideBarItems = filterMenuItems(sideBarData, data?.id);
    const { getPublicUrl } = useFileUpload();
    const { instituteLogo, setInstituteLogo } = useInstituteLogoStore();

    useEffect(() => {
        const timer = setTimeout(() => {
            const fetchPublicUrl = async () => {
                if (data?.institute_logo_file_id) {
                    const publicUrl = await getPublicUrl(data.institute_logo_file_id);
                    setInstituteLogo(publicUrl);
                }
            };

            fetchPublicUrl();
        }, 300); // Adjust the debounce time as needed

        return () => clearTimeout(timer); // Cleanup the timeout on component unmount
    }, [data?.institute_logo_file_id]);

    if (isLoading) return <DashboardLoader />;
    return (
        <Sidebar collapsible="icon" className="z-20">
            <SidebarContent
                className={`sidebar-content flex flex-col gap-4 border-r border-r-neutral-300 bg-primary-50 py-10 ${
                    state == 'expanded' ? 'w-[307px]' : 'w-28'
                }`}
            >
                <SidebarHeader className="">
                    <div
                        className={`flex cursor-pointer items-center justify-center gap-2 ${
                            state == 'expanded' ? 'pl-4' : 'pl-0'
                        }`}
                        onClick={() => navigate({ to: '/dashboard' })}
                    >
                        {instituteLogo !== '' && (
                            <img src={instituteLogo} alt="logo" className="size-12 rounded-full" />
                        )}
                        <SidebarGroup
                            className={`text-[18px] font-semibold text-primary-500 group-data-[collapsible=icon]:hidden`}
                        >
                            {data?.institute_name}
                        </SidebarGroup>
                    </div>
                </SidebarHeader>
                <SidebarMenu
                    className={`flex shrink-0 flex-col justify-center gap-2 py-4 ${
                        state == 'expanded' ? 'items-stretch' : 'items-center'
                    }`}
                >
                    {sidebarComponent
                        ? sidebarComponent
                        : sideBarItems.map((obj, key) => (
                              <SidebarMenuItem key={key} id={obj.id}>
                                  <SidebarItem
                                      icon={obj.icon}
                                      subItems={obj.subItems}
                                      title={obj.title}
                                      to={obj.to}
                                  />
                              </SidebarMenuItem>
                          ))}
                </SidebarMenu>
                <div
                    className={cn(
                        'mt-auto flex items-center justify-center',
                        state === 'collapsed' ? 'mx-auto px-1' : 'px-1'
                    )}
                >
                    {!currentRoute.includes('slides') && <SupportOptions />}
                </div>
            </SidebarContent>
        </Sidebar>
    );
};

function SupportOptions() {
    const [open, setOpen] = useState(false);
    const [hover, setHover] = useState<boolean>(false);
    const toggleHover = () => {
        setHover(!hover);
    };
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div
                    className={`flex w-full cursor-pointer items-center gap-1 rounded-lg px-4 py-2 hover:bg-white`}
                    onMouseEnter={toggleHover}
                    onMouseLeave={toggleHover}
                >
                    <Question
                        className={cn('size-7', hover ? 'text-primary-500' : 'text-neutral-400')}
                        weight="fill"
                    />
                    <div
                        className={`${
                            hover ? 'text-primary-500' : 'text-neutral-600'
                        } text-body font-regular text-neutral-600 group-data-[collapsible=icon]:hidden`}
                    >
                        {'Support'}
                    </div>
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
                <Command>
                    <CommandList>
                        <CommandGroup>
                            <CommandItem>
                                <div
                                    role="button"
                                    className="flex w-full cursor-pointer items-center gap-1"
                                    onClick={goToWhatsappSupport}
                                >
                                    <WhatsappLogo />
                                    WhatsApp
                                </div>
                            </CommandItem>
                            <CommandItem>
                                <div
                                    role="button"
                                    className="flex w-full cursor-pointer items-center gap-1"
                                    onClick={goToMailSupport}
                                >
                                    <EnvelopeSimple />
                                    Mail us
                                </div>
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
