import { useEffect, useState } from 'react';
import { VideoCamera, Info, LinkSimple, CircleNotch } from '@phosphor-icons/react';
import { toast } from 'sonner';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { listGoogleAccounts, initiateGoogleOAuth, type GoogleAccountSummary } from '@/services/google-accounts';
import { GoogleAccountList } from './GoogleAccountList';

/**
 * Self-contained card for the Live Session Settings page that lets an institute admin connect a
 * Google Workspace account (per-tenant OAuth) so admins can create Google Meet sessions from the
 * live-class wizard. Data loads independently of the surrounding LiveSessionSettings form
 * (accounts persist via their own REST endpoints, not the institute_setting JSON blob).
 */
export function GoogleMeetIntegrationCard() {
    const [accounts, setAccounts] = useState<GoogleAccountSummary[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connecting, setConnecting] = useState(false);

    const refresh = async () => {
        setError(null);
        try {
            setAccounts(await listGoogleAccounts());
        } catch (e) {
            console.error(e);
            setError('Failed to load Google accounts.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void refresh();
    }, []);

    // Handle the "Connect Google Workspace" OAuth return (server bounced the browser back here).
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('google_connected')) {
            toast.success('Google Workspace connected successfully.');
            void refresh();
        } else if (params.get('google_error')) {
            const reason = params.get('google_reason');
            toast.error(
                `Google connection failed (${params.get('google_error')})${reason ? `: ${reason}` : ''}.`
            );
        }
        if (params.has('google_connected') || params.has('google_error')) {
            params.delete('google_connected');
            params.delete('google_error');
            params.delete('google_reason');
            const qs = params.toString();
            window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
        }
    }, []);

    const handleConnect = async () => {
        setConnecting(true);
        try {
            const { oauth_url } = await initiateGoogleOAuth();
            window.location.href = oauth_url; // leave the SPA for Google's consent screen
        } catch (e) {
            console.error(e);
            toast.error('Could not start the Google connection. Please try again.');
            setConnecting(false);
        }
    };

    return (
        <Card className="border-neutral-200 shadow-none">
            <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-4">
                <div className="flex size-9 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                    <VideoCamera size={18} />
                </div>
                <div className="flex-1">
                    <CardTitle className="text-base">Google Meet Integration</CardTitle>
                    <CardDescription>
                        Connect a Google Workspace account so admins can create Google Meet sessions
                        directly from the live-class wizard. Learners join by opening the Meet link
                        (Google Meet has no in-app embed).
                    </CardDescription>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Button
                        size="sm"
                        onClick={handleConnect}
                        disabled={loading || connecting}
                        className="bg-primary-500 hover:bg-primary-600"
                    >
                        {connecting ? (
                            <CircleNotch className="mr-1 size-3.5 animate-spin" />
                        ) : (
                            <LinkSimple size={14} className="mr-1" />
                        )}
                        Connect Google Workspace
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="border-t border-neutral-100 p-5">
                {loading ? (
                    <div className="flex h-16 items-center justify-center text-neutral-400">
                        <CircleNotch className="size-5 animate-spin" />
                    </div>
                ) : error ? (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {error}{' '}
                        <button
                            type="button"
                            className="ml-1 underline"
                            onClick={() => {
                                setLoading(true);
                                void refresh();
                            }}
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <>
                        <GoogleAccountList accounts={accounts ?? []} onChanged={refresh} />
                        <RecordingNotice />
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function RecordingNotice() {
    return (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-800">
            <Info size={14} className="mt-0.5 shrink-0" />
            <div className="leading-relaxed">
                Auto-recording requires a recording-capable Workspace edition (Business Standard+,
                Enterprise, or Education Plus) and a teacher signed into the institute’s Workspace to
                be present. Recordings land in the connected account’s Google Drive and are
                admin-facing for now. The connected account is the organizer for every session it
                creates.
            </div>
        </div>
    );
}
