import { CaretDown, Info } from 'phosphor-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    useCopyContentLineage,
    type CopyContentBatchRef,
    type CopyContentMode,
} from '@/services/study-library/course-operations/copy-content-lineage';

/**
 * (i) icon in the course structure header that exposes the batch's
 * content-copy lineage:
 *  - if this batch was seeded from another, show "Copied from <X>" + mode;
 *  - if other batches were seeded from this one, list them with each mode.
 *
 * Renders nothing when there is no lineage either way — there's no signal
 * worth surfacing for a vanilla, hand-built batch.
 */
export const CopyContentLineageBadge = ({
    packageSessionId,
}: {
    packageSessionId: string | null | undefined;
}) => {
    const { data, isLoading } = useCopyContentLineage(packageSessionId);

    if (!packageSessionId || isLoading || !data) return null;

    const hasUpstream = !!data.copiedFrom;
    const hasDownstream = (data.copiedTo?.length ?? 0) > 0;
    if (!hasUpstream && !hasDownstream) return null;

    // Pick a label that hints at the contents without forcing the user to open
    // the popover — "Copy history" is the catch-all when both directions apply.
    const triggerLabel = hasUpstream && hasDownstream
        ? 'Copy history'
        : hasUpstream
            ? 'Copied content'
            : `Used by ${data.copiedTo.length} batch${data.copiedTo.length === 1 ? '' : 'es'}`;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label="Show copy history"
                    className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 transition-colors hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                    <Info size={13} weight="fill" />
                    <span>{triggerLabel}</span>
                    <CaretDown size={10} weight="bold" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[340px] p-0 text-sm"
                align="start"
                sideOffset={6}
            >
                <div className="border-b bg-blue-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-blue-700">
                    Copy history
                </div>
                <div className="flex flex-col gap-3 px-4 py-3">
                    {hasUpstream && data.copiedFrom && (
                        <UpstreamSection
                            source={data.copiedFrom}
                            mode={data.copiedBy as CopyContentMode | null}
                        />
                    )}
                    {hasDownstream && (
                        <DownstreamSection refs={data.copiedTo} />
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
};

const UpstreamSection = ({
    source,
    mode,
}: {
    source: CopyContentBatchRef;
    mode: CopyContentMode | null;
}) => (
    <section>
        <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Content was brought in from
        </div>
        <div className="mt-1 text-sm text-neutral-800">{batchLabel(source)}</div>
        {mode && (
            <div className="mt-0.5 text-xs">
                <ModeChip mode={mode} />
            </div>
        )}
    </section>
);

const DownstreamSection = ({ refs }: { refs: CopyContentBatchRef[] }) => (
    <section>
        <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Used as source by{' '}
            <span className="text-neutral-700">
                {refs.length} batch{refs.length === 1 ? '' : 'es'}
            </span>
        </div>
        <ul className="mt-1 flex max-h-44 flex-col gap-1.5 overflow-y-auto">
            {refs.map((ref) => (
                <li
                    key={ref.packageSessionId}
                    className="flex flex-col rounded border border-neutral-200 bg-neutral-50 px-2 py-1.5"
                >
                    <span className="text-sm text-neutral-800">{batchLabel(ref)}</span>
                    {ref.copiedBy && (
                        <span className="mt-0.5 text-xs">
                            <ModeChip mode={ref.copiedBy} />
                        </span>
                    )}
                </li>
            ))}
        </ul>
    </section>
);

const ModeChip = ({ mode }: { mode: CopyContentMode }) => {
    const isReference = mode === 'REFERENCE';
    return (
        <span
            className={[
                'inline-block rounded-full px-2 py-0.5 text-[11px] font-medium',
                isReference
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-blue-100 text-blue-800',
            ].join(' ')}
        >
            {isReference ? 'Linked copy' : 'Separate copy'}
        </span>
    );
};

const batchLabel = (ref: CopyContentBatchRef) => {
    const parts = [ref.courseName, ref.sessionName, ref.levelName].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : 'Unknown batch';
};
