import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Warning, ArrowRight } from '@phosphor-icons/react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    fetchInvoiceNumberingState,
    previewInvoiceNumbering,
    type InvoiceNumberingConfig,
} from './invoice-settings-service';

const CONFIRM_WORD = 'CHANGE';

interface Props {
    open: boolean;
    /** The strategy about to be saved. */
    next: InvoiceNumberingConfig;
    /** True when the format uses learner/course values, or the reset window changed. */
    requiresTypedConfirmation: boolean;
    saving: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

/**
 * Shown before saving a changed invoice-number strategy, whenever the institute already has
 * invoices.
 *
 * <p>The change is non-destructive by design — old invoices keep their numbers and the
 * counter continues rather than restarting — so the default gate is a single acknowledgement
 * checkbox. Type-to-confirm is reserved for the genuinely risky cases (learner-based tokens,
 * or changing when the counter resets), because the admins using this screen are
 * non-technical and a friction wall on every edit just trains people to click through.
 */
export function InvoiceNumberingChangeDialog({
    open,
    next,
    requiresTypedConfirmation,
    saving,
    onCancel,
    onConfirm,
}: Props) {
    const [acknowledged, setAcknowledged] = useState(false);
    const [typed, setTyped] = useState('');

    const { data: state } = useQuery({
        queryKey: ['invoice-numbering-state'],
        queryFn: fetchInvoiceNumberingState,
        enabled: open,
    });

    const { data: preview } = useQuery({
        queryKey: ['invoice-numbering-change-preview', next],
        queryFn: () => previewInvoiceNumbering(next),
        enabled: open,
    });

    useEffect(() => {
        if (open) {
            setAcknowledged(false);
            setTyped('');
        }
    }, [open]);

    const canConfirm = useMemo(() => {
        if (!acknowledged) return false;
        if (requiresTypedConfirmation) return typed.trim().toUpperCase() === CONFIRM_WORD;
        return true;
    }, [acknowledged, requiresTypedConfirmation, typed]);

    const newExample = preview?.samples?.[0] ?? '—';
    const existingCount = state?.existingInvoiceCount ?? 0;

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Change invoice numbering?</DialogTitle>
                    <DialogDescription>
                        New invoices will use the new format from now on.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Before / after */}
                    <div className="flex items-center gap-3 rounded-md border border-neutral-200 p-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-caption text-neutral-500">Current</p>
                            <code className="block truncate font-mono text-body text-neutral-700">
                                {state?.currentExample || state?.currentFormat || '—'}
                            </code>
                        </div>
                        <ArrowRight className="size-4 shrink-0 text-neutral-400" />
                        <div className="min-w-0 flex-1">
                            <p className="text-caption text-neutral-500">New</p>
                            <code className="block truncate font-mono text-body text-primary-600">
                                {newExample}
                            </code>
                        </div>
                    </div>

                    <ul className="space-y-1.5 text-caption text-neutral-600">
                        <li>
                            <span className="font-medium text-neutral-800">
                                {existingCount.toLocaleString()} existing{' '}
                                {existingCount === 1 ? 'invoice' : 'invoices'}
                            </span>{' '}
                            keep their current numbers. Nothing is renumbered.
                        </li>
                        <li>
                            Numbering continues from{' '}
                            <span className="font-medium text-neutral-800">
                                #{preview?.nextSequence ?? state?.nextSequence ?? 1}
                            </span>{' '}
                            — no number is ever reused.
                        </li>
                    </ul>

                    {requiresTypedConfirmation && (
                        <div className="flex items-start gap-2 rounded-md border border-warning-200 bg-warning-50 p-3">
                            <Warning
                                className="mt-0.5 size-4 shrink-0 text-warning-600"
                                weight="fill"
                            />
                            <p className="text-caption text-warning-700">
                                This format produces numbers that are not strictly sequential.
                                Many tax authorities require invoice numbers to run in an
                                unbroken sequence — check with your accountant before saving.
                            </p>
                        </div>
                    )}

                    <div className="flex items-start gap-2">
                        <Checkbox
                            id="numbering-ack"
                            checked={acknowledged}
                            onCheckedChange={(checked) => setAcknowledged(checked === true)}
                        />
                        <Label
                            htmlFor="numbering-ack"
                            className="text-caption font-normal leading-snug text-neutral-600"
                        >
                            I understand that invoices created from now on will use the new
                            format.
                        </Label>
                    </div>

                    {requiresTypedConfirmation && (
                        <div className="space-y-1.5">
                            <Label htmlFor="numbering-confirm" className="text-caption">
                                Type <span className="font-mono font-medium">{CONFIRM_WORD}</span>{' '}
                                to confirm
                            </Label>
                            <Input
                                id="numbering-confirm"
                                value={typed}
                                autoComplete="off"
                                onChange={(e) => setTyped(e.target.value)}
                                placeholder={CONFIRM_WORD}
                            />
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onCancel} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={onConfirm} disabled={!canConfirm || saving}>
                        {saving ? 'Saving…' : 'Save numbering'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
