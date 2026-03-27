import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '@/providers/theme/theme-provider';
import {
    getWhatsAppProviderStatus,
    switchWhatsAppProvider,
    updateWhatsAppCredentials,
    PROVIDER_CREDENTIAL_FIELDS,
    type ProviderDetails,
    type CredentialField,
} from '@/services/whatsapp-provider-service';
import { WebhookSetup } from './WebhookSetup';

type Props = { isTab?: boolean };

const PROVIDER_ORDER = ['COMBOT', 'WATI', 'META'] as const;

const PROVIDER_CONFIG: Record<
    string,
    { name: string; description: string }
> = {
    COMBOT: {
        name: 'Combot',
        description: 'Com.bot WhatsApp Business API provider',
    },
    WATI: {
        name: 'WATI',
        description: 'WATI WhatsApp Business API provider',
    },
    META: {
        name: 'Meta',
        description: 'Direct Meta WhatsApp Cloud API',
    },
};

export default function WhatsAppSettings({ isTab = false }: Props) {
    const { getPrimaryColorCode } = useTheme();
    const primaryColor = getPrimaryColorCode();
    const [loading, setLoading] = useState(true);
    const [activeProvider, setActiveProvider] = useState<string>('');
    const [providers, setProviders] = useState<ProviderDetails[]>([]);
    const [editingProvider, setEditingProvider] = useState<string | null>(null);
    const [credentials, setCredentials] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [switching, setSwitching] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadStatus = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getWhatsAppProviderStatus();
            setActiveProvider(data.activeProvider || '');
            setProviders(data.providers || []);
        } catch (e) {
            console.error(e);
            setError('Failed to load WhatsApp provider settings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStatus();
    }, []);

    const handleSwitchProvider = async (providerName: string) => {
        if (providerName === activeProvider) return;
        setSwitching(providerName);
        try {
            await switchWhatsAppProvider(providerName);
            toast.success(
                `Switched active provider to ${PROVIDER_CONFIG[providerName]?.name || providerName}`
            );
            await loadStatus();
        } catch (e: any) {
            const msg =
                e?.response?.data?.message || e?.message || 'Failed to switch provider';
            toast.error(msg);
        } finally {
            setSwitching(null);
        }
    };

    const handleSaveCredentials = async (providerName: string) => {
        const fields = PROVIDER_CREDENTIAL_FIELDS[providerName] || [];
        const hasEmpty = fields.some((f) => !credentials[f.key]?.trim());
        if (hasEmpty) {
            toast.error('Please fill in all fields');
            return;
        }

        setSaving(true);
        try {
            await updateWhatsAppCredentials({
                providerName: providerName.toLowerCase(),
                credentials,
            });
            toast.success(
                `${PROVIDER_CONFIG[providerName]?.name || providerName} credentials saved`
            );
            setEditingProvider(null);
            setCredentials({});
    
            await loadStatus();
        } catch (e: any) {
            const msg =
                e?.response?.data?.message || e?.message || 'Failed to save credentials';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const startEditing = (providerName: string) => {
        const provider = providers.find((p) => p.name === providerName);
        if (provider?.credentials) {
            setCredentials({ ...provider.credentials });
        } else {
            setCredentials({});
        }
        setEditingProvider(providerName);

    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="size-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading WhatsApp settings...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {isTab && (
                <div>
                    <h2 className="text-xl font-bold">WhatsApp Settings</h2>
                    <p className="text-sm text-gray-600">
                        Configure and switch between WhatsApp providers for your institute
                    </p>
                </div>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Active Provider Banner */}
            {activeProvider && (
                <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                    <Check className="size-5 text-green-600" />
                    <div>
                        <p className="text-sm font-medium text-gray-900">
                            Active Provider:{' '}
                            <span className="font-bold">
                                {PROVIDER_CONFIG[activeProvider]?.name || activeProvider}
                            </span>
                        </p>
                        <p className="text-xs text-gray-600">
                            All outgoing WhatsApp messages are routed through this provider
                        </p>
                    </div>
                </div>
            )}

            {/* Provider Cards */}
            {PROVIDER_ORDER.map((providerName) => {
                const provider = providers.find((p) => p.name === providerName);
                const config = PROVIDER_CONFIG[providerName] ?? { name: providerName, description: '' };
                const isActive =
                    provider?.isActive || activeProvider === providerName;
                const existingCreds = provider?.credentials || null;
                const hasCredentials =
                    existingCreds != null &&
                    Object.values(existingCreds).some((v) => v && v.trim() !== '');
                const isConfigured = provider?.isConfigured || hasCredentials;
                const isEditing = editingProvider === providerName;
                const fields = PROVIDER_CREDENTIAL_FIELDS[providerName] || [];

                return (
                    <Card
                        key={providerName}
                        className={`rounded-lg border-2 transition-all ${
                            isActive
                                ? 'shadow-md'
                                : isConfigured
                                  ? 'border-gray-300'
                                  : 'border-gray-200'
                        }`}
                        style={isActive ? { borderColor: primaryColor } : undefined}
                    >
                        <CardHeader className="py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {/* Provider selection radio */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            isConfigured && handleSwitchProvider(providerName)
                                        }
                                        disabled={
                                            !isConfigured ||
                                            isActive ||
                                            switching !== null
                                        }
                                        title={
                                            !isConfigured
                                                ? 'Configure credentials first'
                                                : isActive
                                                  ? 'Currently active'
                                                  : `Switch to ${config.name}`
                                        }
                                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                                            isActive
                                                ? ''
                                                : isConfigured
                                                  ? 'border-gray-300 cursor-pointer'
                                                  : 'border-gray-300 cursor-not-allowed opacity-40'
                                        }`}
                                        style={isActive ? { borderColor: primaryColor } : undefined}
                                    >
                                        {isActive && (
                                            <div
                                                className="h-2.5 w-2.5 rounded-full"
                                                style={{ backgroundColor: primaryColor }}
                                            />
                                        )}
                                        {switching === providerName && (
                                            <Loader2
                                                className="h-3 w-3 animate-spin"
                                                style={{ color: primaryColor }}
                                            />
                                        )}
                                    </button>
                                    <div>
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            {config.name}
                                            {isActive && (
                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                                    Active
                                                </Badge>
                                            )}
                                            {isConfigured && !isActive && (
                                                <Badge
                                                    variant="secondary"
                                                    className="bg-gray-100 text-gray-600"
                                                >
                                                    Configured
                                                </Badge>
                                            )}
                                            {!isConfigured && (
                                                <Badge
                                                    variant="outline"
                                                    className="text-gray-400"
                                                >
                                                    Not Configured
                                                </Badge>
                                            )}
                                        </CardTitle>
                                        <p className="text-xs text-muted-foreground">
                                            {config.description}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!isEditing && !isConfigured && (
                                        <Button
                                            size="sm"
                                            onClick={() => startEditing(providerName)}
                                        >
                                            Configure
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardHeader>

                        {/* View mode: show credentials read-only, sensitive fields masked */}
                        {isConfigured && !isEditing && existingCreds && (
                            <CardContent className="border-t pt-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        Provider Credentials
                                    </p>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => startEditing(providerName)}
                                    >
                                        Edit
                                    </Button>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                    {fields.map((field: CredentialField) => {
                                        const val = existingCreds[field.key];
                                        if (!val) return null;
                                        const displayVal =
                                            field.type === 'password' && val.length > 4
                                                ? '****' + val.substring(val.length - 4)
                                                : field.type === 'password'
                                                  ? '****'
                                                  : val;
                                        return (
                                            <div
                                                key={field.key}
                                                className="space-y-1"
                                            >
                                                <Label className="text-xs text-muted-foreground">
                                                    {field.label}
                                                </Label>
                                                <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm font-mono text-gray-600">
                                                    {displayVal}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        )}

                        {/* Edit mode: show full values, all editable */}
                        {isEditing && (
                            <CardContent className="border-t pt-4">
                                <div className="space-y-4">
                                    <p className="text-xs text-muted-foreground">
                                        {isConfigured
                                            ? 'Update your provider credentials below.'
                                            : 'Enter your provider credentials to configure this provider.'}
                                    </p>
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {fields.map((field: CredentialField) => (
                                            <div key={field.key} className="space-y-1">
                                                <Label
                                                    htmlFor={`${providerName}-${field.key}`}
                                                >
                                                    {field.label}
                                                </Label>
                                                <div className="relative">
                                                    <Input
                                                        id={`${providerName}-${field.key}`}
                                                        type="text"
                                                        placeholder={field.placeholder}
                                                        value={
                                                            credentials[field.key] || ''
                                                        }
                                                        onChange={(e) =>
                                                            setCredentials((prev) => ({
                                                                ...prev,
                                                                [field.key]: e.target.value,
                                                            }))
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-end gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setEditingProvider(null);
                                                setCredentials({});
                                        
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() =>
                                                handleSaveCredentials(providerName)
                                            }
                                            disabled={saving}
                                        >
                                            {saving ? (
                                                <Loader2 className="mr-1 size-3 animate-spin" />
                                            ) : null}
                                            Save Credentials
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        )}
                    </Card>
                );
            })}

            {/* Webhook Setup */}
            <WebhookSetup activeProvider={activeProvider} providers={providers} />

            {/* Info Card */}
            <Card className="rounded-lg border-gray-200 bg-gray-50">
                <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground">
                        <strong>Note:</strong> Switching the active provider instantly routes
                        all outgoing WhatsApp messages through the selected provider. Make sure
                        the same message templates exist on the new provider before switching.
                        Inbound messages (user replies) are handled automatically via the smart
                        fallback system.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
