import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import type { CallLogPageSettings } from '@/types/display-settings';

interface CallLogPageCardProps {
    settings: CallLogPageSettings | undefined;
    onChange: (next: CallLogPageSettings) => void;
}

/**
 * Display Settings → Call Log.
 *
 * Note the polarity: unlike the assessment toggles beside it, everything this card
 * owns defaults to OFF, so `checked` tests `=== true` rather than `!== false`.
 */
export const CallLogPageCard = ({ settings, onChange }: CallLogPageCardProps) => {
    // Always emit the full object so no flag this card owns is dropped on save.
    const patch = (partial: Partial<CallLogPageSettings>) =>
        onChange({
            showCallQueueTab: settings?.showCallQueueTab === true,
            ...partial,
        });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Call Log</CardTitle>
                <CardDescription>
                    Extra views on the Call Log page. Off by default — turn one on to expose it to
                    this role.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                <div className="flex items-center justify-between gap-4 border-b border-border py-3.5 last:border-b-0">
                    <div>
                        <div className="text-sm font-medium text-neutral-800">
                            Show the &quot;Queue&quot; tab
                        </div>
                        <div className="mt-0.5 text-caption text-neutral-500">
                            AI calls waiting for a free line — this institute&apos;s own calls only,
                            with how long they will wait and the option to cancel them. Also shows
                            how much of the shared calling capacity is in use, which is why it is
                            off unless you want this role to see it.
                        </div>
                    </div>
                    <Switch
                        checked={settings?.showCallQueueTab === true}
                        onCheckedChange={(checked) => patch({ showCallQueueTab: checked })}
                    />
                </div>
            </CardContent>
        </Card>
    );
};

export default CallLogPageCard;
