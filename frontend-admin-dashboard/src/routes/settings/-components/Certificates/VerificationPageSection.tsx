import { SealCheck } from '@phosphor-icons/react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { MyButton } from '@/components/design-system/button';

/**
 * The page a scanned certificate opens, and the little of it an institute
 * decides.
 *
 * <p>Two things belong here and nothing else. First, the address: admins were
 * being asked to supply a verification URL, which implied they had to go and
 * build the page — they do not, the platform hosts it on their own learner
 * portal, so the address is a fact to state rather than a field to fill. Second,
 * a preview: this page is only ever seen by strangers holding a certificate, so
 * the institute would otherwise never lay eyes on it.
 */
interface Props {
    /** Where a scan lands, already resolved. Empty when no portal is configured. */
    verificationPageUrl: string;
    instituteName: string;
    logoUrl: string;
    themeColor: string;
    note: string;
    onNoteChange: (note: string) => void;
    /** A link the institute set before this section existed, if any. */
    customUrl: string;
    onClearCustomUrl: () => void;
    sampleCertificateId: string;
    disabled?: boolean;
}

export const VerificationPageSection = ({
    verificationPageUrl,
    instituteName,
    logoUrl,
    themeColor,
    note,
    onNoteChange,
    customUrl,
    onClearCustomUrl,
    sampleCertificateId,
    disabled,
}: Props) => {
    const displayName = instituteName || 'Your institute';

    return (
        <div className="space-y-5 rounded-lg border bg-card p-6">
            <div>
                <h3 className="text-base font-semibold">Verification page</h3>
                <p className="text-sm text-muted-foreground">
                    Scanning the code on a certificate opens this page. It is hosted on your own
                    portal and needs no login, so anyone holding the certificate can check it.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                    <div>
                        <div className="text-sm font-medium">Address</div>
                        {verificationPageUrl ? (
                            <p className="mt-1 break-all rounded border bg-muted/30 p-3 font-mono text-xs">
                                {verificationPageUrl}
                            </p>
                        ) : (
                            <p className="mt-1 rounded border bg-muted/30 p-3 text-xs text-muted-foreground">
                                Set your learner portal address in Dashboard → Edit institute
                                profile and this page moves to your own domain. Until then scans
                                verify on the platform address.
                            </p>
                        )}
                    </div>

                    {customUrl && (
                        <div className="flex flex-wrap items-center gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                            <span>
                                Scans currently open a link set earlier:{' '}
                                <span className="font-mono">{customUrl}</span>. That page receives
                                only the certificate number, which is not a credential, so it cannot
                                prove the certificate is genuine.
                            </span>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={onClearCustomUrl}
                                disable={disabled}
                            >
                                Use my portal instead
                            </MyButton>
                        </div>
                    )}

                    <div>
                        <Label htmlFor="verification-note">Your message (optional)</Label>
                        <Input
                            id="verification-note"
                            value={note}
                            disabled={disabled}
                            maxLength={200}
                            placeholder="e.g. Questions about this certificate? registrar@example.com"
                            onChange={(e) => onNoteChange(e.target.value)}
                            className="mt-1"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                            Shown on the page below. Anyone with the link can read it, so keep it to
                            something public.
                        </p>
                    </div>
                </div>

                {/* A miniature of the real page rather than a description of it.
                    The institute never sees this page in the course of its own
                    work — only the people it is trying to convince do. */}
                <div className="rounded-lg border bg-muted/20 p-4">
                    <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        What a scan shows
                    </div>
                    <div className="overflow-hidden rounded-lg border bg-white">
                        <div
                            className="h-2 w-full"
                            // The institute's own colour: runtime data, not a token.
                            style={{ backgroundColor: themeColor }} // design-lint-ignore: institute branding
                        />
                        <div className="flex flex-col items-center gap-2 px-5 pb-4 pt-5 text-center">
                            {logoUrl ? (
                                <img
                                    src={logoUrl}
                                    alt={displayName}
                                    className="size-12 rounded-full object-contain"
                                />
                            ) : (
                                <div
                                    className="flex size-12 items-center justify-center rounded-full text-lg font-semibold text-white"
                                    style={{ backgroundColor: themeColor }} // design-lint-ignore: institute branding
                                >
                                    {displayName.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="text-caption uppercase tracking-widest text-neutral-400">
                                Verified by
                            </div>
                            <div className="text-sm font-semibold text-neutral-700">
                                {displayName}
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-1 border-y bg-success-50 px-5 py-3 text-center">
                            <SealCheck weight="fill" className="size-6 text-success-500" />
                            <div className="text-xs font-medium text-neutral-700">
                                This certificate is genuine
                            </div>
                        </div>
                        <dl className="flex flex-col gap-1.5 px-5 py-4 text-xs">
                            <PreviewRow label="Issued to" value="A··· S·····" />
                            <PreviewRow label="Course" value="Intro to Sample Course" />
                            <PreviewRow label="Certificate number" value={sampleCertificateId} />
                        </dl>
                        {note.trim() && (
                            <p className="border-t px-5 py-3 text-xs text-neutral-600">
                                {note.trim()}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const PreviewRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-baseline justify-between gap-3">
        <dt className="shrink-0 text-neutral-400">{label}</dt>
        <dd className="truncate text-right font-medium text-neutral-700">{value}</dd>
    </div>
);
