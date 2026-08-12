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
    /**
     * Whether certificates are switched on for this course. When false the
     * issuing actions are disabled — the backend refuses them anyway, and
     * offering a Generate button directly under a "certificates are turned off"
     * banner just invites a confusing error.
     */
    certificatesEnabled: boolean;
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
    certificatesEnabled,
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

    /**
     * Save the certificate PDF under its certificate number.
     *
     * <p>The naive `a.download = name; a.click()` does not work here: the file is
     * served from S3, and browsers ignore the `download` attribute cross-origin —
     * the PDF opens in a tab under a random name instead of saving. An anchor
     * that is never appended to the DOM is also ignored by some browsers. So
     * fetch the bytes and download from a same-origin blob URL, falling back to
     * opening the file if the fetch is blocked (e.g. by CORS).
     */
    const downloadCertificate = async (learner: CourseCertificateLearner) => {
        if (!learner.file_id) return;
        const fileName = `${learner.certificate_number ?? 'certificate'}.pdf`;
        try {
            const response = await fetch(learner.file_id);
            if (!response.ok) throw new Error(String(response.status));
            const blobUrl = URL.createObjectURL(await response.blob());
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
        } catch {
            window.open(learner.file_id, '_blank', 'noopener,noreferrer');
            toast.info('Opened the certificate in a new tab', {
                description: 'Your browser blocked the direct download — save it from there.',
            });
        }
    };

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
                    // Generate / Regenerate / Resend all issue or re-issue, so
                    // they follow the course's enable state. Preview and
                    // Download only read an already-issued file and stay live.
                    const issuingBlocked = busy || !certificatesEnabled;

                    if (!hasCertificate) {
                        return (
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                type="button"
                                disable={issuingBlocked}
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
                                onClick={() => void downloadCertificate(learner)}
                            >
                                <DownloadSimple />
                            </MyButton>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                layoutVariant="icon"
                                type="button"
                                disable={issuingBlocked || !learner.certificate_number}
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
                                disable={issuingBlocked}
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
        [issueMutation, resendMutation, certificatesEnabled]
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
