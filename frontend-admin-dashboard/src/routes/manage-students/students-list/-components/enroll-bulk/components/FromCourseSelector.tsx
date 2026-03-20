import { useState } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { MyButton } from '@/components/design-system/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_STUDENTS } from '@/constants/urls';
import { SelectedLearner } from '../../../-types/bulk-assign-types';
import { toast } from 'sonner';

interface Props {
    instituteId: string;
    selectedLearners: SelectedLearner[];
    onAdd: (learners: SelectedLearner[]) => void;
}

interface StudentRow {
    user_id: string;
    username: string;
    email: string;
    name?: string;
}

export const FromCourseSelector = ({ instituteId, selectedLearners, onAdd }: Props) => {
    const { getPackageWiseLevels } = useInstituteDetailsStore();
    const packageGroups = getPackageWiseLevels();

    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [selectedPackageSessionId, setSelectedPackageSessionId] = useState('');
    const [statusFilter, setStatusFilter] = useState('ACTIVE');
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

    const levels =
        packageGroups.find((g) => g.package_dto.id === selectedCourseId)?.level ?? [];

    const handleSearch = async () => {
        if (!selectedPackageSessionId) {
            toast.error('Please select a course level first');
            return;
        }
        setLoading(true);
        try {
            const response = await authenticatedAxiosInstance.post(
                `${GET_STUDENTS}?instituteId=${instituteId}`,
                {
                    package_session_ids: [selectedPackageSessionId],
                    statuses: [statusFilter],
                },
                { params: { pageNo: 0, pageSize: 500 } }
            );
            const content = response.data?.content ?? [];
            setStudents(
                content.map((s: any) => ({
                    user_id: s.user_id,
                    username: s.username,
                    email: s.email,
                    name: s.name || s.username,
                }))
            );
            setCheckedIds(new Set());
        } catch {
            toast.error('Failed to load students from course');
        } finally {
            setLoading(false);
        }
    };

    const toggleCheck = (id: string) => {
        setCheckedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (checkedIds.size === students.length) {
            setCheckedIds(new Set());
        } else {
            setCheckedIds(new Set(students.map((s) => s.user_id)));
        }
    };

    const handleAdd = () => {
        const alreadySelected = new Set(
            selectedLearners
                .filter((l) => l.type === 'existing')
                .map((l) => (l as Extract<SelectedLearner, { type: 'existing' }>).userId)
        );

        const toAdd: SelectedLearner[] = students
            .filter((s) => checkedIds.has(s.user_id) && !alreadySelected.has(s.user_id))
            .map((s) => ({
                type: 'existing' as const,
                userId: s.user_id,
                email: s.email,
                name: s.name || s.username,
            }));

        if (toAdd.length === 0) {
            toast.info('All selected students are already in your list');
            return;
        }
        onAdd(toAdd);
        toast.success(`Added ${toAdd.length} student${toAdd.length !== 1 ? 's' : ''}`);
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Source course picker */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <Label className="mb-1 text-xs text-neutral-500">Source Course</Label>
                    <Select
                        value={selectedCourseId}
                        onValueChange={(v) => {
                            setSelectedCourseId(v);
                            setSelectedPackageSessionId('');
                            setStudents([]);
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select course" />
                        </SelectTrigger>
                        <SelectContent>
                            {packageGroups.map((g) => (
                                <SelectItem key={g.package_dto.id} value={g.package_dto.id}>
                                    {g.package_dto.package_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label className="mb-1 text-xs text-neutral-500">Level</Label>
                    <Select
                        value={selectedPackageSessionId}
                        onValueChange={(v) => {
                            setSelectedPackageSessionId(v);
                            setStudents([]);
                        }}
                        disabled={!selectedCourseId}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                            {levels.map((l) => (
                                <SelectItem
                                    key={l.package_session_id}
                                    value={l.package_session_id}
                                >
                                    {l.level_dto.level_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label className="mb-1 text-xs text-neutral-500">Status filter</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ACTIVE">Active</SelectItem>
                            <SelectItem value="INACTIVE">Inactive</SelectItem>
                            <SelectItem value="INVITED">Invited</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-end">
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        layoutVariant="default"
                        onClick={handleSearch}
                        disable={!selectedPackageSessionId || loading}
                    >
                        {loading ? 'Loading…' : 'Load Students'}
                    </MyButton>
                </div>
            </div>

            {/* Student list */}
            {students.length > 0 && (
                <div className="rounded-lg border border-neutral-200 bg-white">
                    <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-2">
                        <Checkbox
                            checked={checkedIds.size === students.length}
                            onCheckedChange={toggleAll}
                        />
                        <span className="text-xs font-semibold text-neutral-500">
                            {checkedIds.size}/{students.length} selected
                        </span>
                        {checkedIds.size > 0 && (
                            <MyButton
                                buttonType="primary"
                                scale="small"
                                layoutVariant="default"
                                onClick={handleAdd}
                            >
                                Add {checkedIds.size} student{checkedIds.size !== 1 ? 's' : ''}
                            </MyButton>
                        )}
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y divide-neutral-50">
                        {students.map((s) => (
                            <button
                                key={s.user_id}
                                onClick={() => toggleCheck(s.user_id)}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-neutral-50"
                            >
                                <Checkbox
                                    checked={checkedIds.has(s.user_id)}
                                    onCheckedChange={() => toggleCheck(s.user_id)}
                                    className="pointer-events-none"
                                />
                                <div>
                                    <p className="font-medium text-neutral-800">
                                        {s.name || s.username}
                                    </p>
                                    <p className="text-xs text-neutral-400">{s.email}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {students.length === 0 && !loading && selectedPackageSessionId && (
                <p className="text-center text-sm text-neutral-400 py-6">
                    No students found. Click "Load Students" to search.
                </p>
            )}
        </div>
    );
};
