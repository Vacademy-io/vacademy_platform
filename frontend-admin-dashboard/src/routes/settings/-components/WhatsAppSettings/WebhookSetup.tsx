import { useEffect, useState, useCallback } from 'react';
import { Copy, Check, ArrowClockwise, Plugs, Warning } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
    getChannelMappings,
    createChannelMapping,
    deleteChannelMapping,
    registerWatiWebhook,
    registerMetaWebhook,
    verifyWebhookEndpoint,
    getWebhookUrl,
    providerToChannelType,
    ChannelMapping,
    ProviderDetails,
} from '@/services/whatsapp-provider-service';

interface WebhookSetupProps {
    activeProvider: string;
    providers: ProviderDetails[];
}

export function WebhookSetup({ activeProvider, providers }: WebhookSetupProps) {
    const [mappings, setMappings] = useState<ChannelMapping[]>([]);
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);
    const [registering, setRegistering] = useState(false);
    const [verifyResult, setVerifyResult] = useState<{ success: boolean; message: string } | null>(null);
    const [copied, setCopied] = useState(false);

    const activeProviderDetails = providers.find((p) => p.name === activeProvider);
    // Check isConfigured with same fallback as parent: credentials may exist even if isConfigured is false
    const hasCredentials = activeProviderDetails?.credentials != null
        && Object.values(activeProviderDetails.credentials).some((v) => v && v.trim() !== '');
    const isProviderReady = activeProviderDetails?.isConfigured || hasCredentials;
    const channelId = getChannelIdFromProvider(activeProvider, activeProviderDetails);
    const webhookUrl = getWebhookUrl(activeProvider, channelId);

    const loadMappings = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getChannelMappings();
            setMappings(data);
        } catch {
            // No mappings yet — that's ok
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadMappings();
    }, [loadMappings]);

    const hasMapping = mappings.some(
        (m) => m.channelType === providerToChannelType(activeProvider) && m.active
    );

    const handleCopy = async () => {
        await navigator.clipboard.writeText(webhookUrl);
        setCopied(true);
        toast.success('Webhook URL copied');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCreateMapping = async () => {
        if (!channelId) {
            toast.error('Configure provider credentials first (Phone Number ID / WhatsApp Number needed)');
            return;
        }
        try {
            const displayNumber = activeProviderDetails?.credentials?.whatsappNumber
                || activeProviderDetails?.credentials?.phone_number_id
                || activeProviderDetails?.credentials?.phoneNumberId
                || channelId;

            await createChannelMapping({
                channelId,
                channelType: providerToChannelType(activeProvider),
                displayChannelNumber: displayNumber,
            });
            toast.success('Channel mapping created — webhooks will route to your institute');
            loadMappings();
        } catch (err) {
            toast.error('Failed to create mapping');
        }
    };

    const handleVerify = async () => {
        setVerifying(true);
        setVerifyResult(null);
        try {
            const result = await verifyWebhookEndpoint(webhookUrl);
            setVerifyResult(result);
            if (result.success) {
                toast.success('Webhook endpoint is reachable');
            } else {
                toast.error(result.message);
            }
        } catch {
            setVerifyResult({ success: false, message: 'Verification request failed' });
        } finally {
            setVerifying(false);
        }
    };

    const handleFullSetup = async () => {
        if (!activeProviderDetails?.credentials) {
            toast.error('Provider credentials not configured');
            return;
        }
        if (!channelId) {
            toast.error('Phone Number ID / WhatsApp Number not found in credentials');
            return;
        }
        setRegistering(true);
        const creds = activeProviderDetails.credentials;
        try {
            // Step 1: Create channel mapping (auto, if not exists)
            if (!hasMapping) {
                const displayNumber = creds.whatsappNumber || creds.phone_number_id
                    || creds.phoneNumberId || channelId;
                await createChannelMapping({
                    channelId,
                    channelType: providerToChannelType(activeProvider),
                    displayChannelNumber: displayNumber,
                });
                toast.success('Channel mapping created');
                await loadMappings();
            }

            // Step 2: Register webhook with provider
            let result: { success: boolean; message: string; steps?: string[] };

            if (activeProvider === 'WATI') {
                result = await registerWatiWebhook(
                    creds.apiUrl || creds.api_url || '',
                    creds.apiKey || creds.api_key || '',
                    webhookUrl
                );
            } else if (activeProvider === 'META') {
                result = await registerMetaWebhook(webhookUrl);
            } else {
                // COMBOT: just create mapping, webhook must be set manually
                toast.success('Channel mapping ready. Copy the webhook URL and set it in your COMBOT dashboard.');
                setRegistering(false);
                return;
            }

            if (result.success) {
                toast.success(`Webhook registered with ${activeProvider}`);
                if (result.steps) {
                    result.steps.forEach((s) => toast.info(s));
                }
            } else {
                toast.error(result.message);
            }
        } catch (err) {
            console.error(err);
            toast.error('Setup failed');
        } finally {
            setRegistering(false);
        }
    };

    const canAutoRegister = activeProvider === 'WATI' || activeProvider === 'META';

    if (!activeProvider || !isProviderReady) {
        return (
            <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Plugs size={18} /> Webhook Setup
                </h3>
                <p className="text-xs text-gray-400 mt-2">
                    Configure and activate a WhatsApp provider above first, then set up webhooks here.
                </p>
            </div>
        );
    }

    return (
        <div className="mt-6 border rounded-lg overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                    <Plugs size={18} /> Webhook Setup — {activeProvider}
                </h3>
                <p className="text-xs text-blue-600 mt-0.5">
                    Connect your WhatsApp provider to receive incoming messages
                </p>
            </div>

            <div className="p-4 space-y-4">
                {/* Status bar */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div>
                            <p className="text-xs font-semibold text-gray-600">Channel Mapping</p>
                            <p className="text-xs text-gray-400">Routes incoming webhooks to your institute</p>
                        </div>
                    </div>
                    {hasMapping ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                            Connected: {channelId}
                        </span>
                    ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                            Not Connected
                        </span>
                    )}
                </div>

                <hr />

                {/* One-click setup button */}
                <div>
                    <p className="text-xs font-semibold text-gray-600">
                        {canAutoRegister ? 'One-Click Setup' : 'Webhook URL'}
                    </p>
                    <p className="text-xs text-gray-400 mb-2">
                        {canAutoRegister
                            ? `Creates channel mapping and registers webhook with ${activeProvider} automatically.`
                            : `Creates channel mapping. Copy the webhook URL and paste it in your ${activeProvider} dashboard.`}
                    </p>

                    {/* Setup button */}
                    <button
                        onClick={handleFullSetup}
                        disabled={registering}
                        className="text-xs px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {registering ? (
                            <ArrowClockwise size={14} className="animate-spin" />
                        ) : (
                            <Plugs size={14} />
                        )}
                        {registering
                            ? 'Setting up...'
                            : hasMapping && canAutoRegister
                              ? `Re-register Webhook with ${activeProvider}`
                              : canAutoRegister
                                ? `Setup Webhook with ${activeProvider}`
                                : hasMapping
                                  ? 'Mapping Already Created'
                                  : 'Create Channel Mapping'}
                    </button>
                </div>

                <hr />

                {/* Webhook URL (always shown for reference/manual setup) */}
                <div>
                    <p className="text-xs font-semibold text-gray-600">Webhook URL</p>
                    <div className="flex items-center gap-2 mt-1">
                        <code className="flex-1 px-3 py-2 bg-gray-100 rounded text-xs font-mono text-gray-700 break-all select-all">
                            {webhookUrl}
                        </code>
                        <button
                            onClick={handleCopy}
                            className="p-2 border rounded hover:bg-gray-50 shrink-0"
                            title="Copy webhook URL"
                        >
                            {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                        </button>
                    </div>

                    {/* COMBOT: show verify token for manual setup */}
                    {activeProvider === 'COMBOT' && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                            <p className="font-medium flex items-center gap-1">
                                <Warning size={14} /> Manual Webhook Setup
                            </p>
                            <p className="mt-1">
                                Paste the URL above into Com.bot dashboard → Settings → Webhooks.
                            </p>
                            <p className="mt-1">Verify Token:</p>
                            <code className="block mt-0.5 bg-yellow-100 px-2 py-1 rounded font-mono select-all">
                                vacademy_webhook_secret
                            </code>
                        </div>
                    )}
                </div>

                <hr />

                {/* Step 3: Verify */}
                <div>
                    <p className="text-xs font-semibold text-gray-600">Step 3: Verify Connection</p>
                    <p className="text-xs text-gray-400 mb-2">
                        Test that the webhook endpoint is reachable
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleVerify}
                            disabled={verifying}
                            className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50 flex items-center gap-1"
                        >
                            {verifying ? (
                                <ArrowClockwise size={14} className="animate-spin" />
                            ) : (
                                <Check size={14} />
                            )}
                            {verifying ? 'Verifying...' : 'Verify Endpoint'}
                        </button>
                        {verifyResult && (
                            <span
                                className={`text-xs ${
                                    verifyResult.success ? 'text-green-600' : 'text-red-500'
                                }`}
                            >
                                {verifyResult.success ? '✓ ' : '✗ '}
                                {verifyResult.message}
                            </span>
                        )}
                    </div>
                </div>

                {/* Instructions */}
                <div className="p-3 bg-gray-50 border rounded text-xs text-gray-500 space-y-1">
                    <p className="font-medium text-gray-600">How it works:</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                        <li>
                            <strong>Channel Mapping</strong> links your WhatsApp Business number to this
                            institute so incoming webhooks route correctly
                        </li>
                        <li>
                            <strong>Webhook URL</strong> is where your provider sends incoming messages
                            and delivery status updates
                        </li>
                        <li>
                            <strong>Verify</strong> checks that the endpoint is publicly reachable and
                            responds to the challenge correctly
                        </li>
                    </ol>
                </div>
            </div>
        </div>
    );
}

/**
 * Extract the channel ID from provider credentials.
 * COMBOT/META: phone_number_id
 * WATI: whatsappNumber
 */
function getChannelIdFromProvider(provider: string, details?: ProviderDetails | null): string {
    if (!details?.credentials) return '';
    const creds = details.credentials;

    switch (provider.toUpperCase()) {
        case 'COMBOT':
            return creds.phone_number_id || creds.phoneNumberId || '';
        case 'META':
            return creds.phoneNumberId || creds.phone_number_id || '';
        case 'WATI':
            return creds.whatsappNumber || creds.whatsapp_number || '';
        default:
            return '';
    }
}
