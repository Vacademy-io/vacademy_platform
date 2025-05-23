import { useEffect, useRef, useState } from 'react';
import { CaretDown, CaretUp, CaretRight } from '@phosphor-icons/react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuPortal,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
} from '@radix-ui/react-dropdown-menu';
import { myDropDownProps, DropdownItem, DropdownItemType } from './dropdownTypesForPackageItems';
import { AddCourseButton } from '@/components/common/study-library/add-course/add-course-button';
import { AddSessionDialog } from '@/routes/manage-institute/sessions/-components/session-operations/add-session/add-session-dialog';
import { AddLevelButton } from '@/routes/study-library/courses/levels/-components/add-level-button';
import { MyButton } from '@/components/design-system/button';
import { Plus } from 'lucide-react';
import { AddCourseData } from '@/components/common/study-library/add-course/add-course-form';
import { AddSessionDataType } from '@/routes/manage-institute/sessions/-components/session-operations/add-session/add-session-form';
import { AddLevelData } from '@/routes/study-library/courses/levels/-components/add-level-form';
import { useAddCourse } from '@/services/study-library/course-operations/add-course';
import { useAddSession } from '@/services/study-library/session-management/addSession';
import { useAddLevel } from '@/routes/study-library/courses/levels/-services/add-level';
import { toast } from 'sonner';

const isDropdownItem = (item: string | DropdownItem | DropdownItemType): item is DropdownItem => {
    return typeof item !== 'string' && 'label' in item;
};

const isDropdownItemType = (
    item: string | DropdownItem | DropdownItemType
): item is DropdownItemType => {
    return typeof item !== 'string' && 'id' in item && 'name' in item;
};

export const MyDropdown = ({
    currentValue,
    handleChange,
    dropdownList,
    children,
    onSelect,
    placeholder = 'Select an option',
    error,
    disable,
    required = false,
    showAddCourseButton = false,
    showAddSessionButton = false,
    showAddLevelButton = false,
    onAddCourse,
    onAddSession,
    onAddLevel,
    packageId = '',
    disableAddLevelButton = false,
}: myDropDownProps & {
    showAddCourseButton?: boolean;
    showAddSessionButton?: boolean;
    showAddLevelButton?: boolean;
    onAddCourse?: ({ requestData }: { requestData: AddCourseData }) => void;
    onAddSession?: (data: AddSessionDataType) => void;
    onAddLevel?: (data: {
        requestData: AddLevelData;
        packageId?: string;
        sessionId?: string;
    }) => void;
    packageId?: string;
    disableAddLevelButton?: boolean;
}) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [isAddSessionDialogOpen, setIsAddSessionDialogOpen] = useState(false);
    const [disableAddButton, setDisableAddButton] = useState(true);
    const addCourseMutation = useAddCourse();
    const addSessionMutation = useAddSession();
    const addLevelMutation = useAddLevel();
    const formSubmitRef = useRef(() => {});
    const submitFn = (fn: () => void) => {
        formSubmitRef.current = fn;
    };
    useEffect(() => {
        // Auto-select the only item if dropdownList has exactly one item and no current value is set
        if (dropdownList.length === 1) {
            const singleItem = dropdownList[0];
            if (handleChange) {
                singleItem && handleChange(singleItem);
            }
            if (onSelect) {
                singleItem && onSelect(singleItem);
            }
        }
    }, [dropdownList]);

    const handleValueChange = (value: string | DropdownItem | DropdownItemType) => {
        if (handleChange) {
            handleChange(value);
        }
        if (onSelect) {
            onSelect(value);
        }
        setIsOpen(false);
    };

    const handleClearAll = () => {
        handleValueChange(''); // Reset the value to an empty string or null
    };

    // Helper function to get display text from the currentValue
    const getDisplayText = () => {
        if (!currentValue) return placeholder;

        if (isDropdownItem(currentValue)) {
            return currentValue.label;
        } else if (isDropdownItemType(currentValue)) {
            return currentValue.name;
        } else {
            return currentValue; // It's a string
        }
    };

    const handleAddCourseSubmit = ({ requestData }: { requestData: AddCourseData }) => {
        if (onAddCourse) {
            onAddCourse({ requestData });
        } else {
            addCourseMutation.mutate(
                { requestData: requestData },
                {
                    onSuccess: () => {
                        toast.success('Course created successfully');
                    },
                    onError: () => {
                        toast.error('Failed to create course');
                    },
                }
            );
        }
    };

    const handleAddSessionSubmit = (sessionData: AddSessionDataType) => {
        if (onAddSession) {
            onAddSession(sessionData);
            setIsAddSessionDialogOpen(false);
        } else {
            const processedData = structuredClone(sessionData);
            const transformedData = {
                ...processedData,
                levels: processedData.levels.map((level) => ({
                    id: level.level_dto.id,
                    new_level: level.level_dto.new_level === true,
                    level_name: level.level_dto.level_name,
                    duration_in_days: level.level_dto.duration_in_days,
                    thumbnail_file_id: level.level_dto.thumbnail_file_id,
                    package_id: level.level_dto.package_id,
                })),
            };

            addSessionMutation.mutate(
                { requestData: transformedData as unknown as AddSessionDataType },
                {
                    onSuccess: () => {
                        toast.success('Session added successfully');
                        setIsAddSessionDialogOpen(false);
                    },
                    onError: (error) => {
                        toast.error(error.message || 'Failed to add session');
                    },
                }
            );
        }
    };

    const handleAddLevelSubmit = ({
        requestData,
        packageId: pId,
        sessionId: sId,
    }: {
        requestData: AddLevelData;
        packageId?: string;
        sessionId?: string;
    }) => {
        if (onAddLevel) {
            onAddLevel({ requestData, packageId: pId, sessionId: sId });
        } else {
            addLevelMutation.mutate(
                { requestData: requestData, packageId: pId || '', sessionId: sId || '' },
                {
                    onSuccess: () => {
                        toast.success('Level added successfully');
                    },
                    onError: (error) => {
                        toast.error(error.message || 'Failed to add level');
                    },
                }
            );
        }
    };

    const renderMenuItem = (item: string | DropdownItem | DropdownItemType) => {
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
                        currentValue === item.value ? 'bg-primary-50' : 'bg-none'
                    } hover:outline-none`}
                    onClick={() => handleValueChange(item)}
                    disabled={disable}
                >
                    <div className="flex items-center gap-2">
                        {item.icon}
                        {item.label}
                    </div>
                </DropdownMenuItem>
            );
        }

        if (isDropdownItemType(item)) {
            return (
                <DropdownMenuItem
                    key={item.id}
                    className={`cursor-pointer truncate px-3 py-2 text-subtitle text-neutral-600 hover:bg-primary-50 ${
                        currentValue === item.id ? 'bg-primary-50' : 'bg-none'
                    } hover:outline-none`}
                    onClick={() => handleValueChange(item)}
                    disabled={disable}
                >
                    {item.name}
                </DropdownMenuItem>
            );
        }

        return (
            <DropdownMenuItem
                key={item}
                className={`cursor-pointer truncate px-3 py-2 text-subtitle text-neutral-600 hover:bg-primary-50 ${
                    currentValue === item ? 'bg-primary-50' : 'bg-none'
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
                                ? 'border-danger-600'
                                : isOpen
                                  ? 'border-primary-500'
                                  : 'border-neutral-300 hover:border-primary-200 focus:border-primary-500'
                        }`}
                        disabled={disable}
                    >
                        <div className={`truncate ${!currentValue ? 'text-neutral-400' : ''}`}>
                            {getDisplayText()}
                        </div>
                        <div className="ml-2 shrink-0">
                            <CaretDown className={`${isOpen ? 'hidden' : 'visible'} size-[18px]`} />
                            <CaretUp className={`${isOpen ? 'visible' : 'hidden'} size-[18px]`} />
                        </div>
                    </DropdownMenuTrigger>
                )}
                <DropdownMenuPortal container={document.getElementById('portal-root')}>
                    <DropdownMenuContent
                        className="z-[9999] mt-2 min-w-60 rounded-lg bg-white py-2 shadow focus:outline-none"
                        sideOffset={5}
                        align="start"
                    >
                        {/* Add "Clear All Fields" option */}
                        {dropdownList.length == 1 && required == true ? (
                            <></>
                        ) : (
                            <DropdownMenuItem
                                className="cursor-pointer truncate px-3 py-2 text-center text-subtitle text-neutral-400 hover:bg-primary-50 hover:outline-none"
                                onClick={handleClearAll}
                            >
                                Clear All Fields
                            </DropdownMenuItem>
                        )}
                        {dropdownList.map((item) => renderMenuItem(item))}
                        {(showAddCourseButton || showAddSessionButton || showAddLevelButton) && (
                            <div className="border-t border-neutral-200 pt-2">
                                {showAddCourseButton && (
                                    <AddCourseButton
                                        onSubmit={handleAddCourseSubmit}
                                        courseButton={
                                            <MyButton
                                                type="button"
                                                buttonType="text"
                                                layoutVariant="default"
                                                scale="small"
                                                className="w-full text-primary-500"
                                            >
                                                <Plus className="mr-2" /> Create Course
                                            </MyButton>
                                        }
                                    />
                                )}
                                {showAddSessionButton && (
                                    <AddSessionDialog
                                        isAddSessionDiaogOpen={isAddSessionDialogOpen}
                                        handleOpenAddSessionDialog={() =>
                                            setIsAddSessionDialogOpen(!isAddSessionDialogOpen)
                                        }
                                        handleSubmit={handleAddSessionSubmit}
                                        trigger={
                                            <MyButton
                                                type="button"
                                                buttonType="text"
                                                layoutVariant="default"
                                                scale="small"
                                                className="w-full text-primary-500"
                                            >
                                                <Plus className="mr-2" /> Create Session
                                            </MyButton>
                                        }
                                        submitButton={
                                            <div className="flex items-center justify-end">
                                                <MyButton
                                                    type="submit"
                                                    buttonType="primary"
                                                    layoutVariant="default"
                                                    scale="large"
                                                    className="w-[140px]"
                                                    disable={disableAddButton}
                                                    onClick={() => formSubmitRef.current()}
                                                >
                                                    Add
                                                </MyButton>
                                            </div>
                                        }
                                        setDisableAddButton={setDisableAddButton}
                                        submitFn={submitFn}
                                    />
                                )}
                                {showAddLevelButton && (
                                    <AddLevelButton
                                        onSubmit={handleAddLevelSubmit}
                                        trigger={
                                            <div>
                                                <MyButton
                                                    type="button"
                                                    buttonType="text"
                                                    layoutVariant="default"
                                                    scale="small"
                                                    className="w-full text-primary-500"
                                                    disable={disableAddLevelButton}
                                                >
                                                    <div className="flex items-center">
                                                        <Plus
                                                            className={`${
                                                                disableAddLevelButton
                                                                    ? 'text-primary-300'
                                                                    : 'text-primary-500'
                                                            }`}
                                                        />{' '}
                                                        <p
                                                            className={
                                                                disableAddLevelButton
                                                                    ? 'text-primary-300'
                                                                    : 'text-primary-500'
                                                            }
                                                        >
                                                            Create Level
                                                        </p>
                                                    </div>
                                                    {disableAddLevelButton && (
                                                        <p className="text-caption text-neutral-500">
                                                            (Select a course first)
                                                        </p>
                                                    )}
                                                </MyButton>
                                            </div>
                                        }
                                        packageId={packageId}
                                    />
                                )}
                            </div>
                        )}
                    </DropdownMenuContent>
                </DropdownMenuPortal>
            </DropdownMenu>
            {error && <p className="text-caption text-danger-500">This field is required</p>}
        </div>
    );
};
