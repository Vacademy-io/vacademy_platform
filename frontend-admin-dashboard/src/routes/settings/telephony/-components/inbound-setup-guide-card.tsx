import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    BookOpen,
    CheckCircle,
    Copy,
    ArrowSquareOut,
    WarningCircle,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { fetchTelephonyConfig } from '../-services/telephony-admin';

/**
 * One-time inbound-flow setup walkthrough. The admin only ever has to do this
 * once per institute (or once per Exotel account, really) — after the flow
 * is created and its id is pasted into the Calling Provider card, every
 * ExoPhone the admin adds in our Numbers card gets attached automatically.
 *
 * Renders inline copy buttons for the Connect-applet URL + Status callback
 * URL with the right token already substituted, so the admin can do the
 * dashboard part literally by pasting.
 */
export function InboundSetupGuideCard() {
    const instituteId = getCurrentInstituteId() ?? '';
    const configQuery = useQuery({
        queryKey: ['telephony-config', instituteId],
        queryFn: () => fetchTelephonyConfig(instituteId),
        enabled: !!instituteId,
    });

    const cfg = configQuery.data;
    const flowIsSet = !!cfg?.flowSid;
    // Auto-collapse once the setup is in place — admins don't need to re-read
    // the guide every time they hit Settings. They can expand to re-check.
    const [expanded, setExpanded] = useState(!flowIsSet);

    // Defensive trim — backend property files have occasionally been seen with
    // a leading space after the `=` ("foo= https://...") which Spring preserves
    // verbatim. Without this, the Connect-applet URL gets a leading space and
    // Exotel rejects it silently.
    const base = (cfg?.webhookCallbackBase ?? '').trim().replace(/\/$/, '');
    const tokenSet = !!cfg?.webhookTokenSet;
    // We never send the actual token to the frontend (it's a secret). Render
    // a clearly-visible placeholder so the admin substitutes it manually.
    const tokenPart = tokenSet ? '&token=<YOUR_WEBHOOK_TOKEN>' : '';

    const routeUrl = base
        ? `${base}/admin-core-service/v1/telephony/inbound/route?provider=EXOTEL${tokenPart}`
        : '';
    const statusUrl = base
        ? `${base}/admin-core-service/v1/telephony/inbound/status?provider=EXOTEL${tokenPart}`
        : '';

    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                    <BookOpen className="size-5 text-primary-600" />
                    <div>
                        <h2 className="text-base font-semibold text-neutral-900">
                            Inbound setup (one-time)
                        </h2>
                        <p className="text-sm text-neutral-500">
                            Tell Exotel where to send lead callbacks. You only do this once —
                            new numbers you add later are wired up automatically.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {flowIsSet ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700">
                            <CheckCircle className="size-3" /> Connected
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700">
                            <WarningCircle className="size-3" /> Setup needed
                        </span>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExpanded((v) => !v)}
                    >
                        {expanded ? 'Hide' : 'Show'} steps
                    </Button>
                </div>
            </div>

            {expanded && (
                <div className="space-y-4">
                    {!base && (
                        <div className="rounded-md border border-warning-200 bg-warning-50 p-3 text-xs text-warning-800">
                            The server isn't advertising its public webhook URL
                            (<code>telephony.webhook.callback-base</code> is empty).
                            Ask your server admin to set it before completing this
                            setup — Exotel needs a reachable URL.
                        </div>
                    )}

                    <Step n={1} title="Open Exotel and go to App Bazaar">
                        <p>
                            Sign in to{' '}
                            <a
                                href="https://my.exotel.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary-600 hover:underline"
                            >
                                my.exotel.com <ArrowSquareOut className="size-3.5" />
                            </a>
                            , then go to <strong>App Bazaar → Create Call Flow</strong>.
                            Pick the <strong>Voice</strong> applet category.
                        </p>
                    </Step>

                    <Step n={2} title="Add a Connect applet in “dynamic URL” mode">
                        <p>
                            Drop a <strong>Connect</strong> applet into the flow and pick{' '}
                            <strong>“Configure parameters dynamically (via URL)”</strong>.
                            Paste the URL below into the <strong>Primary URL</strong> field,
                            then save the applet.
                        </p>
                        <CopyableUrl
                            label="Primary URL (Connect applet)"
                            url={routeUrl}
                            placeholder="Set telephony.webhook.callback-base first"
                        />
                        {tokenSet && (
                            <p className="text-xs text-neutral-500">
                                Replace <code>&lt;YOUR_WEBHOOK_TOKEN&gt;</code> with the
                                same secret you saved in the Calling Provider card.
                            </p>
                        )}
                    </Step>

                    <Step
                        n={3}
                        title="Drop a Passthru applet under “After the call conversation ends…”"
                    >
                        <p>
                            Still inside the same flow, scroll down to the{' '}
                            <strong>“After the call conversation ends…”</strong> slot under
                            the Connect applet. Drag a <strong>Passthru</strong> applet from
                            the Voice Applets panel and drop it in. Paste the URL below into
                            its <strong>URL</strong> field and pick <strong>Async</strong>{' '}
                            mode.
                        </p>
                        <CopyableUrl
                            label="Passthru URL (recording + status)"
                            url={statusUrl}
                            placeholder="Set telephony.webhook.callback-base first"
                        />
                        <p className="text-xs text-neutral-500">
                            This Passthru is what delivers the recording link + call outcome
                            to our server when the call ends. Without it, calls log fine
                            but recordings won't be saved to your S3.
                        </p>
                        <p className="text-xs text-neutral-500">
                            (Optional, recommended) Drop the same Passthru in the{' '}
                            <strong>“If all agents are busy…”</strong> slot too — that way
                            missed-call rows still appear in the lead's timeline instead of
                            vanishing.
                        </p>
                    </Step>

                    <Step n={4} title="Save the flow and copy its id">
                        <p>
                            Hit <strong>SAVE</strong> at the top right of the flow editor.
                            After saving, look at the URL in your browser — it looks like{' '}
                            <code>my.exotel.com/.../call-flow/edit/<strong>1234567</strong></code>.
                            The number at the end is your <strong>flow id</strong>.
                        </p>
                    </Step>

                    <Step n={5} title="Paste the flow id above and save">
                        <p>
                            Put the flow id into <strong>“Inbound flow id”</strong> on the
                            Calling Provider card up top and hit <strong>Save changes</strong>.
                            From this point on, every ExoPhone you add in the Numbers card
                            will be wired to this flow automatically — no more App Bazaar
                            clicks.
                        </p>
                    </Step>

                    <div className="rounded-md border border-info-200 bg-info-50 p-3 text-xs text-info-800">
                        <strong>Tip:</strong> If you already have ExoPhones added below, hit{' '}
                        <strong>Attach</strong> on each row once you've saved the flow id to
                        wire them up retroactively. New numbers added after this point are
                        attached on creation.
                    </div>
                </div>
            )}
        </div>
    );
}

function Step({
    n,
    title,
    children,
}: {
    n: number;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex gap-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                {n}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-semibold text-neutral-900">{title}</p>
                <div className="space-y-2 text-sm text-neutral-700">{children}</div>
            </div>
        </div>
    );
}

function CopyableUrl({
    label,
    url,
    placeholder,
}: {
    label: string;
    url: string;
    placeholder: string;
}) {
    const [copied, setCopied] = useState(false);

    const onCopy = async () => {
        if (!url) {
            toast.error(placeholder);
            return;
        }
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
            toast.success(`${label} copied`);
        } catch {
            toast.error('Could not copy — copy by hand');
        }
    };

    return (
        <div className="flex items-stretch gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-2">
            <code className="min-w-0 flex-1 break-all px-2 py-1 text-xs text-neutral-700">
                {url || <span className="italic text-neutral-400">{placeholder}</span>}
            </code>
            <Button
                size="sm"
                variant="outline"
                onClick={onCopy}
                disabled={!url}
                className={cn('h-8 px-2', copied && 'border-success-300 text-success-700')}
                aria-label="Copy"
            >
                <Copy className="size-4" />
            </Button>
        </div>
    );
}
