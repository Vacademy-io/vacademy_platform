/**
 * Check Lead — "is this phone / email already in the system?".
 *
 * A counsellor only sees the leads assigned to them, so searching a number a
 * colleague already owns finds nothing and they call it as a fresh lead. This
 * page answers for one exact phone or email without widening the lead list.
 *
 * It shows whatever the institute chose to share and nothing else; the backend
 * omits the rest entirely, so there is no hidden payload to read. ADMIN-role
 * users get every field — they aren't scoped out of lead data elsewhere either.
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MagnifyingGlass, Prohibit, CheckCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { Card, CardContent } from '@/components/ui/card';
import { useLeadSettings } from '@/hooks/use-lead-settings';
import { useLeadTerminology } from '@/hooks/use-lead-terminology';
import { getInstituteId } from '@/constants/helper';
import { LeadEmptyState } from '@/components/shared/leads';
import {
    lookupLead,
    splitLookupTerm,
    isLookupTermComplete,
    type LeadLookupResult,
} from '../-services/lead-lookup';

export function LeadLookupPage() {
    const { leadLookup, isLoading: settingsLoading } = useLeadSettings();
    const terminology = useLeadTerminology();
    const instituteId = getInstituteId() ?? '';
    const [term, setTerm] = useState('');
    const [result, setResult] = useState<LeadLookupResult | null>(null);

    const { mutate: search, isPending } = useMutation({
        mutationFn: () => lookupLead({ instituteId, ...splitLookupTerm(term) }),
        onSuccess: setResult,
        onError: () => toast.error('Could not check this lead — try again'),
    });

    const complete = isLookupTermComplete(term);
    const submit = () => {
        if (!complete || isPending) return;
        setResult(null);
        search();
    };

    if (settingsLoading) return null;
    if (!leadLookup.enabled) {
        return (
            <LeadEmptyState
                title="Check Lead is turned off"
                description="An admin can switch it on in Settings → Lead settings → Check Lead."
            />
        );
    }

    return (
        <div className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="text-h3 font-semibold text-neutral-700">Check Lead</h1>
                <p className="mt-1 text-body text-neutral-500">
                    Enter a full phone number or an email address to see whether this person is
                    already in the system before you call them.
                </p>
            </div>

            <div className="flex max-w-xl items-end gap-3">
                <div className="flex-1">
                    <MyInput
                        inputType="text"
                        input={term}
                        onChangeFunction={(e) => setTerm(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                submit();
                            }
                        }}
                        inputPlaceholder="9876543210 or name@example.com"
                        label="Phone or email"
                        className="w-full"
                    />
                </div>
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={submit}
                    disable={!complete || isPending}
                >
                    {isPending ? 'Checking…' : 'Check'}
                </MyButton>
            </div>
            {term.trim() && !complete && (
                <p className="-mt-3 text-caption text-neutral-500">
                    Enter the full number or a complete email — a partial number would match the
                    wrong person.
                </p>
            )}

            {result && !result.found && (
                <Card className="max-w-xl border-neutral-200">
                    <CardContent className="flex items-start gap-3 py-5">
                        <MagnifyingGlass className="mt-0.5 size-5 shrink-0 text-neutral-400" />
                        <div>
                            <p className="font-medium text-neutral-700">Not in the system</p>
                            <p className="text-body text-neutral-500">
                                No lead matches this{' '}
                                {splitLookupTerm(term).email ? 'email' : 'number'}.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {result?.found && (
                <Card className="max-w-xl border-primary-200">
                    <CardContent className="space-y-4 py-5">
                        <p className="flex items-center gap-2 font-medium text-primary-600">
                            <CheckCircle className="size-5 shrink-0" weight="fill" />
                            This lead is already in the system
                        </p>

                        {result.opted_out && (
                            <p className="flex items-center gap-2 rounded-md bg-danger-50 px-3 py-2 text-body text-danger-600">
                                <Prohibit className="size-4 shrink-0" weight="fill" />
                                This person has opted out — do not contact them.
                            </p>
                        )}

                        {/* design-lint-ignore arbitrary-grid-template — a label column
                            sized to its content next to a value column that takes the
                            rest is the point; grid-cols-2 would split it down the middle. */}
                        <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-[auto_1fr]">
                            <Row label="Name" value={result.lead_name} />
                            <Row label="Phone" value={result.lead_mobile} />
                            <Row label="Email" value={result.lead_email} />
                            <Row label="Counsellor" value={result.counsellor_name} />
                            <Row label={terminology.campaignType} value={result.campaign_type} />
                            <Row label={terminology.leadSource} value={result.campaign_name} />
                            <Row label={terminology.leadStatus} value={result.status} />
                            <Row label="Course" value={result.course} />
                        </dl>

                        <p className="text-caption text-neutral-400">
                            Other details of this lead are not shown.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

/** A field the institute didn't share is absent from the response — skip the row. */
function Row({ label, value }: { label: string; value?: string }) {
    if (!value) return null;
    return (
        <>
            <dt className="text-body text-neutral-500">{label}</dt>
            <dd className="text-body font-medium text-neutral-800">{value}</dd>
        </>
    );
}
