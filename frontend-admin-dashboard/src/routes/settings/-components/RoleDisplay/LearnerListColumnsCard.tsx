import { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { LearnerListColumnSettings } from '@/types/display-settings';
import {
    getCustomFieldSettings,
    getCustomFieldSettingsFromCache,
    type CustomFieldSettingsData,
} from '@/services/custom-field-settings';
import { getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

// Membership columns shown only when the institute has org-associated batches.
// They follow the opt-in pattern (hidden by default) — admin explicitly enables them.
// Accessors MUST match the column ids in `myColumns` (table-column-data.tsx).
const MEMBERSHIP_COLUMNS: { accessor: string; label: string }[] = [
    { accessor: 'membership_role', label: 'Membership Role' },
    { accessor: 'membership_type', label: 'Membership Type' },
];

// Stable list of admin-controlled system columns + their human labels. The
// accessors here MUST match the column ids in `myColumns` (table-column-data.tsx)
// AND the SYSTEM_FIELD_KEY_TO_ACCESSOR mapping. Filter-driven columns
// (Batch/Invite/Plan/Amount/Preferred Batch) are intentionally omitted — they're
// gated by filter state, never by role.
const SYSTEM_COLUMNS: { accessor: string; label: string }[] = [
    { accessor: 'full_name', label: 'Full Name' },
    { accessor: 'username', label: 'Username' },
    { accessor: 'institute_enrollment_number', label: 'Enrollment Number' },
    { accessor: 'linked_institute_name', label: 'College/School' },
    { accessor: 'gender', label: 'Gender' },
    { accessor: 'mobile_number', label: 'Mobile Number' },
    { accessor: 'email', label: 'Email ID' },
    { accessor: 'fathers_name', label: "Father/Male Guardian's Name" },
    { accessor: 'mothers_name', label: "Mother/Female Guardian's Name" },
    { accessor: 'parents_mobile_number', label: "Father/Male Guardian's Mobile Number" },
    { accessor: 'parents_email', label: "Father/Male Guardian's Email" },
    { accessor: 'parents_to_mother_mobile_number', label: "Mother/Female Guardian's Mobile Number" },
    { accessor: 'parents_to_mother_email', label: "Mother/Female Guardian's Email" },
    { accessor: 'city', label: 'City' },
    { accessor: 'region', label: 'State' },
    { accessor: 'attendance_percent', label: 'Attendance' },
    { accessor: 'country', label: 'Country' },
    { accessor: 'expiry_date', label: 'Session Expiry' },
    { accessor: 'status', label: 'Status' },
    { accessor: 'referral_count', label: 'Referrals Count' },
    { accessor: 'counsellor', label: 'Counsellor' },
];

interface LearnerListColumnsCardProps {
    settings: LearnerListColumnSettings | undefined;
    onChange: (next: LearnerListColumnSettings) => void;
}

export const LearnerListColumnsCard = ({ settings, onChange }: LearnerListColumnsCardProps) => {
    const learnerLabel = getTerminologyPlural(RoleTerms.Learner, SystemTerms.Learner);
    const hidden = useMemo(() => new Set(settings?.hiddenColumns ?? []), [settings?.hiddenColumns]);
    // Custom fields default OFF — admin opts in per role. enabledCustomFields is the
    // explicit allow-list; missing/empty means no custom fields visible for this role.
    const enabledCustom = useMemo(
        () => new Set(settings?.enabledCustomFields ?? []),
        [settings?.enabledCustomFields]
    );

    // Source the custom-field catalogue from the institute settings. Cache-first; if it's
    // missing (admin landed here without hitting the Custom Fields page first), fetch.
    // The institute-wide visibility.learnersList flag is intentionally ignored — role
    // display-settings is the single source of truth for learner-list column visibility.
    const [fieldData, setFieldData] = useState<CustomFieldSettingsData | null>(() =>
        getCustomFieldSettingsFromCache()
    );

    useEffect(() => {
        if (fieldData) return;
        let cancelled = false;
        getCustomFieldSettings()
            .then((data) => {
                if (!cancelled) setFieldData(data);
            })
            .catch((err) => console.error('Failed to load custom fields for role card', err));
        return () => {
            cancelled = true;
        };
    }, [fieldData]);

    const customColumns = useMemo(() => {
        if (!fieldData) return [] as { accessor: string; label: string }[];
        const all = [
            ...fieldData.instituteFields,
            ...fieldData.customFields,
            ...fieldData.fieldGroups.flatMap((g) => g.fields),
        ];
        const byId = new Map<string, { accessor: string; label: string }>();
        for (const f of all) {
            if (!f.id) continue;
            if (!byId.has(f.id)) byId.set(f.id, { accessor: f.id, label: f.name });
        }
        return Array.from(byId.values());
    }, [fieldData]);

    // Count badges show by default; only false when explicitly turned off.
    const showCountBadges = settings?.showCountBadges !== false;

    // System columns: toggling off ADDS to hiddenColumns (default visible).
    const setSystemVisible = (accessor: string, visible: boolean) => {
        const nextHidden = new Set(hidden);
        if (visible) nextHidden.delete(accessor);
        else nextHidden.add(accessor);
        onChange({
            hiddenColumns: Array.from(nextHidden),
            enabledCustomFields: settings?.enabledCustomFields,
            showCountBadges: settings?.showCountBadges,
        });
    };

    // Custom fields: toggling on ADDS to enabledCustomFields (default hidden).
    const setCustomVisible = (accessor: string, visible: boolean) => {
        const nextEnabled = new Set(enabledCustom);
        if (visible) nextEnabled.add(accessor);
        else nextEnabled.delete(accessor);
        onChange({
            hiddenColumns: settings?.hiddenColumns ?? [],
            enabledCustomFields: Array.from(nextEnabled),
            showCountBadges: settings?.showCountBadges,
        });
    };

    const setShowCountBadges = (visible: boolean) => {
        onChange({
            hiddenColumns: settings?.hiddenColumns ?? [],
            enabledCustomFields: settings?.enabledCustomFields,
            showCountBadges: visible,
        });
    };

    const renderSystemRow = ({ accessor, label }: { accessor: string; label: string }) => {
        const visible = !hidden.has(accessor);
        return (
            <div
                key={accessor}
                className="flex items-center justify-between border-b border-neutral-100 py-2 last:border-b-0"
            >
                <Label className="text-sm text-neutral-700">{label}</Label>
                <Switch checked={visible} onCheckedChange={(v) => setSystemVisible(accessor, v)} />
            </div>
        );
    };

    const renderCustomRow = ({ accessor, label }: { accessor: string; label: string }) => {
        const visible = enabledCustom.has(accessor);
        return (
            <div
                key={accessor}
                className="flex items-center justify-between border-b border-neutral-100 py-2 last:border-b-0"
            >
                <Label className="text-sm text-neutral-700">{label}</Label>
                <Switch checked={visible} onCheckedChange={(v) => setCustomVisible(accessor, v)} />
            </div>
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{`${learnerLabel} List Columns`}</CardTitle>
                <CardDescription>
                    {`Turn off columns this role should not see in the ${learnerLabel.toLowerCase()} list. ` +
                        'Filter-driven columns (Batch, Invite, Plan, Amount) are not listed here — they only ' +
                        'show when their filter is active. Hiding a column here also hides its filter chip.'}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
                <div>
                    <h4 className="mb-2 text-sm font-semibold text-neutral-600">Header</h4>
                    <div className="flex items-center justify-between border-b border-neutral-100 py-2 last:border-b-0">
                        <Label className="text-sm text-neutral-700">
                            Count badges (Total / Active / Inactive)
                        </Label>
                        <Switch
                            checked={showCountBadges}
                            onCheckedChange={(v) => setShowCountBadges(v)}
                        />
                    </div>
                </div>
                <div>
                    <h4 className="mb-2 text-sm font-semibold text-neutral-600">System columns</h4>
                    <div className="flex flex-col">{SYSTEM_COLUMNS.map(renderSystemRow)}</div>
                </div>
                <div>
                    <h4 className="mb-2 text-sm font-semibold text-neutral-600">
                        Membership columns
                    </h4>
                    <p className="mb-2 text-xs text-neutral-400">
                        These columns are hidden by default and only visible when the institute has
                        org-associated batches. Toggle on the ones this role should see.
                    </p>
                    <div className="flex flex-col">{MEMBERSHIP_COLUMNS.map(renderCustomRow)}</div>
                </div>
                <div>
                    <h4 className="mb-2 text-sm font-semibold text-neutral-600">
                        Custom field columns
                    </h4>
                    <p className="mb-2 text-xs text-neutral-400">
                        Custom field columns are hidden by default. Toggle on the ones this role
                        should see in the learner list.
                    </p>
                    {fieldData == null ? (
                        <p className="text-xs text-neutral-400">Loading custom fields…</p>
                    ) : customColumns.length > 0 ? (
                        <div className="flex flex-col">{customColumns.map(renderCustomRow)}</div>
                    ) : (
                        <p className="text-xs text-neutral-500">
                            No custom fields configured for this institute yet. Add them in the
                            Custom Fields settings, then come back here to enable them per role.
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
