// Bulk Content Uploading — step 4: results summary + retry-failed-only.

import { useMemo } from 'react';
import { ArrowCounterClockwise, CheckCircle, MinusCircle, XCircle } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { useBulkContentUploadingStore } from '../use-bulk-content-uploading-store';

interface ResultsStepProps {
    onRetryFailed: () => void;
}

export const ResultsStep = ({ onRetryFailed }: ResultsStepProps) => {
    const items = useBulkContentUploadingStore((state) => state.items);
    const nodes = useBulkContentUploadingStore((state) => state.nodes);
    const courseSections = useBulkContentUploadingStore((state) => state.courseSections);
    const resetForNewZip = useBulkContentUploadingStore((state) => state.resetForNewZip);

    const summary = useMemo(() => {
        const all = Object.values(items);
        return {
            done: all.filter((i) => i.status === 'done').length,
            skipped: all.filter((i) => i.status === 'skipped').length,
            failed: all.filter((i) => i.status === 'failed' || i.status === 'blocked'),
        };
    }, [items]);

    const chapterName = (chapterNodeId: string) => {
        const node = nodes[chapterNodeId];
        const chapter = node?.displayName ?? '';
        const courseName = node?.sectionId
            ? courseSections[node.sectionId]?.courseName ??
              courseSections[node.sectionId]?.topFolderDisplay
            : undefined;
        return courseName ? `${chapter} · ${courseName}` : chapter;
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-lg border border-success-200 bg-success-50 px-4 py-3">
                    <CheckCircle className="size-6 text-success-600" />
                    <div>
                        <p className="text-h3 font-semibold text-success-700">{summary.done}</p>
                        <p className="text-caption text-success-700">
                            {getTerminologyPlural(
                                ContentTerms.Slide,
                                SystemTerms.Slide
                            ).toLowerCase()}{' '}
                            created
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                    <MinusCircle className="size-6 text-neutral-500" />
                    <div>
                        <p className="text-h3 font-semibold text-neutral-600">{summary.skipped}</p>
                        <p className="text-caption text-neutral-500">skipped</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3">
                    <XCircle className="size-6 text-danger-600" />
                    <div>
                        <p className="text-h3 font-semibold text-danger-700">
                            {summary.failed.length}
                        </p>
                        <p className="text-caption text-danger-700">failed</p>
                    </div>
                </div>
            </div>

            {summary.failed.length > 0 && (
                <div className="rounded-lg border border-neutral-200 bg-white">
                    <div className="border-b border-neutral-100 px-4 py-2 text-subtitle font-semibold text-neutral-700">
                        Failed items
                    </div>
                    <ul className="max-h-60 divide-y divide-neutral-100 overflow-y-auto">
                        {summary.failed.map((item) => (
                            <li key={item.id} className="px-4 py-2">
                                <p className="text-subtitle text-neutral-700">
                                    {item.title}
                                    <span className="ml-2 text-caption text-neutral-400">
                                        in {chapterName(item.chapterNodeId)}
                                    </span>
                                </p>
                                {item.error && (
                                    <p className="text-caption text-danger-600">{item.error}</p>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="flex items-center justify-between">
                <MyButton buttonType="secondary" onClick={resetForNewZip}>
                    Upload another zip
                </MyButton>
                {summary.failed.length > 0 && (
                    <MyButton buttonType="primary" onClick={onRetryFailed}>
                        <ArrowCounterClockwise className="size-4" />
                        Retry failed only
                    </MyButton>
                )}
            </div>
        </div>
    );
};
