import { useEffect, useMemo, useState } from 'react';
import {
    fetchBatchLearners,
    fetchIndividualParticipants,
    BatchLearnerItem,
} from '../-services/offline-entry-services';
import { useBatchNames } from '@/routes/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab/-components/survey/hooks/useBatchNames';
import { MyPagination } from '@/components/design-system/pagination';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardLoader } from '@/components/core/dashboard-loader';

export interface StudentRow {
    id: string;
    name: string;
    email: string;
    username: string;
    mobileNumber: string;
    batchName: string;
    batchId: string;
    status: string;
    score: number | null;
    registrationId: string | null;
    userId: string;
    source: 'batch' | 'individual';
}

interface StudentSelectorProps {
    assessmentId: string;
    assessmentType: string;
    instituteId: string;
    packageSessionIds: string[];
    onSelect: (student: StudentRow) => void;
}

const PAGE_SIZE = 10;

export const StudentSelector = ({
    assessmentId,
    assessmentType,
    instituteId,
    packageSessionIds,
    onSelect,
}: StudentSelectorProps) => {
    const { getBatchName } = useBatchNames();

    const [activeTab, setActiveTab] = useState<'batch' | 'individual'>('batch');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [students, setStudents] = useState<StudentRow[]>([]);

    const loadBatchLearners = async () => {
        setIsLoading(true);
        try {
            if (packageSessionIds.length === 0) {
                setStudents([]);
                return;
            }
            const data = await fetchBatchLearners(instituteId, packageSessionIds, 0, 1000);
            const rows: StudentRow[] = (data?.content ?? []).map((l: BatchLearnerItem) => ({
                id: l.user_id,
                name: l.full_name,
                email: l.email,
                username: l.username,
                mobileNumber: l.phone_number,
                batchName: getBatchName(l.package_session_id),
                batchId: l.package_session_id,
                status: 'Registered',
                score: null,
                registrationId: null,
                userId: l.user_id,
                source: 'batch' as const,
            }));
            setStudents(rows);
        } catch (error) {
            console.error('Failed to fetch batch learners:', error);
            setStudents([]);
        } finally {
            setIsLoading(false);
        }
    };

    const loadIndividualParticipants = async () => {
        setIsLoading(true);
        try {
            const data = await fetchIndividualParticipants(assessmentId, instituteId, assessmentType);
            const rows: StudentRow[] = (data?.content ?? []).map((p) => ({
                id: p.registration_id,
                name: p.student_name,
                email: '',
                username: '',
                mobileNumber: '',
                batchName: getBatchName(p.batch_id),
                batchId: p.batch_id,
                status: p.attempt_id ? 'Attempted' : 'Pending',
                score: p.score,
                registrationId: p.registration_id,
                userId: p.user_id,
                source: 'individual' as const,
            }));
            setStudents(rows);
        } catch (error) {
            console.error('Failed to fetch individual participants:', error);
            setStudents([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'batch') {
            loadBatchLearners();
        } else {
            loadIndividualParticipants();
        }
    }, [activeTab, assessmentId]);

    const filteredStudents = useMemo(() => {
        if (!searchTerm) return students;
        const lower = searchTerm.toLowerCase();
        return students.filter((s) => s.name?.toLowerCase().includes(lower));
    }, [students, searchTerm]);

    const totalPages = Math.ceil(filteredStudents.length / PAGE_SIZE);
    const paginatedStudents = filteredStudents.slice(
        currentPage * PAGE_SIZE,
        (currentPage + 1) * PAGE_SIZE
    );

    return (
        <div className="flex flex-col gap-4">
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'batch' | 'individual'); setSearchTerm(''); setCurrentPage(0); }}>
                <TabsList className="inline-flex h-auto justify-start gap-0 rounded-none border-b !bg-transparent p-0">
                    <TabsTrigger
                        value="batch"
                        className={`rounded-none px-8 py-2 !shadow-none ${
                            activeTab === 'batch'
                                ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                : 'border-none bg-transparent'
                        }`}
                    >
                        <span className={activeTab === 'batch' ? 'text-primary-500' : ''}>
                            Batch Selection
                        </span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="individual"
                        className={`rounded-none px-8 py-2 !shadow-none ${
                            activeTab === 'individual'
                                ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                : 'border-none bg-transparent'
                        }`}
                    >
                        <span className={activeTab === 'individual' ? 'text-primary-500' : ''}>
                            Individual Selection
                        </span>
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                    {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
                    <span className="ml-2 text-xs text-gray-400">Click a row to start data entry</span>
                </p>
                <input
                    type="text"
                    placeholder="Search by name..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(0); }}
                    className="w-64 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                />
            </div>

            {isLoading ? (
                <DashboardLoader />
            ) : (
                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b bg-gray-50 text-xs font-medium uppercase text-gray-500">
                            <tr>
                                <th className="px-4 py-3">Student Name</th>
                                <th className="px-4 py-3">Batch</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Score</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {paginatedStudents.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                                        No students found
                                    </td>
                                </tr>
                            )}
                            {paginatedStudents.map((student) => (
                                <tr
                                    key={student.id}
                                    onClick={() => onSelect(student)}
                                    className="cursor-pointer transition-colors hover:bg-primary-50"
                                >
                                    <td className="px-4 py-3 font-medium">{student.name}</td>
                                    <td className="px-4 py-3 text-gray-600">{student.batchName}</td>
                                    <td className="px-4 py-3">
                                        {student.status === 'Attempted' ? (
                                            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
                                                Attempted
                                            </span>
                                        ) : (
                                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                                                {student.status}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {student.score != null ? student.score : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {totalPages > 1 && (
                <MyPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            )}
        </div>
    );
};
