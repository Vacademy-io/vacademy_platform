import { useMemo, useState } from 'react';
import { Globe, Stack, Tag } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import PackageSelector from '@/components/design-system/PackageSelector';
import { Textarea } from '@/components/ui/textarea';
import {
    getTerminologyPlural,
    getTerminology,
} from '@/components/common/layout-container/sidebar/utils';
import {
    ContentTerms,
    OtherTerms,
    RoleTerms,
    SystemTerms,
} from '@/routes/settings/-components/NamingSettings';

export type CouponScopeMode = 'all' | 'sessions' | 'invites';

export interface CouponScopeValue {
    mode: CouponScopeMode;
    packageSessionIds: string[];
    enrollInviteIds: string[];
}

export interface CouponScopePickerProps {
    instituteId: string;
    value: CouponScopeValue;
    onChange: (value: CouponScopeValue) => void;
    /** When true, the picker is read-only — used post-redemption when scope is frozen. */
    disabled?: boolean;
    className?: string;
}

type TabSpec = { mode: CouponScopeMode; label: string; icon: typeof Globe; description: string };

const buildTabs = (
    learnerSingular: string,
    learnerPlural: string,
    batchPlural: string,
    inviteLabel: string
): TabSpec[] => [
    {
        mode: 'all',
        label: 'Institute-wide',
        icon: Globe,
        description: `Any ${learnerSingular.toLowerCase()} enrolling in this institute can apply this coupon.`,
    },
    {
        mode: 'sessions',
        label: `Specific ${batchPlural}`,
        icon: Stack,
        description: `Only ${learnerPlural.toLowerCase()} enrolling into the selected ${batchPlural.toLowerCase()} can apply this coupon.`,
    },
    {
        mode: 'invites',
        label: `Specific ${inviteLabel}`,
        icon: Tag,
        description: `Only ${learnerPlural.toLowerCase()} enrolling through the listed invite links can apply this coupon.`,
    },
];

const parseInviteIds = (raw: string): string[] =>
    raw
        .split(/[,\n\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);

export const CouponScopePicker = ({
    instituteId,
    value,
    onChange,
    disabled,
    className,
}: CouponScopePickerProps) => {
    const [inviteRaw, setInviteRaw] = useState(value.enrollInviteIds.join(', '));

    const sessionsLabel = useMemo(
        () => getTerminologyPlural(ContentTerms.Session, SystemTerms.Session),
        []
    );
    const inviteLabel = useMemo(
        () => getTerminologyPlural(OtherTerms.Invite, SystemTerms.Invite),
        []
    );
    const learnerSingular = useMemo(
        () => getTerminology(RoleTerms.Learner, SystemTerms.Learner),
        []
    );
    const learnerPlural = useMemo(
        () => getTerminologyPlural(RoleTerms.Learner, SystemTerms.Learner),
        []
    );
    const batchPlural = useMemo(
        () => getTerminologyPlural(ContentTerms.Batch, SystemTerms.Batch),
        []
    );
    const tabs = useMemo(
        () => buildTabs(learnerSingular, learnerPlural, batchPlural, inviteLabel),
        [learnerSingular, learnerPlural, batchPlural, inviteLabel]
    );

    const setMode = (mode: CouponScopeMode) => {
        if (disabled) return;
        onChange({
            mode,
            packageSessionIds: mode === 'sessions' ? value.packageSessionIds : [],
            enrollInviteIds: mode === 'invites' ? value.enrollInviteIds : [],
        });
    };

    return (
        <div className={cn('space-y-3', className)}>
            {/* Segmented control */}
            <div
                className={cn(
                    'grid grid-cols-1 gap-2 sm:grid-cols-3',
                    disabled && 'pointer-events-none opacity-60'
                )}
            >
                {tabs.map(({ mode, label, icon: Icon }) => {
                    const isActive = value.mode === mode;
                    return (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => setMode(mode)}
                            className={cn(
                                'flex items-center gap-2 rounded-md border px-3 py-2 text-left text-body transition-colors',
                                isActive
                                    ? 'border-primary-400 bg-primary-50 text-primary-700'
                                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-primary-200'
                            )}
                            aria-pressed={isActive}
                        >
                            <Icon size={16} weight={isActive ? 'fill' : 'regular'} />
                            <span className="text-caption font-medium">{label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Description for current mode */}
            <p className="text-caption text-neutral-500">
                {tabs.find((t) => t.mode === value.mode)?.description}
            </p>

            {/* Mode-specific control */}
            {value.mode === 'sessions' && (
                <div className="rounded-md border border-neutral-200 bg-white p-3">
                    <p className="mb-2 text-caption font-medium text-neutral-700">
                        Pick one or more {sessionsLabel.toLowerCase()}
                    </p>
                    <PackageSelector
                        instituteId={instituteId}
                        multiSelect
                        initialPackageSessionIds={value.packageSessionIds}
                        onChange={(selection) => {
                            if (disabled) return;
                            onChange({
                                ...value,
                                packageSessionIds: selection.packageSessionIds ?? [],
                            });
                        }}
                    />
                </div>
            )}

            {value.mode === 'invites' && (
                <div className="rounded-md border border-neutral-200 bg-white p-3">
                    <label
                        htmlFor="coupon-invite-ids"
                        className="mb-2 block text-caption font-medium text-neutral-700"
                    >
                        Paste {getTerminology(OtherTerms.Invite, SystemTerms.Invite).toLowerCase()}{' '}
                        IDs
                    </label>
                    <Textarea
                        id="coupon-invite-ids"
                        rows={3}
                        placeholder="Comma- or newline-separated invite IDs"
                        value={inviteRaw}
                        disabled={disabled}
                        onChange={(e) => {
                            setInviteRaw(e.target.value);
                            onChange({
                                ...value,
                                enrollInviteIds: parseInviteIds(e.target.value),
                            });
                        }}
                        className="font-mono text-caption"
                    />
                    <p className="mt-1 text-caption text-neutral-400">
                        {value.enrollInviteIds.length} ID
                        {value.enrollInviteIds.length === 1 ? '' : 's'} captured
                    </p>
                </div>
            )}
        </div>
    );
};
