'use client';

import { useState } from 'react';
import { useNavigate, useRouter } from '@tanstack/react-router';
// import { useStudyLibraryStore } from "@/stores/study-library/use-study-library-store";

export const InternalSideBar = ({
    sideBarList,
    sideBarData,
}: {
    sideBarList?: { value: string; id: string }[];
    sideBarData?: { title: string; listIconText: string; searchParam: string };
}) => {
    const router = useRouter();
    const navigate = useNavigate();

    const searchParams = router.state.location.search;
    const searchKey = sideBarData?.searchParam;
    const searchValue = searchParams[searchKey as keyof typeof searchParams];
    const [activeItem, setActiveItem] = useState<string>(searchValue as string);

    const handleClick = (id: string) => {
        setActiveItem(id);
        navigate({
            to: router.state.location.pathname,
            search: {
                ...searchParams,
                [sideBarData?.searchParam as string]: id,
            },
        });
    };

    // const studyLibraryData = useStudyLibraryStore();

    if (sideBarList?.length == 0) {
        return null;
    }
    return (
        <div className="flex h-full w-[307px] flex-col gap-6 bg-primary-50 px-3 py-10">
            <div className="text-subtitle font-bold">{sideBarData?.title}</div>
            <div className="flex flex-col gap-2">
                {sideBarList?.map((item, index) => (
                    <div
                        key={index}
                        className={`flex cursor-pointer flex-row items-center gap-3 p-4 py-2 ${
                            activeItem == item.id
                                ? 'rounded-lg border-2 bg-white text-primary-500'
                                : ''
                        }`}
                        onClick={() => {
                            handleClick(item.id);
                        }}
                    >
                        <div
                            className={`text-h3 font-bold text-neutral-500 ${
                                activeItem == item.id ? 'text-primary-500' : ''
                            }`}
                        >{`${sideBarData?.listIconText}${index + 1}`}</div>
                        <div>{item.value}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};
