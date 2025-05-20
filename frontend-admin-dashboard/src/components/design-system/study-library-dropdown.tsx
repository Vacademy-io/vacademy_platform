import { useState } from "react";
import { CaretDown, CaretUp, CaretRight } from "@phosphor-icons/react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuPortal,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
} from "@radix-ui/react-dropdown-menu";
import { myDropDownProps } from "./utils/types/study-library-dropdown-types";
import { StudyLibrarySessionType } from "@/stores/study-library/use-study-library-store";

export interface DropdownItem {
    label: string;
    value: string;
    icon?: React.ReactNode;
    subItems?: DropdownItem[];
}

const isDropdownItem = (
    item: string | DropdownItem | StudyLibrarySessionType,
): item is DropdownItem => {
    return typeof item === "object" && "label" in item;
};

const isStudyLibrarySession = (
    item: string | DropdownItem | StudyLibrarySessionType,
): item is StudyLibrarySessionType => {
    return typeof item === "object" && "session_name" in item;
};

export const MyDropdown = ({
    currentValue,
    handleChange,
    dropdownList,
    children,
    onSelect,
    placeholder = "Select an option",
    error,
    disable,
}: myDropDownProps) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);

    const getDisplayValue = (value: string | StudyLibrarySessionType | undefined) => {
        if (!value) return placeholder;
        if (typeof value === "string") return value;
        return value.session_name;
    };

    const handleValueChange = (value: string) => {
        if (handleChange) {
            handleChange(value);
        }
        if (onSelect) {
            onSelect(value);
        }
        setIsOpen(false);
    };

    const renderMenuItem = (item: string | DropdownItem | StudyLibrarySessionType) => {
        if (isStudyLibrarySession(item)) {
            return (
                <DropdownMenuItem
                    key={item.id}
                    className={`cursor-pointer truncate px-3 py-2 text-subtitle text-neutral-600 hover:bg-primary-50 ${
                        currentValue === item.session_name ? "bg-primary-50" : "bg-none"
                    } hover:outline-none`}
                    onClick={() => handleValueChange(item.session_name)}
                    disabled={disable}
                >
                    {item.session_name}
                </DropdownMenuItem>
            );
        }

        if (isDropdownItem(item)) {
            if (item.subItems) {
                return (
                    <DropdownMenuSub key={item.value}>
                        <DropdownMenuSubTrigger className="flex w-full cursor-pointer items-center justify-between rounded px-3 py-2 text-subtitle text-neutral-600 hover:bg-primary-50 focus:outline-none">
                            <div className="flex items-center gap-2">
                                {item.icon}
                                <span>{item.label}</span>
                            </div>
                            <CaretRight className="size-4" />
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                            <DropdownMenuSubContent className="z-[9999] min-w-32 rounded-lg bg-white py-2 shadow-lg">
                                {item.subItems.map((subItem) => renderMenuItem(subItem))}
                            </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                    </DropdownMenuSub>
                );
            }
            return (
                <DropdownMenuItem
                    key={item.value}
                    className={`cursor-pointer truncate px-3 py-2 text-subtitle text-neutral-600 hover:bg-primary-50 ${
                        currentValue === item.value ? "bg-primary-50" : "bg-none"
                    } hover:outline-none`}
                    onClick={() => handleValueChange(item.value)}
                    disabled={disable}
                >
                    <div className="flex items-center gap-2">
                        {item.icon}
                        {item.label}
                    </div>
                </DropdownMenuItem>
            );
        }

        return (
            <DropdownMenuItem
                key={item}
                className={`cursor-pointer truncate px-3 py-2 text-subtitle text-neutral-600 hover:bg-primary-50 ${
                    currentValue === item ? "bg-primary-50" : "bg-none"
                } hover:outline-none`}
                onClick={() => handleValueChange(item)}
                disabled={disable}
            >
                {item}
            </DropdownMenuItem>
        );
    };

    return (
        <div className="flex flex-col gap-1">
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                {children ? (
                    <DropdownMenuTrigger className="w-full focus:outline-none" disabled={disable}>
                        {children}
                    </DropdownMenuTrigger>
                ) : (
                    <DropdownMenuTrigger
                        className={`inline-flex h-9 min-w-60 items-center justify-between rounded-lg border px-3 py-2 text-subtitle text-neutral-600 focus:outline-none ${
                            error
                                ? "border-danger-600"
                                : isOpen
                                  ? "border-primary-500"
                                  : "border-neutral-300 hover:border-primary-200 focus:border-primary-500"
                        }`}
                        disabled={disable}
                    >
                        <div className={`truncate ${!currentValue ? "text-neutral-400" : ""}`}>
                            {getDisplayValue(currentValue)}
                        </div>
                        <div className="ml-2 flex-shrink-0">
                            <CaretDown className={`${isOpen ? "hidden" : "visible"} size-[18px]`} />
                            <CaretUp className={`${isOpen ? "visible" : "hidden"} size-[18px]`} />
                        </div>
                    </DropdownMenuTrigger>
                )}
                <DropdownMenuPortal>
                    <DropdownMenuContent
                        className="z-[9999] mt-2 min-w-60 rounded-lg bg-white py-2 shadow focus:outline-none"
                        sideOffset={5}
                        align="start"
                    >
                        {dropdownList.map((item) => renderMenuItem(item))}
                    </DropdownMenuContent>
                </DropdownMenuPortal>
            </DropdownMenu>
            {error && <p className="text-caption text-danger-500">This field is required</p>}
        </div>
    );
};
