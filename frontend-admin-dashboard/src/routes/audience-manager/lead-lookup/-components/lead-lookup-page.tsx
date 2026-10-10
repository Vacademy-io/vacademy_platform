/**
 * Check Lead — "is this person already in the system?".
 *
 * A counsellor only sees the leads assigned to them, so searching a number a
 * colleague already owns finds nothing and they call it as a fresh lead. This
 * page answers for one exact phone, email or name without widening the lead list.
 *
 * The three are separate modes rather than one guess-what-you-typed box: a name
 * and a badly typed email are indistinguishable, and the hint under the box has
 * to say what "complete" means for the thing actually being searched.
 *
 * Phone and email are open to everyone — a counsellor about to dial someone
 * already has those.
 *
 * Full name is COUNSELLOR-ONLY, and only where the institute switched it on. An
 * admin already sees every lead in the leads list, with a real name search and
 * filters; this page exists for the person who cannot. Offering an admin a
 * cut-down one-answer-at-a-time version of something they already have in full
 * is just a worse route to the same data.
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
import { MyDropdown } from '@/components/design-system/dropdown';
import PhoneNumberInput from '@/components/design-system/phone-number-input';
import { Card, CardContent } from '@/components/ui/card';
import { useLeadSettings } from '@/hooks/use-lead-settings';
import { useLeadTerminology } from '@/hooks/use-lead-terminology';
import { getInstituteId } from '@/constants/helper';
import { isAdminForInstitute } from '@/lib/auth/roleUtils';
import { LeadEmptyState } from '@/components/shared/leads';
import {
    guessLookupMode,
    lookupLead,
    lookupParamsFor,
    isTermCompleteFor,
    LOOKUP_MODE_COPY,
    type LeadLookupResult,
    type LookupMode,
} from '../-services/lead-lookup';

export function LeadLookupPage() {
    const { leadLookup, isLoading: settingsLoading } = useLeadSettings();
    const terminology = useLeadTerminology();
    const instituteId = getInstituteId() ?? '';
    const [mode, setMode] = useState<LookupMode>('phone');
    const [term, setTerm] = useState('');
    const [result, setResult] = useState<LeadLookupResult | null>(null);

    const { mutate: search, isPending } = useMutation({
        mutationFn: () => lookupLead({ instituteId, ...lookupParamsFor(mode, term) }),
        onSuccess: setResult,
        onError: () => toast.error('Could not check this lead — try again'),
    });

    const complete = isTermCompleteFor(mode, term);
    const copy = LOOKUP_MODE_COPY[mode];
    const submit = () => {
        if (!complete || isPending) return;
        setResult(null);
        search();
    };

    // Phone and email are always on. Name only for a counsellor, and only where
    // the institute enabled it — the backend enforces the same rule, this just
    // avoids showing an option that would be refused.
    const canSearchByName = leadLookup.searchByName && !isAdminForInstitute(instituteId);
    const modes: { label: string; value: LookupMode }[] = [
        { label: LOOKUP_MODE_COPY.phone.label, value: 'phone' },
        { label: LOOKUP_MODE_COPY.email.label, value: 'email' },
        ...(canSearchByName
            ? [{ label: LOOKUP_MODE_COPY.name.label, value: 'name' as LookupMode }]
            : []),
    ];
    const changeMode = (label: string) => {
        const next = modes.find((m) => m.label === label);
        if (!next || next.value === mode) return;
        setMode(next.value);
        setTerm('');
        setResult(null);
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
                    Pick what you are searching by, then enter it in full, to see whether this
                    person is already in the system before you call them.
                </p>
            </div>

            <div className="flex max-w-2xl flex-wrap items-end gap-3">
                <div className="w-48">
                    <label className="mb-1 block text-body text-neutral-600">Search by</label>
                    <MyDropdown
                        currentValue={copy.label}
                        dropdownList={modes.map((m) => m.label)}
                        handleChange={changeMode}
                        className="w-full"
                    />
                </div>
                {/* The phone box carries its own country picker: a number stored with
                    a dial code and one typed without it are the same person, and the
                    institute's own preferred countries decide the default. onKeyDown
                    sits on the wrapper because the widget takes no key handler — and
                    skips the country picker's own search box, where Enter means "pick
                    this country", not "run the search". */}
                <div
                    className="min-w-56 flex-1"
                    onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        if ((e.target as HTMLElement).closest('.country-list')) return;
                        e.preventDefault();
                        submit();
                    }}
                >
                    {mode === 'phone' ? (
                        <PhoneNumberInput
                            name="lead-lookup-phone"
                            value={term}
                            onChange={(_name, value) => setTerm(value)}
                            label={copy.label}
                            placeholder={copy.placeholder}
                            validate={false}
                        />
                    ) : (
                        <MyInput
                            inputType={mode === 'email' ? 'email' : 'text'}
                            input={term}
                            onChangeFunction={(e) => setTerm(e.target.value)}
                            onPaste={(e) => {
                                // Pasting an address while the picker says Full name is
                                // a near-miss worth absorbing: switch to the mode the
                                // pasted value obviously belongs to.
                                const pasted = e.clipboardData.getData('text');
                                const guessed = guessLookupMode(pasted);
                                if (
                                    guessed &&
                                    guessed !== mode &&
                                    modes.some((m) => m.value === guessed)
                                ) {
                                    e.preventDefault();
                                    setMode(guessed);
                                    setTerm(pasted.trim());
                                    setResult(null);
                                }
                            }}
                            inputPlaceholder={copy.placeholder}
                            label={copy.label}
                            className="w-full"
                        />
                    )}
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
                <p className="-mt-3 text-caption text-neutral-500">{copy.hint}</p>
            )}

            {result && !result.found && (
                <Card className="max-w-xl border-neutral-200">
                    <CardContent className="flex items-start gap-3 py-5">
                        <MagnifyingGlass className="mt-0.5 size-5 shrink-0 text-neutral-400" />
                        <div>
                            <p className="font-medium text-neutral-700">Not in the system</p>
                            <p className="text-body text-neutral-500">
                                No lead matches this {copy.label.toLowerCase()}.
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
