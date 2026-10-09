import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowsClockwise, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { getProductPage, syncProductPageCatalogue } from '../-services/product-pages-service';
import type { ProductPageResponse } from '../-types/product-page-types';
import {
    groupSkipsByReason,
    parseSyncResponse,
    syncSummaryLine,
    type CatalogueSyncResult,
} from '../-utils/catalogue-sync';

/**
 * "Sync all catalogue courses": one server call that adds every course version
 * published to the catalogue which this product page does not sell yet, so a
 * site-cart store page can check out anything the Courses page shows. The
 * server saves straight away; the caller re-seeds its rows from the result.
 */

interface CatalogueSyncPanelProps {
    productPageId: string;
    instituteId: string;
    /** The editor has unsaved changes. Syncing then would be overwritten by the next Save, so it waits. */
    isDirty?: boolean;
    /** The page as it is after the sync — from the response, or refetched when the response carried none. */
    onSynced?: (page: ProductPageResponse) => void;
    /** Tighter copy for the site settings card. */
    compact?: boolean;
}

const errorText = (e: unknown) => {
    const data = (e as { response?: { data?: { ex?: string; message?: string } } })?.response?.data;
    return data?.ex || data?.message || 'The sync did not finish. Please try again.';
};

export const CatalogueSyncPanel = ({
    productPageId,
    instituteId,
    isDirty = false,
    onSynced,
    compact = false,
}: CatalogueSyncPanelProps) => {
    const queryClient = useQueryClient();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deactivateMissing, setDeactivateMissing] = useState(true);
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<CatalogueSyncResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const blocked = isDirty || !productPageId || !instituteId;

    const run = async () => {
        setConfirmOpen(false);
        setRunning(true);
        setError(null);
        try {
            const parsed = parseSyncResponse(
                await syncProductPageCatalogue(productPageId, instituteId, { deactivateMissing })
            );
            const page = parsed.page ?? (await getProductPage(productPageId));
            setResult(parsed);
            onSynced?.(page);
            // Canvas previews and pickers that show this page's courses.
            queryClient.invalidateQueries({ queryKey: ['PP_OFFER_PREVIEW'] });
            queryClient.invalidateQueries({ queryKey: ['PRODUCT_PAGES_FOR_CATALOGUE', instituteId] });
        } catch (e) {
            setError(errorText(e));
        } finally {
            setRunning(false);
        }
    };

    const skippedByReason = result ? groupSkipsByReason(result.skipped) : [];

    return (
        <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-neutral-800">Catalogue courses</p>
                    <p className="mt-0.5 text-caption text-neutral-500">
                        {compact
                            ? 'Adds every course version on your Courses page that the store page does not sell yet.'
                            : 'Adds every course version published to your catalogue that this page does not sell yet, after the courses already here. Prices follow each course’s catalogue price, as on the Courses page. Saved at once.'}
                    </p>
                </div>
                <MyButton
                    buttonType="secondary"
                    scale="small"
                    disable={blocked || running}
                    onClick={() => setConfirmOpen(true)}
                >
                    <ArrowsClockwise className={cn('size-3.5', running && 'animate-spin')} />
                    {running ? 'Syncing…' : 'Sync all catalogue courses'}
                </MyButton>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-caption text-neutral-600">
                <Checkbox
                    checked={deactivateMissing}
                    onCheckedChange={(v) => setDeactivateMissing(v === true)}
                    disabled={running}
                />
                Also switch off courses that are no longer in the catalogue
            </label>

            {isDirty && (
                <p className="flex items-center gap-1.5 text-caption text-warning-600">
                    <WarningCircle className="size-3.5 shrink-0" />
                    Save your changes first. The sync updates this page on the server, and saving the unsaved edits
                    afterwards would undo it.
                </p>
            )}

            {error && (
                <p role="alert" className="flex items-center gap-1.5 text-caption text-danger-600">
                    <WarningCircle className="size-3.5 shrink-0" />
                    {error}
                </p>
            )}

            {result && !error && (
                <div className="space-y-2 rounded-md border border-success-200 bg-success-50 p-3" aria-live="polite">
                    <p className="flex items-center gap-1.5 text-caption font-semibold text-success-700">
                        <CheckCircle className="size-3.5 shrink-0" weight="fill" />
                        {syncSummaryLine(result)}
                    </p>
                    {skippedByReason.length > 0 && (
                        <div>
                            <p className="text-caption font-medium text-neutral-700">Not added:</p>
                            <ul className="ms-4 list-disc text-caption text-neutral-600">
                                {skippedByReason.map((s) => (
                                    <li key={s.reason}>
                                        {s.reason} — {s.count}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {result.warnings.length > 0 && (
                        <div className="rounded border border-warning-200 bg-warning-50 p-2">
                            {result.warnings.map((w) => (
                                <p key={w} className="flex items-start gap-1.5 text-caption text-warning-700">
                                    <WarningCircle className="mt-0.5 size-3.5 shrink-0" />
                                    {w}
                                </p>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Sync the catalogue into this product page?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Every course version published to your catalogue that this page does not sell yet is
                            added after the existing courses.
                            {deactivateMissing
                                ? ' Courses that are no longer in the catalogue are switched off.'
                                : ' Courses already here stay as they are.'}{' '}
                            This is saved straight away; you can still reorder or remove courses afterwards.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={run}>Sync now</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
