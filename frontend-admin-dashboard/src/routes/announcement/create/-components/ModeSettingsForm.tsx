import type { ReactNode } from 'react';
import type { ModeType } from '@/services/announcement';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { FieldError, FieldHint } from './primitives';
import type { FieldErrors, ModeSettings } from '../-types';

interface ModeSettingsFormProps {
    mode: ModeType;
    settings: ModeSettings;
    onChange: (settings: ModeSettings) => void;
    errors: FieldErrors;
    showErrors: boolean;
}

function Field({
    label,
    error,
    hint,
    children,
}: {
    label: string;
    error?: string;
    hint?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="space-y-1">
            <Label className="text-caption font-semibold">{label}</Label>
            {children}
            {hint && <FieldHint>{hint}</FieldHint>}
            <FieldError message={error} />
        </div>
    );
}

export function ModeSettingsForm({
    mode,
    settings,
    onChange,
    errors,
    showErrors,
}: ModeSettingsFormProps) {
    const set = (key: string, value: unknown) => onChange({ ...settings, [key]: value });
    const err = (key: string) => (showErrors ? errors[`modes.${mode}.${key}`] : undefined);
    const str = (key: string) => (settings[key] as string) || '';
    const invalid = (key: string) => (err(key) ? 'border-danger-400' : undefined);

    switch (mode) {
        case 'SYSTEM_ALERT':
            return (
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Priority" error={err('priority')}>
                        <Select
                            value={str('priority') || 'HIGH'}
                            onValueChange={(value) => set('priority', value)}
                        >
                            <SelectTrigger className={cn(invalid('priority'))}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="HIGH">High</SelectItem>
                                <SelectItem value="MEDIUM">Medium</SelectItem>
                                <SelectItem value="LOW">Low</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Expires at" hint="Leave empty for an alert that never expires.">
                        <Input
                            type="datetime-local"
                            value={str('expiresAt')}
                            onChange={(e) => set('expiresAt', e.target.value)}
                        />
                    </Field>
                </div>
            );

        case 'DASHBOARD_PIN':
            return (
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Position" error={err('position')}>
                        <Select
                            value={str('position') || 'TOP'}
                            onValueChange={(value) => set('position', value)}
                        >
                            <SelectTrigger className={cn(invalid('position'))}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="TOP">Top</SelectItem>
                                <SelectItem value="MIDDLE">Middle</SelectItem>
                                <SelectItem value="BOTTOM">Bottom</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Priority" hint="Higher numbers pin above lower ones.">
                        <Input
                            type="number"
                            value={Number(settings.priority ?? 10)}
                            onChange={(e) => set('priority', Number(e.target.value))}
                        />
                    </Field>
                    <Field label="Pinned from" error={err('pinStartTime')}>
                        <Input
                            type="datetime-local"
                            value={str('pinStartTime')}
                            onChange={(e) => set('pinStartTime', e.target.value)}
                            className={cn(invalid('pinStartTime'))}
                        />
                    </Field>
                    <Field label="Pinned until" error={err('pinEndTime')}>
                        <Input
                            type="datetime-local"
                            value={str('pinEndTime')}
                            onChange={(e) => set('pinEndTime', e.target.value)}
                            className={cn(invalid('pinEndTime'))}
                        />
                    </Field>
                </div>
            );

        case 'APP_OVERLAY':
            return (
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                        label="Show until"
                        error={err('showUntil')}
                        hint="The overlay stops appearing after this time even if never dismissed. Leave empty for no expiry."
                    >
                        <Input
                            type="datetime-local"
                            value={str('showUntil')}
                            onChange={(e) => set('showUntil', e.target.value)}
                            className={cn(invalid('showUntil'))}
                        />
                    </Field>
                    <Field label="Priority" error={err('priority')} hint="Between 1 and 10.">
                        <Input
                            type="number"
                            min={1}
                            max={10}
                            value={Number(settings.priority ?? 1)}
                            onChange={(e) => set('priority', Number(e.target.value))}
                            className={cn(invalid('priority'))}
                        />
                    </Field>
                    <label className="flex items-center gap-2 sm:col-span-2">
                        <Switch
                            checked={Boolean(settings.isDismissible)}
                            onCheckedChange={(value) => set('isDismissible', Boolean(value))}
                        />
                        <span className="text-caption">Allow people to dismiss it</span>
                    </label>
                </div>
            );

        case 'DM':
            return (
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Message priority">
                        <Input
                            type="number"
                            value={Number(settings.messagePriority ?? 5)}
                            onChange={(e) => set('messagePriority', Number(e.target.value))}
                        />
                    </Field>
                    <label className="flex items-center gap-2 sm:self-end sm:pb-2">
                        <Switch
                            checked={Boolean(settings.allowReplies)}
                            onCheckedChange={(value) => set('allowReplies', Boolean(value))}
                        />
                        <span className="text-caption">Allow replies</span>
                    </label>
                </div>
            );

        case 'STREAM':
            return (
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Package session id">
                        <Input
                            value={str('packageSessionId')}
                            onChange={(e) => set('packageSessionId', e.target.value)}
                            placeholder="Package session id"
                        />
                    </Field>
                    <Field label="Stream type">
                        <Select
                            value={str('streamType') || 'LIVE'}
                            onValueChange={(value) => set('streamType', value)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="LIVE">Live</SelectItem>
                                <SelectItem value="RECORDED">Recorded</SelectItem>
                                <SelectItem value="UPCOMING">Upcoming</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                </div>
            );

        case 'RESOURCES':
            return (
                <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Folder name" error={err('folderName')}>
                        <Input
                            value={str('folderName')}
                            onChange={(e) => set('folderName', e.target.value)}
                            placeholder="e.g. Circulars"
                            className={cn(invalid('folderName'))}
                        />
                    </Field>
                    <Field label="Category">
                        <Input
                            value={str('category')}
                            onChange={(e) => set('category', e.target.value)}
                            placeholder="Optional"
                        />
                    </Field>
                    <Field label="Access level">
                        <Select
                            value={str('accessLevel') || 'STUDENTS'}
                            onValueChange={(value) => set('accessLevel', value)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="STUDENTS">Students</SelectItem>
                                <SelectItem value="TEACHERS">Teachers</SelectItem>
                                <SelectItem value="ALL">Everyone</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                </div>
            );

        case 'COMMUNITY':
            return (
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Community type" error={err('communityType')}>
                        <Select
                            value={str('communityType') || 'SCHOOL'}
                            onValueChange={(value) => set('communityType', value)}
                        >
                            <SelectTrigger className={cn(invalid('communityType'))}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="SCHOOL">School</SelectItem>
                                <SelectItem value="CLASS">Class</SelectItem>
                                <SelectItem value="CLUB">Club</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Tags" hint="Comma separated.">
                        <Input
                            value={
                                Array.isArray(settings.tags)
                                    ? (settings.tags as string[]).join(', ')
                                    : ''
                            }
                            onChange={(e) =>
                                set(
                                    'tags',
                                    e.target.value
                                        .split(',')
                                        .map((t) => t.trim())
                                        .filter(Boolean)
                                )
                            }
                            placeholder="announcements, exams"
                        />
                    </Field>
                </div>
            );

        case 'TASKS':
            return (
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Task title" error={err('taskTitle')}>
                        <Input
                            value={str('taskTitle')}
                            onChange={(e) => set('taskTitle', e.target.value)}
                            className={cn(invalid('taskTitle'))}
                        />
                    </Field>
                    <Field label="Estimated minutes">
                        <Input
                            type="number"
                            value={Number(settings.estimatedDurationMinutes ?? 0)}
                            onChange={(e) =>
                                set('estimatedDurationMinutes', Number(e.target.value))
                            }
                        />
                    </Field>
                    <div className="sm:col-span-2">
                        <Field label="Task description">
                            <Textarea
                                value={str('taskDescription')}
                                onChange={(e) => set('taskDescription', e.target.value)}
                                placeholder="What should the learner do?"
                            />
                        </Field>
                    </div>
                    <div className="sm:col-span-2">
                        <Field label="Slide ids" error={err('slideIds')} hint="Comma separated.">
                            <Input
                                value={
                                    Array.isArray(settings.slideIds)
                                        ? (settings.slideIds as string[]).join(', ')
                                        : ''
                                }
                                onChange={(e) =>
                                    set(
                                        'slideIds',
                                        e.target.value
                                            .split(',')
                                            .map((t) => t.trim())
                                            // An empty box used to yield [''], which counted as one
                                            // slide and slipped past validation.
                                            .filter(Boolean)
                                    )
                                }
                                className={cn(invalid('slideIds'))}
                                placeholder="slide-id-1, slide-id-2"
                            />
                        </Field>
                    </div>
                    <Field label="Go live" error={err('goLiveDateTime')}>
                        <Input
                            type="datetime-local"
                            value={str('goLiveDateTime')}
                            onChange={(e) => set('goLiveDateTime', e.target.value)}
                            className={cn(invalid('goLiveDateTime'))}
                        />
                    </Field>
                    <Field label="Deadline" error={err('deadlineDateTime')}>
                        <Input
                            type="datetime-local"
                            value={str('deadlineDateTime')}
                            onChange={(e) => set('deadlineDateTime', e.target.value)}
                            className={cn(invalid('deadlineDateTime'))}
                        />
                    </Field>
                    <Field label="Status">
                        <Select
                            value={str('status') || 'SCHEDULED'}
                            onValueChange={(value) => set('status', value)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="DRAFT">Draft</SelectItem>
                                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                                <SelectItem value="LIVE">Live</SelectItem>
                                <SelectItem value="COMPLETED">Completed</SelectItem>
                                <SelectItem value="OVERDUE">Overdue</SelectItem>
                                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Reminder before (minutes)">
                        <Input
                            type="number"
                            value={Number(settings.reminderBeforeMinutes ?? 0)}
                            onChange={(e) => set('reminderBeforeMinutes', Number(e.target.value))}
                        />
                    </Field>
                    <label className="flex items-center gap-2">
                        <Switch
                            checked={Boolean(settings.isMandatory)}
                            onCheckedChange={(value) => set('isMandatory', Boolean(value))}
                        />
                        <span className="text-caption">Mandatory</span>
                    </label>
                    <label className="flex items-center gap-2">
                        <Switch
                            checked={Boolean(settings.autoStatusUpdate)}
                            onCheckedChange={(value) => set('autoStatusUpdate', Boolean(value))}
                        />
                        <span className="text-caption">Update status automatically</span>
                    </label>
                </div>
            );

        default:
            return null;
    }
}
