import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
    ArrowLeft,
    Eye,
    EyeSlash,
    NotePencil,
    ShieldWarning,
    UploadSimple,
} from '@phosphor-icons/react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { MyButton } from '@/components/design-system/button';
import { StatusChip } from '@/components/design-system/status-chips';
import type { StatusType } from '@/components/design-system/status-chips';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getPublisherListings, setListingStatus } from './-services/library-service';
import type { ListingStatus, PublisherListingRow } from './-types/library';
import { LibraryCover } from './-components/library/LibraryCover';
import { PublishListingDialog } from './-components/library/PublishListingDialog';

export const Route = createLazyFileRoute('/knowledge-base/publish')({
    component: PublishConsolePage,
});

const STATUS_META: Record<string, { label: string; tone: StatusType }> = {
    DRAFT: { label: 'Draft', tone: 'INFO' },
    PUBLISHED: { label: 'Published', tone: 'SUCCESS' },
    UNLISTED: { label: 'Withdrawn', tone: 'WARNING' },
};

/**
 * Prepare and publish the shared library.
 *
 * Only the publishing institute reaches this; everyone else gets the refusal
 * from the API rather than a hidden button, so the rule lives in one place.
 */
function PublishConsolePage() {
    const navigate = useNavigate();
    const { setNavHeading } = useNavHeadingStore();
    const [rows, setRows] = useState<PublisherListingRow[] | null>(null);
    const [forbidden, setForbidden] = useState(false);
    const [editing, setEditing] = useState<PublisherListingRow | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    useEffect(() => {
        setNavHeading('Publish to library');
    }, [setNavHeading]);

    const load = useCallback(() => {
        getPublisherListings()
            .then(setRows)
            .catch((error: unknown) => {
                if ((error as { response?: { status?: number } })?.response?.status === 403) {
                    setForbidden(true);
                }
                setRows([]);
            });
    }, []);

    useEffect(load, [load]);

    const changeStatus = async (row: PublisherListingRow, status: ListingStatus) => {
        setBusyId(row.knowledge_base_id);
        try {
            await setListingStatus(row.knowledge_base_id, status);
            toast.success(
                status === 'PUBLISHED'
                    ? 'Live in the library'
                    : status === 'UNLISTED'
                      ? 'Withdrawn. Institutes that already unlocked it keep their access.'
                      : 'Returned to draft'
            );
            load();
        } catch (error) {
            const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data
                ?.detail;
            toast.error(typeof detail === 'string' ? detail : 'Could not change the status');
        } finally {
            setBusyId(null);
        }
    };

    if (forbidden) {
        return (
            <LayoutContainer>
                <Card className="flex flex-col items-center gap-3 p-10 text-center">
                    <ShieldWarning className="size-7 text-warning-500" />
                    <p className="text-body text-neutral-600">
                        This institute cannot publish to the library
                    </p>
                    <p className="max-w-md text-caption text-neutral-500">
                        Libraries are published from one internal Vacademy institute.
                    </p>
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => navigate({ to: '/knowledge-base' })}
                    >
                        Back to Knowledge Base
                    </MyButton>
                </Card>
            </LayoutContainer>
        );
    }

    return (
        <LayoutContainer>
            <Helmet>
                <title>Publish to library</title>
            </Helmet>

            <div className="flex flex-col gap-5">
                <MyButton
                    buttonType="text"
                    scale="small"
                    className="self-start"
                    onClick={() => navigate({ to: '/knowledge-base' })}
                >
                    <ArrowLeft className="mr-1 size-4" />
                    Knowledge Base
                </MyButton>

                <div>
                    <p className="text-title font-semibold text-neutral-700">Publish to library</p>
                    <p className="mt-1 max-w-2xl text-body text-neutral-500">
                        Describe a knowledge base and publish it so every institute can unlock and
                        use it. Publishing makes it read-only to them — only this institute can keep
                        editing the material.
                    </p>
                </div>

                {rows === null && <Skeleton className="h-56 w-full rounded-xl" />}

                {rows?.length === 0 && !forbidden && (
                    <Card className="flex flex-col items-center gap-2 p-10 text-center">
                        <UploadSimple className="size-7 text-neutral-300" />
                        <p className="text-body text-neutral-600">
                            No knowledge bases in this institute yet
                        </p>
                        <p className="text-caption text-neutral-400">
                            Create one and add its material first, then come back to describe it.
                        </p>
                    </Card>
                )}

                {rows && rows.length > 0 && (
                    <Card className="overflow-hidden">
                        {rows.map((row) => {
                            const described = Boolean(row.status);
                            const meta = row.status ? STATUS_META[row.status] : null;
                            const busy = busyId === row.knowledge_base_id;
                            return (
                                <div
                                    key={row.knowledge_base_id}
                                    className="flex flex-col gap-3 border-b border-neutral-100 p-4 last:border-b-0 sm:flex-row sm:items-center"
                                >
                                    <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-neutral-100">
                                        <LibraryCover
                                            fileId={row.cover_file_id}
                                            alt={row.cover_alt}
                                            title={row.title || row.kb_name}
                                        />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p className="break-words text-body font-medium text-neutral-700">
                                            {row.title || row.kb_name}
                                        </p>
                                        <p className="break-words text-caption text-neutral-500">
                                            {row.summary || (
                                                <span className="text-neutral-400">
                                                    Not described yet
                                                </span>
                                            )}
                                        </p>
                                        <p className="mt-1 flex flex-wrap gap-x-2 text-caption text-neutral-400">
                                            {[row.subject, row.level, row.board]
                                                .filter(Boolean)
                                                .map((chip) => (
                                                    <span key={chip as string}>{chip}</span>
                                                ))}
                                        </p>
                                    </div>

                                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                                        {meta && (
                                            <StatusChip
                                                status={meta.tone}
                                                text={meta.label}
                                                textSize="text-caption"
                                                showIcon={false}
                                            />
                                        )}
                                        <MyButton
                                            buttonType="secondary"
                                            scale="small"
                                            disable={busy}
                                            onClick={() => setEditing(row)}
                                        >
                                            <NotePencil className="mr-1 size-3.5" />
                                            {described ? 'Edit' : 'Describe'}
                                        </MyButton>

                                        {described && row.status !== 'PUBLISHED' && (
                                            <MyButton
                                                buttonType="primary"
                                                scale="small"
                                                disable={busy}
                                                onClick={() => changeStatus(row, 'PUBLISHED')}
                                            >
                                                <Eye className="mr-1 size-3.5" />
                                                Publish
                                            </MyButton>
                                        )}
                                        {row.status === 'PUBLISHED' && (
                                            <MyButton
                                                buttonType="secondary"
                                                scale="small"
                                                disable={busy}
                                                onClick={() => changeStatus(row, 'UNLISTED')}
                                            >
                                                <EyeSlash className="mr-1 size-3.5" />
                                                Withdraw
                                            </MyButton>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </Card>
                )}

                {rows && rows.length > 0 && (
                    <p className="text-caption text-neutral-400">
                        Withdrawing a library removes it from the catalogue but never revokes access
                        an institute has already paid for.
                    </p>
                )}
            </div>

            <PublishListingDialog
                row={editing}
                open={Boolean(editing)}
                onOpenChange={(next: boolean) => !next && setEditing(null)}
                onSaved={load}
            />
        </LayoutContainer>
    );
}
