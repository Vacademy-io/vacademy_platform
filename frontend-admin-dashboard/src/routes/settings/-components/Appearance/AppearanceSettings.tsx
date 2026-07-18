import { Suspense } from 'react';
import { Palette } from '@phosphor-icons/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import ThemeEditor from './ThemeEditor';

/**
 * Settings > Appearance — the canonical home for institute theming (brand
 * color, font, page background, accent colors, sidebar). Wraps the shared
 * ThemeEditor; the profile "Change Theme" button deep-links here so there's a
 * single implementation. `isTab` is the shared settings-tab prop (unused —
 * this card is only ever rendered inside the settings tab shell).
 */
const AppearanceSettings = ({ isTab: _isTab = true }: { isTab?: boolean }) => {
    return (
        <Card className="shadow-none">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Palette className="size-5 text-primary-500" />
                    Appearance
                </CardTitle>
                <CardDescription>
                    Brand color, font, page background, and sidebar — applied across the learner app
                    and admin dashboard.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Suspense fallback={<DashboardLoader />}>
                    <ThemeEditor />
                </Suspense>
            </CardContent>
        </Card>
    );
};

export default AppearanceSettings;
