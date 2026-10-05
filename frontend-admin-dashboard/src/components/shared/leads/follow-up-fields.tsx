/**
 * The three optional dropdowns a counsellor fills when logging a follow-up:
 * what the student said, how the follow-up happened, and what happens next.
 *
 * Off for every institute until one turns it on in Settings → Lead settings →
 * Follow-up fields and supplies its own option lists, so nothing changes for
 * anyone who hasn't asked for it. The values are free text end to end (the
 * column is VARCHAR, not an enum) because renaming an option has to stay a
 * settings change, not a migration.
 *
 * Rendered by all four places a follow-up can be created:
 *   - add-lead-note-dialog (Follow Up tab)
 *   - complete-followup-popover ("Schedule next")
 *   - post-call-disposition-sheet
 *   - student-lead-profile
 */
import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/design-system/searchable-select';
import { useLeadSettings } from '@/hooks/use-lead-settings';
import { cn } from '@/lib/utils';

/** What the counsellor recorded. Empty strings mean "not answered" — all three are optional. */
export interface FollowUpFieldValues {
    studentResponse: string;
    followUpMode: string;
    nextAction: string;
}

export const EMPTY_FOLLOW_UP_FIELDS: FollowUpFieldValues = {
    studentResponse: '',
    followUpMode: '',
    nextAction: '',
};

/** snake_case payload keys for CREATE_LEAD_FOLLOWUP. Omits anything left blank. */
export function followUpFieldsPayload(values: FollowUpFieldValues): Record<string, string> {
    const payload: Record<string, string> = {};
    if (values.studentResponse) payload.student_response = values.studentResponse;
    if (values.followUpMode) payload.follow_up_mode = values.followUpMode;
    if (values.nextAction) payload.next_action = values.nextAction;
    return payload;
}

/**
 * Local state for the three fields plus the institute's option lists.
 *
 * `visible` is false when the institute has the block switched off, so a call
 * site can skip rendering without reaching into settings itself.
 */
export function useFollowUpFields() {
    const { followUpFields } = useLeadSettings();
    const [values, setValues] = useState<FollowUpFieldValues>(EMPTY_FOLLOW_UP_FIELDS);
    const reset = () => setValues(EMPTY_FOLLOW_UP_FIELDS);
    const hasAnyList =
        followUpFields.studentResponses.length > 0 ||
        followUpFields.followUpModes.length > 0 ||
        followUpFields.nextActions.length > 0;
    return {
        values,
        setValues,
        reset,
        visible: followUpFields.enabled && hasAnyList,
        /** Spread into the CREATE_LEAD_FOLLOWUP body. Empty when the block is off. */
        payload: followUpFields.enabled ? followUpFieldsPayload(values) : {},
    };
}

/**
 * Whether this institute refuses a follow-up with an empty note.
 *
 * Deliberately separate from {@link useFollowUpFields}: the note box already
 * exists on every follow-up form and is nothing to do with the three dropdowns,
 * so a call site can require a note without rendering any of them.
 */
export function useFollowUpNotesRequired(): boolean {
    const { followUpFields } = useLeadSettings();
    return followUpFields.notesRequired;
}

interface FollowUpFieldsProps {
    values: FollowUpFieldValues;
    onChange: (next: FollowUpFieldValues) => void;
    /** Pass false inside a Dialog/Sheet — a portalled list can't be scrolled there. */
    portal?: boolean;
    className?: string;
    disabled?: boolean;
}

/**
 * Renders only the dropdowns the institute has options for: an institute that
 * cares about Student response but not Mode configures just the one list and
 * sees just the one control.
 */
export function FollowUpFields({
    values,
    onChange,
    portal = true,
    className,
    disabled = false,
}: FollowUpFieldsProps) {
    const { followUpFields } = useLeadSettings();
    if (!followUpFields.enabled) return null;

    const fields: { key: keyof FollowUpFieldValues; label: string; options: string[] }[] = [
        {
            key: 'studentResponse',
            label: 'Student response',
            options: followUpFields.studentResponses,
        },
        { key: 'followUpMode', label: 'Follow-up mode', options: followUpFields.followUpModes },
        { key: 'nextAction', label: 'Next follow-up action', options: followUpFields.nextActions },
    ];
    const shown = fields.filter((f) => f.options.length > 0);
    if (shown.length === 0) return null;

    return (
        <div className={cn('space-y-3', className)}>
            {shown.map(({ key, label, options }) => (
                <div key={key} className="space-y-1.5">
                    {/* No htmlFor: SearchableSelect's trigger is a combobox button,
                        not a form control with an id to point at. */}
                    <Label className="text-sm font-medium">{label}</Label>
                    <SearchableSelect
                        options={options.map((o) => ({ label: o, value: o }))}
                        value={values[key]}
                        // These are optional, and SearchableSelect has no clear row —
                        // picking the chosen option again unsets it.
                        onChange={(v) => onChange({ ...values, [key]: v === values[key] ? '' : v })}
                        placeholder={`Select ${label.toLowerCase()}`}
                        searchPlaceholder="Search…"
                        portal={portal}
                        disabled={disabled}
                        triggerClassName="h-9"
                    />
                </div>
            ))}
        </div>
    );
}
