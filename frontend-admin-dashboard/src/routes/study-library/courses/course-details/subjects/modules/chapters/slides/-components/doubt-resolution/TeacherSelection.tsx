import MultiSelectDropdown from '@/components/common/multi-select-dropdown';
import { useTeacherList } from '@/routes/dashboard/-hooks/useTeacherList';
import { getInstituteId } from '@/constants/helper';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { DoubtType } from '../../-types/add-doubt-type';
import { FacultyFilterParams } from '@/routes/dashboard/-services/dashboard-services';
import { useAddReply } from '../../-services/AddReply';
import { handleAddReply } from '../../-helper/handleAddReply';
import { Tag } from '@phosphor-icons/react';
import React from 'react';

// Custom debounce hook
const useDebounce = <T extends (...args: any[]) => void>(callback: T, delay: number) => {
    const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout>();

    return useCallback(
        (...args: Parameters<T>) => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            const newTimeoutId = setTimeout(() => {
                callback(...args);
            }, delay);
            setTimeoutId(newTimeoutId);
        },
        [callback, delay, timeoutId]
    );
};

export const TeacherSelection = ({
    doubt,
    filters,
    canChange,
    showCanAssign = true,
}: {
    doubt: DoubtType;
    filters: FacultyFilterParams;
    canChange: boolean;
    showCanAssign?: boolean;
}) => {
    const addReply = useAddReply();
    const InstituteId = getInstituteId();
    const { data: TeachersList } = useTeacherList(InstituteId || '', 0, 100, filters, true);

    const teacherOptions = useMemo(
        () =>
            TeachersList?.content?.map((teacher) => ({
                id: teacher.id,
                name: teacher.name,
            })) || [],
        [TeachersList?.content]
    );

    const [selectedTeachers, setSelectedTeachers] = useState<
        { id: string | number; name: string }[]
    >(
        teacherOptions?.filter((teacher) =>
            doubt?.all_doubt_assignee?.some((assignee) => assignee.source_id === teacher.id)
        )
    );

    useEffect(() => {
        setSelectedTeachers(
            teacherOptions?.filter((teacher) =>
                doubt?.all_doubt_assignee?.some((assignee) => assignee.source_id === teacher.id)
            )
        );
    }, [teacherOptions, doubt?.all_doubt_assignee]);

    const handleTeacherSelection = (
        newlySelectedTeachers: { id: string | number; name: string }[]
    ) => {
        setSelectedTeachers(newlySelectedTeachers);
        if (canChange) {
            debouncedSubmitReply(newlySelectedTeachers);
        }
    };

    const submitReply = useCallback(
        async (currentSelectedTeachers: { id: string | number; name: string }[]) => {
            const replyData: DoubtType = {
                id: doubt.id,
                user_id: doubt.user_id,
                name: doubt.name,
                source: doubt.source,
                source_id: doubt.source_id,
                raised_time: doubt.raised_time,
                resolved_time: doubt.resolved_time,
                content_position: doubt.content_position,
                content_type: doubt.content_type,
                html_text: doubt.html_text,
                status: doubt.status,
                parent_id: doubt.parent_id,
                parent_level: doubt.parent_level,
                doubt_assignee_request_user_ids: currentSelectedTeachers
                    .filter(
                        (teacher) =>
                            !doubt.all_doubt_assignee.some(
                                (assignee) => assignee.source_id === teacher.id
                            )
                    )
                    .map((teacher) => String(teacher.id)),
                all_doubt_assignee: doubt.all_doubt_assignee,
                delete_assignee_request: doubt.all_doubt_assignee
                    .filter(
                        (assignee) =>
                            !currentSelectedTeachers.some(
                                (teacher) => teacher.id === assignee.source_id
                            )
                    )
                    .map((assignee) => assignee.id),
            };
            await handleAddReply({ replyData, addReply, id: doubt.id });
        },
        [doubt, addReply]
    );

    const debouncedSubmitReply = useDebounce(submitReply, 1000);

    const hasAssignedTeachers = selectedTeachers && selectedTeachers.length > 0;

    return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {showCanAssign && (
                <div className="flex items-center gap-1 text-neutral-500">
                    <Tag size={14} weight="duotone" />
                    <span className="font-medium">Assigned:</span>
                </div>
            )}
            {canChange ? (
                <MultiSelectDropdown
                    options={teacherOptions}
                    selected={selectedTeachers}
                    onChange={handleTeacherSelection}
                    placeholder={hasAssignedTeachers ? 'Change Assignee' : '+ Assign Teacher'}
                    className="min-w-[160px] text-xs"
                />
            ) : hasAssignedTeachers ? (
                <div className="flex flex-wrap gap-1">
                    {selectedTeachers.map((teacher) => (
                        <span
                            key={teacher.id}
                            className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700"
                        >
                            {teacher.name}
                        </span>
                    ))}
                </div>
            ) : (
                showCanAssign && <p className="italic text-neutral-500">None</p>
            )}
        </div>
    );
};
