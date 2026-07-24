import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useCustomFieldSetup } from '@/routes/audience-manager/list/-hooks/useCustomFieldSetup';
import type {
    ListCustomFieldControls,
    ListCustomFieldSurface,
    ListCustomFieldSurfaceControls,
} from '@/types/display-settings';

interface ListCustomFieldControlsCardProps {
    /** The unified per-surface controls from the display-settings blob. */
    value: ListCustomFieldControls | undefined;
    /** Legacy leads filter ids (leadsFilterCustomFields) — pre-unified config
     *  that seeds the LEADS surface until it is explicitly saved here. */
    legacyLeadsFields: string[];
    /** Bubbles the next controls up to the parent display-settings state so
     *  the shared unsaved-changes bar persists it. */
    onChange: (next: ListCustomFieldControls) => void;
}

const SURFACES: Array<{ id: ListCustomFieldSurface; label: string; pages: string }> = [
    { id: 'LEADS', label: 'Leads', pages: 'Lead List + Recent Leads' },
    { id: 'CONTACTS', label: 'All Contacts', pages: 'Manage Students → All Contacts' },
    { id: 'STUDENTS', label: 'Students', pages: 'Manage Students → Student List' },
];

/**
 * Institute-wide (applies to all roles): which custom fields are exposed as
 * filters — and, where supported, sortable columns — on each admin list
 * surface. Controlled card; toggling bubbles via onChange into the
 * display-settings blob and persists through the panel's floating save bar.
 *
 * Unconfigured surfaces show their effective legacy behavior so saving without
 * touching a surface never changes what admins see today: LEADS seeds from the
 * legacy leadsFilterCustomFields key, STUDENTS from its historical
 * auto-expose (every text + dropdown field), CONTACTS from none.
 */
export const ListCustomFieldControlsCard = ({
    value,
    legacyLeadsFields,
    onChange,
}: ListCustomFieldControlsCardProps) => {
    const instituteId = getCurrentInstituteId();
    const { data: fields, isLoading } = useCustomFieldSetup(instituteId ?? undefined);
    const [surface, setSurface] = useState<ListCustomFieldSurface>('LEADS');

    const sortedFields = useMemo(
        () => [...(fields ?? [])].sort((a, b) => (a.form_order ?? 0) - (b.form_order ?? 0)),
        [fields]
    );

    // Effective controls for a surface: saved entry, else its legacy default.
    const effectiveFor = (s: ListCustomFieldSurface): ListCustomFieldSurfaceControls => {
        const saved = value?.[s];
        if (saved) {
            return {
                filterFields: saved.filterFields ?? [],
                sortableFields: saved.sortableFields ?? [],
            };
        }
        if (s === 'LEADS') return { filterFields: legacyLeadsFields, sortableFields: [] };
        if (s === 'STUDENTS') {
            return {
                filterFields: sortedFields
                    .filter((f) => {
                        const type = (f.field_type ?? '').toUpperCase();
                        return type === 'TEXT' || type === 'DROPDOWN';
                    })
                    .map((f) => f.custom_field_id),
                sortableFields: [],
            };
        }
        return { filterFields: [], sortableFields: [] };
    };

    const current = effectiveFor(surface);
    const filterSet = useMemo(() => new Set(current.filterFields), [current.filterFields]);
    const sortSet = useMemo(() => new Set(current.sortableFields), [current.sortableFields]);

    const toggle = (kind: 'filterFields' | 'sortableFields', fieldId: string, on: boolean) => {
        const next = new Set(current[kind]);
        if (on) next.add(fieldId);
        else next.delete(fieldId);
        onChange({
            ...(value ?? {}),
            [surface]: { ...current, [kind]: Array.from(next) },
        });
    };

    const surfaceMeta = SURFACES.find((s) => s.id === surface);

    return (
        <Card>
            <CardHeader>
                <CardTitle>List Filters &amp; Sorting — Custom Fields</CardTitle>
                <CardDescription>
                    Choose which custom fields appear as filters on each list page (applies to
                    everyone). Each enabled field adds a searchable multi-select to that page&apos;s
                    filter bar; turning it off hides the filter and stops loading its values.
                    Sortable applies where custom-field column sorting is available.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs
                    value={surface}
                    onValueChange={(v) => setSurface(v as ListCustomFieldSurface)}
                >
                    <TabsList>
                        {SURFACES.map((s) => (
                            <TabsTrigger key={s.id} value={s.id}>
                                {s.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
                {surfaceMeta && (
                    <p className="mt-2 text-xs text-muted-foreground">
                        Applies to: {surfaceMeta.pages}
                    </p>
                )}
                {isLoading ? (
                    <p className="mt-3 text-sm text-muted-foreground">Loading custom fields…</p>
                ) : sortedFields.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                        No custom fields configured for this institute yet.
                    </p>
                ) : (
                    <div className="mt-2 flex flex-col">
                        <div className="flex items-center justify-end gap-8 border-b border-border py-2 pr-1 text-xs font-medium text-muted-foreground">
                            <span>Filter</span>
                            <span>Sort</span>
                        </div>
                        {sortedFields.map((field) => (
                            <div
                                key={field.custom_field_id}
                                className="flex items-center justify-between gap-4 border-b border-border py-3.5 last:border-b-0"
                            >
                                <Label
                                    htmlFor={`list-cf-filter-${surface}-${field.custom_field_id}`}
                                    className="cursor-pointer text-sm font-medium text-neutral-800"
                                >
                                    {field.field_name}
                                </Label>
                                <div className="flex items-center gap-8 pr-1">
                                    <Switch
                                        id={`list-cf-filter-${surface}-${field.custom_field_id}`}
                                        checked={filterSet.has(field.custom_field_id)}
                                        onCheckedChange={(v) =>
                                            toggle('filterFields', field.custom_field_id, v)
                                        }
                                    />
                                    <Switch
                                        id={`list-cf-sort-${surface}-${field.custom_field_id}`}
                                        checked={sortSet.has(field.custom_field_id)}
                                        onCheckedChange={(v) =>
                                            toggle('sortableFields', field.custom_field_id, v)
                                        }
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
