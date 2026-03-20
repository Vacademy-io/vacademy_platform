import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getPipelineUsersQuery } from '../-services/pipeline-services';
import type { PipelineStage, PipelineUser } from '../-types/pipeline-types';

const STAGE_CONFIG: Record<
    PipelineStage,
    { label: string; badgeColor: string; badgeBg: string; dateKey: keyof PipelineUser }
> = {
    ENQUIRY: {
        label: 'Enquiry',
        badgeColor: 'text-amber-700',
        badgeBg: 'bg-amber-100',
        dateKey: 'enquiry_date',
    },
    APPLICATION: {
        label: 'Application',
        badgeColor: 'text-blue-700',
        badgeBg: 'bg-blue-100',
        dateKey: 'application_date',
    },
    ADMITTED: {
        label: 'Admitted',
        badgeColor: 'text-green-700',
        badgeBg: 'bg-green-100',
        dateKey: 'admission_date',
    },
};

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(date);
}

interface PipelineUsersTableProps {
    instituteId: string | undefined;
    packageSessionId?: string;
}

export default function PipelineUsersTable({
    instituteId,
    packageSessionId,
}: PipelineUsersTableProps) {
    const [activeStage, setActiveStage] = useState<PipelineStage>('ENQUIRY');
    const [pageNo, setPageNo] = useState(0);
    const pageSize = 10;

    const { data, isLoading } = useQuery(
        getPipelineUsersQuery(instituteId, activeStage, pageNo, pageSize, packageSessionId)
    );

    const handleStageChange = (stage: string) => {
        setActiveStage(stage as PipelineStage);
        setPageNo(0);
    };

    const users = data?.content ?? [];
    const totalPages = data?.totalPages ?? 0;
    const totalElements = data?.totalElements ?? 0;
    const config = STAGE_CONFIG[activeStage];

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Students by Stage
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs value={activeStage} onValueChange={handleStageChange}>
                    <TabsList className="mb-4">
                        {(Object.keys(STAGE_CONFIG) as PipelineStage[]).map((stage) => (
                            <TabsTrigger key={stage} value={stage}>
                                {STAGE_CONFIG[stage].label}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {(Object.keys(STAGE_CONFIG) as PipelineStage[]).map((stage) => (
                        <TabsContent key={stage} value={stage}>
                            {isLoading ? (
                                <TableSkeleton />
                            ) : users.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                    <div className="text-4xl mb-2">-</div>
                                    <p className="text-sm">
                                        No students at {STAGE_CONFIG[stage].label.toLowerCase()} stage
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="overflow-hidden rounded-lg border">
                                        <table className="w-full text-left text-sm">
                                            <thead className="border-b bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 font-semibold text-gray-600 w-12">
                                                        #
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold text-gray-600">
                                                        Student Name
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold text-gray-600">
                                                        Parent Name
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold text-gray-600">
                                                        Source
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold text-gray-600">
                                                        Date
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold text-gray-600">
                                                        Stage
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {users.map((user, idx) => {
                                                    const cfg = STAGE_CONFIG[user.current_stage] ?? config;
                                                    const dateVal = user[cfg.dateKey] as string | null;
                                                    return (
                                                        <tr
                                                            key={user.pipeline_id}
                                                            className="hover:bg-gray-50 transition-colors"
                                                        >
                                                            <td className="px-4 py-3 text-gray-500">
                                                                {pageNo * pageSize + idx + 1}
                                                            </td>
                                                            <td className="px-4 py-3 font-medium text-gray-900">
                                                                {user.student_name || '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-600">
                                                                {user.parent_name || '-'}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                                                                    {user.source_type}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-600">
                                                                {formatDate(dateVal)}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span
                                                                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.badgeColor} ${cfg.badgeBg}`}
                                                                >
                                                                    {cfg.label}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination */}
                                    <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
                                        <span>
                                            Showing {pageNo * pageSize + 1}–
                                            {Math.min((pageNo + 1) * pageSize, totalElements)} of{' '}
                                            {totalElements}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setPageNo((p) => Math.max(0, p - 1))}
                                                disabled={pageNo === 0}
                                                className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                <ChevronLeft className="size-4" /> Previous
                                            </button>
                                            <span className="text-xs text-gray-400">
                                                Page {pageNo + 1} of {totalPages}
                                            </span>
                                            <button
                                                onClick={() => setPageNo((p) => p + 1)}
                                                disabled={pageNo + 1 >= totalPages}
                                                className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                Next <ChevronRight className="size-4" />
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </TabsContent>
                    ))}
                </Tabs>
            </CardContent>
        </Card>
    );
}

function TableSkeleton() {
    return (
        <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-4 animate-pulse">
                    <div className="h-8 w-8 rounded bg-gray-200" />
                    <div className="h-8 flex-1 rounded bg-gray-200" />
                    <div className="h-8 w-32 rounded bg-gray-200" />
                    <div className="h-8 w-24 rounded bg-gray-200" />
                    <div className="h-8 w-28 rounded bg-gray-200" />
                    <div className="h-8 w-20 rounded bg-gray-200" />
                </div>
            ))}
        </div>
    );
}
