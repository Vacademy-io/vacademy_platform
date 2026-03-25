import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { createFileRoute, useSearch } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { CampaignUsersTable } from '../-components/campaign-users/campaign-users-table';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

const CAMPAIGN_USERS_ROUTE = '/audience-manager/list/campaign-users/' as const;

const campaignUsersSearchSchema = z.object({
    campaignId: z.string().min(1, 'Campaign ID is required'),
    campaignName: z.string().optional(),
    customFields: z.string().optional(), // JSON string of custom fields
});

export const Route = createFileRoute(CAMPAIGN_USERS_ROUTE as any)({
    component: CampaignUsersPage,
    validateSearch: campaignUsersSearchSchema,
});

export function CampaignUsersPage() {
    const { setNavHeading } = useNavHeadingStore();
    const search = useSearch({ from: Route.id });
    const navigate = useNavigate();

    // Debug logging
    console.log('CampaignUsersPage - search params:', search);

    useEffect(() => {
        setNavHeading('Campaign Users');
    }, []);

    const handleBack = () => {
        navigate({
            from: Route.id,
            to: '/audience-manager/list/' as any,
        });
    };

    return (
        <LayoutContainer>
            <Helmet>
                <title>Campaign Users</title>
                <meta name="description" content="View users enrolled in the campaign." />
            </Helmet>
            <div className="flex w-full flex-col gap-6">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBack}
                    className="w-fit"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Campaigns
                </Button>
                {search.campaignId ? (
                    <CampaignUsersTable
                        campaignId={search.campaignId}
                        campaignName={search.campaignName}
                        customFieldsJson={search.customFields}
                    />
                ) : (
                    <div className="flex h-[70vh] w-full flex-col items-center justify-center gap-2">
                        <p className="text-red-500">Campaign ID is required</p>
                    </div>
                )}
            </div>
        </LayoutContainer>
    );
}
