import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowClockwise, DownloadSimple, Eye, PaperPlaneTilt } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { MyTable, type TableData } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { Badge } from '@/components/ui/badge';
import {
    getCourseCertificateLearners,
    issueCourseCertificate,
    resendCourseCertificate,
    type CourseCertificateLearner,
} from '../../-services/course-certificates';

interface CertificateStudentTableProps {
    instituteId: string;
    packageSessionId: string;
    packageId: string;
    courseName?: string;
}

const PAGE_SIZE = 25;

const STATUS_LABEL: Record<CourseCertificateLearner['status'], string> = {
    GENERATED: 'Generated',
    AWAITING: 'Awaiting',
    PENDING: 'Pending',
};

const STATUS_VARIANT: Record<
    CourseCertificateLearner['status'],
    'default' | 'secondary' | 'outline'
> = {
    GENERATED: 'default',
    AWAITING: 'secondary',
    PENDING: 'outline',
};

export const CertificateStudentTable = ({
    instituteId,
    packageSessionId,
    packageId,
    courseName,
}: CertificateStudentTableProps) => {
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState('');
    const queryClient = useQueryClient();

    const {
        data: learnerPage,
        isLoading,
        error,
    } = useQuery({
        queryKey: ['course-certificate-learners', packageSessionId, search, page],
        queryFn: () =>
            getCourseCertificateLearners({
                instituteId,
                packageSessionId,
                packageId,
                search: search || undefined,
                page,
                size: PAGE_SIZE,
            }),
        enabled: !!packageSessionId && !!instituteId,
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['course-certificate-learners'] });
        queryClient.invalidateQueries({ queryKey: ['course-certificate-dashboard'] });
    };

    const issueMutation = useMutation({
        mutationFn: (vars: { userId: string; regenerate: boolean }) =>
            issueCourseCertificate({
                instituteId,
                packageSessionId,
                userId: vars.userId,
                regenerate: vars.regenerate,
                courseName,
            }),
        onSuccess: (_data, vars) => {
            toast.success(
                vars.regenerate ? 'Certificate regenerated' : 'Certificate generated',
                {
                    description: vars.regenerate
                        ? 'The certificate number is unchanged; the PDF has been replaced.'
                        : 'The learner has been emailed their certificate.',
                }
            );
            invalidate();
        },
        onError: () => {
            // The backend refuses when certificates are switched off for this
            // course, or the learner is below the threshold — say so rather than
            // showing a bare failure.
            toast.error('Could not generate certificate', {
                description:
                    'Check that certificates are enabled for this course and the learner is past the completion threshold.',
            });
        },
    });

    const resendMutation = useMutation({
        mutationFn: (certificateId: string) => resendCourseCertificate(instituteId, certificateId),
        onSuccess: () => toast.success('Certificate email sent'),
        onError: () => toast.error('Could not send the certificate email'),
    });

    const columns: ColumnDef<CourseCertificateLearner>[] = useMemo(
        () => [
            {
                accessorKey: 'full_name',
                header: 'Learner',
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="text-body text-neutral-700">
                            {row.original.full_name || '—'}
                        </span>
                        {row.original.email && (
                            <span className="text-caption text-neutral-400">
                                {row.original.email}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                accessorKey: 'completion_percentage',
                header: 'Completion',
                cell: ({ row }) => {
                    const pct = row.original.completion_percentage;
                    return (
                        <span className="text-body text-neutral-600">
                            {pct === null || pct === undefined ? '—' : `${Math.floor(pct)}%`}
                        </span>
                    );
                },
            },
            {
                accessorKey: 'status',
                header: 'Status',
                cell: ({ row }) => {
                    const status = row.original.status;
                    return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
                },
            },
            {
                accessorKey: 'issued_at',
                header: 'Generated On',
                cell: ({ row }) => {
                    const raw = row.original.issued_at;
                    return (
                        <span className="text-body text-neutral-600">
                            {raw ? new Date(raw).toLocaleDateString() : '—'}
                        </span>
                    );
                },
            },
            {
                accessorKey: 'certificate_number',
                header: 'Certificate Number',
                cell: ({ row }) => (
                    <span className="text-body text-neutral-600">
                        {row.original.certificate_number || '—'}
                    </span>
                ),
            },
            {
                id: 'actions',
                header: 'Actions',
                cell: ({ row }) => {
                    const learner = row.original;
                    const hasCertificate = !!learner.certificate_number;
                    const busy = issueMutation.isPending || resendMutation.isPending;

                    if (!hasCertificate) {
                        return (
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                type="button"
                                disable={busy}
                                onClick={() =>
                                    issueMutation.mutate({
                                        userId: learner.user_id,
                                        regenerate: false,
                                    })
                                }
                            >
                                Generate
                            </MyButton>
                        );
                    }

                    return (
                        <div className="flex items-center gap-2">
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                layoutVariant="icon"
                                type="button"
                                disable={!learner.file_id}
                                onClick={() =>
                                    learner.file_id &&
                                    window.open(learner.file_id, '_blank', 'noopener,noreferrer')
                                }
                            >
                                <Eye />
                            </MyButton>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                layoutVariant="icon"
                                type="button"
                                disable={!learner.file_id}
                                onClick={() => {
                                    if (!learner.file_id) return;
                                    const link = document.createElement('a');
                                    link.href = learner.file_id;
                                    link.download = `${learner.certificate_number ?? 'certificate'}.pdf`;
                                    link.click();
                                }}
                            >
                                <DownloadSimple />
                            </MyButton>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                layoutVariant="icon"
                                type="button"
                                disable={busy || !learner.certificate_number}
                                onClick={() =>
                                    learner.certificate_number &&
                                    resendMutation.mutate(learner.certificate_number)
                                }
                            >
                                <PaperPlaneTilt />
                            </MyButton>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                layoutVariant="icon"
                                type="button"
                                disable={busy}
                                onClick={() =>
                                    issueMutation.mutate({
                                        userId: learner.user_id,
                                        regenerate: true,
                                    })
                                }
                            >
                                <ArrowClockwise />
                            </MyButton>
                        </div>
                    );
                },
            },
        ],
        [issueMutation, resendMutation]
    );

    const tableData: TableData<CourseCertificateLearner> | undefined = useMemo(() => {
        if (!learnerPage) return undefined;
        return {
            content: learnerPage.content,
            total_pages: learnerPage.totalPages,
            page_no: learnerPage.pageNo,
            page_size: learnerPage.pageSize,
            total_elements: learnerPage.totalElements,
            last: learnerPage.last,
        };
    }, [learnerPage]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
                <MyInput
                    inputType="text"
                    input={search}
                    onChangeFunction={(e) => {
                        setSearch(e.target.value);
                        setPage(0);
                    }}
                    inputPlaceholder="Search by name, email or certificate number"
                    className="sm:w-96"
                />
                {tableData && (
                    <span className="text-caption text-neutral-500">
                        {tableData.total_elements} learner
                        {tableData.total_elements === 1 ? '' : 's'}
                    </span>
                )}
            </div>

            {!isLoading && tableData && tableData.content.length === 0 ? (
                <div className="py-8 text-center text-body text-neutral-500">
                    {search
                        ? 'No learners match your search.'
                        : 'No learners are enrolled in this batch yet.'}
                </div>
            ) : (
                <>
                    <MyTable<CourseCertificateLearner>
                        data={tableData}
                        columns={columns}
                        isLoading={isLoading}
                        error={error}
                        currentPage={page}
                        scrollable
                    />
                    {tableData && tableData.total_pages > 1 && (
                        <MyPagination
                            currentPage={page}
                            totalPages={tableData.total_pages}
                            onPageChange={setPage}
                        />
                    )}
                </>
            )}
        </div>
    );
};
