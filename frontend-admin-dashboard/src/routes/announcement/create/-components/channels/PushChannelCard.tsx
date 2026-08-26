import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FieldError, FieldHint } from '../primitives';
import type { FieldErrors, PushConfig } from '../../-types';

const TITLE_LIMIT = 50;
const BODY_LIMIT = 150;

interface PushChannelCardProps {
    config: PushConfig;
    onChange: (patch: Partial<PushConfig>) => void;
    synced: boolean;
    onSyncedChange: (synced: boolean) => void;
    errors: FieldErrors;
    showErrors: boolean;
}

function CharacterCount({ value, limit }: { value: string; limit: number }) {
    const over = value.length > limit;
    return (
        <span
            className={cn(
                'text-caption tabular-nums',
                over ? 'text-warning-600' : 'text-muted-foreground'
            )}
        >
            {value.length}/{limit}
        </span>
    );
}

export function PushChannelCard({
    config,
    onChange,
    synced,
    onSyncedChange,
    errors,
    showErrors,
}: PushChannelCardProps) {
    const err = (key: string) => (showErrors ? errors[key] : undefined);

    return (
        <div className="space-y-4">
            <label className="flex items-center gap-2">
                <Switch
                    checked={synced}
                    onCheckedChange={(value) => onSyncedChange(Boolean(value))}
                />
                <span className="text-caption">Mirror the announcement title and content</span>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                        <Label className="text-caption font-semibold">Push title</Label>
                        <CharacterCount value={config.title} limit={TITLE_LIMIT} />
                    </div>
                    <Input
                        value={config.title}
                        onChange={(e) => onChange({ title: e.target.value })}
                        disabled={synced}
                        placeholder="Short, specific headline"
                        className={cn(err('push.title') && 'border-danger-400')}
                    />
                    <FieldError message={err('push.title')} />
                </div>
                <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                        <Label className="text-caption font-semibold">Push body</Label>
                        <CharacterCount value={config.body} limit={BODY_LIMIT} />
                    </div>
                    <Input
                        value={config.body}
                        onChange={(e) => onChange({ body: e.target.value })}
                        disabled={synced}
                        placeholder="One line of detail"
                        className={cn(err('push.body') && 'border-danger-400')}
                    />
                    <FieldError message={err('push.body')} />
                </div>
            </div>

            {synced && (
                <FieldHint>
                    Turn the switch off to write push copy that differs from the announcement.
                </FieldHint>
            )}
        </div>
    );
}
