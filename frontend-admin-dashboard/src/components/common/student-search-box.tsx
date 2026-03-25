// components/StudentSearchBox.tsx
import { MyInput } from '@/components/design-system/input';
import { MagnifyingGlass, KeyReturn, XCircle } from '@phosphor-icons/react';
import { StudentSearchBoxProps } from '@/routes/manage-students/students-list/-types/students-list-types';

import { useCompactMode } from '@/hooks/use-compact-mode';
import { cn } from '@/lib/utils';

export const StudentSearchBox = ({
    searchInput,
    searchFilter,
    onSearchChange,
    onSearchEnter,
    onClearSearch,
    placeholder,
}: StudentSearchBoxProps) => {
    const { isCompact } = useCompactMode();

    return (
        <div className="relative flex flex-col gap-2">
            <div className="relative w-full">
                <MyInput
                    inputType="text"
                    input={searchInput}
                    onChangeFunction={onSearchChange}
                    inputPlaceholder={placeholder || "Search by name, enroll..."}
                    className={cn("px-9 w-full", isCompact ? "h-8 text-xs placeholder:text-xs" : "")}
                />
                <MagnifyingGlass className={cn("absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600", isCompact ? "size-3.5" : "size-[18px]")} />

                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <KeyReturn
                        weight="fill"
                        className={cn(
                            "cursor-pointer text-primary-500 transition-opacity duration-200",
                            isCompact ? "size-3.5" : "size-[18px]",
                            (searchInput.length || (searchFilter.length && !searchInput.length)) && searchFilter != searchInput
                                ? 'opacity-100 visible'
                                : 'opacity-0 invisible'
                        )}
                        onClick={onSearchEnter}
                    />
                    <XCircle
                        className={cn(
                            "cursor-pointer text-neutral-400 transition-opacity duration-200",
                            isCompact ? "size-3.5" : "size-[18px]",
                            searchInput == searchFilter && searchInput != ''
                                ? 'opacity-100 visible'
                                : 'opacity-0 invisible'
                        )}
                        onClick={onClearSearch}
                    />
                </div>
            </div>
        </div>
    );
};
