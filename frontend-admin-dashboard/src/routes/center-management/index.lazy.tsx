import { useEffect, useMemo, useState } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';

import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { StatusChip } from '@/components/design-system/status-chips';
import { cn } from '@/lib/utils';
import {
    Buildings,
    FloppyDisk,
    ArrowClockwise,
    ArrowCounterClockwise,
    WarningCircle,
} from '@phosphor-icons/react';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    listConnectors,
    updateConnector,
    type ConnectorListItem,
} from '@/routes/settings/-services/ad-platform-service';
import { handleFetchCampaignsList } from '@/routes/audience-manager/list/-services/get-campaigns-list';

export const Route = createLazyFileRoute('/center-management/')({
    component: () => (
        <LayoutContainer>
            <CenterManagementPage />
        </LayoutContainer>
    ),
});

// ── Constants ─────────────────────────────────────────────────────────────────

const VENDOR_LABEL: Record<string, string> = {
    ZOHO_FORMS: 'Zoho Forms',
    META_LEAD_ADS: 'Meta Lead Ads',
    GOOGLE_LEAD_ADS: 'Google Lead Ads',
    GOOGLE_FORMS: 'Google Forms',
    MICROSOFT_FORMS: 'Microsoft Forms',
};

/** Structured fields that map to specific keys in default_values_json */
const CENTER_FIELDS: { label: string; jsonKey: string; placeholder: string }[] = [
    { label: 'Center Name', jsonKey: 'Center Name', placeholder: 'e.g. Baner' },
    {
        label: 'Center Manager Name',
        jsonKey: 'Center Manager Name',
        placeholder: 'e.g. Rahul Sharma',
    },
    {
        label: 'Manager Mobile',
        jsonKey: 'Center Manager Mobile',
        placeholder: 'e.g. +91 98765 43210',
    },
    { label: 'Center Phone', jsonKey: 'Center Phone', placeholder: 'e.g. 020-12345678' },
    { label: 'Address', jsonKey: 'Center Address', placeholder: 'e.g. 2nd Floor, Baner Road' },
];

const STRUCTURED_KEYS = new Set(CENTER_FIELDS.map((f) => f.jsonKey));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse defaultValuesJson defensively — always returns a plain object. */
const parseJson = (json: string | null | undefined): Record<string, string> => {
    if (!json) return {};
    try {
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, string>;
        }
    } catch {
        // fall through
    }
    return {};
};

/** Extract only the structured field values from the full object. */
const extractStructured = (obj: Record<string, string>): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const f of CENTER_FIELDS) {
        out[f.jsonKey] = obj[f.jsonKey] ?? '';
    }
    return out;
};

/**
 * Merge ONLY the structured keys into the existing full object, preserving all
 * other keys (e.g. schedule link, routing metadata, etc.).
 */
const mergeAndSerialize = (
    existing: Record<string, string>,
    structured: Record<string, string>
): string => {
    const merged = { ...existing };
    for (const key of STRUCTURED_KEYS) {
        const value = structured[key];
        if (value !== undefined) {
            if (value === '') {
                // remove blank values to keep the object clean
                delete merged[key];
            } else {
                merged[key] = value;
            }
        }
    }
    return JSON.stringify(merged);
};

// ── Main page ─────────────────────────────────────────────────────────────────

function CenterManagementPage() {
    const { setNavHeading } = useNavHeadingStore();
    const queryClient = useQueryClient();
    const instituteId = getCurrentInstituteId() ?? '';

    useEffect(() => {
        setNavHeading(
            <div className="flex items-center gap-2">
                <Buildings className="text-primary-500 size-5" weight="fill" />
                <h1 className="text-title font-semibold">Center Management</h1>
            </div>
        );
    }, [setNavHeading]);

    // ── Connectors query ──────────────────────────────────────────────────────
    const {
        data: connectors = [],
        isLoading: connectorsLoading,
        error: connectorsError,
        refetch,
        isFetching,
    } = useQuery({
        queryKey: ['ad-connectors-all', instituteId],
        queryFn: () => listConnectors(instituteId, true),
        enabled: !!instituteId,
        retry: false,
    });

    // ── Campaigns query (for display names) ──────────────────────────────────
    const { data: campaignsData } = useQuery(
        handleFetchCampaignsList({
            institute_id: instituteId,
            page: 0,
            size: 200,
        })
    );

    /** audience_id → campaign_name lookup */
    const campaignMap = useMemo<Record<string, string>>(() => {
        const map: Record<string, string> = {};
        for (const item of campaignsData?.content ?? []) {
            const key = item.audience_id ?? item.id;
            if (key) map[key] = item.campaign_name;
        }
        return map;
    }, [campaignsData]);

    /** Derive a human-readable center name for a connector. */
    const centerName = (c: ConnectorListItem): string =>
        campaignMap[c.audienceId] ??
        c.platformFormName ??
        c.vendorId ??
        c.audienceId;

    /** Sort connectors by derived center name. */
    const sorted = useMemo(
        () =>
            [...connectors].sort((a, b) =>
                centerName(a).localeCompare(centerName(b))
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [connectors, campaignMap]
    );

    const handleRefetch = () => {
        void refetch();
    };

    // ── Render states ─────────────────────────────────────────────────────────
    return (
        <>
            <Helmet>
                <title>Center Management | Vacademy</title>
                <meta
                    name="description"
                    content="View and edit per-center details for each lead-capture connector."
                />
            </Helmet>

            <div className="space-y-4 p-4 sm:p-6">
                {/* Page header */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-h3 font-semibold">Center Management</h2>
                        <p className="text-body text-muted-foreground mt-1">
                            Configure per-center details that are stamped onto every lead submitted
                            through each connector. Form values always take precedence over these
                            defaults.
                        </p>
                    </div>
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={handleRefetch}
                        disable={isFetching}
                        className="shrink-0"
                    >
                        <ArrowClockwise
                            className={cn('size-3.5', isFetching && 'animate-spin')}
                        />
                        Refresh
                    </MyButton>
                </div>

                {/* Loading state */}
                {connectorsLoading && (
                    <div className="grid gap-4 md:grid-cols-2">
                        {[1, 2, 3, 4].map((n) => (
                            <Card key={n}>
                                <CardHeader className="pb-3">
                                    <Skeleton className="h-5 w-40" />
                                    <Skeleton className="h-4 w-24 mt-1" />
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {CENTER_FIELDS.map((f) => (
                                        <Skeleton key={f.jsonKey} className="h-9 w-full" />
                                    ))}
                                    <Skeleton className="h-9 w-28 ml-auto" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Error state */}
                {!connectorsLoading && connectorsError && (
                    <div className="flex items-start gap-3 rounded-md border border-warning-200 bg-warning-50 p-4">
                        <WarningCircle
                            className="mt-0.5 size-5 shrink-0 text-warning-600"
                            weight="fill"
                        />
                        <div className="space-y-1">
                            <p className="text-body font-semibold text-warning-700">
                                Could not load centers
                            </p>
                            <p className="text-caption text-warning-600">
                                The integration API may not be deployed yet. Try refreshing, or
                                contact support if the problem persists.
                            </p>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={handleRefetch}
                                className="mt-2"
                            >
                                <ArrowClockwise className="size-3.5" />
                                Retry
                            </MyButton>
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {!connectorsLoading && !connectorsError && sorted.length === 0 && (
                    <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50 py-12 text-center">
                        <Buildings className="size-10 text-neutral-300" weight="fill" />
                        <p className="text-body font-semibold text-neutral-500">No centers yet</p>
                        <p className="text-caption text-neutral-400">
                            Add a Zoho, Meta, or Google connector from Settings &rarr; Integrations
                            to start configuring center details.
                        </p>
                    </div>
                )}

                {/* Success state — center cards */}
                {!connectorsLoading && !connectorsError && sorted.length > 0 && (
                    <div className="grid gap-4 md:grid-cols-2">
                        {sorted.map((c) => (
                            <CenterCard
                                key={c.id}
                                connector={c}
                                displayName={centerName(c)}
                                onSaved={() =>
                                    queryClient.invalidateQueries({
                                        queryKey: ['ad-connectors-all', instituteId],
                                    })
                                }
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

// ── Center card ───────────────────────────────────────────────────────────────

function CenterCard({
    connector,
    displayName,
    onSaved,
}: {
    connector: ConnectorListItem;
    displayName: string;
    onSaved: () => void;
}) {
    const existingFull = useMemo(
        () => parseJson(connector.defaultValuesJson),
        [connector.defaultValuesJson]
    );

    const initialStructured = useMemo(
        () => extractStructured(existingFull),
        [existingFull]
    );

    const [fields, setFields] = useState<Record<string, string>>(initialStructured);

    // Sync local state when upstream data changes (after refetch/invalidate).
    useEffect(() => {
        setFields(extractStructured(parseJson(connector.defaultValuesJson)));
    }, [connector.defaultValuesJson]);

    const dirty = useMemo(
        () => JSON.stringify(fields) !== JSON.stringify(initialStructured),
        [fields, initialStructured]
    );

    const { mutate: save, isPending } = useMutation({
        mutationFn: () =>
            updateConnector(connector.id, {
                defaultValuesJson: mergeAndSerialize(existingFull, fields),
            }),
        onSuccess: () => {
            toast.success('Center details saved');
            onSaved();
        },
        onError: (err: unknown) => {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                'Failed to save center details';
            toast.error(msg);
        },
    });

    const handleReset = () => {
        setFields({ ...initialStructured });
    };

    const statusType =
        connector.connectionStatus === 'ACTIVE'
            ? ('SUCCESS' as const)
            : connector.connectionStatus === 'ERROR' || connector.connectionStatus === 'FAILED'
              ? ('DANGER' as const)
              : ('WARNING' as const);

    return (
        <Card className="flex flex-col">
            <CardHeader className="pb-3">
                <CardTitle className="flex flex-wrap items-center gap-2 text-subtitle">
                    <span className="rounded-sm bg-neutral-100 px-2 py-0.5 text-caption font-semibold text-neutral-700">
                        {VENDOR_LABEL[connector.vendor] ?? connector.vendor}
                    </span>
                    {connector.vendorId && (
                        <span className="font-mono text-caption text-neutral-500">
                            {connector.vendorId}
                        </span>
                    )}
                    <StatusChip
                        text={connector.connectionStatus}
                        textSize="text-caption"
                        status={statusType}
                        showIcon={false}
                    />
                </CardTitle>
                <p className="text-body font-semibold text-foreground">{displayName}</p>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-4">
                {/* Structured fields */}
                <div className="space-y-3">
                    {CENTER_FIELDS.map((f) => (
                        <MyInput
                            key={f.jsonKey}
                            label={f.label}
                            inputType="text"
                            size="medium"
                            inputPlaceholder={f.placeholder}
                            input={fields[f.jsonKey] ?? ''}
                            onChangeFunction={(e) =>
                                setFields((prev) => ({
                                    ...prev,
                                    [f.jsonKey]: e.target.value,
                                }))
                            }
                            className="w-full sm:w-full"
                        />
                    ))}
                </div>

                {/* Card footer actions */}
                <div className="mt-auto flex justify-end gap-2 border-t border-border pt-3">
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={handleReset}
                        disable={!dirty || isPending}
                    >
                        <ArrowCounterClockwise className="size-3.5" />
                        Reset
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        onAsyncClick={async () => save()}
                        loadingText="Saving…"
                        disable={!dirty || isPending}
                    >
                        <FloppyDisk className="size-3.5" />
                        Save
                    </MyButton>
                </div>
            </CardContent>
        </Card>
    );
}
