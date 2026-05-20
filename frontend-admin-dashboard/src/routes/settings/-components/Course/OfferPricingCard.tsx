import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { OfferPricingSettings, OfferPriceRoundingMode } from '@/types/course-settings';
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

    const handleRoundingChange = (value: string) => {
        onUpdate({ ...settings, rounding: value as OfferPriceRoundingMode });
    };

    const courseTerm = getTerminology(ContentTerms.Course, SystemTerms.Course);
    const coursesTerm = getTerminologyPlural(ContentTerms.Course, SystemTerms.Course).toLowerCase();
    const rounding: OfferPriceRoundingMode = settings.rounding ?? 'NONE';

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
            <CardContent className="space-y-4">
                <Alert>
                    <Info className="size-4" />
                    <AlertDescription>
                        Allow admins to set an offer price below the MRP on individual {coursesTerm}.
                        When enabled, an "Apply Offer Price" action appears on the {courseTerm}{' '}
                        management page.
                    </AlertDescription>
                </Alert>

                {settings.enabled && (
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Offer price rounding</Label>
                        <p className="text-xs text-neutral-500">
                            Round the discounted price to a whole unit (₹1, $1, etc.). Applies to
                            the price saved when an offer is applied — regardless of currency.
                        </p>
                        <RadioGroup
                            value={rounding}
                            onValueChange={handleRoundingChange}
                            className="flex flex-col gap-2 pt-1"
                        >
                            <div className="flex items-center gap-2">
                                <RadioGroupItem value="NONE" id="offer-rounding-none" />
                                <Label
                                    htmlFor="offer-rounding-none"
                                    className="cursor-pointer font-normal"
                                >
                                    Off (keep decimals as computed)
                                </Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <RadioGroupItem value="CEIL" id="offer-rounding-ceil" />
                                <Label
                                    htmlFor="offer-rounding-ceil"
                                    className="cursor-pointer font-normal"
                                >
                                    Round up (e.g. 479.20 → 480)
                                </Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <RadioGroupItem value="FLOOR" id="offer-rounding-floor" />
                                <Label
                                    htmlFor="offer-rounding-floor"
                                    className="cursor-pointer font-normal"
                                >
                                    Round down (e.g. 479.80 → 479)
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
