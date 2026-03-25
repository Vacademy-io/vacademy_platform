import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { DripConditionsSettings } from '@/types/course-settings';
import { Droplet, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DripConditionsCardProps {
    settings: DripConditionsSettings;
    onUpdate: (settings: DripConditionsSettings) => void;
}

export const DripConditionsCard: React.FC<DripConditionsCardProps> = ({ settings, onUpdate }) => {
    const handleToggleGlobal = (enabled: boolean) => {
        onUpdate({
            ...settings,
            enabled,
        });
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Droplet className="size-5 text-blue-600" />
                        <CardTitle>Drip Conditions</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="drip-global-toggle">
                            {settings.enabled ? 'Enabled' : 'Disabled'}
                        </Label>
                        <Switch
                            id="drip-global-toggle"
                            checked={settings.enabled}
                            onCheckedChange={handleToggleGlobal}
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Alert>
                    <Info className="size-4" />
                    <AlertDescription>
                        Control content dripping for courses. Manage detailed drip conditions from
                        the course details page.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    );
};
