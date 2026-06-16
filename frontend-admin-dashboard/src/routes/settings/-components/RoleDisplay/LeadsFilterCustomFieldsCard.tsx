import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useCustomFieldSetup } from '@/routes/audience-manager/list/-hooks/useCustomFieldSetup';

interface LeadsFilterCustomFieldsCardProps {
    /** Enabled custom_field_ids. */
    value: string[];
    /** Bubbles the next enabled set up to the parent display-settings state so
     *  the shared unsaved-changes bar persists it. */
    onChange: (next: string[]) => void;
}

/**
 * Institute-wide (applies to all roles): which custom fields show as filters on
 * the leads views (open Lead List + Recent Leads). Controlled card — it owns no
 * save logic; toggling bubbles via onChange into the display-settings blob, so
 * it's persisted by the panel's floating "Save now" bar like every other card.
 * Each enabled field renders a searchable multi-select in the filter bar;
 * disabled fields render no control and never call the distinct-values API.
 */
export const LeadsFilterCustomFieldsCard = ({
    value,
    onChange,
}: LeadsFilterCustomFieldsCardProps) => {
    const instituteId = getCurrentInstituteId();
    const { data: fields, isLoading } = useCustomFieldSetup(instituteId ?? undefined);

    const enabled = useMemo(() => new Set(value ?? []), [value]);

    const toggle = (fieldId: string, on: boolean) => {
        const next = new Set(enabled);
        if (on) next.add(fieldId);
        else next.delete(fieldId);
        onChange(Array.from(next));
    };

    const sortedFields = useMemo(
        () => [...(fields ?? [])].sort((a, b) => (a.form_order ?? 0) - (b.form_order ?? 0)),
        [fields]
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Lead Filters — Custom Fields</CardTitle>
                <CardDescription>
                    Choose which custom fields appear as filters on the Lead List and Recent Leads
                    views (applies to everyone). Each enabled field adds a searchable multi-select;
                    turning it off hides the filter and stops loading its values.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading custom fields…</p>
                ) : sortedFields.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No custom fields configured for this institute yet.
                    </p>
                ) : (
                    <div className="flex flex-col">
                        {sortedFields.map((field) => (
                            <div
                                key={field.custom_field_id}
                                className="flex items-center justify-between gap-4 border-b border-border py-3.5 last:border-b-0"
                            >
                                <Label
                                    htmlFor={`leads-filter-${field.custom_field_id}`}
                                    className="cursor-pointer text-sm font-medium text-neutral-800"
                                >
                                    {field.field_name}
                                </Label>
                                <Switch
                                    id={`leads-filter-${field.custom_field_id}`}
                                    checked={enabled.has(field.custom_field_id)}
                                    onCheckedChange={(v) => toggle(field.custom_field_id, v)}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
