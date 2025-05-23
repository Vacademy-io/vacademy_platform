// components/StudentFilters.tsx
import { MyButton } from '@/components/design-system/button';
import { Export } from '@phosphor-icons/react';
import { Filters } from './myFilter';
import { StudentSearchBox } from '../../../../../../components/common/student-search-box';
import { StudentFiltersProps } from '@/routes/manage-students/students-list/-types/students-list-types';
import { useMemo, useRef, useState } from 'react';
import { exportStudentsCsv } from '../../../-services/exportStudentsCsv';
import { exportAccountDetails } from '../../../-services/exportAccountDetails';
import { MyDropdown } from '@/components/common/students/enroll-manually/dropdownForPackageItems';
import { Plus } from 'phosphor-react';
import { AddSessionDialog } from '@/routes/manage-institute/sessions/-components/session-operations/add-session/add-session-dialog';
import { useAddSession } from '@/services/study-library/session-management/addSession';
import { AddSessionDataType } from '@/routes/manage-institute/sessions/-components/session-operations/add-session/add-session-form';
import { toast } from 'sonner';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';

export const StudentFilters = ({
    currentSession,
    filters,
    searchInput,
    searchFilter,
    columnFilters,
    clearFilters,
    getActiveFiltersState,
    onSessionChange,
    onSearchChange,
    onSearchEnter,
    onClearSearch,
    onFilterChange,
    onFilterClick,
    onClearFilters,
    totalElements,
    appliedFilters,
    sessionList,
}: StudentFiltersProps) => {
    const [isAddSessionDiaogOpen, setIsAddSessionDiaogOpen] = useState(false);
    const handleOpenAddSessionDialog = () => {
        if (!instituteDetails?.batches_for_sessions.length) return;
        setIsAddSessionDiaogOpen(!isAddSessionDiaogOpen);
    };
    const addSessionMutation = useAddSession();
    const [disableAddButton, setDisableAddButton] = useState(true);
    const { instituteDetails } = useInstituteDetailsStore();

    const handleAddSession = (sessionData: AddSessionDataType) => {
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

        // Use type assertion since we know this is the correct format for the API
        addSessionMutation.mutate(
            { requestData: transformedData as unknown as AddSessionDataType },
            {
                onSuccess: () => {
                    toast.success('Session added successfully');
                    setIsAddSessionDiaogOpen(false);
                },
                onError: (error) => {
                    toast.error(error.message || 'Failed to add session');
                },
            }
        );
    };

    const formSubmitRef = useRef(() => {});

    const submitButton = (
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
    );

    const submitFn = (fn: () => void) => {
        formSubmitRef.current = fn;
    };

    const isFilterActive = useMemo(() => {
        return getActiveFiltersState();
    }, [columnFilters, searchFilter]);

    const handleExportClick = () => {
        exportStudentsCsv({ pageNo: 0, pageSize: totalElements || 0, filters: appliedFilters });
    };

    const handleExportAccountDetails = () => {
        exportAccountDetails({ pageNo: 0, pageSize: totalElements || 0, filters: appliedFilters });
    };

    return (
        <div className="flex items-start justify-between gap-4">
            <div className="flex w-full flex-col gap-3" id="organize">
                <div className="flex w-full justify-between">
                    {sessionList.length == 0 ? (
                        <AddSessionDialog
                            isAddSessionDiaogOpen={isAddSessionDiaogOpen}
                            handleOpenAddSessionDialog={handleOpenAddSessionDialog}
                            handleSubmit={handleAddSession}
                            trigger={
                                <div className="flex flex-col items-center">
                                    <MyButton
                                        buttonType="text"
                                        className="text-primary-500 disabled:text-primary-300"
                                        disable={!instituteDetails?.batches_for_sessions.length}
                                    >
                                        <Plus /> Add New Session
                                    </MyButton>
                                    {!instituteDetails?.batches_for_sessions.length && (
                                        <p className="-mt-2 text-[12px] text-neutral-400">
                                            (Create a course first)
                                        </p>
                                    )}
                                </div>
                            }
                            submitButton={submitButton}
                            setDisableAddButton={setDisableAddButton}
                            submitFn={submitFn}
                        />
                    ) : (
                        <MyDropdown
                            currentValue={currentSession}
                            dropdownList={sessionList}
                            placeholder="Select Session"
                            handleChange={onSessionChange}
                        />
                    )}
                    <div className="flex items-center gap-4">
                        <MyButton
                            scale="large"
                            buttonType="secondary"
                            layoutVariant="default"
                            onClick={handleExportAccountDetails}
                        >
                            <Export />
                            <div>Export account details</div>
                        </MyButton>
                        <MyButton
                            scale="large"
                            buttonType="secondary"
                            layoutVariant="default"
                            id="export-data"
                            onClick={handleExportClick}
                        >
                            <Export />
                            <div>Export</div>
                        </MyButton>
                    </div>
                </div>
                <div className="flex flex-wrap gap-6 gap-y-3">
                    <StudentSearchBox
                        searchInput={searchInput}
                        searchFilter={searchFilter}
                        onSearchChange={onSearchChange}
                        onSearchEnter={onSearchEnter}
                        onClearSearch={onClearSearch}
                    />
                    {filters.map((filter) => (
                        <Filters
                            key={filter.id}
                            filterDetails={{
                                label: filter.title,
                                filters: filter.filterList.map((filter) => ({
                                    id: filter.id,
                                    label: filter.label,
                                })),
                            }}
                            onFilterChange={(values) => onFilterChange(filter.id, values)}
                            clearFilters={clearFilters}
                            filterId={filter.id}
                            columnFilters={columnFilters}
                        />
                    ))}

                    {(columnFilters.length > 0 || isFilterActive) && (
                        <div className="flex flex-wrap items-center gap-6">
                            <MyButton
                                buttonType="primary"
                                scale="small"
                                layoutVariant="default"
                                className="h-8"
                                onClick={onFilterClick}
                            >
                                Filter
                            </MyButton>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                layoutVariant="default"
                                className="h-8 border border-neutral-400 bg-neutral-200 hover:border-neutral-500 hover:bg-neutral-300 active:border-neutral-600 active:bg-neutral-400"
                                onClick={onClearFilters}
                            >
                                Reset
                            </MyButton>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
