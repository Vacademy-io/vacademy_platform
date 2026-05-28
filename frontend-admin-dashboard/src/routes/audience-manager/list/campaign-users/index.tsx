import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { createFileRoute, useSearch } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { CampaignUsersTable } from '../-components/campaign-users/campaign-users-table';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { CaretLeft } from '@phosphor-icons/react';
import { useNavigate } from '@tanstack/react-router';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import { OtherTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

const CAMPAIGN_USERS_ROUTE = '/audience-manager/list/campaign-users/' as const;

const campaignUsersSearchSchema = z.object({
    campaignId: z.string().min(1, 'Campaign ID is required'),
    campaignName: z.string().optional(),
    customFields: z.string().optional(), // JSON string of custom fields
    campaignType: z.string().optional(),
});

export const Route = createFileRoute(
    // Route path uses a const sentinel; the generated route tree doesn't know it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CAMPAIGN_USERS_ROUTE as any
)({
    component: CampaignUsersPage,
    validateSearch: campaignUsersSearchSchema,
});

export function CampaignUsersPage() {
    const { setNavHeading } = useNavHeadingStore();
    const search = useSearch({ from: Route.id });
    const navigate = useNavigate();

    useEffect(() => {
        setNavHeading(`${getTerminology(OtherTerms.AudienceList, SystemTerms.AudienceList)} Users`);
    }, [setNavHeading]);

    const handleBack = () => {
        navigate({
            from: Route.id,
            // Same sentinel-route reason as the file route above.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            to: '/audience-manager/list/' as any,
        });
    };

    return (
        <LayoutContainer>
            <Helmet>
                <title>{`${getTerminology(OtherTerms.AudienceList, SystemTerms.AudienceList)} Users`}</title>
                <meta
                    name="description"
                    content={`View users enrolled in the ${getTerminology(OtherTerms.AudienceList, SystemTerms.AudienceList).toLowerCase()}.`}
                />
            </Helmet>
            <div className="flex w-full flex-col gap-6">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBack}
                    className="w-fit text-neutral-600 hover:text-neutral-900"
                >
                    <CaretLeft className="mr-1.5 size-4" />
                    {`Back to ${getTerminologyPlural(OtherTerms.AudienceList, SystemTerms.AudienceList)}`}
                </Button>
                {search.campaignId ? (
                    <CampaignUsersTable
                        campaignId={search.campaignId}
                        campaignName={search.campaignName}
                        customFieldsJson={search.customFields}
                        campaignType={search.campaignType}
                    />
                ) : (
                    <div className="flex w-full flex-col items-center justify-center gap-2 py-20">
                        <p className="text-danger-600">Campaign ID is required</p>
                    </div>
                )}
            </div>
        </LayoutContainer>
    );
}
