import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { OfferPricingSettings } from '@/types/course-settings';
import { Tag, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import {
    ContentTerms,
    SystemTerms,
} from '@/routes/settings/-components/NamingSettings';

interface OfferPricingCardProps {
    settings: OfferPricingSettings;
    onUpdate: (settings: OfferPricingSettings) => void;
}

export const OfferPricingCard: React.FC<OfferPricingCardProps> = ({ settings, onUpdate }) => {
    const handleToggle = (enabled: boolean) => {
        onUpdate({ ...settings, enabled });
    };

    const courseTerm = getTerminology(ContentTerms.Course, SystemTerms.Course);
    const coursesTerm = getTerminologyPlural(ContentTerms.Course, SystemTerms.Course).toLowerCase();

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Tag className="size-5 text-emerald-600" />
                        <CardTitle>Offer Pricing</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="offer-pricing-toggle">
                            {settings.enabled ? 'Enabled' : 'Disabled'}
                        </Label>
                        <Switch
                            id="offer-pricing-toggle"
                            checked={settings.enabled}
                            onCheckedChange={handleToggle}
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Alert>
                    <Info className="size-4" />
                    <AlertDescription>
                        Allow admins to set an offer price below the MRP on individual {coursesTerm}.
                        When enabled, an "Apply Offer Price" action appears on the {courseTerm}{' '}
                        management page.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    );
};
