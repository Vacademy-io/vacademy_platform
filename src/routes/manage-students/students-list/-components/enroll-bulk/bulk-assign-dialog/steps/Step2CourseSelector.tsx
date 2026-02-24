import { useState } from 'react';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { MagnifyingGlass, BookOpen } from '@phosphor-icons/react';
import { SelectedPackageSession } from '../../../../-types/bulk-assign-types';
import { cn } from '@/lib/utils';

interface Props {
    selectedPackageSessions: SelectedPackageSession[];
    onSelectedPackageSessionsChange: (sessions: SelectedPackageSession[]) => void;
}

export const Step2CourseSelector = ({
    selectedPackageSessions,
    onSelectedPackageSessionsChange,
}: Props) => {
    const [searchQuery, setSearchQuery] = useState('');
    const { getPackageWiseLevels } = useInstituteDetailsStore();

    const packageGroups = getPackageWiseLevels();

    const filtered = packageGroups
        .map((group) => ({
            ...group,
            level: group.level.filter((l) =>
                searchQuery
                    ? group.package_dto.package_name
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase()) ||
                      l.level_dto.level_name
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase())
                    : true
            ),
        }))
        .filter((g) => g.level.length > 0);

    const isSelected = (packageSessionId: string) =>
        selectedPackageSessions.some((s) => s.packageSessionId === packageSessionId);

    const toggle = (
        group: ReturnType<typeof getPackageWiseLevels>[number],
        levelEntry: ReturnType<typeof getPackageWiseLevels>[number]['level'][number]
    ) => {
        const psId = levelEntry.package_session_id;
        if (isSelected(psId)) {
            onSelectedPackageSessionsChange(
                selectedPackageSessions.filter((s) => s.packageSessionId !== psId)
            );
        } else {
            const newSession: SelectedPackageSession = {
                packageSessionId: psId,
                courseName: group.package_dto.package_name,
                sessionName: '', // resolved via store if needed
                levelName: levelEntry.level_dto.level_name,
                enrollInviteId: null,
                accessDays: null,
            };
            onSelectedPackageSessionsChange([...selectedPackageSessions, newSession]);
        }
    };

    return (
        <div className="flex flex-col gap-4 px-6 py-5">
            {/* Selection summary */}
            {selectedPackageSessions.length > 0 && (
                <div className="rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm text-primary-700">
                    <span className="font-semibold">{selectedPackageSessions.length}</span>{' '}
                    course{selectedPackageSessions.length !== 1 ? 's' : ''} selected — students
                    will be enrolled in all selected courses.
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <MagnifyingGlass
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search courses or levels…"
                    className="pl-9"
                />
            </div>

            {/* Course groups */}
            <div className="flex flex-col gap-3">
                {filtered.length === 0 && (
                    <p className="text-center text-sm text-neutral-400 py-8">
                        No courses found. Please add courses first.
                    </p>
                )}
                {filtered.map((group) => (
                    <div
                        key={group.package_dto.id}
                        className="rounded-lg border border-neutral-200 bg-white"
                    >
                        {/* Course header */}
                        <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3">
                            <BookOpen size={18} className="text-primary-500" weight="duotone" />
                            <span className="font-semibold text-neutral-800">
                                {group.package_dto.package_name}
                            </span>
                        </div>
                        {/* Level rows */}
                        <div className="flex flex-col divide-y divide-neutral-50">
                            {group.level.map((levelEntry) => {
                                const psId = levelEntry.package_session_id;
                                const selected = isSelected(psId);
                                return (
                                    <button
                                        key={psId}
                                        onClick={() => toggle(group, levelEntry)}
                                        className={cn(
                                            'flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-primary-50',
                                            selected && 'bg-primary-50'
                                        )}
                                    >
                                        <Checkbox
                                            checked={selected}
                                            onCheckedChange={() => toggle(group, levelEntry)}
                                            className="pointer-events-none"
                                        />
                                        <div className="flex-1">
                                            <span className="font-medium text-neutral-700">
                                                {levelEntry.level_dto.level_name}
                                            </span>
                                            {levelEntry.level_dto.duration_in_days && (
                                                <span className="ml-2 text-xs text-neutral-400">
                                                    • {levelEntry.level_dto.duration_in_days} days
                                                </span>
                                            )}
                                        </div>
                                        <span
                                            className={cn(
                                                'text-xs font-medium',
                                                selected
                                                    ? 'text-primary-600'
                                                    : 'text-neutral-400'
                                            )}
                                        >
                                            {selected ? '✓ Selected' : 'Select'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
