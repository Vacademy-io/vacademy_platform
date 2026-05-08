/**
 * LeadFormResponseCard — surfaces the audience-form answers of a lead in the
 * side-view, stitched alongside the existing Overview content.
 *
 * Only renders when {@code selectedStudent._response_fields} is populated
 * (which campaign-users-table.tsx attaches when a lead row is clicked). For
 * users coming from manage-students / manage-contacts the prop is absent and
 * the card is silently skipped.
 *
 * Each field is rendered with its display name, a type-aware formatted value,
 * and (for {@code multi_select}) a row of chips so multiple selections read
 * cleanly instead of as raw JSON.
 */

import { ListChecks, FileText, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import {
    formatCustomFieldValue,
    isMultiSelectType,
    parseMultiSelectValue,
} from '../../-utils/format-custom-field-value';

export interface LeadResponseField {
    id: string;
    name: string;
    type: string;
    rawValue: string | null;
}

const isUrlValue = (value: string | null) =>
    !!value && (value.startsWith('http://') || value.startsWith('https://'));

const Row = ({ field }: { field: LeadResponseField }) => {
    const { name, type, rawValue } = field;
    const normalized = (type ?? '').toLowerCase();

    if (isMultiSelectType(type)) {
        const items = parseMultiSelectValue(rawValue);
        return (
            <div className="flex items-start gap-3 px-3 py-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                    <ListChecks className="size-3.5" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                        {name}
                    </p>
                    {items.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {items.map((item, idx) => (
                                <Badge
                                    key={`${item}-${idx}`}
                                    variant="secondary"
                                    className="bg-primary-50 text-primary-700 hover:bg-primary-50"
                                >
                                    {item}
                                </Badge>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm italic text-neutral-400">Not provided</p>
                    )}
                </div>
            </div>
        );
    }

    if (normalized === 'file' && isUrlValue(rawValue)) {
        return (
            <div className="flex items-start gap-3 px-3 py-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                    <FileText className="size-3.5" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                        {name}
                    </p>
                    <a
                        href={rawValue!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-1.5 truncate text-sm font-medium text-primary-600 hover:underline"
                    >
                        <span className="truncate">View attachment</span>
                        <ExternalLink className="size-3.5 shrink-0" />
                    </a>
                </div>
            </div>
        );
    }

    const display = formatCustomFieldValue(rawValue, type);
    return (
        <div className="flex items-start gap-3 px-3 py-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                <FileText className="size-3.5" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                    {name}
                </p>
                <p className="break-words text-sm font-medium text-neutral-900">
                    {display === '-' ? (
                        <span className="font-normal italic text-neutral-400">Not provided</span>
                    ) : (
                        display
                    )}
                </p>
            </div>
        </div>
    );
};

export const LeadFormResponseCard = () => {
    const { selectedStudent } = useStudentSidebar();
    // Loose access — `_response_fields` is attached by audience-list flows only;
    // not part of the canonical StudentTable shape so consumers from other
    // surfaces (manage-students, manage-contacts) don't carry it.
    const fields = (selectedStudent as unknown as { _response_fields?: LeadResponseField[] })
        ?._response_fields;

    if (!fields || fields.length === 0) return null;

    const campaignName = (selectedStudent as unknown as { _audience_campaign_name?: string })
        ?._audience_campaign_name;

    return (
        <Card className="border-neutral-200 shadow-none">
            <CardHeader className="px-4 pb-3 pt-4">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                    <ListChecks className="size-4 text-primary-500" />
                    Form Response
                    {campaignName && (
                        <span className="text-xs font-normal text-neutral-500">
                            · {campaignName}
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="px-1 pb-3 pt-0">
                {fields.map((field, idx) => (
                    <div key={field.id || `${field.name}-${idx}`}>
                        <Row field={field} />
                        {idx < fields.length - 1 && <Separator className="bg-neutral-100" />}
                    </div>
                ))}
            </CardContent>
        </Card>
    );
};

export default LeadFormResponseCard;
